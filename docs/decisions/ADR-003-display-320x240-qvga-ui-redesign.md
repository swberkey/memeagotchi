# ADR-003: Standardize Display on Landscape `320×240` (4:3 QVGA) & Stylistic UI Redesign

- **Status:** Accepted (supersedes `280×240` display target in ADR-002; preserves 5 starter species, D-Pad + `O`/`X`/`--` controls, 3 SNES mini-games, and progression rules)
- **Date:** 2026-11-20
- **Owner:** Scott Berkey

## Context
Following the `280×240` prototype, we decided to standardize the handheld display, SNES mini-game canvas, and simulator viewport on **Landscape `320×240` (classic 4:3 QVGA, 262K color IPS)** and execute a stylistic, more user-friendly UI redesign across both the Handheld Simulator and Web Companion.

## Decisions

### 1. New Hardware Display Target: `320×240` (4:3 QVGA, 262K Color IPS, 4-Wire SPI)
- **Why `320×240`?**
  - `320×240` (240×320 portrait rotated landscape via `MADCTL`) is the single most widely manufactured, lowest-cost IPS TFT resolution in the embedded market, with drop-in support across `TFT_eSPI`, `LovyanGFX`, `LVGL`, and `Adafruit_GFX`.
  - Classic **4:3 aspect ratio** matches retro SNES consoles, gives `+40px` wider canvas space for side-scrolling, arena combat, and 5-lane rhythm readability, and fits meme aspect ratios cleanly in Full-Screen Feed & Sleep Meme Dream Screensaver modes.
- **Recommended Off-the-Shelf Parts:**
  - **Primary Pocket Panel:** **2.0" ST7789VW IPS SPI TFT Module** (240×320 native → rotated `320×240` landscape, 262K RGB, 4-wire SPI, 3.3V/5V). Generic GMT020-02 ST7789 breakouts: **~\$2.50–\$5**; Waveshare 2.0" IPS SPI Module: **~\$10.99**; Waveshare ESP32-S3-LCD-2 all-in-one dev board (ESP32-S3 + 2.0" 320×240 ST7789 IPS + built-in 6-axis IMU): **~\$15–\$25**.
  - **Drop-In Larger Option:** **2.4" ST7789 / ILI9341 320×240 IPS SPI Module** (~\$3–\$6 direct / \$6–\$13 maker retailers).
- **RAM Budget:** `320 × 240 × 2 bytes = 153.6 KB` RGB565 per frame (`307.2 KB` double-buffered in ESP32-S3 SRAM/PSRAM — comfortably runs at 60 FPS SPI DMA).

### 2. Stylistic & User-Friendly UI Redesign
- **Cohesive Neo-Kawaii Retro Handheld Language:** Unified typography (`Silkscreen` / `Press Start 2P` display + `Plus Jakarta Sans` clean UI copy), glassmorphic cards, species-adaptive accent tints, and higher contrast across both apps.
- **Direct-Touch + Hardware Button Parity on `320×240` Simulator:** Users can click/tap directly on menu icon tiles, dock shortcuts (`Feed`, `Care`, `Play`, `Menu`), meme full-screen toggle, and game cartridges OR use the physical D-Pad + `O`/`X`/`--` buttons and keyboard.
- **4 Collectible Pocket Shell Colorways:** Live shell switcher in the Handheld Simulator (`Cosmic Obsidian`, `Atomic Lavender`, `Mint Cream`, `Retro SNES`).
- **Always-On Meme Dream Screensaver & Full-Screen `▲` Feed Preserved at 4:3 (`320×240`):** The 1/8-size gliding pixel sleeping monster sprite (`40px` logical width on `320×240`) glides across the fed-meme slideshow, woken by Light, Sound, or Motion sensors.

## Consequences
- `SCREEN_W` in `packages/snes-games` increases from `280` → `320` (`aspect-[4/3]`).
- All three SNES mini-games (`Meme Runner DX`, `Troll Blaster`, `Vibe Beat`) reflow their HUD, arena bounds, and concert highway cleanly to `320×240`.
- All architecture docs, contracts, hardware BOM, README, and UI labels reflect `320×240` (4:3).
