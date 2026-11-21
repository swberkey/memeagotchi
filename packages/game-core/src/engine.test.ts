import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addCustomLabel,
  buyCosmetic,
  careAction,
  completeMiniGame,
  createFreshState,
  equipCosmetic,
  feedMeme,
  hatchStarter,
  milestonePowersFor,
  postBonusMeme,
  postMeme,
  renameMonster,
  reportLabel,
  reportMeme,
  setDisplayStage,
  shareMeme,
  talkAction,
  tickState,
  toGameView,
  updateSettings,
  voteMeme,
} from "./engine.ts";

const T0 = Date.UTC(2026, 10, 20, 12, 0, 0);
const MIN = 60_000;
const HR = 3_600_000;
const DAY = 24 * HR;

function assertClose(actual: number, expected: number, eps = 1e-4) {
  assert.ok(Math.abs(actual - expected) <= eps, `Expected ${actual} to be within ${eps} of ${expected}`);
}

describe("@memeagotchi/game-core", () => {
  it("preserves exact stat decay across rapid 5-second polling (fixes rounding-wipeout bug)", () => {
    const start = createFreshState(T0, 60);

    // Tick once after 60 real seconds (= 1 game-hour at 60x)
    const oneShot = tickState(start, T0 + MIN).state;

    // Tick 12 times in 5-second increments (= 1 game-hour at 60x)
    let polled = start;
    for (let i = 1; i <= 12; i++) {
      polled = tickState(polled, T0 + i * 5_000).state;
    }

    assertClose(polled.fullness, oneShot.fullness);
    assertClose(polled.happiness, oneShot.happiness);
    assertClose(polled.hygiene, oneShot.hygiene);
    assertClose(polled.energy, oneShot.energy);

    // Expected 1 game-hour awake deltas: -5 fullness, -3 happiness, -2 hygiene, -1 energy
    assert.equal(Math.round(polled.fullness), 73);
    assert.equal(Math.round(polled.happiness), 79);
    assert.equal(Math.round(polled.hygiene), 74);
    assert.equal(Math.round(polled.energy), 83);
  });

  it("enforces auto-sleep at Energy 0 and exact sleep->wake threshold at Energy 80", () => {
    const s = createFreshState(T0, 1);
    s.energy = 2;
    s.fullness = 90;
    s.happiness = 90;
    s.hygiene = 90;

    // After 2 real hours at 1x, awake energy hits 0 -> auto-sleep
    const asleep = tickState(s, T0 + 2 * HR);
    assert.equal(asleep.state.isSleeping, true);
    assert.equal(asleep.state.energy, 0);

    // After 4 more hours sleeping (+20/hr), energy hits 80 -> auto-wakes
    const awake = tickState(asleep.state, T0 + 6 * HR);
    assert.equal(awake.state.isSleeping, false);
    assertClose(awake.state.energy, 80);
    assert.ok(awake.notes.some((n) => n.includes("woke up")));
  });

  it("applies 72h weekend grace + decay floor of 25 without inflating stats that started below 25", () => {
    const s = createFreshState(T0, 1);
    s.fullness = 80;
    s.hygiene = 12; // already below 25 before going offline

    // Away for 10 days (240h > 72h grace)
    const after = tickState(s, T0 + 240 * HR).state;
    assert.equal(after.fullness, 25);
    assert.equal(after.hygiene, 12);
  });

  it("advances stage AND displayStage when Care XP crosses an evolution threshold", () => {
    const s = createFreshState(T0, 60);
    s.xp = 470; // 30 XP away from Stage 2 Critter (500 XP); feed gives 10 * 5 = 50 XP at 60x

    const res = careAction(s, "feed", T0 + 1000);
    assert.equal(res.ok, true);
    assert.equal(res.state.stage, 2);
    assert.equal(res.state.displayStage, 2);
    assert.ok(res.notes.some((n) => n.includes("EVOLVED")));
  });

  it("freezes evolution at Happiness 0 and unfreezes when Happiness recovers", () => {
    const s = createFreshState(T0, 60);
    s.xp = 490;
    s.happiness = 0;

    const fed = careAction(s, "feed", T0 + 1000);
    assert.ok(fed.state.xp >= 500);
    assert.equal(fed.state.stage, 1);

    const played = careAction(fed.state, "play", T0 + 2000);
    assert.equal(played.ok, true);
    assert.equal(played.state.stage, 2);
    assert.equal(played.state.displayStage, 2);
  });

  it("enforces cosmetic ownership and grants +5 Happiness ONLY on first wear", () => {
    const s = createFreshState(T0, 60);

    const unowned = equipCosmetic(s, "shades", T0 + 1000);
    assert.equal(unowned.ok, false);

    const bought = buyCosmetic(s, "shades", T0 + 2000);
    assert.equal(bought.ok, true);
    assert.equal(bought.state.drip, 60);

    const beforeHappy = bought.state.happiness;
    const firstEquip = equipCosmetic(bought.state, "shades", T0 + 2000);
    assert.equal(firstEquip.ok, true);
    assertClose(firstEquip.state.happiness, beforeHappy + 5);

    const unequip = equipCosmetic(firstEquip.state, "shades", T0 + 2000);
    const secondEquip = equipCosmetic(unequip.state, "shades", T0 + 2000);
    assert.equal(secondEquip.ok, true);
    assertClose(secondEquip.state.happiness, beforeHappy + 5);
  });

  it("prevents duplicate memes in belly, triggers Roasted at Heat 100, and lets Rickroll auto-save once", () => {
    const s = createFreshState(T0, 60);
    const spicyMeme = s.memes.find((m) => m.key === "stonks")!;

    const f1 = feedMeme(s, { memeId: spicyMeme.id }, T0 + 1000);
    assert.equal(f1.ok, true);
    assert.equal(f1.state.heat, 25);

    const dup = feedMeme(f1.state, { memeId: spicyMeme.id }, T0 + 2000);
    assert.equal(dup.ok, false);

    const unlocked = talkAction(f1.state, "rickroll", T0 + 3000);
    assert.equal(unlocked.ok, true);
    assert.equal(unlocked.state.buffs.rickrollSaveReady, true);

    unlocked.state.heat = 80;
    const disaster = unlocked.state.memes.find((m) => m.key === "disaster")!;
    const saved = feedMeme(unlocked.state, { memeId: disaster.id }, T0 + 4000);
    assert.equal(saved.ok, true);
    assert.equal(saved.state.isRoasted, false);
    assert.equal(saved.state.heat, 40);
    assert.equal(saved.state.buffs.rickrollSaveReady, false);

    saved.state.heat = 85;
    const buttons = saved.state.memes.find((m) => m.key === "buttons")!;
    const roasted = feedMeme(saved.state, { memeId: buttons.id, label: "spicy" }, T0 + 5000);
    assert.equal(roasted.ok, true);
    assert.equal(roasted.state.isRoasted, true);
  });

  it("applies Based Boost, digestion rewards, viral backflow (in-belly & post-digestion), and Hangry gating", () => {
    const s = createFreshState(T0, 60);
    const meme = s.memes[0]!;

    const lbl = addCustomLabel(s, meme.id, "  Based and Correct ", T0 + 1000);
    assert.equal(lbl.ok, true);
    assert.equal(lbl.extra?.unlocked, "Based Boost");
    assert.equal(lbl.state.buffs.basedBoostReady, true);

    const fed = feedMeme(lbl.state, { memeId: meme.id }, T0 + 2000);
    let pumped = fed.state;
    for (let i = 0; i < 12; i++) {
      pumped = shareMeme(pumped, meme.id, T0 + 3000 + i * 100).state;
    }

    const digested = tickState(pumped, T0 + 98_000);
    assert.equal(digested.state.belly.length, 0);
    assert.equal(digested.state.digestedCount, 1);
    assert.equal(digested.state.buffs.basedBoostReady, false);
    assert.ok(digested.notes.some((n) => n.includes("Based Boost")));
    assert.ok(digested.notes.some((n) => n.includes("backflow")));

    // Post-digestion viral backflow after 15+ game-minutes (at 60x, 20 real seconds = 20 game-minutes)
    let viral = digested.state;
    for (let i = 0; i < 12; i++) {
      viral = shareMeme(viral, meme.id, T0 + 100_000 + i * 100).state;
    }
    const postBackflow = tickState(viral, T0 + 125_000);
    assert.ok(postBackflow.notes.some((n) => n.includes("Viral backflow")));

    // Hangry (Fullness 0) refuses training
    const hangry = createFreshState(T0, 60);
    hangry.fullness = 0;
    const trainAttempt = completeMiniGame(hangry, "runner", 120, T0 + 1000, 5);
    assert.equal(trainAttempt.ok, false);
  });

  it("enforces daily vote budgets scaling with evolution stages (3 -> 4 -> 5) and Rizz x2 vote weight", () => {
    let s = createFreshState(T0, 60);
    assert.equal(toGameView(s, T0).voteBudget, 3);

    // Unlock rizz -> votes add +2 count instead of +1
    s = talkAction(s, "rizz", T0 + 500).state;
    const beforeTasty = s.memes[0]!.tasty;
    const v0 = voteMeme(s, s.memes[0]!.id, "tasty", T0 + 1000);
    assert.equal(v0.ok, true);
    assert.equal(v0.state.memes[0]!.tasty, beforeTasty + 2);
    s = v0.state;

    s = voteMeme(s, s.memes[1]!.id, "tasty", T0 + 2000).state;
    s = voteMeme(s, s.memes[2]!.id, "tasty", T0 + 3000).state;
    assert.equal(voteMeme(s, s.memes[3]!.id, "tasty", T0 + 4000).ok, false);

    s.xp = 2500;
    s.stage = 3;
    assert.equal(toGameView(s, T0 + 5000).voteBudget, 4);
    assert.equal(voteMeme(s, s.memes[3]!.id, "tasty", T0 + 5000).ok, true);
  });

  it("auto-hides user memes and custom labels after 3 reports, blocks profanity/PII, and applies rotten penalty", () => {
    let s = createFreshState(T0, 1);

    assert.equal(addCustomLabel(s, s.memes[0]!.id, "call me 555-123-4567", T0 + 1000).ok, false);
    assert.equal(renameMonster(s, "test@example.com", T0 + 1000).ok, false);

    // Post meme & check fresh -> rotten after 8 days of inactivity
    const posted = postMeme(s, { title: "Aging Meme", caption: "hmm", imageKey: "doge" }, T0 + 2000);
    assert.equal(posted.ok, true);
    const id = posted.extra!.id;
    const freshView = toGameView(posted.state, T0 + 2000).memes.find((m) => m.id === id)!;
    assert.equal(freshView.isFresh, true);
    assert.equal(freshView.isRotten, false);

    const aged = tickState(posted.state, T0 + 8 * DAY).state;
    const rottenView = toGameView(aged, T0 + 8 * DAY).memes.find((m) => m.id === id)!;
    assert.equal(rottenView.isRotten, true);

    // 3 reports auto-hide meme
    s = reportMeme(posted.state, id, T0 + 3000).state;
    s = reportMeme(s, id, T0 + 4000).state;
    const third = reportMeme(s, id, T0 + 5000);
    assert.equal(third.ok, true);
    assert.equal(toGameView(third.state, T0 + 5000).memes.some((m) => m.id === id), false);

    // Hidden meme rejects new custom labels
    assert.equal(addCustomLabel(third.state, id, "nice meme", T0 + 5500).ok, false);

    // 3 reports auto-hide custom label on a visible meme
    const visibleMeme = third.state.memes.find((m) => !m.hidden)!;
    const lblRes = addCustomLabel(third.state, visibleMeme.id, "nice meme", T0 + 6000);
    assert.equal(lblRes.ok, true);
    const lblId = lblRes.state.customLabels[0]!.id;
    s = reportLabel(lblRes.state, lblId, T0 + 7000).state;
    s = reportLabel(s, lblId, T0 + 8000).state;
    s = reportLabel(s, lblId, T0 + 9000).state;
    const viewMeme = toGameView(s, T0 + 9000).memes.find((m) => m.id === visibleMeme.id)!;
    assert.equal(viewMeme.customLabels.length, 0);
  });

  it("enforces Hygiene 0 social gate, Fullness < 30 training halving, Mid Crisis & Ratio Shield blech handling", () => {
    // 1) Hygiene 0 blocks social actions until groomed
    let s = createFreshState(T0, 60);
    s.hygiene = 0;
    assert.equal(shareMeme(s, s.memes[0]!.id, T0 + 1000).ok, false);
    assert.equal(addCustomLabel(s, s.memes[0]!.id, "hello", T0 + 1000).ok, false);
    s = careAction(s, "groom", T0 + 2000).state;
    assert.equal(shareMeme(s, s.memes[0]!.id, T0 + 3000).ok, true);

    // 2) Fullness < 30 halves mini-game XP
    const healthy = createFreshState(T0, 1);
    const hungry = createFreshState(T0, 1);
    hungry.fullness = 20;
    const healthyGame = completeMiniGame(healthy, "blaster", 200, T0 + 1000, 10);
    const hungryGame = completeMiniGame(hungry, "blaster", 200, T0 + 1000, 10);
    assert.equal(hungryGame.extra!.xpGained, Math.round(healthyGame.extra!.xpGained * 0.5));

    // 3) Mid Crisis converts blech-dominant digestion into tasty Fullness/Happiness boost
    let midState = createFreshState(T0, 60);
    midState = talkAction(midState, "mid meme", T0 + 1000).state;
    const blechPost = postMeme(midState, { title: "Bad Take", caption: "yikes", imageKey: "npc" }, T0 + 2000);
    midState = blechPost.state;
    const blechMeme = midState.memes.find((m) => m.id === blechPost.extra!.id)!;
    blechMeme.blech = 5;
    blechMeme.tasty = 1;
    midState = feedMeme(midState, { memeId: blechMeme.id }, T0 + 3000).state;
    const afterMid = tickState(midState, T0 + 100_000);
    assert.ok(afterMid.notes.some((n) => n.includes("Mid Crisis")));

    // 4) Ratio Shield consumes shield once on blech digestion when Mid Crisis is not unlocked
    let ratioState = createFreshState(T0, 60);
    ratioState = talkAction(ratioState, "L + ratio", T0 + 1000).state;
    assert.equal(ratioState.buffs.ratioShieldReady, true);
    const blechPost2 = postMeme(ratioState, { title: "Another Bad Take", caption: "oof", imageKey: "npc" }, T0 + 2000);
    ratioState = blechPost2.state;
    const blechMeme2 = ratioState.memes.find((m) => m.id === blechPost2.extra!.id)!;
    blechMeme2.blech = 5;
    blechMeme2.tasty = 0;
    ratioState = feedMeme(ratioState, { memeId: blechMeme2.id }, T0 + 3000).state;
    const afterRatio = tickState(ratioState, T0 + 100_000);
    assert.equal(afterRatio.state.buffs.ratioShieldReady, false);
    assert.ok(afterRatio.notes.some((n) => n.includes("Ratio Shield")));
  });

  it("handles Nostalgia stage selection, No Cap 105 stat cap, mini-game secret buffs, bonus memes, and clock toggle", () => {
    const s = createFreshState(T0, 60);
    assert.equal(setDisplayStage(s, 1, T0 + 1000).ok, false);

    s.xp = 45000;
    s.stage = 5;
    s.displayStage = 5;
    const nost = setDisplayStage(s, 1, T0 + 2000);
    assert.equal(nost.ok, true);
    const view = toGameView(nost.state, T0 + 2000);
    assert.equal(view.monster.stage, 5);
    assert.equal(view.monster.displayStage, 1);

    // No Cap raises stat cap to 105
    const noCap = talkAction(nost.state, "no cap", T0 + 2500).state;
    noCap.fullness = 95;
    const fedOver = careAction(noCap, "feed", T0 + 2600).state;
    assert.equal(Math.round(fedOver.fullness), 105);

    // Bonus meme & clock switch
    const bonus = postBonusMeme(fedOver, "bonus-chill", T0 + 3000);
    assert.equal(bonus.ok, true);
    const realClock = updateSettings(bonus.state, { clock: 1, soundOn: false }, T0 + 4000);
    assert.equal(realClock.state.clock, 1);
    assert.equal(realClock.state.soundOn, false);

    // Mini-game with Stonks + Chad buffs + Personal Best tracking
    let buffed = talkAction(realClock.state, "stonks", T0 + 5000).state;
    buffed = talkAction(buffed, "chad", T0 + 6000).state;
    const gameRes = completeMiniGame(buffed, "beat", 240, T0 + 7000, 18);
    assert.equal(gameRes.ok, true);
    assert.equal(gameRes.extra!.isNewBest, true);
    assert.equal(gameRes.state.highScores.beat.bestScore, 240);
    assert.equal(gameRes.state.highScores.beat.bestCombo, 18);
    assert.equal(gameRes.state.highScores.beat.plays, 1);
  });

  it("supports hatching all 5 starter species with distinct archetypes, daily care streaks, and 5/15/30 milestone powers", () => {
    const unhatched = createFreshState(T0, 1, { hatched: false });
    assert.equal(unhatched.hatched, false);

    // 1) Spicy Imp: Heat cap 120 (doesn't roast at 100!)
    const impRes = hatchStarter(unhatched, "spicy-imp", "Ignis", T0 + 1000);
    assert.equal(impRes.ok, true);
    assert.equal(impRes.state.hatched, true);
    assert.equal(impRes.state.species, "spicy-imp");
    assert.equal(impRes.state.name, "Ignis");
    impRes.state.heat = 85;
    const stonks = impRes.state.memes.find((m) => m.key === "stonks")!;
    const hotFed = feedMeme(impRes.state, { memeId: stonks.id }, T0 + 2000);
    assert.equal(Math.round(hotFed.state.heat), 110);
    assert.equal(hotFed.state.isRoasted, false); // heatCap is 120 for Spicy Imp!

    // 2) Cozy Frog: slower energy decay (0.75x) & +20% kibble (+36 Fullness)
    const frog = hatchStarter(unhatched, "cozy-frog", "Pebbles", T0 + 1000).state;
    frog.fullness = 40;
    const fedFrog = careAction(frog, "feed", T0 + 2000);
    assert.equal(Math.round(fedFrog.state.fullness), 76); // 40 + 36
    const after4HrFrog = tickState(frog, T0 + 1000 + 4 * HR).state;
    assertClose(after4HrFrog.energy, 84 - 3); // 0.75 * 4 = 3 energy instead of 4!

    // 3) Cyber Cat: +15% mini-game XP payout vs Mint Dragon
    const cat = hatchStarter(unhatched, "cyber-cat", "Pixel", T0 + 1000).state;
    const dragon = hatchStarter(unhatched, "mint-dragon", "Mochi", T0 + 1000).state;
    const catRun = completeMiniGame(cat, "runner", 300, T0 + 2000, 12);
    const dragRun = completeMiniGame(dragon, "runner", 300, T0 + 2000, 12);
    assert.ok(catRun.extra!.xpGained > dragRun.extra!.xpGained);

    // 4) Daily Care Streak increments on consecutive UTC days & grants Drip bonus
    let streakPet = careAction(dragon, "feed", T0 + 1000).state;
    assert.equal(streakPet.careStreak.count, 1);
    const dripDay1 = streakPet.drip;
    streakPet = careAction(streakPet, "feed", T0 + DAY + 1000).state;
    assert.equal(streakPet.careStreak.count, 2);
    assert.ok(streakPet.drip > dripDay1);

    // 5) Active Digestion Milestone Powers at 5 / 15 / 30
    assert.deepEqual(milestonePowersFor(4), { turboCharge: false, secondWind: false, memeOverdrive: false });
    assert.deepEqual(milestonePowersFor(5), { turboCharge: true, secondWind: false, memeOverdrive: false });
    assert.deepEqual(milestonePowersFor(15), { turboCharge: true, secondWind: true, memeOverdrive: false });
    assert.deepEqual(milestonePowersFor(30), { turboCharge: true, secondWind: true, memeOverdrive: true });
  });

  it("projects fed memes (in-belly and digested) into dreamMemes newest-first for the Sleep Dream Screensaver", () => {
    let s = createFreshState(T0, 60); // demo clock: digests in 2 minutes
    const m1 = s.memes[0]!;
    const m2 = s.memes[1]!;

    // Initially empty
    assert.equal(toGameView(s, T0).dreamMemes.length, 0);

    // Feed m1, let it digest (after 130s in 60x demo clock)
    s = feedMeme(s, { memeId: m1.id }, T0 + 1000).state;
    s = tickState(s, T0 + 140_000).state;
    assert.equal(s.digestedCount, 1);

    // Feed m2 (currently in belly)
    s = feedMeme(s, { memeId: m2.id }, T0 + 150_000).state;

    const view = toGameView(s, T0 + 151_000);
    assert.equal(view.dreamMemes.length, 2);
    assert.equal(view.dreamMemes[0]!.memeKey, m2.key);
    assert.equal(view.dreamMemes[0]!.inBelly, true);
    assert.equal(view.dreamMemes[1]!.memeKey, m1.key);
    assert.equal(view.dreamMemes[1]!.inBelly, false);
  });
});
