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
