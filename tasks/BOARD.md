# MemeAgotchi — Sprint Board & Multi-AI Handoffs

## Current Phase: Core Unification + Graphics & UX Pass Complete → Ready for Grok Content Polish & Deployment / Hardware Prep

### Sprint 1 — Unified Core & Bug-Free Runtime (Completed)
- [x] Initialize clean Git monorepo + `AGENTS.md` / `CLAUDE.md` / contracts / ADRs
- [x] Complete bug audit across `02-web-app-source` and `03-handheld-simulator-source` ([BUG-AUDIT.md](./BUG-AUDIT.md))
- [x] Implement `packages/game-core` (zero-dep pure deterministic TS engine, all GDD v1.0 rules, Nov 17 energy/sleep retuning, live secret move effects, floating-point decay, 12 unit test suites)
- [x] Implement `packages/rpc-sdk` (zero-dep typed schema & RPC layer replacing `@hatch/space-sdk` with dual `InferIn`/`InferOut` optional/default support)
- [x] Implement `apps/server` (zero-dep Node 22 HTTP + built-in `node:sqlite`, ≤5 MB magic-byte-validated image upload, SSRF-guarded URL import, single-process static serving for `/` and `/handheld/`)
- [x] Port & bug-fix `apps/web-companion` and `apps/handheld-sim` onto the unified server with live SQLite state sync

### Sprint 2 — Graphics & UX Upgrade Pass (Completed)
- [x] Install dependencies & verify `npm run check` (strict `tsc --noEmit` across all 6 workspaces + 17/17 tests + Vite/server production builds)
- [x] Build shared `@memeagotchi/monster-ui` package unifying your mint/lavender character sheet (`docs/art/character-sheet-v1.jpg`) across all 5 evolution stages (Blob → Critter [fixed Teen Sleepy horns!] → Beast → Legend → Eldritch Meme Lord) and all 10 moods
- [x] Upgrade all 12 Drip Shop cosmetics to custom thick-outlined SVG vector overlays (`Chef Hat`, `Deal-With-It Shades`, `Party Hat`, `Wizard Hat`, `Wizard Robe`, `Backward Cap`, `Tiny Crown`, `Star Glasses`, `Gold Chain`, `Hero Cape`, `Flame Sticker`, `Sparkle Sticker`) rendered on Mochi AND inside Shop/Bag cards
- [x] Polish Web Companion UX: harmonized mint/lavender theme, time-of-day sky viewport, interactive tap-to-pet heart burst + WebAudio chiptune SFX toggle, Feed filters (`All`, `Hot`, `Tasty`, `Spicy`, `Fresh`) + collapsible composer + Belly pill, visual 5-stage Evolution Road, dressed Mochi inside Meme Dodge, Drip Shop slot filters, non-overlapping bottom toast
- [x] Polish Handheld Simulator UX: unified mint/lavender `MemeMonster`, crisp `CosmeticBadge` icons in Shop/Bag, 1-click hardware gesture helper pills (`TAP`, `HOLD`, `2× TAP`) below the orange button
- [x] Browser QA verified live on `http://localhost:3000/` and `http://localhost:3000/handheld/` (zero console errors, zero failed requests, live cross-app sync verified)

### Sprint 3 — Content Polish, Cloud Deployment & Hardware Phase (Next Up)
- [ ] Grok session (GDD §5.3 Prompt 0.2): finalize 5 reserve secret words & expand Mochi's Muse voice dialogue pack
- [ ] Deploy container (`Dockerfile`) or swap `StateRepo` adapter to Supabase Auth + Postgres + Storage (GDD §8) + Capacitor Android wrap
- [ ] Perplexity hardware sourcing pass: verify 192×192 display panel & ESP32-S3 / AiPi Lite pinout
- [ ] Port `packages/game-core` to ESP32-S3 C/C++ verified against golden test vectors

---

## Handoff Log

### 2026-11-20 — Sprint 1 Core Unification (Commit `7594ce9`)
- Unified monorepo created; 17/17 unit & HTTP/SQLite integration tests passing.

### 2026-11-20 — Sprint 2 Graphics, UX, & Visual QA Pass (Antigravity / Gemini 4 Neon)
- **Changed:** Decoupled `apps/server/src/actions.ts` `StateRepo`/`UrlUploader` interfaces from `node:*` types; added `packages/monster-ui` (`MemeMonster` + `CosmeticArtwork` + `CosmeticBadge`); upgraded `apps/web-companion` and `apps/handheld-sim` visuals, audio, filters, visual Evolution Road, dressed Meme Dodge, and 1-click handheld gesture helpers.
- **Verification:** `npm run check` passed with exit code 0 across all 6 workspaces (`tsc --noEmit`, 17/17 tests, Vite + server builds). Browser visual QA verified both `http://localhost:3000/` and `http://localhost:3000/handheld/` with 0 console/network errors and live cross-app sync.
- **Next Step:** Ready for Sprint 3 — either run the Grok content/dialogue pass, deploy to cloud hosting via `Dockerfile` / Supabase, or begin ESP32-S3 hardware sourcing & firmware planning.
