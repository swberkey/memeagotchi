import { createActionClient, type ApiRequest, type ApiResponse } from "@memeagotchi/rpc-sdk/client";
import type { Actions } from "@memeagotchi/server/actions";

const STORAGE_KEY = "mg_handheld_device_v1";

export interface StoredPairedDevice {
  deviceId: string;
  deviceToken: string;
  accountHandle: string;
}

export function getPairedDevice(): StoredPairedDevice | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredPairedDevice>;
    if (parsed.deviceId && parsed.deviceToken && parsed.accountHandle) {
      return {
        deviceId: parsed.deviceId,
        deviceToken: parsed.deviceToken,
        accountHandle: parsed.accountHandle,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function savePairedDevice(dev: StoredPairedDevice): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dev));
  } catch {
    /* ignore storage quota */
  }
}

export function clearPairedDevice(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export const api = createActionClient<typeof Actions>("/api/actions", {
  getHeaders: (): Record<string, string> => {
    const dev = getPairedDevice();
    if (!dev) return {};
    return { authorization: `Bearer ${dev.deviceToken}` };
  },
});

export type { ApiRequest, ApiResponse };

export async function claimPairCode(
  code: string,
  deviceName = "MemeAgotchi-320 Sim",
): Promise<StoredPairedDevice> {
  const res = await fetch("/api/devices/claim", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, deviceName }),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    deviceId?: string;
    deviceToken?: string;
    accountHandle?: string;
    error?: string;
  };
  if (!res.ok || !data.ok || !data.deviceId || !data.deviceToken || !data.accountHandle) {
    throw new Error(data.error ?? `Pairing failed (${res.status})`);
  }
  const paired: StoredPairedDevice = {
    deviceId: data.deviceId,
    deviceToken: data.deviceToken,
    accountHandle: data.accountHandle,
  };
  savePairedDevice(paired);
  return paired;
}

function deviceAuthHeaders(): Record<string, string> {
  const dev = getPairedDevice();
  return dev ? { authorization: `Bearer ${dev.deviceToken}` } : {};
}

export async function fetchEmberCloudSave(): Promise<{ files: Record<string, string>; updatedAt: number | null }> {
  const res = await fetch("/api/ember-save", {
    credentials: "same-origin",
    headers: deviceAuthHeaders(),
  });
  const data = (await res.json()) as { ok?: boolean; files?: Record<string, string>; updatedAt?: number | null };
  if (!res.ok || data.ok === false) throw new Error("Failed to fetch cloud Ember Vale save");
  return { files: data.files ?? {}, updatedAt: data.updatedAt ?? null };
}

export async function pushEmberCloudSave(files: Record<string, string>): Promise<void> {
  const res = await fetch("/api/ember-save", {
    method: "PUT",
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...deviceAuthHeaders() },
    body: JSON.stringify({ files }),
  });
  if (!res.ok) throw new Error("Failed to sync Ember Vale save");
}

export async function clearEmberCloudSave(): Promise<void> {
  const res = await fetch("/api/ember-save", {
    method: "DELETE",
    credentials: "same-origin",
    headers: deviceAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to clear cloud Ember Vale save");
}
