# Companion ↔ Device Sync & Online API Contract

Both the **Web Companion** (`/`) and the **Landscape 320×240 (4:3) Handheld Simulator / ESP32-S3 Firmware** (`/handheld/`) communicate with `apps/server` over HTTP JSON, Server-Sent Events (SSE), and magic-byte-validated image upload.

## 1. Authentication & Device Pairing Surface
| Endpoint | Auth | Purpose |
| :--- | :--- | :--- |
| `GET /api/health` | Public | Liveness & metrics (`service`, `version`, `uptimeSec`, `accounts`, `activeStreams`) |
| `POST /api/auth/register` | Public | Create `@handle` account (`scrypt` password hash) and issue signed `HttpOnly` cookie (`mg_session`) |
| `POST /api/auth/login` | Public | Sign in and issue `mg_session` cookie |
| `POST /api/auth/logout` | Any | Clear session cookie |
| `GET /api/auth/me` | Session / Bearer / Guest | Active actor info + list of paired handheld devices |
| `POST /api/devices/pair-code` | Session / Guest | Generate single-use 6-character handheld pairing code (10 min TTL) |
| `POST /api/devices/claim` | Public (code) | Exchange 6-char code for long-lived Bearer `deviceToken` (`mgd_...`, SHA-256 hashed in SQLite) |
| `DELETE /api/devices/:id` | Session / Guest | Immediately revoke a paired handheld's Bearer token |
| `GET /api/leaderboard` | Any | Live ranked online leaderboard across all hatched accounts (XP, Care Streak, 4 SNES Arcade bests incl. Ember Vale) |
| `GET /api/ember-save` | Session / Bearer / Guest | Fetch cloud-synced Ember Vale RPG flash files (`save.dat`, `wallet.json`, `status.json` in base64) |
| `PUT /api/ember-save` | Session / Bearer / Guest | Persist Ember Vale RPG save files to SQLite (`ember_saves`) and push SSE `ember_save_updated` |
| `DELETE /api/ember-save` | Session / Bearer / Guest | Clear cloud Ember Vale RPG save and push SSE `ember_save_updated` |
| `GET /api/players/:userId` | Any | Public friend trainer profile card (dressed monster, 4 Arcade bests, fed dream memes, cheer count, visitor guestbook) |
| `POST /api/players/:userId/cheer` | Session / Bearer / Guest | Daily social cheer (1/day per friend): +8 Happiness & +15 XP to friend, +5 Drip & +10 XP to visitor + SSE push |
| `POST /api/players/:userId/gift-meme` | Session / Bearer / Guest | Gift a feed meme with optional moderated note (5/day per friend): +20 XP & +6 Drip to friend, +6 Drip & +10 XP to sender |
| `GET /api/events` | Cookie or `?deviceToken=` | Real-time **Server-Sent Events (SSE)** stream pushing `state_updated`, `network_updated`, `device_paired`, and `ember_save_updated` |
| `POST /api/upload` | Any | Direct meme image upload (≤ 5 MB, JPEG/PNG/GIF/WebP magic-byte checked) |

## 2. Shared Typed RPC Actions (`POST /api/actions`)
Every RPC call authenticates via `Authorization: Bearer <deviceToken>` (ESP32-S3 / paired handheld), `mg_session` cookie (online account), or local Guest fallback.

| Action | Used By | Purpose |
| :--- | :--- | :--- |
| `getState` | Companion + Handheld | Ticks decay, digestion, backflow, merges community `network_memes`, and returns unified `GameView` (including `dreamMemes`, `hatched`, `species`, `careStreak`, `highScores`, `milestonePowers`) |
| `hatchStarter` | Companion + Handheld | Hatches a new active pet of chosen `species` (`mint-dragon`, `spicy-imp`, `cyber-cat`, `cozy-frog`, `cursed-ghost`) and custom `name` |
| `care` | Companion + Handheld | Feed kibble, Groom, Play, Sleep, Wake (updates Daily Care Streak) |
| `renameMonster` | Companion | Rename active pet (1–24 chars, filtered) |
| `feedMeme` | Companion + Handheld | Feed a meme into a belly slot; optional `label` applies vote simultaneously |
| `voteMeme` | Companion | Cast daily `tasty`/`spicy`/`blech` vote (enforces daily vote budget & syncs community tallies) |
| `shareMeme` | Companion | Share meme (+1 power, +5 XP, +3 Drip commission) |
| `addCustomLabel` | Companion | Add custom label (profanity/PII filtered, checks secret words) |
| `reportMeme` / `reportLabel` | Companion | Report/flag content (3 reports auto-hide) |
| `postMeme` | Companion | Post meme with template photo or uploaded image path (publishes to shared online `network_memes`) |
| `postBonusMeme` | Handheld | Add one of the built-in bonus memes |
| `postMemeFromUrl` | Companion + Handheld | Fetch external image URL (SSRF-guarded, MIME + ≤5 MB validated) |
| `talk` | Handheld + Companion | Voice/text input (secret words, voice care commands, species-flavored Muse replies) |
| `completeMiniGame` | Companion + Handheld | Award XP/Drip/Happiness/Energy & update personal best high scores for `runner`, `blaster`, `beat`, or `ember` (Ember Vale) |
| `buyCosmetic` / `equipCosmetic` | Companion + Handheld | Drip Shop purchase & equip (+5 Happiness first wear only) |
| `setDisplayStage` | Companion + Handheld | Nostalgia stage display (unlocked Stage 3) |
| `updateSettings` | Companion + Handheld | Toggle clock (`60` demo vs `1` real-time) & sound |
| `resetPet` | Companion + Handheld | Returns pet state to unhatched Title Screen so a new starter can be chosen |
