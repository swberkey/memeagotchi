# MemeAgotchi — Handheld Hardware & Simulator Architecture (v1.1)

Target platform: **ESP32-S3 custom/modded pocket console** (AiPi Lite or bare ESP32-S3-N16R8 module + off-the-shelf 1.69" IPS display + tactile D-Pad & 3 buttons).
Updated **2026-11-20** (see [ADR-002](./decisions/ADR-002-handheld-280x240-roster-games.md)).

---

## 1. Target Hardware BOM (Cheap, Widely Available Off-the-Shelf Parts)

| Subsystem | Recommended Part | Key Specs | Typical Street Price |
| :--- | :--- | :--- | :--- |
| **MCU / Radio** | **ESP32-S3-N16R8** (AiPi Lite base or ESP32-S3 DevKit/Zero) | Dual-core 240 MHz, 8 MB PSRAM, 16 MB Flash, Wi-Fi 2.4 GHz + BLE 5 | \$4–\$10 (or \$29–\$36 complete AiPi Lite) |
| **Display (NEW TARGET)** | **1.69" ST7789V2 IPS TFT LCD Module** (e.g., Waveshare 1.69" LCD / generic GMT020 ST7789V2 breakout) | **240×280 native → rotated Landscape `280×240`**, **262K RGB color** (RGB565 / RGB666), rounded corners, IPS wide viewing angle, 4-wire SPI, 3.3V native | **\$2–\$4** (AliExpress / LCSC) · **\$6–\$10** (Waveshare / Amazon / US distributors) |
| **Physical Controls** | **4-way tactile D-Pad + 3 dome/tactile buttons (`O`, `X`, `--`)** | 7 momentary switches (Up, Down, Left, Right, `O`, `X`, `--`) | \$0.50–\$1.50 |
| **Audio** | **I2S MEMS Mic (INMP441) + I2S Amp (MAX98357A) + 20mm 8Ω Speaker** (built-in on AiPi Lite) | Push-to-talk voice + SNES synth/TTS playback | \$3–\$5 |
| **Battery / Power** | **450–800 mAh 3.7V LiPo + USB-C TP4056/charging IC** | Deep sleep + RTC wakeups | \$3–\$5 |

### ESP32-S3 Pin Budget (`280×240` ST7789V2 + 7 Buttons + Audio)
- **Display (4-wire SPI, 6 pins):** `SCLK`, `MOSI`, `CS`, `DC`, `RST`, `BL` (PWM dimming). Runs smoothly at 40–80 MHz SPI DMA (> 45–60 FPS partial/full framebuffer in PSRAM).
- **Controls (7 buttons):**
  - *Option A (Direct GPIOs — simplest on bare ESP32-S3):* 7 input-pullup GPIOs (zero scanning overhead, instant interrupt wake from deep sleep on `--` or `O`).
  - *Option B (Pin-constrained AiPi Lite back header):* Single **PCF8574 / MCP23008 I2C GPIO expander** (2 shared I2C pins for all 7 buttons + 1 interrupt pin, ~\$0.40) OR a 2-pin resistor ADC ladder.
- **Audio (I2S):** 3–5 pins (shared `BCLK`/`WS` + `DOUT` speaker + `DIN` mic).

---

## 2. Physical Layout & Control Mapping

```text
┌────────────────────────────────────────────────────────────────────┐
│  MEMEAGOTCHI-280 · ESP32-S3 · 1.69" ST7789V2 (262K IPS)   ••••    │
│                                                                    │
│     [ ▲ ]       ┌──────────────────────────────┐        ( O )      │
│  [ ◄ ] [ ► ]    │    280 × 240 LANDSCAPE       │    ( X )          │
│     [ ▼ ]       │     ROUNDED-CORNER IPS       │        [ -- ]     │
│                 └──────────────────────────────┘                   │
│                            — USB-C —                               │
└────────────────────────────────────────────────────────────────────┘
```

| Input | Menus / Pet Screen | 3 SNES Arcade Games | Voice / Push-to-Talk |
| :--- | :--- | :--- | :--- |
| **D-Pad (`▲ ▼ ◄ ►`)** | Navigate menus, scroll memes, pick starter species & labels | 4-way / 8-way movement, duck/drop, rhythm directional notes | — |
| **`O` Button** | Confirm / Select / Open / Feed | Primary Action (Jump, Fire Meme Orb, `O` Beat) | — |
| **`X` Button** | Back / Cancel / Unequip | **Species Signature Special Move** (`Bubble Shield`, `Fire Dash`, `Glitch Blink`, `Zen Slow`, `Phantom Phase`) + `X` Beat | — |
| **`--` Button** | Open Main Menu / Toggle Pause | Pause / Resume / Return to Game Menu | **Hold `--` (≥500ms)** = Push-to-Talk Voice to Muse Brain |

---

## 3. Three-Layer System Split

```text
┌────────────────────────────────────────────────────────────────────┐
│ COMPANION (Web / Phone — apps/web-companion)                       │
│ Title Screen & 5-Starter Hatch, Meme upload (≤5 MB), Feed voting,  │
│ Drip Shop, On-screen D-Pad + O/X/-- Arcade, Device Sync & Backup   │
└──────────────▲─────────────────────────────────────┬───────────────┘
               │ sync (Wi-Fi / HTTP RPC)             │ state backup
┌──────────────┴─────────────────────────────────────▼───────────────┐
│ BRAIN (Muse / Voice Agent)                                         │
│ Species-flavored personality, spoken replies, voice secret words   │
└──────────────▲─────────────────────────────────────┬───────────────┘
               │ events up / speech down             │
┌──────────────┴─────────────────────────────────────▼───────────────┐
│ DEVICE FIRMWARE (ESP32-S3, 280×240 ST7789V2)                       │
│ Local game engine (port of packages/game-core), 60fps sprite &     │
│ SNES mini-game renderer, D-Pad + O/X/-- input, deep sleep / RTC    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 4. 16 MB Flash Asset Budget (`280×240` Landscape, 5 Starter Species)
- **Memes:** `280×240` compressed JPEG/RGB565 thumbnails (~8–14 KB each) → 120-meme pack ≈ **1.6 MB**.
- **5 Starter Species Sprites:** 5 species × 5 evolution stages × key mood frames (indexed 8-bit palette / RLE sprites) ≈ **3.2 MB**.
- **12 Illustrated Cosmetics Overlays:** Indexed sprites with per-stage anchor tables ≈ **0.6 MB**.
- **3 SNES Mini-Games + Audio Synth:** Procedural 8-bit/16-bit synth SFX + tilemaps + firmware engine ≈ **4.2 MB**.
- **Total:** ~**9.6 MB / 16 MB flash** (over 6 MB headroom for OTA partitions and larger meme packs).
- **RAM Budget (8 MB PSRAM):** A full `280×240` 16-bit RGB565 framebuffer is only **`134.4 KB`** (`280 × 240 × 2 bytes`) — double-buffering takes just **269 KB**, fitting comfortably in SRAM/PSRAM for silky-smooth 60 FPS scrolling!
