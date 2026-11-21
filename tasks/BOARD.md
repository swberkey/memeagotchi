# MemeAgotchi — Sprint Board & Multi-AI Handoffs

## Current Phase: Sprint 4 Complete (Online Multi-User Auth, 6-Char Handheld Pairing, Real-Time SSE, Community Memes, Leaderboard & Cloud Deploy Kit) → Ready for Live Cloud Deploy & ESP32-S3 Hardware Build

### Sprint 1 — Unified Core & Bug-Free Runtime (Completed · `7594ce9`)
- [x] Initialize clean Git monorepo + `AGENTS.md` / `CLAUDE.md` / contracts / ADRs
- [x] Complete bug audit across `02-web-app-source` and `03-handheld-simulator-source` ([BUG-AUDIT.md](./BUG-AUDIT.md))
- [x] Implement `packages/game-core` (zero-dep pure deterministic TS engine, all GDD v1.0 rules, Nov 17 energy/sleep retuning, live secret move effects, floating-point decay)
- [x] Implement `packages/rpc-sdk` (zero-dep typed schema & RPC layer replacing `@hatch/space-sdk` with dual `InferIn`/`InferOut` optional/default support)
- [x] Implement `apps/server` (zero-dep Node 22 HTTP + built-in `node:sqlite`, ≤5 MB magic-byte-validated image upload, SSRF-guarded URL import, single-process static serving for `/` and `/handheld/`)
- [x] Port & bug-fix `apps/web-companion` and `apps/handheld-sim` onto the unified server with live SQLite state sync

### Sprint 2 — Graphics & UX Upgrade Pass (Completed · `97af63d`)
- [x] Build shared `@memeagotchi/monster-ui` package unifying mint/lavender character sheet (`docs/art/character-sheet-v1.jpg`) across all 5 evolution stages and 10 moods
- [x] Upgrade all 12 Drip Shop cosmetics to custom thick-outlined SVG vector overlays rendered on pet AND inside Shop/Bag cards
- [x] Polish Web Companion & Handheld Simulator UX (sky viewport, tap-to-pet bursts, SFX, Feed filters, Evolution Road, Shop slot filters)

### Sprint 3 — 280×240 Display Alignment, Title Screen, 5 Starter Species & 3 SNES Games (Completed)
- [x] **Hardware Alignment (`280×240` Landscape 262K IPS + D-Pad / `O` / `X` / `--`):** Verified **1.69" ST7789V2 IPS TFT LCD** (240×280 native → rotated `280×240` landscape, 262K color, 4-wire SPI, rounded glass corners, ~$2–$4 direct / ~$6–$10 Waveshare/Adafruit). Recorded [ADR-002](../docs/decisions/ADR-002-handheld-280x240-roster-games.md) and updated `docs/handheld-architecture.md`, `docs/GDD-v1.0.md` (v1.1 Addendum), `hardware/README.md`, `docs/contracts/`, `AGENTS.md`, and `README.md`.
- [x] **5 Playable Starter Species & Concept Art:** Generated matching kawaii sprite sheets for all 4 new species (`docs/art/species-spicy-imp.jpg`, `species-cyber-cat.jpg`, `species-cozy-frog.jpg`, `species-cursed-ghost.jpg`) alongside `character-sheet-v1.jpg` (Mint Dragon); implemented all 5 species × 5 stages × 10 moods + `<StarterEgg />` in `@memeagotchi/monster-ui`.
- [x] **Engine v3 (`@memeagotchi/game-core` & `@memeagotchi/server`):** Added `hatched`, `species`, `SPECIES_CATALOG`, `hatchStarter` RPC, species stat-curve archetypes, `heatCap` (120 for Spicy Imp), Daily Care Streak, Personal Best High Scores & Max Combos per mini-game, and active 5 / 15 / 30 Digestion Milestone Powers (`Turbo Charge`, `Second Wind`, `Meme Overdrive ×1.5`) with v2→v3 save migration (18/18 tests passing).
- [x] **3 60fps `280×240` SNES Mini-Games (`@memeagotchi/snes-games`):** Built shared `SnesArcadeCanvas` + `ArcadeGamepad` + WebAudio 16-bit SFX/music powering **Meme Runner DX** (platformer), **Troll Blaster** (8-way arena shooter with waves & bosses), and **Vibe Beat** (chiptune concert rhythm stage), all supporting species `X` Signature Special Moves + 5/15/30 Milestone Powers + secret buffs.
- [x] **Title Screen, Starter Picker & Landscape 280×240 Handheld Rebuild:** Added Title Screen + 5-Starter Picker + SNES Arcade with on-screen D-Pad/`O`/`X`/`--` to Web Companion; rebuilt Handheld Simulator into a landscape `280×240` rounded-corner ESP32-S3 micro-console with physical D-Pad + `O`/`X`/`--` (Hold `--` = Voice PTT), on-device Title/Starter Picker, 2-column Menu, split Feed, 3-page Stats, and native 60fps SNES Arcade.
- [x] **Verification & Visual QA:** Verified `npm run check` (7/7 workspaces typecheck & build, 18/18 tests) and live browser QA on `http://localhost:3000/` and `http://localhost:3000/handheld/`; fixed Tailwind v4 shared-package scanning (`@source`) for `ArcadeGamepad`, canvas result wrapping, and single-line keyboard hints.
- [x] **Full-Screen Meme Feed (`▲` Up Arrow) & Always-On Meme Dream Screensaver:** Added `dreamMemes` engine projection (19/19 tests), 1/8-size gliding `<PixelSleepingSprite />` + `<DreamScreensaver />` over the monster's fed memes, `▲` Up Arrow full-screen meme viewing in both Handheld `280×240` and Web Companion, and Light / Sound / Motion ambient carry wake sensor simulation + BOM updates in `docs/handheld-architecture.md` & `hardware/README.md`.

### Sprint 3.5 — `320×240` (4:3 QVGA) Standardization & Stylistic UI Redesign (Completed)
- [x] **Display Standard Updated (`320×240` 4:3 QVGA):** Recorded [ADR-003](../docs/decisions/ADR-003-display-320x240-qvga-ui-redesign.md) targeting **2.0" ST7789VW** (and drop-in **2.4" ST7789/ILI9341**) 262K color SPI IPS modules (`153.6 KB` / `307.2 KB` double-buffered RAM). Updated `docs/handheld-architecture.md`, `docs/GDD-v1.0.md` (v1.2 Addendum), `hardware/README.md`, `docs/contracts/`, `AGENTS.md`, `README.md`, and `packages/game-core` copy.
- [x] **Native `320×240` (4:3) SNES Arcade:** Reflowed `SCREEN_W = 320`, `aspect-[4/3]`, HUD bar, Meme Runner DX runway, Troll Blaster arena, and Vibe Beat concert stage & 5-lane rhythm highway (`LANE_W = 35`), plus boutique candy-glass `<ArcadeGamepad />`.
- [x] **Stylistic & User-Friendly UI Redesign:**
  - **Handheld Simulator (`apps/handheld-sim`):** 4 live switchable hardware shell colorways (`Obsidian`, `Atomic Purple`, `Mint Cream`, `Retro SNES`), flush 4:3 glass lens, recessed D-Pad well, direct mouse/touch clickability across all screens (5×2 visual app launcher grid, Pet bottom quick-action dock, clickable vibe pills & stat tabs), `▲` Full-Screen `320×240` Meme Feed, and Sleep Meme Dream Screensaver + Light/Sound/Motion wake sensors.
  - **Web Companion (`apps/web-companion`):** `Plus Jakarta Sans` + `Silkscreen` typography, species-tinted habitat card, 4:3 Sleep Dream Screensaver, floating glass pill bottom nav with Belly badge, unified 3-tab lower drawer (`Pulse` / `Secrets` / `Pet Options`), dark-glass harmonized Feed cards, and `320×240` 4:3 SNES Arcade.

### Sprint 4 — Putting the Online Pieces Together (Completed)
- [x] **Multi-User Accounts & Security (`apps/server/src/auth.ts`, `db.ts`):** Per-user SQLite saves (`user_pets`), `@handle` + `scrypt` password auth, HMAC-SHA256 signed `HttpOnly` session cookies (`mg_session`), seamless Guest fallback & legacy DB migration, per-IP rate limiting, and security/CORS headers.
- [x] **6-Character Handheld Device Pairing (`/api/devices/*`):** One-click 6-char pair code generation in Web Companion → single-use claim returning SHA-256-hashed Bearer `deviceToken` (`mgd_...`) for the `320×240` Handheld Simulator & future ESP32-S3 Wi-Fi firmware, plus instant remote Unpair revocation.
- [x] **Real-Time Live Sync (`/api/events` SSE):** Zero-dependency Server-Sent Events hub broadcasting `state_updated`, `network_updated`, and `device_paired` instantly across Web Companion and paired handhelds.
- [x] **Shared Online Meme Network & Global Leaderboard:** Community `network_memes` cross-account sharing + live `/api/leaderboard` ranked by XP, Care Streak, and all 3 SNES Arcade high scores (`OnlineHubModal` in Companion).
- [x] **Cloud Deploy Kit & PWA:** Added `render.yaml`, `fly.toml`, `railway.json`, `.env.example`, `apps/web-companion/public/manifest.webmanifest`, and [docs/online-deployment.md](../docs/online-deployment.md).
- [x] **Verification:** Expanded `apps/server/src/server.test.ts` with end-to-end multi-user, pairing, revocation, community meme, leaderboard, and SSE live-push tests (**20/20 tests passing**).

### Sprint 5 — Next Up (Live Cloud Launch, Grok Content Pack & ESP32-S3 Hardware Build)
- [ ] Click Deploy on Railway / Render / Fly.io using `swberkey/memeagotchi` (`docs/online-deployment.md`) and test mobile PWA + live multiplayer!
- [ ] Grok session (GDD §5.3 Prompt 0.2): finalize 5 reserve secret words & expand all 5 starter species' Muse voice dialogue packs
- [ ] Hardware Phase 1 breadboard: wire ESP32-S3-N16R8 (or Waveshare ESP32-S3 2" LCD Board) + 2.0" ST7789VW `320×240` SPI display + 7 tactile switches (D-Pad + `O`/`X`/`--`) + INMP441/MAX98357A audio + LIS3DH/BH1750 carry wake sensors and port `packages/game-core` to C/C++ verified against golden unit-test vectors

---

## Handoff Log

### 2026-11-20 — Sprint 1 Core Unification (Commit `7594ce9`)
- Unified monorepo created; 17/17 unit & HTTP/SQLite integration tests passing.

### 2026-11-20 — Sprint 2 Graphics, UX, & Visual QA Pass (Commit `97af63d`)
- Added `@memeagotchi/monster-ui` with 5-stage mint/lavender art + 12 vector cosmetics; verified `npm run check` across 6 workspaces and browser QA.

### 2026-11-21 — Sprint 3 280×240 Alignment, 5 Starters, Title Screen & 3 SNES Games (Antigravity)
- **Changed:** Added `docs/decisions/ADR-002-handheld-280x240-roster-games.md`, 4 new species concept sheets in `docs/art/`, engine v3 + server RPCs (`hatchStarter`, `runner`/`blaster`/`beat`, care streak, high scores, 5/15/30 milestone powers), 5-species `@memeagotchi/monster-ui`, new `@memeagotchi/snes-games` package, Web Companion Title/Starter Picker & SNES Arcade, and Landscape `280×240` Handheld Simulator rebuild.
- **Verification:** `npm run check` passed with exit code 0 across all 7 workspaces (`tsc --noEmit`, 18/18 tests, Vite + server production builds). Browser visual QA verified both `http://localhost:3000/` and `http://localhost:3000/handheld/` with 0 console errors and 0 failed HTTP requests.
### 2026-11-21 — Sprint 3.5 `320×240` (4:3 QVGA) Standardization & Stylistic UI Redesign (`fc98776`)
- **Changed:** Standardized display geometry to `320×240` (4:3 QVGA, 2.0" ST7789VW / 2.4" ILI9341 IPS) in `ADR-003`, all docs, and all 3 SNES games; redesigned Handheld Simulator (4 shell colorways, 5×2 app launcher grid, clickable controls) and Web Companion (`Plus Jakarta Sans` + `Silkscreen`, species-tinted habitat, floating pill nav, 3-tab drawer).

### 2026-11-21 — Sprint 4 Putting the Online Pieces Together (Antigravity)
- **Changed:** Multi-user accounts (`scrypt` + signed `HttpOnly` cookie sessions), isolated per-user SQLite saves (`user_pets`), 6-char ESP32-S3/Handheld pairing codes & revocable SHA-256 Bearer `mgd_...` tokens, real-time SSE hub (`/api/events`), cross-account community memes (`network_memes`), live Global Leaderboard (`/api/leaderboard`), Web Companion `OnlineHubModal` + PWA `manifest.webmanifest`, Handheld Cloud Pairing bar, and deploy manifests (`render.yaml`, `fly.toml`, `railway.json`, `.env.example`, `docs/online-deployment.md`).
- **Verification:** `npm run check` passed across all 7 workspaces (`tsc --noEmit`, 20/20 unit + HTTP/SSE integration tests, Vite + server production builds).
- **Next Step:** Deploy live on Railway/Render/Fly.io using `docs/online-deployment.md`, run Grok dialogue pack session, and begin ESP32-S3 `320×240` hardware breadboard firmware.
