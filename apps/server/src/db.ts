import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  clampFloat,
  containsBlockedText,
  createFreshState,
  normalizeState,
  stageForXp,
  STAGES,
  statCapFor,
  STATE_VERSION,
  tickState,
  toGameView,
  utcDateKey,
  type DreamMemeView,
  type GameState,
  type GameView,
  type HighScoreEntry,
  type MiniGameId,
  type Mood,
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

export interface SocialVisitRecord {
  id: number;
  fromUserId: string;
  fromHandle: string;
  kind: "cheer" | "meme_gift";
  memeTitle: string | null;
  note: string;
  createdAt: number;
}

export interface PlayerProfileView {
  userId: string;
  handle: string;
  displayName: string;
  petName: string;
  species: SpeciesId;
  stage: number;
  displayStage: number;
  stageName: string;
  mood: Mood;
  xp: number;
  drip: number;
  careStreak: number;
  digestedCount: number;
  equippedItems: GameView["equippedItems"];
  dreamMemes: DreamMemeView[];
  highScores: Record<MiniGameId, HighScoreEntry>;
  cheerCount: number;
  cheeredTodayByViewer: boolean;
  isSelf: boolean;
  recentVisits: SocialVisitRecord[];
}

const ALLOWED_EMBER_FILES = new Set(["save.dat", "wallet.json", "status.json"]);
const MAX_EMBER_FILE_B64 = 32_768;

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
      CREATE TABLE IF NOT EXISTS ember_saves (
        user_id TEXT PRIMARY KEY,
        files_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS social_visits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_user_id TEXT NOT NULL,
        from_handle TEXT NOT NULL,
        to_user_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        meme_key TEXT,
        meme_title TEXT,
        note TEXT NOT NULL DEFAULT '',
        date_key TEXT NOT NULL,
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

  /* ==================== Cloud-Synced Ember Vale RPG Saves ==================== */

  getEmberSave(userId: string): { files: Record<string, string>; updatedAt: number | null } {
    const row = this.db
      .prepare("SELECT files_json, updated_at FROM ember_saves WHERE user_id = ?")
      .get(userId) as { files_json?: string; updated_at?: number } | undefined;
    if (!row?.files_json) {
      return { files: {}, updatedAt: null };
    }
    try {
      const parsed = JSON.parse(row.files_json) as Record<string, unknown>;
      const clean: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (ALLOWED_EMBER_FILES.has(k) && typeof v === "string" && v.length <= MAX_EMBER_FILE_B64) {
          clean[k] = v;
        }
      }
      return { files: clean, updatedAt: row.updated_at ?? null };
    } catch {
      return { files: {}, updatedAt: null };
    }
  }

  putEmberSave(
    userId: string,
    incoming: Record<string, unknown>,
    nowMs: number,
  ): { files: Record<string, string>; updatedAt: number } {
    const existing = this.getEmberSave(userId).files;
    const merged: Record<string, string> = { ...existing };
    for (const [k, v] of Object.entries(incoming)) {
      if (!ALLOWED_EMBER_FILES.has(k)) continue;
      if (v === null) {
        delete merged[k];
      } else if (typeof v === "string" && v.length <= MAX_EMBER_FILE_B64) {
        merged[k] = v;
      }
    }
    this.db
      .prepare(
        `INSERT INTO ember_saves (user_id, files_json, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           files_json = excluded.files_json,
           updated_at = excluded.updated_at`,
      )
      .run(userId, JSON.stringify(merged), nowMs);
    return { files: merged, updatedAt: nowMs };
  }

  deleteEmberSave(userId: string): void {
    this.db.prepare("DELETE FROM ember_saves WHERE user_id = ?").run(userId);
  }

  /* ==================== Social Visits: Profile, Cheer & Meme Gifts ==================== */

  private displayHandleFor(userId: string): string {
    if (userId === DEFAULT_USER_ID) return "Guest";
    const u = this.getUserById(userId);
    return u ? `@${u.handle}` : "Trainer";
  }

  private bumpXpWithEvolution(s: GameState, gained: number, nowMs: number): void {
    if (gained <= 0) return;
    s.xp += Math.round(gained);
    if (Math.round(s.happiness) <= 0) return;
    const targetStage = stageForXp(s.xp).stage;
    if (targetStage > s.stage) {
      const wasLatest = s.displayStage === s.stage;
      s.stage = targetStage;
      if (wasLatest || targetStage < 3) s.displayStage = targetStage;
      const def = STAGES[targetStage - 1] ?? STAGES[0]!;
      s.events.unshift({
        id: ++s.nextId,
        text: `🌟 EVOLVED → Stage ${targetStage}: ${def.name}!`,
        createdAtReal: nowMs,
      });
      if (s.events.length > 24) s.events.length = 24;
    }
  }

  getPlayerProfile(targetUserId: string, viewerUserId: string, nowMs: number): PlayerProfileView | null {
    const petRow = this.db
      .prepare("SELECT state_json FROM user_pets WHERE user_id = ?")
      .get(targetUserId) as { state_json?: string } | undefined;
    if (!petRow?.state_json) return null;

    let st: GameState;
    try {
      st = normalizeState(JSON.parse(petRow.state_json) as Partial<GameState>, nowMs);
    } catch {
      return null;
    }
    if (!st.hatched) return null;

    const view = toGameView(tickState(st, nowMs).state, nowMs, []);
    const user = targetUserId === DEFAULT_USER_ID ? null : this.getUserById(targetUserId);
    const today = utcDateKey(nowMs);

    const cheerCountRow = this.db
      .prepare("SELECT COUNT(*) as c FROM social_visits WHERE to_user_id = ? AND kind = 'cheer'")
      .get(targetUserId) as { c?: number } | undefined;

    const cheeredTodayRow = this.db
      .prepare(
        "SELECT 1 as ok FROM social_visits WHERE from_user_id = ? AND to_user_id = ? AND kind = 'cheer' AND date_key = ? LIMIT 1",
      )
      .get(viewerUserId, targetUserId, today) as { ok?: number } | undefined;

    const visits = this.db
      .prepare(
        `SELECT id, from_user_id, from_handle, kind, meme_title, note, created_at
         FROM social_visits WHERE to_user_id = ? ORDER BY created_at DESC LIMIT 8`,
      )
      .all(targetUserId) as Array<{
      id: number;
      from_user_id: string;
      from_handle: string;
      kind: "cheer" | "meme_gift";
      meme_title: string | null;
      note: string;
      created_at: number;
    }>;

    return {
      userId: targetUserId,
      handle: user ? `@${user.handle}` : "Guest",
      displayName: user?.displayName ?? (targetUserId === DEFAULT_USER_ID ? "Local Guest" : "Trainer"),
      petName: view.monster.name,
      species: view.monster.species,
      stage: view.monster.stage,
      displayStage: view.monster.displayStage,
      stageName: view.monster.stageName,
      mood: view.monster.mood,
      xp: view.monster.xp,
      drip: view.monster.drip,
      careStreak: view.monster.careStreak.count,
      digestedCount: view.monster.digestedCount,
      equippedItems: view.equippedItems,
      dreamMemes: view.dreamMemes.slice(0, 6),
      highScores: view.monster.highScores,
      cheerCount: Number(cheerCountRow?.c ?? 0),
      cheeredTodayByViewer: Boolean(cheeredTodayRow?.ok),
      isSelf: targetUserId === viewerUserId,
      recentVisits: visits.map((v) => ({
        id: v.id,
        fromUserId: v.from_user_id,
        fromHandle: v.from_handle,
        kind: v.kind,
        memeTitle: v.meme_title,
        note: v.note,
        createdAt: v.created_at,
      })),
    };
  }

  cheerPlayer(
    fromUserId: string,
    toUserId: string,
    nowMs: number,
  ): { ok: boolean; message: string } {
    if (fromUserId === toUserId) {
      return { ok: false, message: "You can't visit-cheer your own pet — visit a friend from Rankings!" };
    }
    const targetRow = this.db
      .prepare("SELECT state_json FROM user_pets WHERE user_id = ?")
      .get(toUserId) as { state_json?: string } | undefined;
    if (!targetRow?.state_json) {
      return { ok: false, message: "That trainer's pet wasn't found." };
    }

    const today = utcDateKey(nowMs);
    const already = this.db
      .prepare(
        "SELECT 1 as ok FROM social_visits WHERE from_user_id = ? AND to_user_id = ? AND kind = 'cheer' AND date_key = ? LIMIT 1",
      )
      .get(fromUserId, toUserId, today) as { ok?: number } | undefined;
    if (already?.ok) {
      return { ok: false, message: "You already cheered this friend today — come back tomorrow!" };
    }

    const fromHandle = this.displayHandleFor(fromUserId);
    const toHandle = this.displayHandleFor(toUserId);

    const target = tickState(this.load(nowMs, toUserId), nowMs).state;
    if (!target.hatched) return { ok: false, message: "That trainer hasn't hatched a starter yet." };

    const tCap = statCapFor(target, nowMs);
    target.happiness = clampFloat(target.happiness + 8, tCap);
    this.bumpXpWithEvolution(target, 15, nowMs);
    target.speech = `Yay! ${fromHandle} cheered me!`;
    target.speechUntilReal = nowMs + 8000;
    target.events.unshift({
      id: ++target.nextId,
      text: `🤝 ${fromHandle} visited & cheered ${target.name}! (+8 Happy, +15 XP)`,
      createdAtReal: nowMs,
    });
    if (target.events.length > 24) target.events.length = 24;
    this.save(target, nowMs, toUserId);

    // Reward the friendly visitor too!
    const sender = tickState(this.load(nowMs, fromUserId), nowMs).state;
    if (sender.hatched) {
      sender.drip += 5;
      this.bumpXpWithEvolution(sender, 10, nowMs);
      sender.events.unshift({
        id: ++sender.nextId,
        text: `🤝 Visited & cheered ${target.name} (${toHandle})! (+5 Drip, +10 XP)`,
        createdAtReal: nowMs,
      });
      if (sender.events.length > 24) sender.events.length = 24;
      this.save(sender, nowMs, fromUserId);
    }

    this.db
      .prepare(
        `INSERT INTO social_visits (from_user_id, from_handle, to_user_id, kind, note, date_key, created_at)
         VALUES (?, ?, ?, 'cheer', '', ?, ?)`,
      )
      .run(fromUserId, fromHandle, toUserId, today, nowMs);

    return {
      ok: true,
      message: `🤝 Cheered ${target.name} (${toHandle})! They got +8 Happiness & +15 XP, and you earned +5 Drip & +10 XP!`,
    };
  }

  giftMemeToPlayer(
    fromUserId: string,
    toUserId: string,
    memeId: number,
    rawNote: string,
    nowMs: number,
  ): { ok: boolean; message: string } {
    if (fromUserId === toUserId) {
      return { ok: false, message: "Pick another trainer from Rankings to gift a meme!" };
    }
    const note = rawNote.trim().slice(0, 60);
    if (note && containsBlockedText(note)) {
      return { ok: false, message: "Gift note blocked by profanity/PII filter." };
    }

    const today = utcDateKey(nowMs);
    const giftCountRow = this.db
      .prepare(
        "SELECT COUNT(*) as c FROM social_visits WHERE from_user_id = ? AND to_user_id = ? AND kind = 'meme_gift' AND date_key = ?",
      )
      .get(fromUserId, toUserId, today) as { c?: number } | undefined;
    if (Number(giftCountRow?.c ?? 0) >= 5) {
      return { ok: false, message: "Daily gift limit reached for this friend (5/day)." };
    }

    const sender = tickState(this.load(nowMs, fromUserId), nowMs).state;
    const meme = sender.memes.find((m) => m.id === memeId && !m.hidden);
    if (!meme) {
      return { ok: false, message: "Selected meme not found in your feed." };
    }

    const targetRow = this.db
      .prepare("SELECT state_json FROM user_pets WHERE user_id = ?")
      .get(toUserId) as { state_json?: string } | undefined;
    if (!targetRow?.state_json) {
      return { ok: false, message: "That trainer's pet wasn't found." };
    }
    const target = tickState(this.load(nowMs, toUserId), nowMs).state;
    if (!target.hatched) return { ok: false, message: "That trainer hasn't hatched a starter yet." };

    const fromHandle = this.displayHandleFor(fromUserId);
    const toHandle = this.displayHandleFor(toUserId);

    // Ensure the gifted meme exists in target's feed & bump its share power
    const existingTargetMeme = target.memes.find((m) => m.key === meme.key);
    if (existingTargetMeme) {
      existingTargetMeme.shares += 1;
      existingTargetMeme.lastActivityGameMs = target.gameMs;
    } else {
      target.memes.unshift({
        ...meme,
        id: ++target.nextId,
        shares: meme.shares + 1,
        createdAtGameMs: target.gameMs,
        lastActivityGameMs: target.gameMs,
      });
    }

    const tCap = statCapFor(target, nowMs);
    target.happiness = clampFloat(target.happiness + 5, tCap);
    target.drip += 6;
    this.bumpXpWithEvolution(target, 20, nowMs);
    target.speech = `🎁 ${fromHandle} sent "${meme.title}"!`;
    target.speechUntilReal = nowMs + 9000;
    target.events.unshift({
      id: ++target.nextId,
      text: `🎁 ${fromHandle} gifted "${meme.title}"${note ? ` — "${note}"` : ""} (+20 XP, +6 Drip)`,
      createdAtReal: nowMs,
    });
    if (target.events.length > 24) target.events.length = 24;
    this.save(target, nowMs, toUserId);

    if (sender.hatched) {
      sender.drip += 6;
      this.bumpXpWithEvolution(sender, 10, nowMs);
      sender.events.unshift({
        id: ++sender.nextId,
        text: `🎁 Gifted "${meme.title}" to ${target.name} (${toHandle})! (+6 Drip, +10 XP)`,
        createdAtReal: nowMs,
      });
      if (sender.events.length > 24) sender.events.length = 24;
      this.save(sender, nowMs, fromUserId);
    }

    this.db
      .prepare(
        `INSERT INTO social_visits (from_user_id, from_handle, to_user_id, kind, meme_key, meme_title, note, date_key, created_at)
         VALUES (?, ?, ?, 'meme_gift', ?, ?, ?, ?, ?)`,
      )
      .run(fromUserId, fromHandle, toUserId, meme.key, meme.title, note, today, nowMs);

    return {
      ok: true,
      message: `🎁 Sent "${meme.title}" to ${target.name} (${toHandle})! (+6 Drip & +10 XP for you, +20 XP & +6 Drip for them!)`,
    };
  }

  close(): void {
    this.db.close();
  }
}
