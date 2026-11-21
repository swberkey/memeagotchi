# MemeAgotchi Hardware Track (Ready for Phase 1 After App Lock)

Target platform: **ESP32-S3** pocket console with **1.69" ST7789V2 IPS TFT LCD (262K color, Landscape `280×240`, rounded corners, 4-wire SPI)**, **4-way tactile D-Pad + 3 action buttons (`O`, `X`, `--`)**, I2S mic + speaker, and 450–800 mAh USB-C LiPo battery.

Reference docs:
- [Handheld Architecture v1.1](../docs/handheld-architecture.md)
- [ADR-002: 280×240 Display, D-Pad + X/O/--, 5 Species, 3 SNES Games](../docs/decisions/ADR-002-handheld-280x240-roster-games.md)
- [Game Engine Contract](../docs/contracts/game-engine-contract.md)
- [Companion ↔ Device Sync Contract](../docs/contracts/companion-device-sync.md)

## Verified Off-the-Shelf Display Part
- **Part:** 1.69" IPS TFT LCD Breakout (`240×280` native, rotated landscape `280×240` via ST7789 `MADCTL`), 262K colors, 4-wire SPI, 3.3V logic, rounded corners.
- **Sources:** Waveshare 1.69" LCD Module (~\$7–\$10), Adafruit 1.69" 280×240 Round Rectangle TFT (~\$10–\$15), generic ST7789V2 1.69" SPI breakouts on AliExpress/Amazon (~\$2–\$6).
- **Double-Buffer RAM:** `280 × 240 × 2 bytes = 134.4 KB` per RGB565 frame (`269 KB` double-buffered in ESP32-S3 PSRAM/SRAM).

## Pre-Hardware Entry Gate
- [x] Core app & simulator unified on `packages/game-core`
- [x] 1.69" ST7789V2 `280×240` display part & D-Pad + `O`/`X`/`--` control spec locked
- [x] 5 starter species + Title Screen + 3 SNES `280×240` games built & verified in simulator
- [ ] Cloud multi-user deployment (Supabase Auth/Postgres/Storage + Capacitor Android wrap)
- [ ] Export `packages/game-core` golden JSON test vectors for ESP32-S3 C/C++ firmware verification
- [ ] Bench prototype: wire ESP32-S3 + 1.69" ST7789V2 + 7 tactile switches (direct GPIO or PCF8574 I2C expander) + INMP441/MAX98357A audio
