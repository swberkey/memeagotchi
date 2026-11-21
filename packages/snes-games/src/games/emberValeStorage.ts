const STORAGE_PREFIX = "mg_ev:";
const FILE_NAMES = ["save.dat", "wallet.json", "status.json"] as const;

const memoryFallback: Record<string, string> = {};
const listeners = new Set<() => void>();

export interface EmberCloudSyncAdapter {
  push: (files: Record<string, string>) => Promise<void>;
  clear: () => Promise<void>;
}

let cloudAdapter: EmberCloudSyncAdapter | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let cloudSyncStatus: "local" | "syncing" | "synced" | "error" = "local";

export function getEmberCloudStatus(): "local" | "syncing" | "synced" | "error" {
  return cloudSyncStatus;
}

export function configureEmberCloudSync(adapter: EmberCloudSyncAdapter | null): void {
  cloudAdapter = adapter;
  if (!adapter) {
    cloudSyncStatus = "local";
    notify();
  }
}

function scheduleCloudPush(): void {
  if (!cloudAdapter) return;
  if (pushTimer) clearTimeout(pushTimer);
  cloudSyncStatus = "syncing";
  notify();
  pushTimer = setTimeout(() => {
    pushTimer = null;
    if (!cloudAdapter) return;
    const files = exportEmberFilesBase64();
    void cloudAdapter
      .push(files)
      .then(() => {
        cloudSyncStatus = "synced";
        notify();
      })
      .catch(() => {
        cloudSyncStatus = "error";
        notify();
      });
  }, 350);
}

export function exportEmberFilesBase64(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of FILE_NAMES) {
    const raw = lsGet(STORAGE_PREFIX + name);
    if (raw != null) out[name] = raw;
  }
  return out;
}

export function importEmberFilesBase64(files: Record<string, string>, replace = true): void {
  if (replace) {
    for (const name of FILE_NAMES) {
      if (!(name in files)) lsDel(STORAGE_PREFIX + name);
    }
  }
  for (const name of FILE_NAMES) {
    const val = files[name];
    if (typeof val === "string" && val.length > 0) {
      lsSet(STORAGE_PREFIX + name, val);
    }
  }
  cloudSyncStatus = "synced";
  notify();
}

export async function hydrateEmberFromCloud(
  fetchCloud: () => Promise<{ files: Record<string, string>; updatedAt: number | null }>,
): Promise<boolean> {
  try {
    cloudSyncStatus = "syncing";
    notify();
    const remote = await fetchCloud();
    const hasRemote = Object.keys(remote.files).length > 0;
    if (hasRemote) {
      importEmberFilesBase64(remote.files, true);
      return true;
    }
    // If cloud is empty but this browser already has a local Ember Vale save, seed the cloud!
    const local = exportEmberFilesBase64();
    if (Object.keys(local).length > 0 && cloudAdapter) {
      await cloudAdapter.push(local);
    }
    cloudSyncStatus = "synced";
    notify();
    return false;
  } catch {
    cloudSyncStatus = "error";
    notify();
    return false;
  }
}

function notify(): void {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* ignore subscriber errors */
    }
  }
}

export function subscribeEmberStorage(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function lsGet(key: string): string | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage.getItem(key) : (memoryFallback[key] ?? null);
  } catch {
    return memoryFallback[key] ?? null;
  }
}

function lsSet(key: string, value: string): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
    else memoryFallback[key] = value;
  } catch {
    memoryFallback[key] = value;
  }
}

function lsDel(key: string): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
  delete memoryFallback[key];
}

function toBase64(u8: Uint8Array): string {
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]!);
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
}

export function readEmberFile(name: string): Uint8Array | null {
  const raw = lsGet(STORAGE_PREFIX + name);
  if (raw == null) return null;
  try {
    return fromBase64(raw);
  } catch {
    return null;
  }
}

export function writeEmberFile(name: string, u8: Uint8Array): number {
  lsSet(STORAGE_PREFIX + name, toBase64(u8));
  notify();
  scheduleCloudPush();
  return 0;
}

export interface EmberWallet {
  coins: number;
  lifetimeCoins: number;
}

export interface EmberStatus {
  hearts: number;
  crystals: number;
  complete: boolean;
  playSeconds: number;
  deaths: number;
  items: {
    bombs: boolean;
    bow: boolean;
    boomerang: boolean;
  };
}

export interface EmberSnapshot {
  hasSave: boolean;
  wallet: EmberWallet;
  status: EmberStatus;
}

export function getEmberSnapshot(): EmberSnapshot {
  const hasSave = readEmberFile("save.dat") !== null;
  let wallet: EmberWallet = { coins: 0, lifetimeCoins: 0 };
  let status: EmberStatus = {
    hearts: 3,
    crystals: 0,
    complete: false,
    playSeconds: 0,
    deaths: 0,
    items: { bombs: false, bow: false, boomerang: false },
  };

  const wBytes = readEmberFile("wallet.json");
  if (wBytes) {
    try {
      const parsed = JSON.parse(new TextDecoder().decode(wBytes)) as {
        coins?: number;
        lifetime_coins?: number;
      };
      wallet = {
        coins: Math.max(0, Math.floor(parsed.coins ?? 0)),
        lifetimeCoins: Math.max(0, Math.floor(parsed.lifetime_coins ?? 0)),
      };
    } catch {
      /* ignore corrupt json */
    }
  }

  const sBytes = readEmberFile("status.json");
  if (sBytes) {
    try {
      const parsed = JSON.parse(new TextDecoder().decode(sBytes)) as {
        hearts?: number;
        crystals?: number;
        complete?: boolean | number;
        play_seconds?: number;
        deaths?: number;
        items?: { bombs?: boolean; bow?: boolean; boomerang?: boolean };
      };
      status = {
        hearts: Math.max(3, Math.floor(parsed.hearts ?? 3)),
        crystals: Math.max(0, Math.floor(parsed.crystals ?? 0)),
        complete: Boolean(parsed.complete),
        playSeconds: Math.max(0, Math.floor(parsed.play_seconds ?? 0)),
        deaths: Math.max(0, Math.floor(parsed.deaths ?? 0)),
        items: {
          bombs: Boolean(parsed.items?.bombs),
          bow: Boolean(parsed.items?.bow),
          boomerang: Boolean(parsed.items?.boomerang),
        },
      };
    } catch {
      /* ignore corrupt json */
    }
  }

  return { hasSave, wallet, status };
}

/**
 * Computes a deterministic Quest Score (0..9999) from Ember Vale adventure
 * progress (coins, Sun/Moon crystals, heart containers, dungeon items, ending).
 */
export function computeEmberQuestScore(snap: EmberSnapshot): { score: number; maxCombo: number } {
  const itemCount =
    (snap.status.items.boomerang ? 1 : 0) +
    (snap.status.items.bombs ? 1 : 0) +
    (snap.status.items.bow ? 1 : 0);
  const raw =
    snap.wallet.lifetimeCoins * 6 +
    snap.status.crystals * 350 +
    Math.max(0, snap.status.hearts - 3) * 100 +
    itemCount * 90 +
    (snap.status.complete ? 800 : 0);
  return {
    score: Math.min(9999, Math.max(25, raw)),
    maxCombo: Math.min(999, Math.max(snap.wallet.lifetimeCoins, snap.status.crystals * 50 + itemCount * 10)),
  };
}

/**
 * Host cash-out protocol matching Ember Vale's ESP32-S3 host contract:
 * reads wallet.json, converts unspent coins into a MemeAgotchi score payload,
 * and zeroes wallet.coins while preserving lifetime_coins & save.dat.
 */
export function cashOutEmberWallet(): { cashedCoins: number; score: number; maxCombo: number } {
  const snap = getEmberSnapshot();
  const cashedCoins = snap.wallet.coins;
  if (cashedCoins <= 0) {
    return { cashedCoins: 0, score: 0, maxCombo: 0 };
  }
  const updated = JSON.stringify({
    coins: 0,
    lifetime_coins: snap.wallet.lifetimeCoins,
    version: 1,
  });
  writeEmberFile("wallet.json", new TextEncoder().encode(`${updated}\n`));
  const base = computeEmberQuestScore(snap);
  return {
    cashedCoins,
    score: Math.min(9999, Math.max(base.score, cashedCoins * 12)),
    maxCombo: Math.min(999, Math.max(cashedCoins, base.maxCombo)),
  };
}

export function eraseEmberSave(): void {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  for (const name of FILE_NAMES) {
    lsDel(STORAGE_PREFIX + name);
  }
  if (cloudAdapter) {
    cloudSyncStatus = "syncing";
    void cloudAdapter
      .clear()
      .then(() => {
        cloudSyncStatus = "synced";
        notify();
      })
      .catch(() => {
        cloudSyncStatus = "error";
        notify();
      });
  }
  notify();
}
