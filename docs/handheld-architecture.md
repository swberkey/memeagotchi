# MemeAgotchi — Handheld Re-Architecture

Target class: Muse handheld devices like the **AiPi Lite** (AiPi / XDC).
Written 2026-11-17. Current builds: hosted web app (slug `memeagotchi`) and the
standalone localStorage project (`memeagotchi-project.zip`, Nov 8).

**Design revision (Scott, 2026-11-17):** the target screen is now **192×192**,
not the AiPi Lite's stock 128×128 — Scott is speccing a screen swap on the
handheld. The simulator was retargeted to 192×192 with a 16-bit SNES-style UI
pass (full color, RPG menu windows). Sections below that cite 128×128 describe
the stock AiPi Lite; read them at 192×192 for the current design target.

## 1. The target hardware (verified from the AiPi Lite product page, 2026-11-17)

| Part | Spec |
|---|---|
| Processor | ESP32-S3 |
| Memory | 8 MB PSRAM |
| Storage | 16 MB flash |
| Display | 128 × 128 LCD |
| Input | One physical press-to-talk button (stock UX); exposed GPIO pins on the back |
| Audio | Built-in microphone + speaker |
| Radio | 2.4 GHz Wi-Fi b/g/n; Bluetooth 5 LE hardware present but not enabled in stock firmware |
| Battery | 450 mAh detachable module, USB-C charging; 46 g total |
| Price | $28.99–$35.99 |

Two platform facts drive everything:

1. **It is voice-first and cloud-brained.** Stock firmware is a talk-to-a-character
   device: press the button, speak, a cloud LLM answers through the speaker. The
   screen is a face/status display, not an app surface.
2. **AiPi officially supports running Muse on it.** The product page links a
   browser-based Muse installer (muse.aipi.com): flash Muse firmware, keep a
   backup, restore stock whenever. Community Muse builds already show the
   pieces we need: custom avatars with listening / thinking / idle animation
   states, on-screen text replies, push-to-talk, and spoken replies via
   third-party TTS. The Muse SDK side is young — one community screen
   improvement was noted as "not yet merged into the SDK" (Oct 2026) — so the
   plan treats the Muse link as a layer we can swap, not a foundation we
   depend on.

## 2. What the hardware does to the game design

The web build assumes a big screen, a pointer, and a browser. The handheld
assumes none of that. Design rules that follow:

- **128 × 128 is the whole UI.** One monster, drawn big. Stats become icons and
  pips, never numbers-and-bars panels. Text is for short replies only.
- **One button + voice is the whole controller.** Every interaction must work as
  (a) a button gesture, or (b) something you say to the monster.
- **The monster can talk back.** This is the upgrade, not a constraint: the pet's
  personality runs on Muse. It begs for memes, reacts to care, complains when
  neglected — in voice, in character.
- **Always with you, mostly asleep.** 450 mAh means the game loop must live in
  deep sleep with RTC wake-ups. Decay ticks are computed from elapsed time on
  wake, exactly like the GDD's server-side decay with an offline floor of 25 —
  the handheld just makes "offline" the normal state.
- **16 MB flash is the whole world.** Assets are a budget, not a folder (see §5).

## 3. New architecture — three layers

```
┌─────────────────────────────────────────────────────────┐
│ COMPANION (phone / web — the existing build, slimmed)   │
│ Meme posting, feed browsing, Drip shop, settings,       │
│ account + device pairing. Pushes meme packs to device.  │
└──────────────▲──────────────────────────┬───────────────┘
               │ sync (Wi-Fi, when awake)  │ state backup
┌──────────────┴──────────────────────────▼───────────────┐
│ BRAIN (Muse)                                            │
│ The monster's personality: a Muse agent that receives   │
│ game events ("fed a spicy meme", "ignored for 6h"),     │
│ speaks in character, and can trigger game actions.      │
└──────────────▲──────────────────────────┬───────────────┘
               │ events up / speech down  │
┌──────────────┴──────────────────────────▼───────────────┐
│ DEVICE FIRMWARE (ESP32-S3)                              │
│ Sprite renderer + animation states · local game engine  │
│ (stats, decay, evolution, Drip) · button state machine  │
│ · asset packs in flash · Wi-Fi client · deep sleep/RTC  │
└─────────────────────────────────────────────────────────┘
```

Key decision: **the game engine lives on the device, the personality lives in
Muse, the heavy content lives in the companion.** The pet survives with no
network (it just gets quieter); Muse makes it charming when connected; the
companion handles everything that needs a real screen.

## 4. GDD system mapping

| GDD system | Fate on handheld |
|---|---|
| Care loop (feed / groom / play / sleep) | **Keep, on device.** Button cycles actions, long-press confirms; or just tell it: "feed him." |
| Stat decay + offline floor 25 | **Keep, on device.** Computed from RTC elapsed time on wake; identical math to the GDD. |
| Evolution (5 stages, Blob → Eldritch Meme Lord) | **Keep.** One sprite set per stage; evolution is a full-screen animation moment. |
| Meme feed + label voting (tasty +2 / spicy +3 / blech −1) | **Transform.** One meme at a time, full-screen 128 × 128. Label by voice ("spicy!") or button: short = tasty, double = spicy, long = blech. The label *is* the feeding. |
| Belly digestion + backflow (15 min) | **Keep, on device.** A timer and a very proud burp animation. |
| Secret words (stonks, doge, rickroll…) | **Transform — and improve.** They're *spoken* now. Say "doge" to the device and it reacts. The mic finally earns its keep. |
| Meme Slots (3 base, 7 max) | **Keep.** The device's meme pack holds N memes; companion refills it. |
| Mini-game: Meme Dodge | **Transform.** One-button timing/reflex game on the 128 × 128 screen. |
| Mini-game: Label Match | **Transform.** Voice quiz — it shows a meme, you shout the label. |
| Drip shop + cosmetics | **Split.** Wearing cosmetics renders on device (sprite overlays — yes, the glasses anchor problem returns at 128 × 128, and this time we anchor per-stage). Shopping itself happens in the companion. |
| Post your own memes | **Move to companion.** Needs a keyboard and a real screen. Device receives them in the next meme pack. |
| Server-side state (fullstack build) | **Becomes sync + backup.** Device is source of truth for the pet; server keeps the feed catalog and a state backup. |

## 5. Asset budget (16 MB flash)

The current web build's 9 meme photos total ~1.1 MB at web size. On device:

- Memes ship as 128 × 128 thumbnails, ~4–8 KB each → a 200-meme pack ≈ 1.5 MB.
- Sprites: 5 stages × ~6 animation states (idle, happy, hungry, sleepy,
  eating, sick) × a few frames, indexed-color bitmaps ≈ 2–3 MB total.
- Cosmetics overlays ≈ 0.5 MB. Sound effects (8-bit bleeps, no samples) ≈ synth at runtime, ~0 MB.
- Firmware + engine budget ≈ 4 MB.
- **Total ≈ 8–9 MB, leaving half the flash free** for bigger meme packs.

## 6. Input scheme (one button, honestly designed)

- **Short press** — next action / advance meme.
- **Long press** — confirm / feed with current label.
- **Double press** — open the care wheel (feed → groom → play → sleep icons).
- **Press-and-hold + talk** — push-to-talk to the monster (stock gesture; the
  Muse firmware builds already use it).
- Everything button-doable is also sayable. Voice is the shortcut, never the
  only path — a pet you can only feed by shouting at it on a bus is a bad pet.

## 7. Power & offline behavior

- Deep sleep between interactions; wake on button, RTC decay tick every
  15 min (aligned with backflow), and Wi-Fi sync windows.
- Offline: full game, no voice replies (pre-recorded bleep reactions instead),
  events queue for Muse and flush on next connection — the monster "tells you
  about its day" when you're back on Wi-Fi.
- Charging over USB-C = desk mode: livelier idle animation, sync, meme pack
  refresh.

## 8. Build order

0. **No-hardware simulator** — a 128 × 128, one-button emulation of the new UI
   running the real game math, built on the existing web codebase. Proves the
   design before anyone buys hardware. *(Can start immediately.)*
1. **Firmware skeleton** — ESP32-S3: sprite renderer, button state machine,
   decay engine, deep sleep. Runs on any ESP32-S3 dev board, not just AiPi.
2. **Muse link** — flash the official Muse firmware path (muse.aipi.com) on a
   real AiPi Lite; wire game events → Muse agent; spoken replies back.
   Fallback if the Muse SDK fights us: custom firmware speaking to a small
   bridge service — the three-layer design keeps this swap contained.
3. **Companion sync** — slim the existing fullstack build into the companion:
   meme packs down, state backup up, shop.

## 9. Risks / unknowns

- Muse-on-AiPi is community-young (Oct 2026 builds); SDK gaps are documented
  by its own contributors. Phase 0 and 1 don't depend on it.
- TTS on the Muse path is third-party in community builds (VoiceRSS /
  ElevenLabs keys) — budget a key or accept bleep-speak offline.
- Stock firmware disables Bluetooth for user features; custom firmware on
  ESP32-S3 can use BLE, but that's our code to write and test.
- AiPi Lite is one agent per device by design in the XDC world; the Muse
  firmware route is the one that fits a game, and it's the route this plan
  takes — stock XDC character creation is a fallback personality layer, not
  the game.
