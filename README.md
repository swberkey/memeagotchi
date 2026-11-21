# MemeAgotchi

A Tamagotchi-style virtual pet whose food, power source, and social currency are memes — unified across a **Web Companion App** and a **192×192 ESP32-S3 Handheld Simulator** on one deterministic TypeScript game engine.

## Monorepo Architecture

```text
memeagotchi/
├── AGENTS.md                   # Shared multi-AI harness rules & invariants
├── docs/                       # GDD v1.0, handheld architecture, art sheet, contracts, ADRs
├── tasks/                      # Live sprint board & bug audit log
├── packages/
│   ├── game-core/              # Pure deterministic TS game engine + golden unit tests
│   └── rpc-sdk/                # Open, zero-lock-in typed RPC layer (replaces @hatch/space-sdk)
├── apps/
│   ├── server/                 # Node 22 HTTP + built-in SQLite API, uploads, & production static server
│   ├── web-companion/          # React 19 + Vite + Tailwind v4 Companion App (served at /)
│   └── handheld-sim/           # React 19 + Vite + Tailwind v4 192×192 Handheld Simulator (served at /handheld/)
└── hardware/                   # Parked Phase 1–3 ESP32-S3 / AiPi Lite hardware checklist
```

## Quick Start (Requires Node.js ≥ 22.5)

```bash
# 1. Install dependencies
npm install

# 2. Run full verification (typecheck + unit/integration tests + production builds)
npm run check

# 3. Development mode (API on :3001, Web Companion on :5173, Handheld Sim on :5174)
npm run dev

# 4. Single-server production mode (serves BOTH apps + API on http://localhost:3000)
npm run build
npm start
#   - Web Companion:      http://localhost:3000/
#   - Handheld Simulator: http://localhost:3000/handheld/
#   - Health check:       http://localhost:3000/api/health
```

## Shared Live State
Both **Web Companion** (`/`) and **Handheld Simulator** (`/handheld/`) talk to the exact same SQLite-backed unified server (`apps/server/data/memeagotchi.db`). Actions taken in either UI — feeding memes, voting, posting uploads, unlocking secret words by label or voice, buying/equipping Drip, playing mini-games, or toggling Demo 60× vs Real-Time 1× clock — stay live-synced across both views.

## Deploying
The repo ships with a production multi-stage `Dockerfile` and serves both apps + API + uploads from one Node 22 process (`PORT` defaults to `3000`, `DATA_DIR` defaults to `./apps/server/data`):

```bash
docker build -t memeagotchi .
docker run -p 3000:3000 -v memeagotchi-data:/app/data -e DATA_DIR=/app/data memeagotchi
```
It deploys directly to Railway, Render, Fly.io, or any Node 22 container host with a persistent volume mounted at `/app/data`.
