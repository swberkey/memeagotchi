# MemeAgotchi Hardware Track (Parked Until App Core & Graphics Are Locked)

Target platform: **ESP32-S3** (AiPi Lite base with **192×192 color LCD swap**, 8 MB PSRAM, 16 MB flash, 1 physical press-to-talk button, mic + speaker, 450 mAh USB-C battery).

Reference docs:
- [Handheld Re-Architecture](../docs/handheld-architecture.md)
- [Game Engine Contract](../docs/contracts/game-engine-contract.md)
- [Companion ↔ Device Sync Contract](../docs/contracts/companion-device-sync.md)

## Pre-Hardware Entry Gate
Before starting Phase 1 firmware:
- [ ] Core app & 192×192 simulator unified on `packages/game-core` and verified bug-free
- [ ] Graphics & UX upgrade pass complete (unifying mint/lavender character art + 5-stage sprites + illustrated outfit overlays)
- [ ] Verify 192×192 LCD panel availability, SPI/QSPI driver IC, and pin compatibility with AiPi Lite GPIO/connector (recommended: Perplexity live sourcing check)
- [ ] Export `packages/game-core` golden test vectors as JSON for C/C++ ESP32-S3 firmware unit tests
