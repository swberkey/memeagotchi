# MemeAgotchi Hardware Track (Ready for Phase 1 After App Lock)

Target platform: **ESP32-S3** pocket console with **2.0" ST7789VW (or 2.4" ST7789/ILI9341) IPS TFT LCD (262K color, Landscape `320×240` 4:3 QVGA, 4-wire SPI)**, **4-way tactile D-Pad + 3 action buttons (`O`, `X`, `--`)**, I2S mic + speaker, ambient wake sensors (Light + Sound + Motion), and 500–800 mAh USB-C LiPo battery.

Reference docs:
- [Handheld Architecture v1.2 (320×240)](../docs/handheld-architecture.md)
- [ADR-003: Standardize on 320×240 (4:3 QVGA) & Stylistic UI Redesign](../docs/decisions/ADR-003-display-320x240-qvga-ui-redesign.md)
- [ADR-002: Roster, D-Pad + X/O/--, 3 SNES Games](../docs/decisions/ADR-002-handheld-280x240-roster-games.md)
- [Game Engine Contract](../docs/contracts/game-engine-contract.md)
- [Companion ↔ Device Sync Contract](../docs/contracts/companion-device-sync.md)

## Verified Off-the-Shelf Display Parts (`320×240` 4:3)
- **Primary Pocket Part:** **2.0" ST7789VW IPS TFT LCD Breakout** (`240×320` native, rotated landscape **`320×240`** via ST7789 `MADCTL`), 262K colors, 4-wire SPI, 3.3V/5V logic.
- **Sources:** Generic 2.0" GMT020-02 ST7789 breakouts (~\$2.50–\$5), Waveshare 2.0" SPI IPS LCD Module (~\$10.99), **Waveshare ESP32-S3 2" Display Dev Board** (all-in-one ESP32-S3 + 2.0" 320×240 ST7789 IPS + onboard 6-axis IMU for ~\$15–\$25), or drop-in **2.4" ST7789 / ILI9341 320×240 IPS SPI** modules (~\$3–\$6 direct / \$6–\$13 maker retailers).
- **Double-Buffer RAM:** `320 × 240 × 2 bytes = 153.6 KB` per RGB565 frame (`307.2 KB` double-buffered in ESP32-S3 PSRAM/SRAM).
- **Always-On Carry Wake Sensors (Meme Dream Screensaver):** Pair a low-power I2C IMU (`LIS3DH` / `QMI8658` motion interrupt) + ambient light sensor (`BH1750` or LDR divider) + `INMP441` mic wake so the sleeping handheld automatically lights up into a full-screen 4:3 slideshow of the monster's fed memes with a gliding 1/8-size pixel sleeping sprite whenever it detects light, sound, or motion.

## Pre-Hardware Entry Gate
- [x] Core app & simulator unified on `packages/game-core`
- [x] `320×240` (4:3) ST7789VW/ILI9341 display part, D-Pad + `O`/`X`/`--` control spec, and Light/Sound/Motion carry-wake spec locked
- [x] 5 starter species + Title Screen + 3 SNES `320×240` games + Full-Screen `▲` Feed + Sleep Dream Screensaver built & verified
- [ ] Cloud multi-user deployment (Supabase Auth/Postgres/Storage + Capacitor Android wrap)
- [ ] Export `packages/game-core` golden JSON test vectors for ESP32-S3 C/C++ firmware verification
- [ ] Bench prototype: wire ESP32-S3 + 2.0" ST7789VW `320×240` + 7 tactile switches (direct GPIO or PCF8574 I2C expander) + INMP441/MAX98357A audio + LIS3DH/BH1750 wake sensors
