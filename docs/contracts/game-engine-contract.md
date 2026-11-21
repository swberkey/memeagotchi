# Game Engine Contract (`packages/game-core`)

This contract specifies the deterministic state machine shared across the Web Companion, the 192×192 Handheld Simulator, and the future ESP32-S3 C/C++ firmware port.

## 1. Time & Clock Model
- Every engine function takes an explicit UTC epoch millisecond timestamp `nowMs: number`.
- Two clock modes:
  - **`clock = 60` (Demo / Dev mode):** 1 real second = 1 game minute; digestion = 90s; cooldowns = 30s feed / 60s groom / 90s play; Roasted = 60s; XP boost = 5×.
  - **`clock = 1` (Real-time GDD mode):** 1 real second = 1 game second; digestion = 24h; cooldowns = 5m feed / 10m groom / 15m play; Roasted = 1h; XP boost = 1×.

## 2. Stat Decay & Offline Invariants
- Internal stats (`fullness`, `happiness`, `hygiene`, `energy`, `heat`) are stored as floating-point numbers and rounded only in `toView()`.
- **Invariant (Tick Composition):** `tick(tick(s, t1), t2)` produces the same stat values as `tick(s, t2)` (within floating-point tolerance) for continuous awake or continuous sleep intervals.
- **Rates per game-hour:**
  - Awake: Fullness `−5`, Happiness `−3`, Hygiene `−2`, Energy `−1` (Nov 17 retuning, ADR-001).
  - Sleeping: Fullness `−2.5`, Happiness `−1.5`, Hygiene `−1`, Energy `+20` (auto-wakes when Energy reaches `80`).
  - Auto-sleep: When awake Energy reaches `0`, the pet automatically falls asleep.
- **Weekend Grace & Offline Floor (GDD Decision #1):**
  - Decay pauses beyond 72 game-hours of inactivity (`cappedGameHours = min(gameHours, 72)`).
  - When offline > 72 game-hours, offline decay never drops a stat below `min(startingValue, 25)`.

## 3. Evolution, Moods, & Low-Stat Effects
- Stages: `1 Blob (0 XP)`, `2 Critter (500 XP)`, `3 Beast (2,500 XP)`, `4 Legend (10,000 XP)`, `5 Eldritch Meme Lord (40,000 XP)`.
- Happiness `0` freezes evolution advancement until Happiness > `0`.
- Fullness `0` ("Hangry"): training disabled, digestion awards no XP/power gain.
- Fullness `< 30`: training XP rewards reduced by 50%.
- Happiness `< 30`: mini-games refused (Care Play remains available while Happiness > 0 so players can recover).
- Hygiene `0`: social actions (share / custom labels) blocked until groomed.
- **Nostalgia (GDD Decision #2):** Unlocked at Stage 3. `displayStage ≤ actualStage` controls visual silhouette, while Stage 5 aura effects remain tied to `actualStage`.

## 4. Memes, Digestion, Backflow & Secret Moves
- Power: `max(0, tasty*2 + spicy*3 - blech + shares + freshBonus + rottenPenalty)` where `freshBonus = +1` (< 24h old) and `rottenPenalty = -2` (no activity for ≥ 7 days).
- Daily vote budget: `3 + (stage >= 3 ? 1 : 0) + (stage >= 5 ? 1 : 0)` (max 5).
- Belly slots: `min(7, 3 + (stage - 1))`. Duplicate meme in belly disallowed.
- Spicy/Heat: Spicy-dominant meme adds `+25` Heat; meme with any spicy votes adds `+10` Heat. `heat >= 100` triggers Roasted (unless saved once by `rickroll` secret move).
- Digestion tier: `min(10, floor(powerNow / 10)) + min(5, max(0, floor((powerNow - powerAtFed) / 10)))`.
- Post-digestion backflow: Every 15 game-minutes, previously digested memes whose power increased credit bonus XP/Drip up to `+5` power tiers/day per meme.
- Secret moves (10 launch words, case-insensitive, whitespace-normalized) apply live gameplay effects (`stonks`, `doge`, `chad`, `rickroll`, `sus`, `rizz`, `no cap`, `l + ratio`, `mid meme`, `based and correct`).

## 5. Cosmetics
- 5 slots: `head`, `face`, `body`, `back`, `sticker`.
- Equipping strictly requires ownership.
- `+5 Happiness` first-wear bonus is granted **once** per cosmetic item (tracked via `firstWornCosmetics`).
