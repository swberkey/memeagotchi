# ADR-002: Landscape 280×240 ST7789V2 Display, D-Pad + X/O/-- Controls, 5 Starter Species, & 3 SNES Games

- **Date:** 2026-11-20
- **Status:** Accepted
- **Owner:** Scott Berkey

## Context
Following Sprint 2 playtesting, the single-button 192×192 display limited mini-game depth and species variety. To turn the handheld into a genuinely fun pocket SNES-style virtual pet console while keeping BOM cost low and parts regularly available off the shelf, we aligned the hardware target, roster, and games together.

## Decisions
1. **Target Display Module:** Standardize on the widely available **1.69-inch 240×280 262K-color IPS TFT LCD module (ST7789V2 4-wire SPI, 3.3V native, rounded corners)** rotated in hardware (`MADCTL`) to **Landscape `280×240`**.
   - **Pricing & Sourcing:** ~\$2–\$4 direct (AliExpress / LCSC / generic GMT020-style breakouts) and ~\$6–\$10 from Waveshare, Adafruit, Amazon, and major distributors.
   - **Why this part:** Native 3.3V logic matches ESP32-S3 directly, 4-wire SPI uses only 6 pins (SCLK, MOSI, CS, DC, RST, BL), ST7789V2 has first-class support in `LovyanGFX` / `TFT_eSPI` / `esp_lcd`, and rounded corners give a polished pocket-console silhouette.
2. **Physical Console Controls:** Expand from 1 button to a classic pocket-console layout:
   - Left: **4-way tactile D-Pad** (Up, Down, Left, Right)
   - Right: **3 action buttons** labeled **`O`** (Confirm / Primary Action), **`X`** (Back / Species Signature Special Move), and **`--`** (Menu / Pause; **Hold `--`** = Push-to-Talk Voice).
   - **Companion App parity:** Renders an on-screen D-Pad + `O` / `X` / `--` gamepad during mini-games alongside full desktop keyboard controls.
3. **5 Playable Starter Species with Distinct Archetypes & `X` Special Moves:**
   - `mint-dragon` (**Mochi**): Balanced curve, +10% tasty digestion · `X`: **Bubble Shield**
   - `spicy-imp` (**Scoville**): Heat cap 120, faster cooling, +20% spicy XP, 1.15× fullness decay · `X`: **Fire Dash**
   - `cyber-cat` (**Pixel**): +15% mini-game combo/XP, 1.15× energy decay · `X`: **Glitch Blink**
   - `cozy-frog` (**Pebbles**): 0.75× energy decay, +20% kibble/sleep boost · `X`: **Zen Slow**
   - `cursed-ghost` (**Wisp**): +50% blech power, +25% Drip gain, 1.15× happiness decay · `X`: **Phantom Phase**
4. **Title Screen & Single Active Pet Save Slot:**
   - Dedicated Title Screen in both Web Companion and 280×240 Handheld Simulator with Continue / New Pet (5-Starter Species Picker → Name → Hatch) / Mode Switch / Settings, retaining the single-active-pet model matching the 1-pet-per-device handheld.
5. **3 Rebuilt 60fps `280×240` SNES-Style Video Games (`packages/snes-games`):**
   - **Meme Runner DX** (side-scrolling platformer)
   - **Troll Blaster** (4-way top-down arena shooter)
   - **Vibe Beat** (WebAudio chiptune rhythm-reflex stage)
6. **Progression Depth:**
   - Track personal best high scores & max combos per game, Daily Care Streaks, and activate the GDD 5/15/30 digestion milestones inside all 3 games (**5: Turbo Charge**, **15: Second Wind**, **30: Meme Overdrive**).
