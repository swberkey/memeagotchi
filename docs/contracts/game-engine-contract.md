# Game Engine Contract (`packages/game-core`)

This contract specifies the deterministic state machine shared across the Web Companion, the **320×240 (4:3) Landscape Handheld Simulator**, and the future ESP32-S3 C/C++ firmware port.

## 1. Time & Clock Model
- Every engine function takes an explicit UTC epoch millisecond timestamp `nowMs: number`.
- Two clock modes:
  - **`clock = 60` (Demo / Dev mode):** 1 real second = 1 game minute; digestion = 90s; cooldowns = 30s feed / 60s groom / 90s play; Roasted = 60s; XP boost = 5×.
  - **`clock = 1` (Real-time GDD mode):** 1 real second = 1 game second; digestion = 24h; cooldowns = 5m feed / 10m groom / 15m play; Roasted = 1h; XP boost = 1×.

## 2. Starter Species Archetypes & Signature `X` Specials
Every pet has a `species: SpeciesId` selected on the Title / Hatch screen (`hatchStarter` action):

| Species ID | Default Name | Archetype Modifiers | Signature `X` Special |
| :--- | :--- | :--- | :--- |
| `mint-dragon` | Mochi | Balanced `1.0×` decay, `+10%` tasty digestion | **Bubble Shield** (absorbs 1 hit / shields combo) |
| `spicy-imp` | Scoville | Heat cap `120`, cools faster, `+20%` spicy XP, `1.15×` fullness decay | **Fire Dash** (invulnerable dash / clears nearby hazards) |
| `cyber-cat` | Pixel | `+15%` mini-game score & XP, `1.15×` energy decay | **Glitch Blink** (instant blink teleport + score burst) |
| `cozy-frog` | Pebbles | `0.75×` energy decay, `+20%` kibble & sleep recovery | **Zen Slow** (slows hazards/notes + bonus grab) |
| `cursed-ghost` | Wisp | `+50%` blech power, `+25%` Drip gain, `1.15×` happiness decay | **Phantom Phase** (brief intangibility + cursed bonus) |

## 3. Stat Decay & Offline Invariants
- Internal stats (`fullness`, `happiness`, `hygiene`, `energy`, `heat`) are stored as floating-point numbers and rounded only in `toGameView()`.
- **Base Rates per game-hour** (multiplied by species archetype modifiers):
  - Awake: Fullness `−5`, Happiness `−3`, Hygiene `−2`, Energy `−1`.
  - Sleeping: Fullness `−2.5`, Happiness `−1.5`, Hygiene `−1`, Energy `+20` (auto-wakes at Energy `80`).
  - Auto-sleep: When awake Energy reaches `0`, the pet automatically falls asleep.
- **Weekend Grace & Offline Floor (GDD Decision #1):** Decay caps at 72 game-hours and offline decay never drops any stat below `min(startingValue, 25)`.

## 4. Evolution, Streaks, Milestones & 3 SNES Games
- Stages: `1 Blob (0 XP)`, `2 Critter (500 XP)`, `3 Beast (2,500 XP)`, `4 Legend (10,000 XP)`, `5 Eldritch Meme Lord (40,000 XP)`.
- Happiness `0` freezes evolution; Nostalgia unlocks at Stage 3 while Stage 5 aura stays tied to `actualStage`.
- **Daily Care Streak:** First care action on consecutive UTC dates increments `careStreak.count` and awards `+10 × min(count, 7)` Drip and `+15 × min(count, 7)` XP.
- **3 SNES Mini-Games (`runner`, `blaster`, `beat`):** Track personal best score, best combo, and play count; cost `5` Energy, grant `+20` Happiness + XP + Drip.
- **Active Digestion Milestone Powers:**
  - `digestedCount >= 5` → **Turbo Charge** (`X` Special recharges 35% faster)
  - `digestedCount >= 15` → **Second Wind** (1 automatic free hit-shield per run)
  - `digestedCount >= 30` → **Meme Overdrive** (`×1.5` starting score multiplier)
