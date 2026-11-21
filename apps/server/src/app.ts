import fs from "node:fs";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { dispatchAction, RpcError } from "@memeagotchi/rpc-sdk";
import { Actions, type ServerCtx } from "./actions.ts";
import {
  formatSessionCookie,
  hashPassword,
  loadOrCreateSessionSecret,
  parseCookies,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  signSessionToken,
  validateHandle,
  validatePassword,
  verifyPassword,
  verifySessionToken,
} from "./auth.ts";
import { DEFAULT_USER_ID, GameRepository, type UserAccount } from "./db.ts";
import { MAX_UPLOAD_BYTES, UploadStore } from "./uploads.ts";

export interface AppServerOptions {
  dbPath: string;
  uploadsDir: string;
  webDistDir?: string;
  handheldDistDir?: string;
  sessionSecret?: string;
  corsOrigin?: string;
  rateLimitMaxPerMin?: number;
  now?: () => number;
}

const STATIC_MIMES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

interface ResolvedActor {
  userId: string;
  mode: "user" | "device" | "guest";
  user: UserAccount | null;
  deviceId?: string;
  deviceName?: string;
}

async function readBody(req: IncomingMessage, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    total += buf.length;
    if (total > maxBytes) {
      throw new RpcError(413, `Payload too large (max ${Math.round(maxBytes / 1024 / 1024)} MB).`);
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

async function readJsonBody<T>(req: IncomingMessage, maxBytes = 64 * 1024): Promise<T> {
  const raw = await readBody(req, maxBytes);
  try {
    return (raw.length ? JSON.parse(raw.toString("utf-8")) : {}) as T;
  } catch {
    throw new RpcError(400, "Invalid JSON body.");
  }
}

function getClientIp(req: IncomingMessage): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.trim()) {
    return fwd.split(",")[0]!.trim();
  }
  return req.socket.remoteAddress ?? "local";
}

function isSecureRequest(req: IncomingMessage): boolean {
  const proto = req.headers["x-forwarded-proto"];
  if (typeof proto === "string" && proto.toLowerCase().includes("https")) return true;
  return Boolean((req.socket as { encrypted?: boolean }).encrypted);
}

function buildSecurityHeaders(corsOrigin?: string): Record<string, string> {
  const h: Record<string, string> = {
    "x-content-type-options": "nosniff",
    "x-frame-options": "SAMEORIGIN",
    "referrer-policy": "same-origin",
    "permissions-policy": "camera=(), geolocation=()",
  };
  if (corsOrigin) {
    h["access-control-allow-origin"] = corsOrigin;
    h["access-control-allow-credentials"] = "true";
    h["access-control-allow-headers"] = "content-type, authorization";
    h["access-control-allow-methods"] = "GET, POST, PUT, DELETE, OPTIONS";
  }
  return h;
}

function sendJson(
  res: ServerResponse,
  status: number,
  payload: unknown,
  extraHeaders?: Record<string, string>,
): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    ...extraHeaders,
  });
  res.end(body);
}

function tryServeStatic(
  res: ServerResponse,
  distDir: string | undefined,
  relPath: string,
  baseHeaders: Record<string, string>,
): boolean {
  if (!distDir || !fs.existsSync(distDir)) return false;
  const cleanRel = relPath.replace(/^\/+/, "") || "index.html";
  const resolvedRoot = path.resolve(distDir);
  let target = path.resolve(resolvedRoot, cleanRel);
  if (!target.startsWith(resolvedRoot)) return false;

  if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
    if (path.extname(cleanRel)) return false;
    target = path.join(resolvedRoot, "index.html");
    if (!fs.existsSync(target)) return false;
  }

  const ext = path.extname(target).toLowerCase();
  const mime = STATIC_MIMES[ext] ?? "application/octet-stream";
  const isHashedAsset = cleanRel.startsWith("assets/");
  res.writeHead(200, {
    ...baseHeaders,
    "content-type": mime,
    "cache-control": isHashedAsset ? "public, max-age=31536000, immutable" : "no-cache",
  });
  fs.createReadStream(target).pipe(res);
  return true;
}

export function createAppServer(options: AppServerOptions) {
  const repo = new GameRepository(options.dbPath);
  const uploads = new UploadStore(options.uploadsDir);
  const now = options.now ?? (() => Date.now());
  const startedAt = now();
  const sessionSecret =
    options.sessionSecret ??
    loadOrCreateSessionSecret(options.dbPath === ":memory:" ? undefined : path.dirname(options.dbPath));
  const corsOrigin = options.corsOrigin ?? process.env.CORS_ORIGIN ?? undefined;
  const baseHeaders = buildSecurityHeaders(corsOrigin);

  // Simple sliding-window per-IP rate limiter
  const rateBuckets = new Map<string, { count: number; resetAt: number }>();
  const defaultLimit = options.rateLimitMaxPerMin ?? 240;

  const checkRateLimit = (ip: string, bucket: string, limit: number): boolean => {
    if (limit <= 0) return true;
    const t = now();
    const key = `${bucket}:${ip}`;
    const cur = rateBuckets.get(key);
    if (!cur || t >= cur.resetAt) {
      rateBuckets.set(key, { count: 1, resetAt: t + 60_000 });
      return true;
    }
    if (cur.count >= limit) return false;
    cur.count += 1;
    return true;
  };

  // Real-time Server-Sent Events (SSE) live sync hub per userId
  const sseClients = new Map<string, Set<ServerResponse>>();
  const addSseClient = (userId: string, res: ServerResponse) => {
    let set = sseClients.get(userId);
    if (!set) {
      set = new Set();
      sseClients.set(userId, set);
    }
    set.add(res);
  };
  const removeSseClient = (userId: string, res: ServerResponse) => {
    const set = sseClients.get(userId);
    if (!set) return;
    set.delete(res);
    if (set.size === 0) sseClients.delete(userId);
  };
  const countSseClients = (): number => {
    let n = 0;
    for (const set of sseClients.values()) n += set.size;
    return n;
  };
  const broadcastToUser = (userId: string, eventName: string, payload: unknown) => {
    const set = sseClients.get(userId);
    if (!set || set.size === 0) return;
    const msg = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of set) {
      try {
        client.write(msg);
      } catch {
        set.delete(client);
      }
    }
  };
  const broadcastGlobal = (eventName: string, payload: unknown) => {
    const msg = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const set of sseClients.values()) {
      for (const client of set) {
        try {
          client.write(msg);
        } catch {
          set.delete(client);
        }
      }
    }
  };

  const sseHeartbeat = setInterval(() => {
    for (const set of sseClients.values()) {
      for (const client of set) {
        try {
          client.write(": ping\n\n");
        } catch {
          set.delete(client);
        }
      }
    }
  }, 25_000);
  sseHeartbeat.unref?.();

  const resolveActor = (req: IncomingMessage, url: URL): ResolvedActor => {
    const t = now();

    // 1. Handheld / ESP32-S3 Bearer Device Token (or query param for EventSource)
    const authHeader = req.headers.authorization;
    const bearer =
      typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ")
        ? authHeader.slice(7).trim()
        : (url.searchParams.get("deviceToken")?.trim() ?? "");

    if (bearer) {
      const dev = repo.authenticateDeviceToken(bearer, t);
      if (!dev) {
        throw new RpcError(401, "Device token invalid or revoked. Please re-pair your handheld.");
      }
      const user = dev.userId === DEFAULT_USER_ID ? null : repo.getUserById(dev.userId);
      return {
        userId: dev.userId,
        mode: "device",
        user,
        deviceId: dev.deviceId,
        deviceName: dev.deviceName,
      };
    }

    // 2. Signed HttpOnly Session Cookie
    const cookies = parseCookies(req.headers.cookie);
    const rawSession = cookies[SESSION_COOKIE_NAME];
    if (rawSession) {
      const uid = verifySessionToken(rawSession, sessionSecret, t);
      if (uid) {
        const user = repo.getUserById(uid);
        if (user) {
          return { userId: user.id, mode: "user", user };
        }
      }
    }

    // 3. Zero-friction Guest / Local Default
    return { userId: DEFAULT_USER_ID, mode: "guest", user: null };
  };

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      const pathname = url.pathname;
      const ip = getClientIp(req);

      // CORS preflight
      if (req.method === "OPTIONS") {
        res.writeHead(204, baseHeaders);
        res.end();
        return;
      }

      // Health check endpoint (Railway / Render / Fly.io / Docker)
      if (req.method === "GET" && pathname === "/api/health") {
        sendJson(
          res,
          200,
          {
            ok: true,
            service: "memeagotchi",
            version: "1.2.0",
            uptimeSec: Math.max(0, Math.floor((now() - startedAt) / 1000)),
            accounts: repo.countUsers(),
            activeStreams: countSseClients(),
            now: now(),
          },
          baseHeaders,
        );
        return;
      }

      /* ==================== Auth Endpoints ==================== */

      if (req.method === "GET" && pathname === "/api/auth/me") {
        const actor = resolveActor(req, url);
        sendJson(
          res,
          200,
          {
            ok: true,
            actor: {
              userId: actor.userId,
              mode: actor.mode,
              user: actor.user,
              deviceId: actor.deviceId ?? null,
              deviceName: actor.deviceName ?? null,
            },
            pairedDevices: repo.listPairedDevices(actor.userId),
          },
          baseHeaders,
        );
        return;
      }

      if (req.method === "POST" && pathname === "/api/auth/register") {
        if (!checkRateLimit(ip, "auth", 30)) {
          throw new RpcError(429, "Too many auth requests. Please wait a minute.");
        }
        const body = await readJsonBody<{ handle?: string; password?: string; displayName?: string }>(req);
        const hCheck = validateHandle(String(body.handle ?? ""));
        if (!hCheck.ok) throw new RpcError(400, hCheck.error);
        const pCheck = validatePassword(String(body.password ?? ""));
        if (!pCheck.ok) throw new RpcError(400, pCheck.error);

        if (repo.findUserForLogin(hCheck.handle)) {
          throw new RpcError(409, `Handle @${hCheck.handle} is already taken.`);
        }
        const t = now();
        const displayName = String(body.displayName ?? "").trim().slice(0, 28) || hCheck.handle;
        const user = repo.createUser(hCheck.handle, displayName, hashPassword(String(body.password)), t);
        const token = signSessionToken(user.id, sessionSecret, t);
        sendJson(
          res,
          201,
          { ok: true, user },
          {
            ...baseHeaders,
            "set-cookie": formatSessionCookie(token, SESSION_TTL_MS / 1000, isSecureRequest(req)),
          },
        );
        return;
      }

      if (req.method === "POST" && pathname === "/api/auth/login") {
        if (!checkRateLimit(ip, "auth", 30)) {
          throw new RpcError(429, "Too many login attempts. Please wait a minute.");
        }
        const body = await readJsonBody<{ handle?: string; password?: string }>(req);
        const handle = String(body.handle ?? "").trim().toLowerCase().replace(/^@+/, "");
        const password = String(body.password ?? "");
        const found = repo.findUserForLogin(handle);
        if (!found || !verifyPassword(password, found.passwordHash)) {
          throw new RpcError(401, "Invalid handle or password.");
        }
        const t = now();
        const token = signSessionToken(found.id, sessionSecret, t);
        const user: UserAccount = {
          id: found.id,
          handle: found.handle,
          displayName: found.displayName,
          createdAt: found.createdAt,
        };
        sendJson(
          res,
          200,
          { ok: true, user },
          {
            ...baseHeaders,
            "set-cookie": formatSessionCookie(token, SESSION_TTL_MS / 1000, isSecureRequest(req)),
          },
        );
        return;
      }

      if (req.method === "POST" && pathname === "/api/auth/logout") {
        sendJson(
          res,
          200,
          { ok: true },
          {
            ...baseHeaders,
            "set-cookie": formatSessionCookie("", 0, isSecureRequest(req)),
          },
        );
        return;
      }

      /* ==================== 6-Character Handheld Device Pairing ==================== */

      if (req.method === "POST" && pathname === "/api/devices/pair-code") {
        const actor = resolveActor(req, url);
        const pair = repo.createPairCode(actor.userId, now());
        sendJson(res, 200, { ok: true, code: pair.code, expiresAt: pair.expiresAt }, baseHeaders);
        return;
      }

      if (req.method === "POST" && pathname === "/api/devices/claim") {
        if (!checkRateLimit(ip, "pair", 30)) {
          throw new RpcError(429, "Too many pairing attempts. Please wait a minute.");
        }
        const body = await readJsonBody<{ code?: string; deviceName?: string }>(req);
        const claimed = repo.claimPairCode(
          String(body.code ?? ""),
          String(body.deviceName ?? "MemeAgotchi-320"),
          now(),
        );
        if (!claimed) {
          throw new RpcError(400, "Invalid or expired 6-character pairing code.");
        }
        broadcastToUser(claimed.userId, "device_paired", { deviceId: claimed.deviceId, at: now() });
        sendJson(
          res,
          200,
          {
            ok: true,
            deviceId: claimed.deviceId,
            deviceToken: claimed.deviceToken,
            accountHandle: claimed.accountHandle,
          },
          baseHeaders,
        );
        return;
      }

      if (req.method === "DELETE" && pathname.startsWith("/api/devices/")) {
        const actor = resolveActor(req, url);
        const deviceId = decodeURIComponent(pathname.slice("/api/devices/".length));
        const revoked = repo.revokePairedDevice(actor.userId, deviceId);
        sendJson(res, 200, { ok: true, revoked }, baseHeaders);
        return;
      }

      /* ==================== Online Global Leaderboard ==================== */

      if (req.method === "GET" && pathname === "/api/leaderboard") {
        const actor = resolveActor(req, url);
        sendJson(
          res,
          200,
          {
            ok: true,
            entries: repo.getLeaderboard(now()),
            currentUserId: actor.userId,
          },
          baseHeaders,
        );
        return;
      }

      /* ==================== Cloud-Synced Ember Vale RPG Saves ==================== */

      if (req.method === "GET" && pathname === "/api/ember-save") {
        const actor = resolveActor(req, url);
        const saved = repo.getEmberSave(actor.userId);
        sendJson(res, 200, { ok: true, ...saved }, baseHeaders);
        return;
      }

      if (req.method === "PUT" && pathname === "/api/ember-save") {
        if (!checkRateLimit(ip, "ember", 120)) {
          throw new RpcError(429, "Too many save sync requests. Slow down a bit.");
        }
        const actor = resolveActor(req, url);
        const body = await readJsonBody<{ files?: Record<string, unknown> }>(req, 96 * 1024);
        if (!body.files || typeof body.files !== "object") {
          throw new RpcError(400, "Missing files map.");
        }
        const t = now();
        const saved = repo.putEmberSave(actor.userId, body.files, t);
        broadcastToUser(actor.userId, "ember_save_updated", { updatedAt: t });
        sendJson(res, 200, { ok: true, ...saved }, baseHeaders);
        return;
      }

      if (req.method === "DELETE" && pathname === "/api/ember-save") {
        const actor = resolveActor(req, url);
        repo.deleteEmberSave(actor.userId);
        broadcastToUser(actor.userId, "ember_save_updated", { updatedAt: now(), cleared: true });
        sendJson(res, 200, { ok: true }, baseHeaders);
        return;
      }

      /* ==================== Social Visits: Friend Profile, Cheer & Meme Gifts ==================== */

      if (pathname.startsWith("/api/players/")) {
        const parts = pathname.slice("/api/players/".length).split("/").filter(Boolean);
        const targetUserId = parts[0] ? decodeURIComponent(parts[0]) : "";
        const subAction = parts[1] ?? "";

        if (req.method === "GET" && targetUserId && !subAction) {
          const actor = resolveActor(req, url);
          const profile = repo.getPlayerProfile(targetUserId, actor.userId, now());
          if (!profile) throw new RpcError(404, "Trainer profile not found.");
          sendJson(res, 200, { ok: true, profile }, baseHeaders);
          return;
        }

        if (req.method === "POST" && targetUserId && subAction === "cheer") {
          if (!checkRateLimit(ip, "social", 60)) {
            throw new RpcError(429, "Too many social visits. Try again in a moment.");
          }
          const actor = resolveActor(req, url);
          const t = now();
          const result = repo.cheerPlayer(actor.userId, targetUserId, t);
          if (!result.ok) throw new RpcError(400, result.message);
          broadcastToUser(targetUserId, "state_updated", { action: "social_cheer", at: t });
          broadcastToUser(actor.userId, "state_updated", { action: "social_cheer", at: t });
          sendJson(res, 200, result, baseHeaders);
          return;
        }

        if (req.method === "POST" && targetUserId && subAction === "gift-meme") {
          if (!checkRateLimit(ip, "social", 60)) {
            throw new RpcError(429, "Too many gift requests. Try again in a moment.");
          }
          const actor = resolveActor(req, url);
          const body = await readJsonBody<{ memeId?: number; note?: string }>(req);
          const memeId = Number(body.memeId);
          if (!Number.isInteger(memeId) || memeId <= 0) {
            throw new RpcError(400, "Please choose a valid meme to gift.");
          }
          const t = now();
          const result = repo.giftMemeToPlayer(actor.userId, targetUserId, memeId, String(body.note ?? ""), t);
          if (!result.ok) throw new RpcError(400, result.message);
          broadcastToUser(targetUserId, "state_updated", { action: "social_gift", at: t });
          broadcastToUser(actor.userId, "state_updated", { action: "social_gift", at: t });
          sendJson(res, 200, result, baseHeaders);
          return;
        }
      }

      /* ==================== Real-Time SSE Live Sync Stream ==================== */

      if (req.method === "GET" && pathname === "/api/events") {
        const actor = resolveActor(req, url);
        res.writeHead(200, {
          ...baseHeaders,
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache, no-transform",
          connection: "keep-alive",
        });
        addSseClient(actor.userId, res);
        res.write(
          `event: connected\ndata: ${JSON.stringify({ userId: actor.userId, mode: actor.mode, at: now() })}\n\n`,
        );
        req.on("close", () => removeSseClient(actor.userId, res));
        return;
      }

      /* ==================== Unified Typed RPC Actions ==================== */

      if (req.method === "POST" && pathname === "/api/actions") {
        if (!checkRateLimit(ip, "actions", defaultLimit)) {
          throw new RpcError(429, "Rate limit exceeded. Slow down a touch!");
        }
        const actor = resolveActor(req, url);
        const parsed = await readJsonBody<{ action?: unknown; args?: unknown }>(req, 512 * 1024);
        if (typeof parsed.action !== "string") {
          sendJson(res, 400, { ok: false, error: "Missing action name." }, baseHeaders);
          return;
        }
        const ctx: ServerCtx = {
          repo: repo.forUser(actor.userId),
          uploads,
          now,
        };
        const result = await dispatchAction(Actions, ctx, parsed.action, parsed.args);
        if (parsed.action !== "getState") {
          broadcastToUser(actor.userId, "state_updated", { action: parsed.action, at: now() });
          if (parsed.action === "postMeme" || parsed.action === "voteMeme" || parsed.action === "shareMeme") {
            broadcastGlobal("network_updated", { action: parsed.action, at: now() });
          }
        }
        sendJson(res, 200, { ok: true, result }, baseHeaders);
        return;
      }

      /* ==================== Image Upload & Safe Serving ==================== */

      if (req.method === "POST" && pathname === "/api/upload") {
        if (!checkRateLimit(ip, "upload", 30)) {
          throw new RpcError(429, "Too many uploads. Please wait a minute.");
        }
        const raw = await readBody(req, MAX_UPLOAD_BYTES + 1024);
        const saved = uploads.saveBuffer(raw);
        sendJson(res, 200, { ok: true, imageUrl: saved.imageUrl, mime: saved.mime }, baseHeaders);
        return;
      }

      if (req.method === "GET" && pathname.startsWith("/uploads/")) {
        let fileName: string;
        try {
          fileName = decodeURIComponent(pathname.slice("/uploads/".length));
        } catch {
          sendJson(res, 400, { ok: false, error: "Malformed upload path." }, baseHeaders);
          return;
        }
        const found = uploads.resolveSafeFile(fileName);
        if (!found) {
          sendJson(res, 404, { ok: false, error: "Upload not found." }, baseHeaders);
          return;
        }
        res.writeHead(200, {
          ...baseHeaders,
          "content-type": found.mime,
          "cache-control": "public, max-age=31536000, immutable",
        });
        fs.createReadStream(found.fullPath).pipe(res);
        return;
      }

      /* ==================== Static Frontend Hosting ==================== */

      if (req.method === "GET" && (pathname === "/handheld" || pathname.startsWith("/handheld/"))) {
        if (pathname === "/handheld") {
          res.writeHead(302, { location: "/handheld/" });
          res.end();
          return;
        }
        const rel = pathname.slice("/handheld/".length);
        if (tryServeStatic(res, options.handheldDistDir, rel, baseHeaders)) return;
      }

      if (req.method === "GET") {
        if (tryServeStatic(res, options.webDistDir, pathname, baseHeaders)) return;
      }

      sendJson(res, 404, { ok: false, error: "Not found." }, baseHeaders);
    } catch (err) {
      if (err instanceof RpcError) {
        sendJson(res, err.status, { ok: false, error: err.message }, baseHeaders);
        return;
      }
      const message = err instanceof Error ? err.message : "Internal server error";
      sendJson(res, 400, { ok: false, error: message }, baseHeaders);
    }
  });

  return {
    server,
    close: () =>
      new Promise<void>((resolve) => {
        clearInterval(sseHeartbeat);
        for (const set of sseClients.values()) {
          for (const client of set) {
            try {
              client.end();
            } catch {
              /* ignore */
            }
          }
          set.clear();
        }
        sseClients.clear();
        server.close(() => {
          repo.close();
          resolve();
        });
      }),
  };
}
