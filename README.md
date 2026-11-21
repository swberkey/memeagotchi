# MemeAgotchi

A Tamagotchi-style virtual pet whose food, power source, and social currency are memes — unified across a **Web Companion App** and a **Landscape 320×240 (4:3) ESP32-S3 Handheld Simulator** on one deterministic TypeScript game engine.

## What's Inside (v1.3 · 320×240 Online Edition)
- **Title Screen & 5 Playable Starter Species:** Choose from **Mint Dragon (Mochi)**, **Spicy Imp (Scoville)**, **Cyber Cat (Pixel)**, **Cozy Frog (Pebbles)**, or **Cursed Ghost (Wisp)** — each with custom concept sheets in `docs/art/`, distinct stat-curve archetypes, voice banter, and an exclusive **`X` Signature Special Move**.
- **4 60fps `320×240` (4:3) SNES Arcade Games (`@memeagotchi/snes-games`):**
  1. **Meme Runner DX** — SNES side-scrolling platformer with floating platforms, stompable enemies, double-jump, and species specials.
  2. **Troll Blaster** — 8-way top-down arena shooter with enemy waves and mini-bosses.
  3. **Vibe Beat** — Live WebAudio chiptune rhythm stage with dancing dressed-up monster and 5-lane beat highway (`◄ ▼ ▲ ► O` + `X` Special).
  4. **Ember Vale** — Full 16-bit top-down action-adventure RPG compiled from the real ESP32-S3 C99 core to WebAssembly (`hardware/ember-vale/`): 24 overworld screens, 2 castles (Bramblekeep & Cinderspire), 9 heart containers, the Silly Meme Vault, persistent flash saves, and host coin cash-out into MemeAgotchi Drip & XP!
- **Full-Screen Meme Feed (`▲`) & Always-On Meme Dream Screensaver:** Press `▲` Up Arrow while feeding for edge-to-edge full-screen memes. While sleeping, Light / Sound / Motion wake the handheld into a full-screen 4:3 slideshow of the memes your monster has fed on, with a **1/8-size gliding pixel sleeping monster**.
- **Multi-User Online Hub, 6-Char Handheld Pairing & Real-Time SSE Sync:**
  - Create a cloud account (`@handle` + password, `scrypt` hashed, signed `HttpOnly` cookie session) for an isolated SQLite pet save — or play immediately as a zero-friction Local Guest.
  - Pair any **320×240 Handheld Simulator** or physical **ESP32-S3 MemeAgotchi** via a 10-minute **6-character pair code** (`POST /api/devices/pair-code` → `POST /api/devices/claim`) issuing a revocable Bearer `mgd_...` token.
  - **Real-Time Server-Sent Events (`GET /api/events`):** Instant cross-device sync across Web Companion + paired handhelds, cross-account community meme sharing & live votes, and a **Global Leaderboard** (`GET /api/leaderboard`) sortable by XP, Care Streak, Runner DX, Troll Blaster, and Vibe Beat.
  - **Mobile PWA Ready:** Installable Web App Manifest (`manifest.webmanifest`) for iOS & Android home screens.
- **5 Physical Pocket Handheld Models & 5 Distinct Background Scene Templates (`/handheld/`):** Vertical pocket hardware emulator modeled after `docs/art/handheld-models-v1.jpg` with the `320×240` IPS screen on top, 4-way D-Pad lower-left, diagonally stepped `X`/`O` lower-right, `-- MENU` pill bottom-center, and braided wrist lanyard — switchable across **Dragon Scale**, **Cozy Kitty**, **Bloom Petal**, **Cyber Bot**, and **Atomic Purple**, paired with 5 mix-and-match background scenes (**Emerald Dragon Glade**, **Sunlit Kitty Loft**, **Botanical Glasshouse**, **Cyber Robotics Lab**, **90s Maker Workbench**).
- **Hardware Alignment (`2.0" ST7789VW / 2.4" ILI9341 320×240 IPS TFT`):** 240×320 native panel rotated to **Landscape `320×240` (4:3 QVGA)** (262K color, 4-wire SPI) paired with an **ESP32-S3**, tactile **4-way D-Pad + `O` / `X` / `--`**, and Light/Sound/Motion carry-wake sensors.
- **Full Progression Loop:** Personal Best High Scores & Max Combos per game, Daily Care Streak bonuses, and active **5 / 15 / 30 Digestion Milestone Powers** (`Turbo Charge`, `Second Wind`, `Meme Overdrive ×1.5`) usable in every mini-game.

## Monorepo Architecture

```text
memeagotchi/
├── AGENTS.md                   # Shared multi-AI harness rules & invariants
├── docs/                       # GDD v1.0–v1.2, 320×240 architecture, 5 species art sheets, contracts, ADRs
├── tasks/                      # Live sprint board & bug audit log
├── packages/
│   ├── game-core/              # Pure deterministic TS game engine (v3 schema) + golden unit tests
│   ├── rpc-sdk/                # Open, zero-lock-in typed RPC layer
│   ├── monster-ui/             # 5-species × 5-stage SVG art kit, starter eggs, 12 cosmetics & Meme Dream Screensaver
│   └── snes-games/             # Shared 60fps 320×240 (4:3) Canvas SNES Arcade Trio + on-screen D-Pad/O/X/-- Gamepad
├── apps/
│   ├── server/                 # Node 22 HTTP + built-in SQLite API, uploads, & production static server
│   ├── web-companion/          # React 19 + Vite + Tailwind v4 Companion App (served at /)
│   └── handheld-sim/           # React 19 + Vite + Tailwind v4 320×240 (4:3) Landscape Handheld Simulator (served at /handheld/)
└── hardware/                   # ESP32-S3 + 2.0" ST7789VW 320×240 BOM, wake sensors, GPIO budget & build checklist
```

## Quick Start (Requires Node.js ≥ 22.5)

```bash
# 1. Install dependencies
npm install

# 2. Run full verification (typecheck across all 7 workspaces + unit/integration tests + production builds)
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
Both **Web Companion** (`/`) and **Handheld Simulator** (`/handheld/`) talk to the exact same SQLite-backed unified server (`apps/server/data/memeagotchi.db`). Actions taken in either UI — hatching a starter, feeding memes, voting, posting uploads, unlocking secret words by label or voice, buying/equipping Drip, beating SNES Arcade high scores, or toggling Demo 60× vs Real-Time 1× clock — stay live-synced across both views.

## Deploying Online
The repo ships with a production multi-stage `Dockerfile`, `.env.example`, and ready-to-use deployment manifests for **Render (`render.yaml`)**, **Fly.io (`fly.toml`)**, and **Railway (`railway.json`)** serving both apps + API + SSE + SQLite + uploads from one Node 22 process (`PORT` defaults to `3000`, `DATA_DIR` defaults to `./apps/server/data`):

```bash
docker build -t memeagotchi .
docker run -p 3000:3000 -v memeagotchi-data:/app/data -e DATA_DIR=/app/data -e SESSION_SECRET=$(openssl rand -hex 32) memeagotchi
```
See [`docs/online-deployment.md`](docs/online-deployment.md) for step-by-step Railway, Render, Fly.io, and ESP32-S3 HTTPS pairing setup.
