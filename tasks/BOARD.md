# MemeAgotchi — Sprint Board & Multi-AI Handoffs

## Current Phase: Sprint 3 Complete (280×240 Hardware Alignment + Title/5 Starters + 3 SNES Games + Full Progression) → Ready for Sprint 4 (Grok Dialogue Pack / Cloud Deployment / ESP32-S3 Firmware)

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

### Sprint 4 — Next Up (Content Polish, Cloud Deployment & Hardware Build)
- [ ] Grok session (GDD §5.3 Prompt 0.2): finalize 5 reserve secret words & expand all 5 starter species' Muse voice dialogue packs
- [ ] Cloud deployment: deploy via `Dockerfile` (Railway/Render/Fly.io) or add Supabase Auth + Postgres + Storage adapter (GDD §8) + Capacitor Android wrap
- [ ] Hardware Phase 1 breadboard: wire ESP32-S3-WROOM-1 + 1.69" ST7789V2 SPI display + 7 tactile switches (D-Pad + `O`/`X`/`--`) + INMP441/MAX98357A audio and port `packages/game-core` to C/C++ verified against golden unit-test vectors

---

## Handoff Log

### 2026-11-20 — Sprint 1 Core Unification (Commit `7594ce9`)
- Unified monorepo created; 17/17 unit & HTTP/SQLite integration tests passing.

### 2026-11-20 — Sprint 2 Graphics, UX, & Visual QA Pass (Commit `97af63d`)
- Added `@memeagotchi/monster-ui` with 5-stage mint/lavender art + 12 vector cosmetics; verified `npm run check` across 6 workspaces and browser QA.

### 2026-11-21 — Sprint 3 280×240 Alignment, 5 Starters, Title Screen & 3 SNES Games (Antigravity)
- **Changed:** Added `docs/decisions/ADR-002-handheld-280x240-roster-games.md`, 4 new species concept sheets in `docs/art/`, engine v3 + server RPCs (`hatchStarter`, `runner`/`blaster`/`beat`, care streak, high scores, 5/15/30 milestone powers), 5-species `@memeagotchi/monster-ui`, new `@memeagotchi/snes-games` package, Web Companion Title/Starter Picker & SNES Arcade, and Landscape `280×240` Handheld Simulator rebuild.
- **Verification:** `npm run check` passed with exit code 0 across all 7 workspaces (`tsc --noEmit`, 18/18 tests, Vite + server production builds). Browser visual QA verified both `http://localhost:3000/` and `http://localhost:3000/handheld/` with 0 console errors and 0 failed HTTP requests.
- **Next Step:** Ready for Sprint 4 — online deployment (`Dockerfile` / Railway / Fly.io or Supabase + Android), Grok dialogue expansion across all 5 species, or ESP32-S3 + 1.69" ST7789V2 hardware breadboard firmware port.
