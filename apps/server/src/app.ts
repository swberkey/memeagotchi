import fs from "node:fs";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { dispatchAction, RpcError } from "@memeagotchi/rpc-sdk";
import { Actions, type ServerCtx } from "./actions.ts";
import { GameRepository } from "./db.ts";
import { MAX_UPLOAD_BYTES, UploadStore } from "./uploads.ts";

export interface AppServerOptions {
  dbPath: string;
  uploadsDir: string;
  webDistDir?: string;
  handheldDistDir?: string;
  now?: () => number;
}

const STATIC_MIMES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

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

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff",
    "referrer-policy": "same-origin",
  });
  res.end(body);
}

function tryServeStatic(res: ServerResponse, distDir: string | undefined, relPath: string): boolean {
  if (!distDir || !fs.existsSync(distDir)) return false;
  const cleanRel = relPath.replace(/^\/+/, "") || "index.html";
  const resolvedRoot = path.resolve(distDir);
  let target = path.resolve(resolvedRoot, cleanRel);
  if (!target.startsWith(resolvedRoot)) return false;

  if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
    // SPA fallback for client routes without a file extension
    if (path.extname(cleanRel)) return false;
    target = path.join(resolvedRoot, "index.html");
    if (!fs.existsSync(target)) return false;
  }

  const ext = path.extname(target).toLowerCase();
  const mime = STATIC_MIMES[ext] ?? "application/octet-stream";
  const isHashedAsset = cleanRel.startsWith("assets/");
  res.writeHead(200, {
    "content-type": mime,
    "x-content-type-options": "nosniff",
    "cache-control": isHashedAsset ? "public, max-age=31536000, immutable" : "no-cache",
  });
  fs.createReadStream(target).pipe(res);
  return true;
}

export function createAppServer(options: AppServerOptions) {
  const repo = new GameRepository(options.dbPath);
  const uploads = new UploadStore(options.uploadsDir);
  const ctx: ServerCtx = {
    repo,
    uploads,
    now: options.now ?? (() => Date.now()),
  };

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      const pathname = url.pathname;

      // Health endpoint
      if (req.method === "GET" && pathname === "/api/health") {
        sendJson(res, 200, { ok: true, service: "memeagotchi", now: ctx.now() });
        return;
      }

      // Unified typed RPC actions endpoint
      if (req.method === "POST" && pathname === "/api/actions") {
        const raw = await readBody(req, 512 * 1024);
        let parsed: { action?: unknown; args?: unknown };
        try {
          parsed = JSON.parse(raw.toString("utf-8")) as { action?: unknown; args?: unknown };
        } catch {
          sendJson(res, 400, { ok: false, error: "Invalid JSON body." });
          return;
        }
        if (typeof parsed.action !== "string") {
          sendJson(res, 400, { ok: false, error: "Missing action name." });
          return;
        }
        const result = await dispatchAction(Actions, ctx, parsed.action, parsed.args);
        sendJson(res, 200, { ok: true, result });
        return;
      }

      // GDD Decision #5: Direct file upload endpoint (<= 5 MB, magic-byte validated)
      if (req.method === "POST" && pathname === "/api/upload") {
        const raw = await readBody(req, MAX_UPLOAD_BYTES + 1024);
        const saved = uploads.saveBuffer(raw);
        sendJson(res, 200, { ok: true, imageUrl: saved.imageUrl, mime: saved.mime });
        return;
      }

      // Serve uploaded images safely
      if (req.method === "GET" && pathname.startsWith("/uploads/")) {
        let fileName: string;
        try {
          fileName = decodeURIComponent(pathname.slice("/uploads/".length));
        } catch {
          sendJson(res, 400, { ok: false, error: "Malformed upload path." });
          return;
        }
        const found = uploads.resolveSafeFile(fileName);
        if (!found) {
          sendJson(res, 404, { ok: false, error: "Upload not found." });
          return;
        }
        res.writeHead(200, {
          "content-type": found.mime,
          "x-content-type-options": "nosniff",
          "cache-control": "public, max-age=31536000, immutable",
        });
        fs.createReadStream(found.fullPath).pipe(res);
        return;
      }

      // Production static hosting: Handheld Simulator at /handheld/*
      if (req.method === "GET" && (pathname === "/handheld" || pathname.startsWith("/handheld/"))) {
        if (pathname === "/handheld") {
          res.writeHead(302, { location: "/handheld/" });
          res.end();
          return;
        }
        const rel = pathname.slice("/handheld/".length);
        if (tryServeStatic(res, options.handheldDistDir, rel)) return;
      }

      // Production static hosting: Web Companion at /*
      if (req.method === "GET") {
        if (tryServeStatic(res, options.webDistDir, pathname)) return;
      }

      sendJson(res, 404, { ok: false, error: "Not found." });
    } catch (err) {
      if (err instanceof RpcError) {
        sendJson(res, err.status, { ok: false, error: err.message });
        return;
      }
      const message = err instanceof Error ? err.message : "Internal server error";
      sendJson(res, 400, { ok: false, error: message });
    }
  });

  return {
    server,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          repo.close();
          resolve();
        });
      }),
  };
}
