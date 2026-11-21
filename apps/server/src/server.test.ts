import assert from "node:assert/strict";
import fs from "node:fs";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { createAppServer } from "./app.ts";

// Minimal valid 1x1 transparent PNG (67 bytes)
const TINY_PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082",
  "hex",
);

describe("@memeagotchi/server HTTP + SQLite integration", () => {
  let cleanup: (() => Promise<void>) | null = null;
  let tmpDir = "";

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
      cleanup = null;
    }
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = "";
    }
  });

  async function boot(nowFn?: () => number) {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "memeagotchi-srv-"));
    const app = createAppServer({
      dbPath: path.join(tmpDir, "test.db"),
      uploadsDir: path.join(tmpDir, "uploads"),
      now: nowFn,
    });
    await new Promise<void>((resolve) => app.server.listen(0, "127.0.0.1", resolve));
    const { port } = app.server.address() as AddressInfo;
    cleanup = app.close;
    const base = `http://127.0.0.1:${port}`;
    const rpc = async (action: string, args: unknown = {}) => {
      const r = await fetch(`${base}/api/actions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, args }),
      });
      return { status: r.status, body: (await r.json()) as { ok: boolean; result?: any; error?: string } };
    };
    return { base, rpc };
  }

  it("serves health, shares unified state between Companion & Handheld actions, and persists to SQLite", async () => {
    let clockMs = Date.UTC(2026, 10, 20, 18, 0, 0);
    const { base, rpc } = await boot(() => clockMs);

    const health = (await fetch(`${base}/api/health`).then((r) => r.json())) as { ok: boolean };
    assert.equal(health.ok, true);

    // 1) Companion hatches Mint Dragon, renames it & buys Chef Hat
    const hatched = await rpc("hatchStarter", { species: "mint-dragon", name: "Mochi" });
    assert.equal(hatched.body.result.ok, true);

    const renamed = await rpc("renameMonster", { name: "Nugget" });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.body.result.view.monster.name, "Nugget");

    const bought = await rpc("buyCosmetic", { assetId: "chef-hat" });
    assert.equal(bought.body.result.ok, true);

    // 2) Handheld equips Chef Hat & speaks a secret word
    const equipped = await rpc("equipCosmetic", { assetId: "chef-hat" });
    assert.equal(equipped.body.result.ok, true);

    const talked = await rpc("talk", { text: "doge" });
    assert.equal(talked.body.result.ok, true);
    assert.ok(talked.body.result.view.secrets.some((s: any) => s.word === "doge"));

    // 3) Companion polls getState -> sees all Handheld updates live!
    clockMs += 5000;
    const state = await rpc("getState", {});
    assert.equal(state.body.result.view.monster.name, "Nugget");
    assert.ok(state.body.result.view.equippedItems.some((e: any) => e.assetId === "chef-hat"));
    assert.ok(state.body.result.view.secrets.some((s: any) => s.word === "doge"));
  });

  it("validates RPC schemas, image upload magic bytes, path traversal safety, and blocks SSRF URLs", async () => {
    const { base, rpc } = await boot();

    // Schema validation catches bad action args cleanly with 400
    const badArgs = await rpc("setDisplayStage", { stage: 99 });
    assert.equal(badArgs.status, 400);
    assert.equal(badArgs.body.ok, false);

    // Unknown action returns 404
    const unknown = await rpc("nonExistentAction", {});
    assert.equal(unknown.status, 404);

    // Reject fake image (plain text)
    const badUp = await fetch(`${base}/api/upload`, {
      method: "POST",
      body: Buffer.from("not an image at all, sorry!"),
    });
    assert.equal(badUp.status, 400);

    // Accept real PNG & serve it back
    const goodUp = await fetch(`${base}/api/upload`, {
      method: "POST",
      body: TINY_PNG,
    });
    assert.equal(goodUp.status, 200);
    const upData = (await goodUp.json()) as { ok: boolean; imageUrl: string };
    assert.ok(upData.imageUrl.startsWith("/uploads/"));

    const served = await fetch(`${base}${upData.imageUrl}`);
    assert.equal(served.status, 200);
    assert.equal(served.headers.get("content-type"), "image/png");

    // Path traversal blocked
    const traversal = await fetch(`${base}/uploads/..%2Ftest.db`);
    assert.equal(traversal.status, 404);

    // Post meme using the uploaded file
    const posted = await rpc("postMeme", {
      title: "My Uploaded Meme",
      caption: "fresh png",
      imageUrl: upData.imageUrl,
    });
    assert.equal(posted.body.result.ok, true);
    assert.equal(posted.body.result.view.memes[0].imageUrl, upData.imageUrl);

    // Block localhost SSRF in postMemeFromUrl
    const ssrf = await rpc("postMemeFromUrl", { url: "http://127.0.0.1:3001/api/health" });
    assert.equal(ssrf.body.result.ok, false);
    assert.match(ssrf.body.result.message, /blocked/i);

    // Malformed percent-encoded path returns 400 cleanly
    const badPath = await fetch(`${base}/uploads/%ZZ`);
    assert.equal(badPath.status, 400);

    // Malformed JSON body returns 400 cleanly
    const badJson = await fetch(`${base}/api/actions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-json",
    });
    assert.equal(badJson.status, 400);
  });

  it("exercises all 19 RPC actions and preserves state across SQLite server restarts", async () => {
    let clockMs = Date.UTC(2026, 10, 20, 19, 0, 0);
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "memeagotchi-persist-"));
    const dbPath = path.join(tmpDir, "persist.db");
    const uploadsDir = path.join(tmpDir, "uploads");

    const startInstance = async () => {
      const app = createAppServer({ dbPath, uploadsDir, now: () => clockMs });
      await new Promise<void>((resolve) => app.server.listen(0, "127.0.0.1", resolve));
      const { port } = app.server.address() as AddressInfo;
      cleanup = app.close;
      const base = `http://127.0.0.1:${port}`;
      const rpc = async (action: string, args: unknown = {}) => {
        const r = await fetch(`${base}/api/actions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, args }),
        });
        return { status: r.status, body: (await r.json()) as { ok: boolean; result?: any; error?: string } };
      };
      return { app, rpc };
    };

    const inst1 = await startInstance();
    const s0 = await inst1.rpc("getState", {});
    assert.equal(s0.status, 200);
    assert.equal(s0.body.result.view.hatched, false);

    // Hatch starter species via Title Screen flow
    const hatched = await inst1.rpc("hatchStarter", { species: "cyber-cat", name: "Pixel" });
    assert.equal(hatched.body.result.ok, true);
    assert.equal(hatched.body.result.view.hatched, true);
    assert.equal(hatched.body.result.view.monster.species, "cyber-cat");

    const firstMemeId = hatched.body.result.view.memes[0].id;

    assert.equal((await inst1.rpc("care", { action: "feed" })).body.result.ok, true);
    assert.equal((await inst1.rpc("care", { action: "groom" })).body.result.ok, true);
    assert.equal((await inst1.rpc("care", { action: "play" })).body.result.ok, true);
    assert.equal((await inst1.rpc("care", { action: "sleep" })).body.result.ok, true);
    assert.equal((await inst1.rpc("care", { action: "wake" })).body.result.ok, true);
    assert.equal((await inst1.rpc("voteMeme", { memeId: firstMemeId, label: "tasty" })).body.result.ok, true);
    assert.equal((await inst1.rpc("shareMeme", { memeId: firstMemeId })).body.result.ok, true);
    const lbl = await inst1.rpc("addCustomLabel", { memeId: firstMemeId, text: "stonks" });
    assert.equal(lbl.body.result.unlocked, "Market Manipulation");
    const lblId = lbl.body.result.view.memes.find((m: any) => m.id === firstMemeId).customLabels[0].id;
    assert.equal((await inst1.rpc("reportLabel", { labelId: lblId })).body.result.ok, true);

    const posted = await inst1.rpc("postMeme", { title: "Restart Survival", caption: "sqlite!", imageKey: "stonks" });
    assert.equal(posted.body.result.ok, true);
    assert.equal((await inst1.rpc("reportMeme", { memeId: posted.body.result.id })).body.result.ok, true);
    assert.equal((await inst1.rpc("postBonusMeme", { bonusKey: "bonus-wow" })).body.result.ok, true);
    assert.equal((await inst1.rpc("feedMeme", { memeId: firstMemeId, label: "tasty" })).body.result.ok, true);
    const mini = await inst1.rpc("completeMiniGame", { game: "runner", score: 280, maxCombo: 14 });
    assert.equal(mini.body.result.ok, true);
    assert.equal(mini.body.result.isNewBest, true);
    assert.equal((await inst1.rpc("updateSettings", { clock: 1, soundOn: false })).body.result.ok, true);
    assert.equal((await inst1.rpc("setDisplayStage", { stage: 1 })).body.result.ok, false); // locked at Stage 1

    // Shut down server instance #1 and reboot instance #2 against the SAME SQLite database
    await inst1.app.close();
    cleanup = null;
    clockMs += 10_000;

    const inst2 = await startInstance();
    const afterReboot = await inst2.rpc("getState", {});
    assert.equal(afterReboot.body.result.view.settings.clock, 1);
    assert.equal(afterReboot.body.result.view.settings.soundOn, false);
    assert.ok(afterReboot.body.result.view.secrets.some((x: any) => x.word === "stonks"));
    assert.equal(afterReboot.body.result.view.belly.length, 1);

    // Reset pet returns to unhatched Title Screen while preserving settings
    const reset = await inst2.rpc("resetPet", {});
    assert.equal(reset.body.result.ok, true);
    assert.equal(reset.body.result.view.hatched, false);
    assert.equal(reset.body.result.view.monster.xp, 0);
    assert.equal(reset.body.result.view.belly.length, 0);
    assert.equal(reset.body.result.view.settings.clock, 1);
  });

  it("supports multi-user accounts, 6-char handheld pairing, community memes, leaderboard, and SSE live sync", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "memeagotchi-online-"));
    const app = createAppServer({
      dbPath: path.join(dir, "online.db"),
      uploadsDir: path.join(dir, "uploads"),
      sessionSecret: "test-session-secret-at-least-32-chars",
      now: () => 1_763_600_000_000,
    });
    await new Promise<void>((resolve) => app.server.listen(0, "127.0.0.1", resolve));
    const addr = app.server.address() as AddressInfo;
    const base = `http://127.0.0.1:${addr.port}`;
    cleanup = async () => {
      await app.close();
      fs.rmSync(dir, { recursive: true, force: true });
    };

    const callRpc = async (headers: Record<string, string>, action: string, args: unknown = {}) => {
      const res = await fetch(`${base}/api/actions`, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify({ action, args }),
      });
      return { status: res.status, body: (await res.json()) as any };
    };

    // 1. Register User A (alice) & User B (bob)
    const regA = await fetch(`${base}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ handle: "alice", password: "password123", displayName: "Alice" }),
    });
    assert.equal(regA.status, 201);
    const cookieA = regA.headers.get("set-cookie")?.split(";")[0] ?? "";
    assert.ok(cookieA.startsWith("mg_session="));

    // Duplicate handle rejected with 409
    const dupA = await fetch(`${base}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ handle: "alice", password: "password123" }),
    });
    assert.equal(dupA.status, 409);

    // Wrong password rejected with 401
    const badLogin = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ handle: "alice", password: "wrongpassword" }),
    });
    assert.equal(badLogin.status, 401);

    const regB = await fetch(`${base}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ handle: "bob", password: "password456", displayName: "Bob" }),
    });
    assert.equal(regB.status, 201);
    const cookieB = regB.headers.get("set-cookie")?.split(";")[0] ?? "";

    // 2. Per-user pet isolation: Alice hatches Spicy Imp, Bob hatches Cozy Frog
    const hatchA = await callRpc({ cookie: cookieA }, "hatchStarter", { species: "spicy-imp", name: "Blaze" });
    assert.equal(hatchA.body.result.view.monster.species, "spicy-imp");
    const hatchB = await callRpc({ cookie: cookieB }, "hatchStarter", { species: "cozy-frog", name: "Lily" });
    assert.equal(hatchB.body.result.view.monster.species, "cozy-frog");

    const stateA = await callRpc({ cookie: cookieA }, "getState");
    assert.equal(stateA.body.result.view.monster.name, "Blaze");
    assert.equal(stateA.body.result.view.monster.species, "spicy-imp");

    // 3. Community Meme Network: Alice posts a meme -> Bob sees it in his feed!
    const alicePost = await callRpc({ cookie: cookieA }, "postMeme", {
      title: "Alice Online Meme",
      caption: "cross-account network test",
      imageKey: "doge",
    });
    assert.equal(alicePost.body.result.ok, true);
    const bobFeed = await callRpc({ cookie: cookieB }, "getState");
    assert.ok(
      bobFeed.body.result.view.memes.some((m: any) => m.title === "Alice Online Meme"),
      "Bob should receive Alice's posted community meme",
    );

    // 4. 6-Char Handheld Device Pairing + Bearer Auth + Revocation
    const pairRes = await fetch(`${base}/api/devices/pair-code`, {
      method: "POST",
      headers: { cookie: cookieA },
    });
    const pairData = (await pairRes.json()) as { ok: boolean; code: string };
    assert.equal(pairData.ok, true);
    assert.equal(pairData.code.length, 6);

    const claimRes = await fetch(`${base}/api/devices/claim`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: pairData.code, deviceName: "Scott ESP32-320" }),
    });
    const claimData = (await claimRes.json()) as {
      ok: boolean;
      deviceId: string;
      deviceToken: string;
      accountHandle: string;
    };
    assert.equal(claimData.ok, true);
    assert.equal(claimData.accountHandle, "@alice");
    assert.ok(claimData.deviceToken.startsWith("mgd_"));

    // Paired handheld mutates Alice's pet directly via Bearer token!
    const hwPlay = await callRpc(
      { authorization: `Bearer ${claimData.deviceToken}` },
      "completeMiniGame",
      { game: "blaster", score: 420, maxCombo: 18 },
    );
    assert.equal(hwPlay.status, 200);
    assert.equal(hwPlay.body.result.view.monster.name, "Blaze");
    assert.equal(hwPlay.body.result.view.monster.highScores.blaster.bestScore, 420);

    // 5. Real-time SSE Live Sync: open /api/events for Alice, trigger care via paired handheld -> receive state_updated!
    const sseAbort = new AbortController();
    const sseRes = await fetch(`${base}/api/events?deviceToken=${encodeURIComponent(claimData.deviceToken)}`, {
      signal: sseAbort.signal,
    });
    assert.equal(sseRes.status, 200);
    const reader = sseRes.body!.getReader();
    const decoder = new TextDecoder();
    const firstChunk = await reader.read();
    const firstText = decoder.decode(firstChunk.value);
    assert.ok(firstText.includes("event: connected"));

    // Fire mutation from Alice's web session -> handheld SSE stream receives instant push!
    await callRpc({ cookie: cookieA }, "care", { action: "feed" });
    const updateChunk = await reader.read();
    const updateText = decoder.decode(updateChunk.value);
    assert.ok(updateText.includes("event: state_updated"));
    sseAbort.abort();
    await reader.cancel().catch(() => {});

    // 6. Online Leaderboard ranks Alice above Bob
    const lbRes = await fetch(`${base}/api/leaderboard`, { headers: { cookie: cookieA } });
    const lb = (await lbRes.json()) as { ok: boolean; entries: Array<{ handle: string; petName: string; xp: number }> };
    assert.equal(lb.ok, true);
    assert.equal(lb.entries.length, 2);
    assert.equal(lb.entries[0]!.handle, "@alice");
    assert.equal(lb.entries[0]!.petName, "Blaze");

    // 7. Revoking paired device invalidates its Bearer token immediately (401)
    const revRes = await fetch(`${base}/api/devices/${claimData.deviceId}`, {
      method: "DELETE",
      headers: { cookie: cookieA },
    });
    const revData = (await revRes.json()) as { ok: boolean; revoked: boolean };
    assert.equal(revData.revoked, true);

    const denied = await callRpc({ authorization: `Bearer ${claimData.deviceToken}` }, "getState");
    assert.equal(denied.status, 401);
  });
});
