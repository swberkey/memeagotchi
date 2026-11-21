import type { HighScoreEntry, MiniGameId, SpeciesId } from "@memeagotchi/game-core";
import { createActionClient, type ApiRequest, type ApiResponse } from "@memeagotchi/rpc-sdk/client";
import type { Actions } from "@memeagotchi/server/actions";

export const api = createActionClient<typeof Actions>("/api/actions");
export type { ApiRequest, ApiResponse };

export interface AuthUser {
  id: string;
  handle: string;
  displayName: string;
  createdAt: number;
}

export interface PairedDevice {
  id: string;
  deviceName: string;
  createdAt: number;
  lastSeenAt: number;
}

export interface AuthMeResponse {
  ok: boolean;
  actor: {
    userId: string;
    mode: "user" | "device" | "guest";
    user: AuthUser | null;
    deviceId: string | null;
    deviceName: string | null;
  };
  pairedDevices: PairedDevice[];
}

export interface LeaderboardEntry {
  userId: string;
  handle: string;
  displayName: string;
  petName: string;
  species: SpeciesId;
  stage: number;
  stageName: string;
  xp: number;
  drip: number;
  careStreak: number;
  digestedCount: number;
  highScores: Record<MiniGameId, HighScoreEntry>;
}

async function jsonReq<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "same-origin",
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json()) as T & { ok?: boolean; error?: string };
  if (!res.ok || data.ok === false) {
    throw new Error(data.error ?? `Request failed (${res.status})`);
  }
  return data;
}

export function fetchAuthMe(): Promise<AuthMeResponse> {
  return jsonReq<AuthMeResponse>("/api/auth/me");
}

export function authRegister(args: { handle: string; password: string; displayName?: string }): Promise<{ ok: true; user: AuthUser }> {
  return jsonReq("/api/auth/register", { method: "POST", body: JSON.stringify(args) });
}

export function authLogin(args: { handle: string; password: string }): Promise<{ ok: true; user: AuthUser }> {
  return jsonReq("/api/auth/login", { method: "POST", body: JSON.stringify(args) });
}

export function authLogout(): Promise<{ ok: true }> {
  return jsonReq("/api/auth/logout", { method: "POST", body: "{}" });
}

export function createDevicePairCode(): Promise<{ ok: true; code: string; expiresAt: number }> {
  return jsonReq("/api/devices/pair-code", { method: "POST", body: "{}" });
}

export function revokePairedDevice(deviceId: string): Promise<{ ok: true; revoked: boolean }> {
  return jsonReq(`/api/devices/${encodeURIComponent(deviceId)}`, { method: "DELETE" });
}

export function fetchLeaderboard(): Promise<{ ok: true; entries: LeaderboardEntry[]; currentUserId: string }> {
  return jsonReq("/api/leaderboard");
}

export async function uploadMemeFile(file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Image must be 5 MB or smaller (GDD limit).");
  }
  const bytes = await file.arrayBuffer();
  const res = await fetch("/api/upload", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": file.type || "application/octet-stream" },
    body: bytes,
  });
  const data = (await res.json()) as { ok?: boolean; imageUrl?: string; error?: string };
  if (!res.ok || !data.ok || !data.imageUrl) {
    throw new Error(data.error ?? "Upload failed.");
  }
  return data.imageUrl;
}
