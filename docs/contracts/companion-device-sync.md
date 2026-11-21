# Companion ↔ Device Sync Contract

Both the **Web Companion** (`/`) and the **Landscape 320×240 (4:3) Handheld Simulator** (`/handheld/`) communicate with `apps/server` through `/api/actions` (typed JSON-RPC POST `{ action, args }`) and `/api/upload` (≤ 5 MB magic-byte-validated image upload).

## Shared Actions Surface
| Action | Used By | Purpose |
| :--- | :--- | :--- |
| `getState` | Companion + Handheld | Ticks decay, digestion, backflow, and returns unified `GameView` (including `hatched`, `species`, `careStreak`, `highScores`, `milestonePowers`) |
| `hatchStarter` | Companion + Handheld | Hatches a new active pet of chosen `species` (`mint-dragon`, `spicy-imp`, `cyber-cat`, `cozy-frog`, `cursed-ghost`) and custom `name` |
| `care` | Companion + Handheld | Feed kibble, Groom, Play, Sleep, Wake (updates Daily Care Streak) |
| `renameMonster` | Companion | Rename active pet (1–24 chars, filtered) |
| `feedMeme` | Companion + Handheld | Feed a meme into a belly slot; optional `label` applies vote simultaneously |
| `voteMeme` | Companion | Cast daily `tasty`/`spicy`/`blech` vote (enforces daily vote budget) |
| `shareMeme` | Companion | Share meme (+1 power, +5 XP, +3 Drip commission) |
| `addCustomLabel` | Companion | Add custom label (profanity/PII filtered, checks secret words) |
| `reportMeme` / `reportLabel` | Companion | Report/flag content (3 reports auto-hide) |
| `postMeme` | Companion | Post meme with template photo or uploaded image path |
| `postBonusMeme` | Handheld | Add one of the built-in bonus memes |
| `postMemeFromUrl` | Companion + Handheld | Fetch external image URL (SSRF-guarded, MIME + ≤5 MB validated) |
| `talk` | Handheld + Companion | Voice/text input (secret words, voice care commands, species-flavored Muse replies) |
| `completeMiniGame` | Companion + Handheld | Award XP/Drip/Happiness/Energy & update personal best high scores for `runner`, `blaster`, or `beat` |
| `buyCosmetic` / `equipCosmetic` | Companion + Handheld | Drip Shop purchase & equip (+5 Happiness first wear only) |
| `setDisplayStage` | Companion + Handheld | Nostalgia stage display (unlocked Stage 3) |
| `updateSettings` | Companion + Handheld | Toggle clock (`60` demo vs `1` real-time) & sound |
| `resetPet` | Companion + Handheld | Returns pet state to unhatched Title Screen so a new starter can be chosen |
