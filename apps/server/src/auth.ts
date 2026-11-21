import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { containsBlockedText } from "@memeagotchi/game-core";

export const SESSION_COOKIE_NAME = "mg_session";
export const SESSION_TTL_MS = 30 * 24 * 3600 * 1000; // 30 days
export const PAIR_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const PAIR_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function loadOrCreateSessionSecret(dataDir?: string): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return process.env.SESSION_SECRET;
  }
  if (!dataDir) {
    return crypto.randomBytes(32).toString("hex");
  }
  fs.mkdirSync(dataDir, { recursive: true });
  const secretPath = path.join(dataDir, ".session-secret");
  if (fs.existsSync(secretPath)) {
    const existing = fs.readFileSync(secretPath, "utf-8").trim();
    if (existing.length >= 32) return existing;
  }
  const fresh = crypto.randomBytes(32).toString("hex");
  try {
    fs.writeFileSync(secretPath, fresh, { mode: 0o600 });
  } catch {
    fs.writeFileSync(secretPath, fresh);
  }
  return fresh;
}

export function validateHandle(raw: string): { ok: true; handle: string } | { ok: false; error: string } {
  const handle = raw.trim().toLowerCase().replace(/^@+/, "");
  if (handle.length < 3 || handle.length > 20) {
    return { ok: false, error: "Handle must be 3–20 characters." };
  }
  if (!/^[a-z0-9_]+$/.test(handle)) {
    return { ok: false, error: "Handle may only use letters, numbers, and underscores." };
  }
  if (handle === "default" || handle === "guest" || handle === "admin" || handle === "system") {
    return { ok: false, error: "That handle is reserved." };
  }
  if (containsBlockedText(handle)) {
    return { ok: false, error: "Handle blocked by moderation filter." };
  }
  return { ok: true, handle };
}

export function validatePassword(raw: string): { ok: true } | { ok: false; error: string } {
  if (raw.length < 6 || raw.length > 128) {
    return { ok: false, error: "Password must be 6–128 characters." };
  }
  return { ok: true };
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hashHex] = parts;
  if (!salt || !hashHex) return false;
  try {
    const expected = Buffer.from(hashHex, "hex");
    const actual = crypto.scryptSync(password, salt, expected.length);
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function signSessionToken(userId: string, secret: string, nowMs: number): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, exp: nowMs + SESSION_TTL_MS }),
    "utf-8",
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string, secret: string, nowMs: number): string | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!payload || !sig) return null;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8")) as {
      uid?: unknown;
      exp?: unknown;
    };
    if (typeof data.uid !== "string" || typeof data.exp !== "number") return null;
    if (nowMs >= data.exp) return null;
    return data.uid;
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function formatSessionCookie(token: string, maxAgeSec: number, secure: boolean): string {
  const attrs = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.max(0, Math.floor(maxAgeSec))}`,
  ];
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}

export function generatePairCode(): string {
  const bytes = crypto.randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += PAIR_ALPHABET[bytes[i]! % PAIR_ALPHABET.length]!;
  }
  return out;
}

export function generateDeviceToken(): string {
  return `mgd_${crypto.randomBytes(24).toString("base64url")}`;
}

export function hashDeviceToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}
