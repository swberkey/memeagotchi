# MemeAgotchi — Game Design Document (v1.0)

Status: **v1.0 — owner-approved** (Scott Berkey, Nov 6, 2026). All seven open decisions are resolved and folded into the systems below; the decisions register is closed. This document is the single source of truth for game systems; the development workflow and prompt library live in `../memeagotchi-dev-plan.md`.

---

## 1. Core Loop

```
Care for your Meme Monster (feed, groom, dress, train)
        ↓
Monster stays healthy → earns Meme Slots
        ↓
Browse the community Meme Feed → feed memes to your Monster
        ↓
Fed memes grant Powers (based on label votes: tasty / spicy / blech)
        ↓
Powers win training mini-games → unlock evolution stages, cosmetics, status
        ↓
Share your memes to the Feed → other players' votes add power
        to YOUR monster's memes (network backflow)
```

Session target: 3–5 minutes, 2–3x daily (tamagotchi cadence), with asynchronous rewards accumulating while offline (meme power backflow) so returning feels rewarding.

---

## 2. Monster Stats

Four core stats, each 0–100. All decay is computed **server-side** from timestamps (never client timers) so browser and Android always agree.

| Stat | Range | Decay rate | Effects at low values | Effects at 0 |
|---|---|---|---|---|
| Fullness | 0–100 | −1 per 12 min (−5/hr) | < 30: Monster sulks, training rewards −50% | Monster enters "Hangry" state (won't train, no power gain) |
| Happiness | 0–100 | −1 per 20 min (−3/hr) | < 30: refuses mini-games | Monster mopes; evolution frozen |
| Hygiene | 0–100 | −1 per 30 min (−2/hr) | < 30: flies visual, other players' monsters avoid play-dates | No social features until groomed |
| Energy | 0–100 | −1 per 15 min awake (−4/hr); +10/hr while sleeping | < 30: training fails chance 50% | Monster falls asleep automatically |

**Offline rule (DECIDED):** decay pauses while the player has no active session older than 72 hours ("weekend grace"), and offline decay alone never drops any stat below 25 (**decay floor**) — a returning player always finds a tired-but-recoverable monster, while neglect still stings.

**Care actions:**

| Action | Effect | Cooldown | Stat |
|---|---|---|---|
| Feed (kibble) | +30 Fullness | 5 min | Fullness |
| Groom | +25 Hygiene | 10 min | Hygiene |
| Play (mini-game) | +20 Happiness, −15 Energy | 15 min | Happiness/Energy |
| Sleep (tuck in) | Monster sleeps until Energy ≥ 80 or player wakes it | once per 8h | Energy |
| Dress up | Cosmetic only; small +5 Happiness first wear of a new outfit | none | Happiness |

---

## 3. Evolution & Progression

Five evolution stages, gated by lifetime XP (earned from care actions, training, and meme power gains):

| Stage | Name (working) | XP needed | Visual change |
|---|---|---|---|
| 1 | Blob | 0 | Simple blob, one color |
| 2 | Critter | 500 | Eyes + stubby limbs |
| 3 | Beast | 2,500 | Distinct silhouette, ears/horns |
| 4 | Legend | 10,000 | Aura particle effects |
| 5 | Eldritch Meme Lord | 40,000 | Glitch aesthetic, animated background |

Evolutions are permanent and cosmetic-agnostic (outfits restage per evolution). **Nostalgia toggle (DECIDED):** unlocked at Stage 3, players may display any previously-attained evolution stage's look — purely visual; Stage 5 aura effects remain tied to actual stage so progression can't be masked, and outfits restage per the displayed stage.

---

## 4. Meme Eating & Powers

### 4.1 Meme slots

Each monster has **Meme Slots** (belly capacity): base 3, +1 per evolution stage (max 7). A meme occupies a slot for 24h, then is "digested" and the slot frees up. Its granted power persists as a permanent stat bump (see 4.3).

### 4.2 Meme rarity & base power

When a meme is uploaded to the feed it starts at base power. Power grows with community labels (Section 5).

| Label received | Vote weight | Effect on meme power | Flavor |
|---|---|---|---|
| tasty | +2 | Meme is nourishing: grants power to eaters | best label |
| spicy | +3 | High risk/reward: grants power but monster gains 10 "Heat" | most viral |
| blech | −1 | Weakens the meme; eaters gain reduced power | bad meme |

Additional system labels (auto-applied, not user-votable): `fresh` (uploaded < 24h ago, +1), `rotten` (no votes for 7 days, −2).

### 4.3 Power grants to monsters

When a monster digests a meme, it gains power proportional to the meme's power at digestion time:

- Power tier: `floor(meme_power / 10)`, capped at 10.
- Stat bump: tier points distributed to the monster's stats chosen by the meme's dominant label:
  - tasty-dominant → Fullness & Happiness
  - spicy-dominant → Energy & training speed
  - blech-dominant → tiny Hygiene bump (garbage diet)
- Powers (special moves) unlock at digestion milestones: 5/15/30 lifetime digested memes.

**Spicy/Heat mechanic:** Heat accumulates from spicy memes; at 100 Heat the monster gets "Roasted" (sick state, 1h). Managing Heat = don't over-feed viral fire memes.

---

## 5. The Meme Network (social layer)

### 5.1 Feed mechanics

- Any player can upload a meme (**file upload only at launch**, ≤ 5 MB, MIME-validated; URL import deferred to post-beta) or share/re-share an existing feed meme. Every meme carries a report/flag button.
- Every player gets **3 label votes per day** (tasty/spicy/blech), one per meme (unique constraint user+meme+label). **Vote budget scales with evolution (DECIDED): +1 at Stage 3 and +1 at Stage 5 (max 5)** — voting is a visible progression reward.
- Custom labels: players unlock the ability to add one custom label per day after Stage 2. Custom labels start with no vote weight but can trend (top custom labels get reviewed for promotion to system labels with weights — a live-ops lever).
- **Custom label moderation (DECIDED):** profanity/PII filter blocks instantly; custom labels go live immediately; 3 user reports auto-hide pending review. No pre-moderation queue — custom labels carry no vote weight until promoted by live-ops, so game-effect risk is contained.
- Shares are tracked: each share event adds +1 to meme power and is attributed (sharer gets a tiny XP cut — "commission").

### 5.2 Network backflow

Every 15 minutes, a server job recalculates each meme's current power and credits **backflow power** to every monster currently digesting or having digested that meme:

- Backflow = `(meme_power_now − meme_power_at_digestion) / 10`, capped at +5/day per monster per meme.
- This is the "your early bet on a viral meme pays off" loop — eating memes before they blow up is the skill expression.

### 5.3 Secret words

Secret words are phrases a player types as a custom label. If it matches a secret table (server-side only, case-insensitive, whitespace-trimmed), the uploading/labeling player's monster unlocks a secret move. First unlock per word is broadcast to the feed ("🔓 someone discovered a secret move") without revealing the word.

Working list (15, to be finalized with Grok in Prompt 0.2; changes below are owner-approved):

| Secret word (working) | Unlocks |
|---|---|
| "stonks" | Market Manipulation (training rewards +25% for 1h) |
| "doge" | Much Speed (super speed: mini-game time +30%) |
| "chad" | Gigachad Strength (super strength: mini-game power +30%) |
| "rickroll" | Never Gonna Give You Up (monster auto-recovers from one sick state) |
| "sus" | Imposter Sense (see upcoming mini-game patterns) |
| "gyatt" | Gravity Shift (slower falling obstacles) |
| "rizz" | Charisma (custom labels you write get +1 vote weight) |
| "no cap" | Cap Breaker (stat cap +5 for a day) |
| "L + ratio" | Ratio Shield (immune to one blech-label penalty) |
| "skibidi" | Skibidi Dash (dodge chance +20%) |
| "sigma" | Lone Wolf (solo training XP ×1.5) |
| "goated" | GOAT Mode (all stats +10 for 1h) |
| "delulu" | Delulu Vision (preview one future feed meme) |
| "mid meme" | Mid Crisis (converts a blech meme to neutral) |
| "based and correct" | Based Boost (next power grant ×2) |

Secret moves are per-account unlocks (persist across evolution), and each secret word can only fire once per account.

**Rollout (DECIDED):** stagger the release — launch with 10 words, hold 5 in reserve for events and seasons so community discovery stays alive. Launch set: stonks, doge, chad, rickroll, sus, rizz, no cap, L + ratio, mid meme, based and correct. Reserve (event/season drops): gyatt, skibidi, sigma, goated, delulu. Final selection of reserve drops is a Grok-session deliverable (Prompt 0.2).

---

## 6. Training & Mini-Games

Training happens in short (30–60s) mini-games that consume Energy and award XP; powers modify outcomes. v1 ships **two** mini-games:

1. **Meme Dodge** (endless runner style): dodge falling meme labels; tests reaction. Feeds Fullness/Happiness XP.
2. **Label Match** (memory/pattern): match label types to meme types. Feeds Energy/XP.

**DECIDED (scope check):** ship 2 mini-games in Phase 4; add more post-beta based on which games players actually replay.

---

## 7. Cosmetics

- Slots: head, face, body, back, sticker (free-placement decal).
- Currency: **Drip** earned via daily care streaks, training, and meme shares. No real-money purchases in v1.
- All game logic server-side; cosmetics are pure data (`monster_cosmetics` table: user_id, slot, asset_id, equipped_at).

---

## 8. Accounts & Cross-Platform

- OAuth: Google (v1), Apple & Discord (post-beta). Supabase Auth; sessions shared between web and the Capacitor Android wrap so stats sync for free.
- Anti-cheat rule: the client never computes stat decay, power math, or secret-word matching — all Edge Functions / Postgres.

---

## 9. Monetization (post-beta outline)

Cosmetics-only, no pay-to-win: cosmetic bundles, evolution "prestige skins," and a "Meme Pass" seasonal cosmetic track. Power and progression must never be purchasable.

---

## 10. Decisions Register (CLOSED — Nov 6, 2026)

All seven open decisions were reviewed and approved by Scott Berkey on Nov 6, 2026. Outcomes are folded into the sections above.

| # | Decision | Outcome |
|---|---|---|
| 1 | Offline decay grace window | 72h pause **+ decay floor of 25** (offline decay never drops a stat below 25) |
| 2 | Nostalgia toggle | **Yes** — visual-only, unlocked at Stage 3; Stage 5 aura stays tied to actual stage |
| 3 | Mini-game count for Phase 4 | **2** (Meme Dodge + Label Match); more post-beta based on replay metrics |
| 4 | Daily label-vote budget | **3 base**, +1 at Stage 3, +1 at Stage 5 (max 5) |
| 5 | Meme upload policy | **File upload only (≤ 5 MB) at launch**; URL import deferred to post-beta; report button on every meme |
| 6 | Custom label moderation | **Filter + post-moderation** (profanity/PII filter, 3 reports auto-hide) — no pre-moderation queue |
| 7 | Secret word list | "mid" → **"mid meme"**, "based" → **"based and correct"**; launch 10, hold 5 in reserve for events |

---

## 11. v1.1 Addendum — Roster, 280×240 Handheld & SNES Arcade Overhaul (Approved Nov 20, 2026)

See [ADR-002](./decisions/ADR-002-handheld-280x240-roster-games.md) for full rationale. All v1.0 systems above remain in effect with the following approved expansions:

- **Title Screen & 5 Starter Species (Single Active Pet Slot):** Players begin on a Title Screen and choose one of 5 starter species with distinct stat-curve archetypes and signature `X` Special Moves:
  1. **Mochi (`mint-dragon`)** — Balanced, +10% tasty digestion · `X`: *Bubble Shield*
  2. **Scoville (`spicy-imp`)** — Heat cap 120, faster cooling, +20% spicy XP, 1.15× fullness decay · `X`: *Fire Dash*
  3. **Pixel (`cyber-cat`)** — +15% mini-game combo & XP, 1.15× energy decay · `X`: *Glitch Blink*
  4. **Pebbles (`cozy-frog`)** — 0.75× energy decay, +20% kibble/sleep bonus · `X`: *Zen Slow*
  5. **Wisp (`cursed-ghost`)** — +50% blech power, +25% Drip gain, 1.15× happiness decay · `X`: *Phantom Phase*
- **Expanded Arcade Trio (replaces v1.0 two-game placeholder):** Three 60fps `280×240` SNES-style games built for D-Pad + `O` / `X` / `--` controls (physical on handheld, on-screen gamepad + keyboard on Companion):
  1. **Meme Runner DX** (side-scrolling platformer)
  2. **Troll Blaster** (4-way top-down arena shooter)
  3. **Vibe Beat** (chiptune rhythm-reflex stage)
- **Active 5 / 15 / 30 Digestion Milestone Powers:**
  - **5 digested — Turbo Charge:** Species `X` Special recharges 35% faster in mini-games.
  - **15 digested — Second Wind:** One automatic free hit-shield/revive per mini-game run.
  - **30 digested — Meme Overdrive:** Start every mini-game with a `×1.5` Overdrive multiplier.
- **Daily Care Streaks & High Scores:** Consecutive UTC care days award escalating Drip & XP bonuses; each of the 3 SNES games tracks personal best score, max combo, and play count.
- **Nov 17 Sleep/Energy Tuning Preserved:** Base awake Energy decay `−1/hr`, Play/Mini-game cost `−5 Energy`, Sleep restore `+20/hr` (modified by species archetype multipliers).
