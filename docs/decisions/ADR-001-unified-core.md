# ADR-001: Unified Pure `game-core`, Open RPC Layer, & Node 22 SQLite

- **Date:** 2026-11-20
- **Status:** Accepted
- **Owner:** Scott Berkey

## Context
The project previously had three separate prototypes: a Nov 8 localStorage standalone build, a fullstack web app (`02-web-app-source`), and a Nov 17 192×192 handheld simulator (`03-handheld-simulator-source`). Both fullstack builds depended on `@hatch/space-sdk` (`file:/opt/hatch/...`), only available in a hosted sandbox, and had diverged in engine math, schema, and bug fixes.

## Decisions
1. **Replace `@hatch/space-sdk` with `packages/rpc-sdk`**: A minimal, MIT-clean typed RPC + Zod validation helper (`defineAction` + `createActionClient`) with zero vendor lock-in.
2. **Extract `packages/game-core`**: Single deterministic TypeScript state machine shared by the server, web companion, and handheld simulator, serving as the executable spec and golden test suite for the future ESP32-S3 C/C++ firmware port.
3. **Standardize on Node.js 22 + built-in `node:sqlite`**: Node v22.19+ ships `node:sqlite` natively (no C++ `node-gyp` build issues on Windows, no Bun requirement). Storage uses SQLite with transactional persistence and clean migration hooks so moving to Supabase/Postgres later (GDD §8) only swaps the repository adapter in `apps/server`.
4. **Adopt Nov 17 Sleep/Energy Retuning Across Both Apps**: Awake Energy decay `−1/hr`, Play/Mini-game cost `−5 Energy`, Sleep restore `+20/hr` (per Scott's Nov 17 playtest feedback that `−4/hr` put the pet to sleep too quickly).
5. **Store Stats as Internal Floats**: Fixes a critical rounding bug where 5s/20s polling rounded fractional stat decay back to zero.
6. **Unify Live State Across Companion & Handheld Simulator**: Both apps hit the same `apps/server` instance so players can test the real Companion ↔ Handheld workflow side-by-side.
