# MemeAgotchi — Multi-AI Workspace Rules (`AGENTS.md`)

This file is the **shared operating contract** for every AI harness working on this repository (Antigravity, Claude Code, Codex CLI, Gemini CLI, OpenCode, etc.).

## 1. Source of Truth Hierarchy
1. **`docs/GDD-v1.0.md`** — Owner-approved Game Design Document v1.0 (all 7 decisions locked). Do **not** alter a locked GDD rule without flagging it and recording an ADR in `docs/decisions/`.
2. **`docs/handheld-architecture.md`** — Three-layer hardware split (ESP32-S3 + 1.69" ST7789V2 `280×240` landscape IPS + D-Pad/`O`/`X`/`--` device ↔ Muse voice brain ↔ Web/Phone companion).
3. **`docs/contracts/`** — Interface contracts shared between `packages/game-core`, `apps/server`, `apps/web-companion`, `apps/handheld-sim`, and future ESP32-S3 C/C++ firmware.
4. **`docs/decisions/`** — Architecture Decision Records (ADRs) documenting intentional retuning (e.g., Nov 17 Energy/Sleep retuning) and tech choices.
5. **`tasks/BOARD.md`** — Live sprint progress, bug register, and handoffs.

## 2. Hard Engineering Invariants
- **Single Game Engine (`packages/game-core`)**: All stat decay, evolution, digestion, viral backflow, secret-word matching, cooldowns, and reward math MUST live in `packages/game-core`. Never duplicate game math inside React clients or ad-hoc server handlers.
- **Pure & Deterministic Core**: `packages/game-core` MUST have zero Node/DOM/network imports and MUST accept `nowMs: number` explicitly (no `Date.now()` inside core functions). This keeps tick composition invariant (`tick(tick(s, t1), t2) === tick(s, t2)`) and lets unit tests double as golden vectors for the eventual ESP32-S3 firmware port.
- **Floating-Point Internal Stats**: Store `fullness`, `happiness`, `hygiene`, `energy`, and `heat` as floats internally and round **only** in the view projection (`toView`). Rounding inside `tick()` silently drops small deltas during polling.
- **Server-Side Anti-Cheat**: Clients never compute stat decay, XP/Drip grants, secret-word matching, or cosmetic ownership. Always validate ownership and gates server-side.
- **Nostalgia Aura Rule (GDD Decision #2)**: Stage 5 aura effects remain tied to `actualStage`, even when `displayStage < 5`.
- **Moderation & Upload Safety (GDD Decisions #5 & #6)**: Uploaded meme images must be ≤ 5 MB and MIME/magic-byte validated (`image/jpeg`, `image/png`, `image/gif`, `image/webp`). Profanity + PII filter runs on custom labels, voice text, and meme titles/captions. 3 user reports auto-hide reported items pending review.

## 3. Standard Verification Commands
Always run before marking a task done:
```bash
npm run typecheck   # Strict TypeScript across all 7 workspaces
npm test            # Pure game-core + HTTP/SQLite integration tests
npm run build       # Production builds for packages, server, web-companion, handheld-sim
```
Or run all three together:
```bash
npm run check
```

## 4. Multi-AI Handoff Protocol
Whenever an agent completes a unit of work, append a concise entry to `tasks/BOARD.md` (or the relevant task file) with:
1. **Changed files / commit SHA**
2. **Verification run** (exact commands + pass/fail count)
3. **Assumptions & open risks**
4. **Exact next step & recommended role** (e.g., Antigravity UI pass, Claude/Codex security review, Grok dialogue/secret-word polish, Perplexity hardware BOM check)

## 5. Hardware Phase Boundary
Do **not** modify `hardware/` firmware specs until the app core, graphics pass, and companion sync contracts are signed off by the owner. Keep `packages/game-core` simple and portable (no heavy runtime deps) so porting to ESP32-S3 C/C++ stays straightforward.
