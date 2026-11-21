import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  createFreshState,
  normalizeState,
  STATE_VERSION,
  type GameState,
} from "@memeagotchi/game-core";

export class GameRepository {
  private readonly db: DatabaseSync;

  constructor(dbPath: string) {
    if (dbPath !== ":memory:") {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS game_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        version INTEGER NOT NULL,
        state_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS action_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action_name TEXT NOT NULL,
        ok INTEGER NOT NULL,
        summary TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
  }

  load(nowMs: number): GameState {
    const row = this.db
      .prepare("SELECT state_json FROM game_state WHERE id = 1")
      .get() as { state_json?: string } | undefined;

    if (!row?.state_json) {
      const fresh = createFreshState(nowMs, 60);
      this.save(fresh, nowMs);
      return fresh;
    }

    try {
      const parsed = JSON.parse(row.state_json) as Partial<GameState>;
      return normalizeState(parsed, nowMs);
    } catch {
      const fresh = createFreshState(nowMs, 60);
      this.save(fresh, nowMs);
      return fresh;
    }
  }

  save(state: GameState, nowMs: number): void {
    this.db
      .prepare(
        `INSERT INTO game_state (id, version, state_json, updated_at)
         VALUES (1, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           version = excluded.version,
           state_json = excluded.state_json,
           updated_at = excluded.updated_at`,
      )
      .run(STATE_VERSION, JSON.stringify(state), nowMs);
  }

  audit(actionName: string, ok: boolean, summary: string, nowMs: number): void {
    this.db
      .prepare(
        "INSERT INTO action_audit (action_name, ok, summary, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(actionName, ok ? 1 : 0, summary.slice(0, 240), nowMs);
  }

  close(): void {
    this.db.close();
  }
}
