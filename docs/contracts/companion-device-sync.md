# Companion ↔ Device Sync Contract

Both the **Web Companion** (`/`) and the **192×192 Handheld Simulator** (`/handheld/`) communicate with `apps/server` through `/api/actions` (typed JSON-RPC POST `{ action, args }`) and `/api/upload` (multipart/raw image upload ≤ 5 MB).

## Shared Actions Surface
| Action | Used By | Purpose |
| :--- | :--- | :--- |
| `getState` | Companion + Handheld | Ticks decay, digestion, backflow, and returns unified `GameView` |
| `care` | Companion + Handheld | Feed kibble, Groom, Play, Sleep, Wake |
| `renameMonster` | Companion | Rename pet (1–24 chars, filtered) |
| `feedMeme` | Companion + Handheld | Feed a meme into a belly slot; optional `label` applies vote simultaneously (handheld "label IS feeding" flow) |
| `voteMeme` | Companion | Cast daily `tasty`/`spicy`/`blech` vote (enforces daily vote budget) |
| `shareMeme` | Companion | Share meme (+1 power, +5 XP, +3 Drip commission) |
| `addCustomLabel` | Companion | Add custom label (profanity/PII filtered, checks secret words) |
| `reportMeme` / `reportLabel` | Companion | Report/flag content (3 reports auto-hide per GDD Decisions #5 & #6) |
| `postMeme` | Companion | Post meme with template photo or uploaded image path |
| `postBonusMeme` | Handheld | Add one of the built-in bonus memes via one-button flow |
| `postMemeFromUrl` | Companion + Handheld | Fetch external image URL (SSRF-guarded, MIME + ≤5 MB validated) |
| `talk` | Handheld + Companion | Voice/text input (secret words, voice care commands, Muse replies) |
| `completeMiniGame` | Companion + Handheld | Award XP/Drip/Happiness/Energy for `dodge` or `match` |
| `buyCosmetic` | Companion + Handheld | Purchase Drip shop cosmetic |
| `equipCosmetic` | Companion + Handheld | Equip/unequip owned cosmetic (+5 Happiness first wear only) |
| `setDisplayStage` | Companion + Handheld | Nostalgia stage display (unlocked Stage 3) |
| `updateSettings` | Companion + Handheld | Toggle clock (`60` demo vs `1` real-time) & sound bleeps |
| `resetPet` | Companion + Handheld | Reset to freshly hatched Blob |

## Future ESP32-S3 Hardware Sync Endpoints (Planned Phase 3)
When hardware development starts, the ESP32-S3 firmware will sync over Wi-Fi using a compact binary/JSON subset of `GameState`:
- `GET /api/device/pack` → 192×192 indexed meme thumbnails + meme metadata
- `POST /api/device/sync` → Timestamp-resolved merge of device state backup + queued Muse voice events
