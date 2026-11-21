import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  createFreshState,
  normalizeState,
  STAGES,
  STATE_VERSION,
  type GameState,
  type HighScoreEntry,
  type MiniGameId,
  type SpeciesId,
} from "@memeagotchi/game-core";
import type { StateRepo } from "./actions.ts";
import { generateDeviceToken, generateId, generatePairCode, hashDeviceToken, PAIR_CODE_TTL_MS } from "./auth.ts";

export const DEFAULT_USER_ID = "default";

export interface UserAccount {
  id: string;
  handle: string;
  displayName: string;
  createdAt: number;
}

export interface PairedDeviceView {
  id: string;
  deviceName: string;
  createdAt: number;
  lastSeenAt: number;
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

export class GameRepository {
  private readonly db: DatabaseSync;

  constructor(dbPath: string) {
    if (dbPath !== ":memory:") {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        handle TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS user_pets (
        user_id TEXT PRIMARY KEY,
        version INTEGER NOT NULL,
        state_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS paired_devices (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        device_name TEXT NOT NULL,
        token_hash TEXT UNIQUE NOT NULL,
        created_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pair_codes (
        code TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS network_memes (
        key TEXT PRIMARY KEY,
        author_user_id TEXT NOT NULL,
        author_handle TEXT NOT NULL,
        title TEXT NOT NULL,
        caption TEXT NOT NULL,
        emoji TEXT NOT NULL,
        image_key TEXT,
        image_url TEXT,
        bg TEXT NOT NULL,
        tasty INTEGER NOT NULL DEFAULT 0,
        spicy INTEGER NOT NULL DEFAULT 0,
        blech INTEGER NOT NULL DEFAULT 0,
        shares INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS action_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL DEFAULT 'default',
        action_name TEXT NOT NULL,
        ok INTEGER NOT NULL,
        summary TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);

    // Ensure action_audit has user_id column when upgrading an older local DB
    const auditCols = this.db.prepare("PRAGMA table_info(action_audit)").all() as Array<{ name: string }>;
    if (!auditCols.some((c) => c.name === "user_id")) {
      this.db.exec("ALTER TABLE action_audit ADD COLUMN user_id TEXT NOT NULL DEFAULT 'default'");
    }

    // Seamless one-time migration from legacy single-row game_state (id = 1) -> user_pets ('default')
    const legacyExists = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'game_state'")
      .get() as { name?: string } | undefined;
    if (legacyExists?.name) {
      const hasDefault = this.db
        .prepare("SELECT 1 FROM user_pets WHERE user_id = ?")
        .get(DEFAULT_USER_ID);
      if (!hasDefault) {
        const legacy = this.db
          .prepare("SELECT version, state_json, updated_at FROM game_state WHERE id = 1")
          .get() as { version: number; state_json: string; updated_at: number } | undefined;
        if (legacy?.state_json) {
          this.db
            .prepare("INSERT INTO user_pets (user_id, version, state_json, updated_at) VALUES (?, ?, ?, ?)")
            .run(DEFAULT_USER_ID, legacy.version, legacy.state_json, legacy.updated_at);
        }
      }
    }
  }

  /** Returns a StateRepo scoped cleanly to one userId (used by Actions without changing action signatures). */
  forUser(userId: string): StateRepo {
    return {
      load: (nowMs: number) => this.load(nowMs, userId),
      save: (state: GameState, nowMs: number) => this.save(state, nowMs, userId),
      audit: (actionName: string, ok: boolean, summary: string, nowMs: number) =>
        this.audit(actionName, ok, summary, nowMs, userId),
    };
  }

  load(nowMs: number, userId = DEFAULT_USER_ID): GameState {
    const row = this.db
      .prepare("SELECT state_json FROM user_pets WHERE user_id = ?")
      .get(userId) as { state_json?: string } | undefined;

    let state: GameState;
    if (!row?.state_json) {
      state = createFreshState(nowMs, 60, { hatched: false });
      this.save(state, nowMs, userId);
    } else {
      try {
        const parsed = JSON.parse(row.state_json) as Partial<GameState>;
        state = normalizeState(parsed, nowMs);
      } catch {
        state = createFreshState(nowMs, 60, { hatched: false });
        this.save(state, nowMs, userId);
      }
    }

    // Merge shared online community memes posted by other accounts (and live community vote tallies)
    this.mergeNetworkMemesInto(state, userId);
    return state;
  }

  save(state: GameState, nowMs: number, userId = DEFAULT_USER_ID): void {
    this.db
      .prepare(
        `INSERT INTO user_pets (user_id, version, state_json, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           version = excluded.version,
           state_json = excluded.state_json,
           updated_at = excluded.updated_at`,
      )
      .run(userId, STATE_VERSION, JSON.stringify(state), nowMs);

    this.publishCommunityMemesFrom(state, userId, nowMs);
  }

  audit(actionName: string, ok: boolean, summary: string, nowMs: number, userId = DEFAULT_USER_ID): void {
    this.db
      .prepare(
        "INSERT INTO action_audit (user_id, action_name, ok, summary, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(userId, actionName, ok ? 1 : 0, summary.slice(0, 240), nowMs);
  }

  /* ==================== Shared Online Community Meme Network ==================== */

  private publishCommunityMemesFrom(state: GameState, userId: string, nowMs: number): void {
    const user = userId === DEFAULT_USER_ID ? null : this.getUserById(userId);
    const authorHandle = user ? user.handle : "local";

    for (const m of state.memes) {
      if (m.isSeed || m.hidden || m.key.startsWith("bonus-")) continue;
      const netKey = m.key.startsWith("net-") ? m.key : `net-${userId.slice(0, 8)}-${m.key}`;
      // Tag the local meme key cleanly only if already net-prefixed, otherwise publish under netKey
      const existing = this.db
        .prepare("SELECT tasty, spicy, blech, shares FROM network_memes WHERE key = ?")
        .get(netKey) as { tasty: number; spicy: number; blech: number; shares: number } | undefined;

      if (!existing) {
        this.db
          .prepare(
            `INSERT INTO network_memes
             (key, author_user_id, author_handle, title, caption, emoji, image_key, image_url, bg, tasty, spicy, blech, shares, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            netKey,
            userId,
            authorHandle,
            m.title,
            m.caption,
            m.emoji,
            m.imageKey,
            m.imageUrl,
            m.bg,
            m.tasty,
            m.spicy,
            m.blech,
            m.shares,
            m.createdAtReal || nowMs,
          );
      } else {
        this.db
          .prepare(
            `UPDATE network_memes
             SET tasty = MAX(tasty, ?), spicy = MAX(spicy, ?), blech = MAX(blech, ?), shares = MAX(shares, ?)
             WHERE key = ?`,
          )
          .run(m.tasty, m.spicy, m.blech, m.shares, netKey);
      }
    }
  }

  private mergeNetworkMemesInto(state: GameState, userId: string): void {
    const rows = this.db
      .prepare(
        `SELECT key, author_user_id, author_handle, title, caption, emoji, image_key, image_url, bg, tasty, spicy, blech, shares, created_at
         FROM network_memes
         ORDER BY created_at DESC
         LIMIT 30`,
      )
      .all() as Array<{
      key: string;
      author_user_id: string;
      author_handle: string;
      title: string;
      caption: string;
      emoji: string;
      image_key: string | null;
      image_url: string | null;
      bg: string;
      tasty: number;
      spicy: number;
      blech: number;
      shares: number;
      created_at: number;
    }>;

    for (const r of rows) {
      // Match either by exact network key or by author's own original local key
      const localOwnKey = r.author_user_id === userId ? r.key.replace(`net-${userId.slice(0, 8)}-`, "") : null;
      const existing = state.memes.find((m) => m.key === r.key || (localOwnKey && m.key === localOwnKey));
      if (existing) {
        existing.tasty = Math.max(existing.tasty, r.tasty);
        existing.spicy = Math.max(existing.spicy, r.spicy);
        existing.blech = Math.max(existing.blech, r.blech);
        existing.shares = Math.max(existing.shares, r.shares);
      } else if (r.author_user_id !== userId) {
        const id = state.nextId++;
        state.memes.unshift({
          id,
          key: r.key,
          title: r.title,
          caption: r.caption ? `${r.caption} — @${r.author_handle}` : `Posted by @${r.author_handle}`,
          emoji: r.emoji,
          imageKey: r.image_key,
          imageUrl: r.image_url,
          bg: r.bg,
          tasty: r.tasty,
          spicy: r.spicy,
          blech: r.blech,
          shares: r.shares,
          isSeed: false,
          createdAtReal: r.created_at,
          createdAtGameMs: state.gameMs,
          lastActivityGameMs: state.gameMs,
          reports: 0,
          hidden: false,
        });
      }
    }
  }

  /* ==================== Users & Auth ==================== */

  createUser(handle: string, displayName: string, passwordHash: string, nowMs: number): UserAccount {
    const id = generateId("usr");
    this.db
      .prepare(
        "INSERT INTO users (id, handle, display_name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(id, handle, displayName, passwordHash, nowMs);
    return { id, handle, displayName, createdAt: nowMs };
  }

  findUserForLogin(handle: string): (UserAccount & { passwordHash: string }) | null {
    const row = this.db
      .prepare("SELECT id, handle, display_name, password_hash, created_at FROM users WHERE handle = ?")
      .get(handle) as
      | { id: string; handle: string; display_name: string; password_hash: string; created_at: number }
      | undefined;
    if (!row) return null;
    return {
      id: row.id,
      handle: row.handle,
      displayName: row.display_name,
      passwordHash: row.password_hash,
      createdAt: row.created_at,
    };
  }

  getUserById(id: string): UserAccount | null {
    const row = this.db
      .prepare("SELECT id, handle, display_name, created_at FROM users WHERE id = ?")
      .get(id) as { id: string; handle: string; display_name: string; created_at: number } | undefined;
    if (!row) return null;
    return {
      id: row.id,
      handle: row.handle,
      displayName: row.display_name,
      createdAt: row.created_at,
    };
  }

  countUsers(): number {
    const row = this.db.prepare("SELECT COUNT(*) as n FROM users").get() as { n?: number } | undefined;
    return Number(row?.n ?? 0);
  }

  /* ==================== 6-Character Handheld Device Pairing ==================== */

  createPairCode(userId: string, nowMs: number): { code: string; expiresAt: number } {
    // Prune expired codes first
    this.db.prepare("DELETE FROM pair_codes WHERE expires_at <= ?").run(nowMs);
    const code = generatePairCode();
    const expiresAt = nowMs + PAIR_CODE_TTL_MS;
    this.db
      .prepare("INSERT OR REPLACE INTO pair_codes (code, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
      .run(code, userId, expiresAt, nowMs);
    return { code, expiresAt };
  }

  claimPairCode(
    rawCode: string,
    deviceName: string,
    nowMs: number,
  ): { deviceId: string; deviceToken: string; userId: string; accountHandle: string } | null {
    const code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const row = this.db
      .prepare("SELECT code, user_id, expires_at FROM pair_codes WHERE code = ?")
      .get(code) as { code: string; user_id: string; expires_at: number } | undefined;
    if (!row || row.expires_at <= nowMs) {
      if (row) this.db.prepare("DELETE FROM pair_codes WHERE code = ?").run(code);
      return null;
    }

    // Consume pair code (single-use)
    this.db.prepare("DELETE FROM pair_codes WHERE code = ?").run(code);

    const deviceId = generateId("dev");
    const deviceToken = generateDeviceToken();
    const tokenHash = hashDeviceToken(deviceToken);
    const cleanName = deviceName.trim().slice(0, 32) || "MemeAgotchi-320";

    this.db
      .prepare(
        "INSERT INTO paired_devices (id, user_id, device_name, token_hash, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(deviceId, row.user_id, cleanName, tokenHash, nowMs, nowMs);

    const user = row.user_id === DEFAULT_USER_ID ? null : this.getUserById(row.user_id);
    return {
      deviceId,
      deviceToken,
      userId: row.user_id,
      accountHandle: user ? `@${user.handle}` : "Guest",
    };
  }

  authenticateDeviceToken(rawToken: string, nowMs: number): { deviceId: string; userId: string; deviceName: string } | null {
    const tokenHash = hashDeviceToken(rawToken);
    const row = this.db
      .prepare("SELECT id, user_id, device_name FROM paired_devices WHERE token_hash = ?")
      .get(tokenHash) as { id: string; user_id: string; device_name: string } | undefined;
    if (!row) return null;
    this.db.prepare("UPDATE paired_devices SET last_seen_at = ? WHERE id = ?").run(nowMs, row.id);
    return { deviceId: row.id, userId: row.user_id, deviceName: row.device_name };
  }

  listPairedDevices(userId: string): PairedDeviceView[] {
    const rows = this.db
      .prepare("SELECT id, device_name, created_at, last_seen_at FROM paired_devices WHERE user_id = ? ORDER BY created_at DESC")
      .all(userId) as Array<{ id: string; device_name: string; created_at: number; last_seen_at: number }>;
    return rows.map((r) => ({
      id: r.id,
      deviceName: r.device_name,
      createdAt: r.created_at,
      lastSeenAt: r.last_seen_at,
    }));
  }

  revokePairedDevice(userId: string, deviceId: string): boolean {
    const info = this.db
      .prepare("DELETE FROM paired_devices WHERE id = ? AND user_id = ?")
      .run(deviceId, userId);
    return Number(info.changes) > 0;
  }

  /* ==================== Online Global Leaderboard ==================== */

  getLeaderboard(nowMs: number, limit = 25): LeaderboardEntry[] {
    const rows = this.db
      .prepare(
        `SELECT p.user_id, p.state_json, u.handle, u.display_name
         FROM user_pets p
         LEFT JOIN users u ON u.id = p.user_id`,
      )
      .all() as Array<{
      user_id: string;
      state_json: string;
      handle: string | null;
      display_name: string | null;
    }>;

    const entries: LeaderboardEntry[] = [];
    for (const r of rows) {
      try {
        const st = normalizeState(JSON.parse(r.state_json) as Partial<GameState>, nowMs);
        if (!st.hatched) continue;
        const stageDef = STAGES[Math.max(0, Math.min(STAGES.length - 1, st.stage - 1))] ?? STAGES[0]!;
        entries.push({
          userId: r.user_id,
          handle: r.handle ? `@${r.handle}` : "Guest",
          displayName: r.display_name ?? (r.user_id === DEFAULT_USER_ID ? "Local Guest" : "Trainer"),
          petName: st.name,
          species: st.species,
          stage: st.stage,
          stageName: stageDef.name,
          xp: st.xp,
          drip: st.drip,
          careStreak: st.careStreak.count,
          digestedCount: st.digestedCount,
          highScores: st.highScores,
        });
      } catch {
        /* skip malformed row */
      }
    }

    entries.sort((a, b) => b.xp - a.xp || b.careStreak - a.careStreak);
    return entries.slice(0, limit);
  }

  close(): void {
    this.db.close();
  }
}
