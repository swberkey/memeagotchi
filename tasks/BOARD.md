# MemeAgotchi — Sprint Board & Multi-AI Handoffs

## Current Phase: Core Unification Complete → Ready for Online Build/Deploy & Graphics/UX Pass

### Sprint 1 — Unified Core & Bug-Free Runtime (Completed)
- [x] Initialize clean Git monorepo + `AGENTS.md` / `CLAUDE.md` / contracts / ADRs
- [x] Complete bug audit across `02-web-app-source` and `03-handheld-simulator-source` ([BUG-AUDIT.md](./BUG-AUDIT.md))
- [x] Implement `packages/game-core` (zero-dep pure deterministic TS engine, all GDD v1.0 rules, Nov 17 energy/sleep retuning, live secret move effects, floating-point decay, 12 unit test suites)
- [x] Implement `packages/rpc-sdk` (zero-dep typed schema & RPC layer replacing `@hatch/space-sdk` with dual `InferIn`/`InferOut` optional/default support)
- [x] Implement `apps/server` (zero-dep Node 22 HTTP + built-in `node:sqlite`, ≤5 MB magic-byte-validated image upload, SSRF-guarded URL import, single-process static serving for `/` and `/handheld/`)
- [x] Port & bug-fix `apps/web-companion` onto unified server (fixes `LabelMatch` reset, `MemeDodge` timer leaks & React 19 batching, ownership & first-wear exploits, live 1s timers, file uploads, meme/label reporting, clock toggle)
- [x] Port & bug-fix `apps/handheld-sim` onto unified server (live synced with Companion via shared SQLite DB, Stage 5 Nostalgia aura fix, unified captions & 12-item Drip catalog, timer unmount cleanup)
- [x] Verify `game-core`, `rpc-sdk`, and `apps/server` end-to-end via `npm test` (17/17 passing across 3 suites including SQLite restart persistence)

### Sprint 2 — Online Build/Deploy + Graphics & UX Upgrade Pass (Next Up)
- [ ] Run `npm install && npm run check` in an internet-connected terminal (installs React/Vite/Tailwind/TypeScript devDependencies, runs `tsc --noEmit` across all 5 workspaces, and emits production bundles)
- [ ] Launch live single-server mode (`npm start`) or dev mode (`npm run dev`) and smoke-test Companion (`/`) + Handheld Simulator (`/handheld/`) side-by-side
- [ ] Expand `docs/art/character-sheet-v1.jpg` mint/lavender character direction across all 5 GDD stages (fix Teen Sleepy missing horns, design Legend & Eldritch Meme Lord variants)
- [ ] Upgrade remaining emoji cosmetics to custom illustrated SVG/sprite overlays with per-stage anchor calibration
- [ ] Polish Web Companion & Handheld Simulator UX (sound/haptics polish, visual feed cards, side-by-side companion↔handheld layout)
- [ ] Grok session (GDD §5.3 Prompt 0.2): finalize 5 reserve secret words & expand Mochi's Muse voice dialogue pack

### Sprint 3 — Multi-User Production & Hardware Phase
- [ ] Swap SQLite repo adapter to Supabase Auth + Postgres + Storage (GDD §8) + Capacitor Android wrapper
- [ ] Perplexity hardware sourcing pass: verify 192×192 display panel & ESP32-S3 / AiPi Lite pinout
- [ ] Port `packages/game-core` to ESP32-S3 C/C++ verified against golden test vectors

---

## Handoff Log

### 2026-11-20 — Sprint 1 Core Unification (Antigravity / Gemini 4 Neon)
- **Changed:** Created unified monorepo (`packages/game-core`, `packages/rpc-sdk`, `apps/server`, `apps/web-companion`, `apps/handheld-sim`, `docs/`, `tasks/`, `hardware/`, `Dockerfile`).
- **Verification:** `npm test` passed **17 / 17** tests across 3 suites (`@memeagotchi/game-core` 12/12, `@memeagotchi/rpc-sdk` 2/2, `@memeagotchi/server` 3/3 covering all 19 RPC actions, SQLite restart persistence, magic-byte image uploads, path traversal, and SSRF protection).
- **Environment Note:** Shell sandbox has no outbound access to `registry.npmjs.org`, so `npm install` (React/Vite/Tailwind/TypeScript frontend deps) could not run inside the sandbox. All server & core packages have **zero external runtime dependencies** and were executed/tested natively on Node 22.19.0.
- **Next Step:** Open `C:\Users\User\.gemini\antigravity\scratch\memeagotchi` as the active workspace, run `npm install && npm run check` in a network-enabled terminal to verify `tsc` & Vite production builds, then begin **Sprint 2 (Graphics & UX pass)**.
