# MemeAgotchi — Handheld Hardware & Simulator Architecture (v1.2 · 320×240)

Target platform: **ESP32-S3 pocket console** (`ESP32-S3-N16R8` or Waveshare ESP32-S3 2.0" dev base + off-the-shelf 2.0" / 2.4" `320×240` 4:3 IPS display + tactile D-Pad & 3 buttons + ambient wake sensors).
Updated **2026-11-20** (see [ADR-003](./decisions/ADR-003-display-320x240-qvga-ui-redesign.md)).

---

## 1. Target Hardware BOM (Cheap, Widely Available Off-the-Shelf Parts)

| Subsystem | Recommended Part | Key Specs | Typical Street Price |
| :--- | :--- | :--- | :--- |
| **MCU / Radio** | **ESP32-S3-N16R8** (standalone DevKit/module, or **Waveshare ESP32-S3 2" LCD Board** all-in-one with built-in display & IMU) | Dual-core 240 MHz, 8 MB PSRAM, 16 MB Flash, Wi-Fi 2.4 GHz + BLE 5 | \$4–\$10 standalone (or \$15–\$25 all-in-one ESP32-S3 + 2.0" 320×240 + IMU) |
| **Display (320×240 4:3 TARGET)** | **2.0" ST7789VW IPS TFT LCD Module** (e.g., Waveshare 2.0" SPI IPS / generic GMT020-02 ST7789) — or drop-in **2.4" ST7789 / ILI9341 320×240 IPS SPI** | **240×320 native → rotated Landscape `320×240` (4:3 QVGA)**, **262K RGB color** (RGB565/RGB666), IPS wide viewing angle, 4-wire SPI, 3.3V/5V | **\$2.50–\$5** (AliExpress / LCSC) · **\$7–\$11** (Waveshare / Amazon / PiShop) |
| **Physical Controls** | **4-way tactile D-Pad + 3 dome/tactile buttons (`O`, `X`, `--`)** | 7 momentary switches (Up, Down, Left, Right, `O`, `X`, `--`) | \$0.50–\$1.50 |
| **Audio** | **I2S MEMS Mic (INMP441) + I2S Amp (MAX98357A) + 20mm 8Ω Speaker** | Push-to-talk voice + SNES synth/TTS playback + Sound-activity wake | \$3–\$5 |
| **Ambient Carry Wake Sensors** | **LIS3DH / QMI8658 I2C IMU** (motion/pickup interrupt) + **BH1750 I2C ALS or GL5528 LDR** (ambient light wake) + **INMP441 Mic** (sound wake) | Ultra-low-power hardware interrupts wake the `320×240` IPS into the **Meme Dream Screensaver** whenever carried, touched, lit, or spoken near | **\$0.80–\$2.20** (QMI8658 already onboard Waveshare ESP32-S3 2" board!) |
| **Battery / Power** | **500–800 mAh 3.7V LiPo + USB-C TP4056/charging IC** | Light/Deep sleep + RTC & sensor interrupt wakeups | \$3–\$5 |

### ESP32-S3 Pin Budget (`320×240` ST7789VW + 7 Buttons + Audio + Wake Sensors)
- **Display (4-wire SPI, 6 pins):** `SCLK`, `MOSI`, `CS`, `DC`, `RST`, `BL` (PWM dimming). Runs smoothly at 40–80 MHz SPI DMA (> 50–60 FPS double-buffered in PSRAM/SRAM via `LovyanGFX` or `TFT_eSPI`).
- **Controls (7 buttons):**
  - *Option A (Direct GPIOs — simplest on bare ESP32-S3):* 7 input-pullup GPIOs (zero scanning overhead, instant interrupt wake on `--` or `O`).
  - *Option B (Pin-constrained boards):* Single **PCF8574 / MCP23008 I2C GPIO expander** (shared I2C bus for all 7 buttons + 1 interrupt pin, ~\$0.40).
- **Audio (I2S):** 3–5 pins (shared `BCLK`/`WS` + `DOUT` speaker + `DIN` mic).
- **Carry Wake Sensors (shared I2C + 1–2 RTC wake pins):** `LIS3DH`/`QMI8658` motion `INT1` + `BH1750`/LDR comparator on ESP32-S3 `RTC_GPIO` pins for microamp standby with instant wake into the **Meme Dream Screensaver**.

---

## 2. Physical Layout & Control Mapping

```text
┌──────────────────────────────────────────────────────────────────────┐
│  MEMEAGOTCHI-320 · ESP32-S3 · 2.0" ST7789VW 320×240 (4:3 IPS)  •••• │
│                                                                      │
│     [ ▲ ]       ┌──────────────────────────────────┐       ( O )     │
│  [ ◄ ] [ ► ]    │      320 × 240 LANDSCAPE (4:3)   │   ( X )         │
│     [ ▼ ]       │       262K COLOR IPS DISPLAY     │       [ -- ]    │
│                 └──────────────────────────────────┘                 │
│                              — USB-C —                               │
└──────────────────────────────────────────────────────────────────────┘
```

| Input | Menus / Pet Screen | 3 SNES Arcade Games | Voice / Push-to-Talk |
| :--- | :--- | :--- | :--- |
| **D-Pad (`▲ ▼ ◄ ►`)** | Navigate 5×2 icon menu, pick starter species & labels; in **Feed**, **`▲` toggles Full-Screen `320×240` Meme Display** (`◄ ►` browse full-screen, `▼` cycle vibe) | 4-way / 8-way movement, duck/drop, rhythm directional notes | — |
| **`O` Button** | Confirm / Select / Open / Feed / Wake from Sleep Dream Saver | Primary Action (Jump, Fire Meme Orb, `O` Beat) | — |
| **`X` Button** | Back / Cancel / Exit Full-Screen Meme / Unequip | **Species Signature Special Move** (`Bubble Shield`, `Fire Dash`, `Glitch Blink`, `Zen Slow`, `Phantom Phase`) | — |
| **`--` Button** | Open Main Menu / Toggle Pause / Wake from Sleep | Pause / Resume / Return to Game Menu | **Hold `--` (≥450ms)** = Push-to-Talk Voice to Muse Brain |

### Signature Carry Feature — Always-On Meme Dream Screensaver
- While the monster is sleeping, the ESP32-S3 idles in low-power standby with **Light, Sound, and Motion wake sensors** armed.
- Whenever the handheld detects **ambient light** (pulled out of a pocket / room lights on), **sound** (voice / music / clap), or **motion** (clipped to a bag / picked up off a desk), the `320×240` IPS wakes straight into the **Meme Dream Screensaver**:
  - Full-screen 4:3 slideshow cycling the **exact memes the monster has fed on** (currently in belly + digested history).
  - A crisp **1/8-size (`40×40` logical px / `12.5%` width) pixel-art sleeping monster sprite** glides smoothly across the screen with floating dream-bubble motes so it looks like your monster is dreaming of its favorite memes.

---

## 3. Three-Layer System Split

```text
┌────────────────────────────────────────────────────────────────────┐
│ COMPANION (Web / Phone — apps/web-companion)                       │
│ Title Screen & 5-Starter Hatch, Meme upload (≤5 MB), Feed voting,  │
│ Drip Shop, On-screen D-Pad + O/X/-- 320×240 Arcade, Device Sync    │
└──────────────▲─────────────────────────────────────┬───────────────┘
               │ sync (Wi-Fi / HTTP RPC)             │ state backup
┌──────────────┴─────────────────────────────────────▼───────────────┐
│ BRAIN (Muse / Voice Agent)                                         │
│ Species-flavored personality, spoken replies, voice secret words   │
└──────────────▲─────────────────────────────────────┬───────────────┘
               │ events up / speech down             │
┌──────────────┴─────────────────────────────────────▼───────────────┐
│ DEVICE FIRMWARE (ESP32-S3, 320×240 ST7789VW / ILI9341)             │
│ Local game engine (port of packages/game-core), 60fps sprite &     │
│ SNES mini-game renderer, D-Pad + O/X/-- input, ambient wake sleep  │
└────────────────────────────────────────────────────────────────────┘
```

---

## 4. 16 MB Flash & RAM Asset Budget (`320×240` 4:3 Landscape, 5 Starter Species)
- **Memes:** `320×240` compressed JPEG/RGB565 thumbnails (~10–16 KB each) → 120-meme pack ≈ **1.8 MB**.
- **5 Starter Species Sprites:** 5 species × 5 evolution stages × key mood frames + 1/8-size sleeping dream sprites (indexed 8-bit palette / RLE) ≈ **3.4 MB**.
- **12 Illustrated Cosmetics Overlays:** Indexed sprites with per-stage anchor tables ≈ **0.6 MB**.
- **3 SNES Mini-Games + Audio Synth:** Procedural 8-bit/16-bit synth SFX + tilemaps + firmware engine ≈ **4.4 MB**.
- **Total Flash:** ~**10.2 MB / 16 MB** (nearly 6 MB headroom for OTA partitions and larger meme packs).
- **RAM Budget (8 MB PSRAM):** A full `320×240` 16-bit RGB565 framebuffer is **`153.6 KB`** (`320 × 240 × 2 bytes`) — double-buffering takes **`307.2 KB`**, fitting comfortably in ESP32-S3 SRAM/PSRAM for silky-smooth 60 FPS SPI DMA!
