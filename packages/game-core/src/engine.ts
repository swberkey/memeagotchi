import {
  AUTO_HIDE_REPORT_THRESHOLD,
  BACKFLOW_INTERVAL_GAME_MS,
  BONUS_MEMES,
  CARE_EFFECTS,
  COSMETICS,
  DAY_MS,
  DECAY_RATES,
  DIGESTION_MILESTONES,
  HOUR_MS,
  LAUNCH_SECRET_WORDS,
  LONG_OFFLINE_GAME_MS,
  OFFLINE_DECAY_FLOOR,
  SEED_MEMES,
  STATE_VERSION,
} from "./constants.ts";
import {
  bellyCapacity,
  clampFloat,
  computeMood,
  containsBlockedText,
  dominantLabel,
  getTimingConfig,
  isMemeFresh,
  isMemeRotten,
  memePower,
  moodDisplayLabel,
  nextStageForStage,
  normalizePhrase,
  stageDefByNumber,
  stageForXp,
  statCapFor,
  utcDateKey,
  voteBudgetForStage,
} from "./rules.ts";
import type {
  CareAction,
  ClockRate,
  EngineResult,
  GameState,
  GameView,
  Label,
  MemeRecord,
  MiniGameId,
} from "./types.ts";

function cloneState(s: GameState): GameState {
  return structuredClone(s);
}

function allocId(s: GameState): number {
  const id = s.nextId;
  s.nextId += 1;
  return id;
}

function pushEvent(s: GameState, text: string, nowMs: number): void {
  s.events.unshift({ id: allocId(s), text, createdAtReal: nowMs });
  if (s.events.length > 24) s.events.length = 24;
}

function say(s: GameState, nowMs: number, text: string, durationMs = 6000): void {
  s.speech = text;
  s.speechUntilReal = nowMs + durationMs;
}

function awardXp(s: GameState, rawXp: number, nowMs: number, notes: string[]): number {
  if (rawXp <= 0) return 0;
  const gained = Math.round(rawXp);
  s.xp += gained;
  // GDD §2: Happiness === 0 freezes evolution until recovered.
  if (Math.round(s.happiness) <= 0) {
    return gained;
  }
  const targetStage = stageForXp(s.xp).stage;
  if (targetStage > s.stage) {
    const wasUsingLatestLook = s.displayStage === s.stage;
    s.stage = targetStage;
    // Automatically advance look unless user explicitly selected an older nostalgia look at Stage 3+
    if (wasUsingLatestLook || targetStage < 3) {
      s.displayStage = targetStage;
    }
    const def = stageDefByNumber(targetStage);
    const msg = `EVOLVED → Stage ${targetStage}: ${def.name}!`;
    pushEvent(s, `🌟 ${msg}`, nowMs);
    notes.push(`🌟 ${msg}`);
    say(s, nowMs, `I EVOLVED! ${def.name}!`, 9000);
  }
  return gained;
}

function maybeUnfreezeEvolution(s: GameState, nowMs: number, notes: string[]): void {
  if (Math.round(s.happiness) <= 0) return;
  const targetStage = stageForXp(s.xp).stage;
  if (targetStage > s.stage) {
    const wasUsingLatestLook = s.displayStage === s.stage;
    s.stage = targetStage;
    if (wasUsingLatestLook || targetStage < 3) {
      s.displayStage = targetStage;
    }
    const def = stageDefByNumber(targetStage);
    const msg = `EVOLVED → Stage ${targetStage}: ${def.name}!`;
    pushEvent(s, `🌟 ${msg}`, nowMs);
    notes.push(`🌟 ${msg}`);
    say(s, nowMs, `I EVOLVED! ${def.name}!`, 9000);
  }
}

export function createFreshState(nowMs: number, clock: ClockRate = 60): GameState {
  const bornGameMs = nowMs * clock;
  let nextId = 1;
  const memes: MemeRecord[] = SEED_MEMES.map((m, i) => ({
    id: nextId++,
    key: m.key,
    title: m.title,
    caption: m.caption,
    emoji: m.emoji,
    imageKey: m.key,
    imageUrl: null,
    bg: m.bg,
    tasty: m.tasty,
    spicy: m.spicy,
    blech: m.blech,
    shares: m.shares,
    isSeed: true,
    createdAtReal: nowMs - (i + 1) * 1_800_000,
    createdAtGameMs: bornGameMs - (i + 1) * 1_800_000,
    lastActivityGameMs: bornGameMs - (i + 1) * 1_800_000,
    reports: 0,
    hidden: false,
  }));

  return {
    version: STATE_VERSION,
    name: "Mochi",
    xp: 0,
    stage: 1,
    displayStage: 1,
    fullness: 78,
    happiness: 82,
    hygiene: 76,
    energy: 84,
    heat: 0,
    drip: 120,
    isSleeping: false,
    isRoasted: false,
    roastedUntilReal: 0,
    lastTickReal: nowMs,
    gameMs: bornGameMs,
    bornGameMs,
    lastBackflowGameMs: bornGameMs,
    lastFeedReal: 0,
    lastGroomReal: 0,
    lastPlayReal: 0,
    lastSleepReal: 0,
    digestedCount: 0,
    belly: [],
    digestedHistory: [],
    memes,
    votes: [],
    customLabels: [],
    secrets: {},
    buffs: {
      stonksUntilReal: 0,
      noCapUntilReal: 0,
      basedBoostReady: false,
      rickrollSaveReady: false,
      ratioShieldReady: false,
    },
    ownedCosmetics: [],
    firstWornCosmetics: [],
    equipped: {},
    events: [{ id: nextId++, text: "🥚 Mochi hatched!", createdAtReal: nowMs }],
    speech: "Feed me memes!",
    speechUntilReal: nowMs + 8000,
    clock,
    soundOn: true,
    nextId,
  };
}

export function normalizeState(raw: Partial<GameState>, nowMs: number): GameState {
  const base = createFreshState(nowMs, raw.clock === 1 ? 1 : 60);
  const s: GameState = {
    ...base,
    ...raw,
    version: STATE_VERSION,
    buffs: {
      ...base.buffs,
      ...(raw.buffs ?? {}),
    },
    equipped: { ...(raw.equipped ?? {}) },
  };
  s.clock = s.clock === 1 ? 1 : 60;
  s.soundOn = s.soundOn !== false;
  s.stage = Math.max(1, Math.min(5, s.stage || stageForXp(s.xp).stage));
  s.displayStage = Math.max(1, Math.min(s.stage, s.displayStage || s.stage));
  s.ownedCosmetics ??= [];
  s.firstWornCosmetics ??= [...s.ownedCosmetics];
  s.belly ??= [];
  s.digestedHistory ??= [];
  s.memes = s.memes?.length ? s.memes : base.memes;
  s.votes ??= [];
  s.customLabels ??= [];
  s.secrets ??= {};
  s.events ??= base.events;
  s.nextId = Math.max(s.nextId || 1, 1000);
  return s;
}

/**
 * Pure deterministic tick:
 * - Floating-point stat decay (prevents rounding-wipeout during rapid polling)
 * - Exact sleep -> wake interval splitting at Energy 80
 * - Auto-sleep when awake Energy hits 0
 * - 72 game-hour weekend grace + offline decay floor of 25 (never inflates stats below 25)
 * - Roasted expiry
 * - Belly digestion with GDD power tiers, backflow, Hangry rule, and secret move modifiers
 * - Periodic 15 game-min viral backflow for previously digested memes
 */
export function tickState(input: GameState, nowMs: number): { state: GameState; notes: string[] } {
  const s = cloneState(input);
  const notes: string[] = [];
  const timing = getTimingConfig(s.clock);
  const cap = statCapFor(s, nowMs);

  const realElapsed = Math.max(0, nowMs - s.lastTickReal);
  const gameElapsed = realElapsed * s.clock;

  if (gameElapsed > 0) {
    const startStats = {
      fullness: s.fullness,
      happiness: s.happiness,
      hygiene: s.hygiene,
      energy: s.energy,
    };
    const isLongOffline = gameElapsed > LONG_OFFLINE_GAME_MS;
    const effectiveGameElapsed = isLongOffline ? LONG_OFFLINE_GAME_MS : gameElapsed;
    s.gameMs += gameElapsed;

    let remHours = effectiveGameElapsed / HOUR_MS;

    // 1) If currently sleeping, restore energy until waking threshold (80) or time runs out.
    if (s.isSleeping && remHours > 0) {
      const needed = Math.max(0, DECAY_RATES.sleepWakeThreshold - s.energy);
      const hoursToWake = needed / DECAY_RATES.energySleepRestorePerHour;
      const sleepHours = Math.min(remHours, hoursToWake);

      s.fullness -= DECAY_RATES.fullnessPerHour * DECAY_RATES.sleepOtherDecayFactor * sleepHours;
      s.happiness -= DECAY_RATES.happinessPerHour * DECAY_RATES.sleepOtherDecayFactor * sleepHours;
      s.hygiene -= DECAY_RATES.hygienePerHour * DECAY_RATES.sleepOtherDecayFactor * sleepHours;
      s.energy += DECAY_RATES.energySleepRestorePerHour * sleepHours;
      remHours -= sleepHours;

      if (s.energy >= DECAY_RATES.sleepWakeThreshold - 1e-6) {
        s.energy = Math.max(s.energy, DECAY_RATES.sleepWakeThreshold);
        s.isSleeping = false;
        notes.push("☀️ Your monster woke up fully rested!");
        pushEvent(s, `☀️ ${s.name} woke up refreshed`, nowMs);
        say(s, nowMs, "I LIVE. Feed me.");
      }
    }

    // 2) Apply awake decay for remaining hours; auto-sleep if energy hits 0.
    if (!s.isSleeping && remHours > 0) {
      const hoursToZeroEnergy = Math.max(0, s.energy) / DECAY_RATES.energyAwakePerHour;
      if (remHours >= hoursToZeroEnergy && hoursToZeroEnergy > 0) {
        s.fullness -= DECAY_RATES.fullnessPerHour * hoursToZeroEnergy;
        s.happiness -= DECAY_RATES.happinessPerHour * hoursToZeroEnergy;
        s.hygiene -= DECAY_RATES.hygienePerHour * hoursToZeroEnergy;
        s.energy = 0;
        s.isSleeping = true;
        pushEvent(s, `💤 ${s.name} fell asleep (Energy 0)`, nowMs);
        notes.push("💤 Energy hit 0 — your monster fell asleep automatically.");
        remHours -= hoursToZeroEnergy;

        // If additional time elapsed after falling asleep, apply sleeping recovery
        if (remHours > 0) {
          const sleepHours = Math.min(
            remHours,
            DECAY_RATES.sleepWakeThreshold / DECAY_RATES.energySleepRestorePerHour,
          );
          s.fullness -= DECAY_RATES.fullnessPerHour * DECAY_RATES.sleepOtherDecayFactor * sleepHours;
          s.happiness -= DECAY_RATES.happinessPerHour * DECAY_RATES.sleepOtherDecayFactor * sleepHours;
          s.hygiene -= DECAY_RATES.hygienePerHour * DECAY_RATES.sleepOtherDecayFactor * sleepHours;
          s.energy += DECAY_RATES.energySleepRestorePerHour * sleepHours;
          if (s.energy >= DECAY_RATES.sleepWakeThreshold - 1e-6) {
            s.energy = Math.max(s.energy, DECAY_RATES.sleepWakeThreshold);
            s.isSleeping = false;
          }
        }
      } else {
        s.fullness -= DECAY_RATES.fullnessPerHour * remHours;
        s.happiness -= DECAY_RATES.happinessPerHour * remHours;
        s.hygiene -= DECAY_RATES.hygienePerHour * remHours;
        s.energy -= DECAY_RATES.energyAwakePerHour * remHours;
      }
    }

    // Clamp & apply offline decay floor (25, never artificially raising a stat above what it started at)
    for (const key of ["fullness", "happiness", "hygiene", "energy"] as const) {
      const clamped = clampFloat(s[key], cap);
      if (isLongOffline) {
        const floor = Math.min(startStats[key], OFFLINE_DECAY_FLOOR);
        s[key] = Math.max(floor, clamped);
      } else {
        s[key] = clamped;
      }
    }

    s.lastTickReal = nowMs;
  }

  // Roasted expiry
  if (s.isRoasted && s.roastedUntilReal > 0 && nowMs >= s.roastedUntilReal) {
    s.isRoasted = false;
    s.heat = 40;
    s.roastedUntilReal = 0;
    notes.push("🌡️ Your monster cooled down from being Roasted.");
    pushEvent(s, "🌡️ Cooled down from Roasted (Heat 40)", nowMs);
    say(s, nowMs, "Cooled off. Careful with spicy.");
  }

  // Belly digestion
  const remainingBelly = [];
  for (const item of s.belly) {
    if (nowMs - item.fedAtReal < timing.digestRealMs) {
      remainingBelly.push(item);
      continue;
    }
    const meme = s.memes.find((m) => m.id === item.memeId || m.key === item.memeKey);
    if (!meme) continue;

    // GDD §2: Hangry (fullness === 0) grants no power gain on digestion.
    if (Math.round(s.fullness) <= 0) {
      s.digestedCount += 1;
      const msg = `😤 Digested "${meme.title}" while Hangry — no power gained! Feed kibble first.`;
      notes.push(msg);
      pushEvent(s, msg, nowMs);
      continue;
    }

    const pNow = memePower(meme, s.gameMs);
    const backflow = Math.min(5, Math.max(0, Math.floor((pNow - item.powerAtFed) / 10)));
    let tier = Math.min(10, Math.floor(pNow / 10)) + backflow;

    // Secret move: Based Boost doubles next digestion power tier
    let basedUsed = false;
    if (s.buffs.basedBoostReady) {
      tier *= 2;
      s.buffs.basedBoostReady = false;
      basedUsed = true;
    }

    let dom = dominantLabel(meme);
    let midUsed = false;
    let ratioUsed = false;
    if (dom === "blech") {
      if (s.secrets["mid meme"]) {
        dom = "tasty";
        midUsed = true;
      } else if (s.buffs.ratioShieldReady) {
        s.buffs.ratioShieldReady = false;
        ratioUsed = true;
      } else {
        // Blech weakens granted tier slightly unless shielded
        tier = Math.max(1, Math.floor(tier * 0.75));
      }
    }

    const xpGain = awardXp(s, (tier * 15 + 10) * timing.xpMultiplier, nowMs, notes);
    const dripGain = tier * 2;
    s.drip += dripGain;
    s.digestedCount += 1;

    const amt = Math.max(1, Math.min(15, tier));
    if (dom === "tasty") {
      s.fullness = clampFloat(s.fullness + amt, cap);
      s.happiness = clampFloat(s.happiness + amt, cap);
    } else if (dom === "spicy") {
      s.energy = clampFloat(s.energy + amt, cap);
    } else {
      s.hygiene = clampFloat(s.hygiene + Math.max(1, Math.floor(amt / 2)), cap);
    }

    const today = utcDateKey(nowMs);
    s.digestedHistory.unshift({
      memeId: meme.id,
      memeKey: meme.key,
      digestedAtReal: nowMs,
      lastCreditedPower: pNow,
      backflowCreditedToday: backflow,
      backflowDateKey: today,
    });
    if (s.digestedHistory.length > 25) s.digestedHistory.length = 25;

    const extras: string[] = [];
    if (backflow > 0) extras.push(`+${backflow} backflow`);
    if (basedUsed) extras.push("Based Boost ×2");
    if (midUsed) extras.push("Mid Crisis");
    if (ratioUsed) extras.push("Ratio Shield");

    const digestMsg = `✨ Digested "${meme.title}" — +${xpGain} XP, +${dripGain} Drip (${dom}-dominant, power ${pNow}${extras.length ? `, ${extras.join(", ")}` : ""})`;
    notes.push(digestMsg);
    pushEvent(s, digestMsg, nowMs);
    say(s, nowMs, "*happy burp*");

    if ((DIGESTION_MILESTONES as readonly number[]).includes(s.digestedCount)) {
      const msMsg = `🔓 Power milestone! ${s.digestedCount} memes digested — a new power stirs!`;
      notes.push(msMsg);
      pushEvent(s, msMsg, nowMs);
    }
  }
  s.belly = remainingBelly;

  // Periodic 15 game-min viral backflow for already-digested memes (GDD §5.2)
  if (s.gameMs - s.lastBackflowGameMs >= BACKFLOW_INTERVAL_GAME_MS) {
    s.lastBackflowGameMs = s.gameMs;
    const today = utcDateKey(nowMs);
    let totalBackflowBonus = 0;
    for (const rec of s.digestedHistory) {
      if (rec.backflowDateKey !== today) {
        rec.backflowDateKey = today;
        rec.backflowCreditedToday = 0;
      }
      if (rec.backflowCreditedToday >= 5) continue;
      const meme = s.memes.find((m) => m.id === rec.memeId || m.key === rec.memeKey);
      if (!meme) continue;
      const pNow = memePower(meme, s.gameMs);
      const deltaTiers = Math.floor((pNow - rec.lastCreditedPower) / 10);
      if (deltaTiers > 0) {
        const credit = Math.min(5 - rec.backflowCreditedToday, deltaTiers);
        if (credit > 0) {
          rec.backflowCreditedToday += credit;
          rec.lastCreditedPower = pNow;
          totalBackflowBonus += credit;
        }
      }
    }
    if (totalBackflowBonus > 0 && Math.round(s.fullness) > 0) {
      const bfXp = awardXp(s, totalBackflowBonus * 12 * timing.xpMultiplier, nowMs, notes);
      const bfDrip = totalBackflowBonus * 2;
      s.drip += bfDrip;
      const bfMsg = `🌊 Viral backflow! Your earlier meme picks blew up: +${bfXp} XP, +${bfDrip} Drip`;
      notes.push(bfMsg);
      pushEvent(s, bfMsg, nowMs);
    }
  }

  return { state: s, notes };
}

export function careAction(input: GameState, action: CareAction, nowMs: number): EngineResult {
  const { state: s, notes } = tickState(input, nowMs);
  const timing = getTimingConfig(s.clock);
  const cap = statCapFor(s, nowMs);

  if (action === "wake") {
    if (!s.isSleeping) {
      return { state: s, ok: true, message: `${s.name} is already awake.`, notes };
    }
    s.isSleeping = false;
    pushEvent(s, `☀️ Woke ${s.name} up`, nowMs);
    say(s, nowMs, "I LIVE. Feed me.");
    return { state: s, ok: true, message: "☀️ Wakey wakey!", notes };
  }

  if (action === "sleep") {
    if (s.isSleeping) {
      s.isSleeping = false;
      pushEvent(s, `☀️ Woke ${s.name} up`, nowMs);
      say(s, nowMs, "Woke up!");
      return { state: s, ok: true, message: "☀️ Woke up!", notes };
    }
    s.isSleeping = true;
    s.lastSleepReal = nowMs;
    pushEvent(s, `💤 Tucked ${s.name} in for a nap`, nowMs);
    say(s, nowMs, "Tucked in. Zzz…");
    return { state: s, ok: true, message: "💤 Tucked in. Energy recharges while sleeping.", notes };
  }

  if (s.isSleeping) {
    say(s, nowMs, "Zzz… (wake me first)");
    return { state: s, ok: false, message: "Your monster is asleep — wake it first.", notes };
  }

  if (action === "feed") {
    const waitMs = timing.feedCdRealMs - (nowMs - s.lastFeedReal);
    if (s.lastFeedReal > 0 && waitMs > 0) {
      say(s, nowMs, "Too full for kibble!");
      return { state: s, ok: false, message: `Kibble cooldown (${Math.ceil(waitMs / 1000)}s).`, notes };
    }
    s.fullness = clampFloat(s.fullness + CARE_EFFECTS.feedFullness, cap);
    s.lastFeedReal = nowMs;
    const xp = awardXp(s, CARE_EFFECTS.feedXp * timing.xpMultiplier, nowMs, notes);
    pushEvent(s, `🍖 Fed kibble (+${CARE_EFFECTS.feedFullness} Fullness, +${xp} XP)`, nowMs);
    say(s, nowMs, "Nom. Kibble era.");
    return { state: s, ok: true, message: `🍖 Kibble served! +${CARE_EFFECTS.feedFullness} Fullness, +${xp} XP`, notes };
  }

  if (action === "groom") {
    const waitMs = timing.groomCdRealMs - (nowMs - s.lastGroomReal);
    if (s.lastGroomReal > 0 && waitMs > 0) {
      say(s, nowMs, "Already fabulous.");
      return { state: s, ok: false, message: `Grooming cooldown (${Math.ceil(waitMs / 1000)}s).`, notes };
    }
    s.hygiene = clampFloat(s.hygiene + CARE_EFFECTS.groomHygiene, cap);
    s.lastGroomReal = nowMs;
    const xp = awardXp(s, CARE_EFFECTS.groomXp * timing.xpMultiplier, nowMs, notes);
    pushEvent(s, `🛁 Groomed (+${CARE_EFFECTS.groomHygiene} Hygiene, +${xp} XP)`, nowMs);
    say(s, nowMs, "So fresh. So clean.");
    return { state: s, ok: true, message: `🛁 Scrubbed and sparkling! +${CARE_EFFECTS.groomHygiene} Hygiene, +${xp} XP`, notes };
  }

  // play
  const waitMs = timing.playCdRealMs - (nowMs - s.lastPlayReal);
  if (s.lastPlayReal > 0 && waitMs > 0) {
    say(s, nowMs, "Need a breather.");
    return { state: s, ok: false, message: `Play cooldown (${Math.ceil(waitMs / 1000)}s).`, notes };
  }
  if (s.energy < 10) {
    say(s, nowMs, "Too tired to play.");
    return { state: s, ok: false, message: "Energy too low to play (< 10). Let your monster nap!", notes };
  }
  s.happiness = clampFloat(s.happiness + CARE_EFFECTS.playHappiness, cap);
  s.energy = clampFloat(s.energy - CARE_EFFECTS.playEnergyCost, cap);
  s.lastPlayReal = nowMs;
  maybeUnfreezeEvolution(s, nowMs, notes);
  const xp = awardXp(s, CARE_EFFECTS.playXp * timing.xpMultiplier, nowMs, notes);
  pushEvent(s, `🎾 Play session (+${CARE_EFFECTS.playHappiness} Happiness, −${CARE_EFFECTS.playEnergyCost} Energy, +${xp} XP)`, nowMs);
  say(s, nowMs, "BEST. DAY. EVER.");
  return {
    state: s,
    ok: true,
    message: `🎾 Played! +${CARE_EFFECTS.playHappiness} Happiness, −${CARE_EFFECTS.playEnergyCost} Energy, +${xp} XP`,
    notes,
  };
}

export function renameMonster(input: GameState, rawName: string, nowMs: number): EngineResult {
  const { state: s, notes } = tickState(input, nowMs);
  const clean = rawName.trim();
  if (clean.length < 1 || clean.length > 24) {
    return { state: s, ok: false, message: "Name must be 1–24 characters.", notes };
  }
  if (containsBlockedText(clean)) {
    return { state: s, ok: false, message: "Name blocked by the profanity/PII filter.", notes };
  }
  s.name = clean;
  pushEvent(s, `✏️ Renamed monster to ${clean}`, nowMs);
  say(s, nowMs, `Call me ${clean}!`);
  return { state: s, ok: true, message: `Renamed to ${clean}!`, notes };
}

export function setDisplayStage(input: GameState, targetStage: number, nowMs: number): EngineResult {
  const { state: s, notes } = tickState(input, nowMs);
  if (s.stage < 3) {
    return { state: s, ok: false, message: "Nostalgia toggle unlocks at Stage 3 (Beast).", notes };
  }
  if (targetStage < 1 || targetStage > s.stage) {
    return { state: s, ok: false, message: "You can only display stages you've already reached.", notes };
  }
  s.displayStage = targetStage;
  const def = stageDefByNumber(targetStage);
  pushEvent(s, `🕰️ Nostalgia: displaying Stage ${targetStage} (${def.name})`, nowMs);
  return { state: s, ok: true, message: `Now displaying Stage ${targetStage} (${def.name}) look.`, notes };
}

export function voteMeme(input: GameState, memeId: number, label: Label, nowMs: number): EngineResult {
  const { state: s, notes } = tickState(input, nowMs);
  const today = utcDateKey(nowMs);
  const budget = voteBudgetForStage(s.stage);
  const todaysVotes = s.votes.filter((v) => v.voteDate === today);

  if (todaysVotes.length >= budget) {
    return { state: s, ok: false, message: `Daily vote budget reached (${budget}/day). Evolve for more!`, notes };
  }
  if (todaysVotes.some((v) => v.memeId === memeId)) {
    return { state: s, ok: false, message: "You already voted on this meme today.", notes };
  }
  const meme = s.memes.find((m) => m.id === memeId && !m.hidden);
  if (!meme) {
    return { state: s, ok: false, message: "Meme not found.", notes };
  }

  // Secret move `rizz` (Charisma): your votes carry +1 extra weight!
  const weight = s.secrets["rizz"] ? 2 : 1;
  meme[label] += weight;
  meme.lastActivityGameMs = s.gameMs;
  s.votes.push({ memeId: meme.id, label, voteDate: today, createdAtReal: nowMs });
  return {
    state: s,
    ok: true,
    message: `Labeled "${meme.title}" as ${label}${weight > 1 ? " (Charisma ×2!)" : ""}!`,
    notes,
  };
}

function tryUnlockSecret(s: GameState, normalizedPhrase: string, nowMs: number, notes: string[]): { unlocked: string | null; alreadyHad: boolean; line?: string; effect?: string } {
  const def = LAUNCH_SECRET_WORDS[normalizedPhrase];
  if (!def) return { unlocked: null, alreadyHad: false };
  if (s.secrets[normalizedPhrase]) {
    return { unlocked: null, alreadyHad: true, line: "Already know that one.", effect: def.effect };
  }
  const cap = statCapFor(s, nowMs);
  s.secrets[normalizedPhrase] = {
    word: def.word,
    move: def.move,
    effect: def.effect,
    unlockedAtReal: nowMs,
  };
  s.drip += 15;
  s.happiness = clampFloat(s.happiness + 10, cap);
  maybeUnfreezeEvolution(s, nowMs, notes);

  // Activate immediate secret move buffs
  if (normalizedPhrase === "stonks") s.buffs.stonksUntilReal = nowMs + HOUR_MS;
  if (normalizedPhrase === "no cap") s.buffs.noCapUntilReal = nowMs + DAY_MS;
  if (normalizedPhrase === "based and correct") s.buffs.basedBoostReady = true;
  if (normalizedPhrase === "rickroll") s.buffs.rickrollSaveReady = true;
  if (normalizedPhrase === "l + ratio") s.buffs.ratioShieldReady = true;

  pushEvent(s, "🔓 Someone discovered a secret move!", nowMs);
  say(s, nowMs, def.line, 8000);
  return { unlocked: def.move, alreadyHad: false, line: def.line, effect: def.effect };
}

export function addCustomLabel(
  input: GameState,
  memeId: number,
  rawText: string,
  nowMs: number,
): EngineResult<{ unlocked: string | null }> {
  const { state: s, notes } = tickState(input, nowMs);
  if (Math.round(s.hygiene) <= 0) {
    return { state: s, ok: false, message: "Too stinky for social features — groom your monster first!", notes, extra: { unlocked: null } };
  }
  const clean = rawText.trim();
  if (clean.length < 1 || clean.length > 40) {
    return { state: s, ok: false, message: "Label must be 1–40 characters.", notes, extra: { unlocked: null } };
  }
  if (containsBlockedText(clean)) {
    return { state: s, ok: false, message: "Label blocked by the profanity/PII filter.", notes, extra: { unlocked: null } };
  }
  const meme = s.memes.find((m) => m.id === memeId && !m.hidden);
  if (!meme) {
    return { state: s, ok: false, message: "Meme not found.", notes, extra: { unlocked: null } };
  }

  const key = normalizePhrase(clean);
  const secretRes = tryUnlockSecret(s, key, nowMs, notes);

  s.customLabels.push({
    id: allocId(s),
    memeId: meme.id,
    text: clean,
    createdAtReal: nowMs,
    reports: 0,
    hidden: false,
  });
  meme.lastActivityGameMs = s.gameMs;

  const message = secretRes.unlocked
    ? `🔓 SECRET MOVE UNLOCKED: ${secretRes.unlocked} — ${secretRes.effect} (+15 Drip)`
    : `Label "${clean}" added.`;
  return { state: s, ok: true, message, notes, extra: { unlocked: secretRes.unlocked } };
}

export function reportMeme(input: GameState, memeId: number, nowMs: number): EngineResult {
  const { state: s, notes } = tickState(input, nowMs);
  const meme = s.memes.find((m) => m.id === memeId && !m.hidden);
  if (!meme) return { state: s, ok: false, message: "Meme not found.", notes };
  if (meme.isSeed) return { state: s, ok: false, message: "Built-in starter memes cannot be hidden.", notes };
  meme.reports += 1;
  if (meme.reports >= AUTO_HIDE_REPORT_THRESHOLD) {
    meme.hidden = true;
    pushEvent(s, `🚩 "${meme.title}" auto-hidden after ${AUTO_HIDE_REPORT_THRESHOLD} reports`, nowMs);
    return { state: s, ok: true, message: `"${meme.title}" reached ${AUTO_HIDE_REPORT_THRESHOLD} reports and was hidden pending review.`, notes };
  }
  return { state: s, ok: true, message: `Reported "${meme.title}" (${meme.reports}/${AUTO_HIDE_REPORT_THRESHOLD} to auto-hide).`, notes };
}

export function reportLabel(input: GameState, labelId: number, nowMs: number): EngineResult {
  const { state: s, notes } = tickState(input, nowMs);
  const lbl = s.customLabels.find((l) => l.id === labelId && !l.hidden);
  if (!lbl) return { state: s, ok: false, message: "Label not found.", notes };
  lbl.reports += 1;
  if (lbl.reports >= AUTO_HIDE_REPORT_THRESHOLD) {
    lbl.hidden = true;
    return { state: s, ok: true, message: `Label "#${lbl.text}" auto-hidden after ${AUTO_HIDE_REPORT_THRESHOLD} reports.`, notes };
  }
  return { state: s, ok: true, message: `Reported label "#${lbl.text}" (${lbl.reports}/${AUTO_HIDE_REPORT_THRESHOLD}).`, notes };
}

export function shareMeme(input: GameState, memeId: number, nowMs: number): EngineResult {
  const { state: s, notes } = tickState(input, nowMs);
  if (Math.round(s.hygiene) <= 0) {
    return { state: s, ok: false, message: "Too stinky for social features — groom your monster first!", notes };
  }
  const timing = getTimingConfig(s.clock);
  const meme = s.memes.find((m) => m.id === memeId && !m.hidden);
  if (!meme) return { state: s, ok: false, message: "Meme not found.", notes };
  meme.shares += 1;
  meme.lastActivityGameMs = s.gameMs;
  const xp = awardXp(s, CARE_EFFECTS.shareXp * timing.xpMultiplier, nowMs, notes);
  s.drip += CARE_EFFECTS.shareDrip;
  return {
    state: s,
    ok: true,
    message: `Shared "${meme.title}" — +1 power, +${xp} XP, +${CARE_EFFECTS.shareDrip} Drip commission.`,
    notes,
  };
}

export interface PostMemeInput {
  title: string;
  caption?: string;
  emoji?: string;
  imageKey?: string | null;
  imageUrl?: string | null;
  bg?: string;
}

export function postMeme(
  input: GameState,
  payload: PostMemeInput,
  nowMs: number,
): EngineResult<{ id: number; key: string }> {
  const { state: s, notes } = tickState(input, nowMs);
  const title = payload.title.trim();
  const caption = (payload.caption ?? "").trim();
  if (title.length < 1 || title.length > 80) {
    return { state: s, ok: false, message: "Meme title must be 1–80 characters.", notes, extra: { id: 0, key: "" } };
  }
  if (containsBlockedText(title) || containsBlockedText(caption)) {
    return { state: s, ok: false, message: "Blocked by profanity/PII filter.", notes, extra: { id: 0, key: "" } };
  }
  const id = allocId(s);
  const key = `meme-${id}`;
  s.memes.unshift({
    id,
    key,
    title,
    caption,
    emoji: (payload.emoji ?? "🖼️").slice(0, 8),
    imageKey: payload.imageKey ?? null,
    imageUrl: payload.imageUrl ?? null,
    bg: payload.bg ?? "#fef9c3",
    tasty: 0,
    spicy: 0,
    blech: 0,
    shares: 0,
    isSeed: false,
    createdAtReal: nowMs,
    createdAtGameMs: s.gameMs,
    lastActivityGameMs: s.gameMs,
    reports: 0,
    hidden: false,
  });
  pushEvent(s, `🆕 New meme dropped: "${title}"`, nowMs);
  say(s, nowMs, "Ooh, fresh content.");
  return {
    state: s,
    ok: true,
    message: `Posted "${title}" to the feed! It's FRESH (+1 power).`,
    notes,
    extra: { id, key },
  };
}

export function postBonusMeme(input: GameState, bonusKey: string, nowMs: number): EngineResult {
  const { state: s, notes } = tickState(input, nowMs);
  const bonus = BONUS_MEMES.find((b) => b.key === bonusKey);
  if (!bonus) return { state: s, ok: false, message: "Unknown bonus meme.", notes };
  if (s.memes.some((m) => m.key === bonus.key && !m.hidden)) {
    return { state: s, ok: false, message: `"${bonus.title}" is already in the feed pack.`, notes };
  }
  const id = allocId(s);
  s.memes.unshift({
    id,
    key: bonus.key,
    title: bonus.title,
    caption: bonus.caption,
    emoji: bonus.emoji,
    imageKey: bonus.imageKey,
    imageUrl: null,
    bg: bonus.bg,
    tasty: bonus.tasty,
    spicy: bonus.spicy,
    blech: bonus.blech,
    shares: 0,
    isSeed: false,
    createdAtReal: nowMs,
    createdAtGameMs: s.gameMs,
    lastActivityGameMs: s.gameMs,
    reports: 0,
    hidden: false,
  });
  pushEvent(s, `📮 Added "${bonus.title}" to the feed pack`, nowMs);
  say(s, nowMs, "Ooh, fresh content.");
  return { state: s, ok: true, message: `"${bonus.title}" added to the feed pack!`, notes };
}

export function feedMeme(
  input: GameState,
  target: { memeId?: number; memeKey?: string; label?: Label },
  nowMs: number,
): EngineResult {
  const { state: s, notes } = tickState(input, nowMs);
  const timing = getTimingConfig(s.clock);
  const cap = statCapFor(s, nowMs);

  if (s.isSleeping) {
    say(s, nowMs, "Zzz… no eating in my sleep.");
    return { state: s, ok: false, message: "Your monster is asleep — wake it first.", notes };
  }
  if (s.isRoasted) {
    say(s, nowMs, "TOO HOT. Can't eat.");
    return { state: s, ok: false, message: "Your monster is Roasted — let it cool down first.", notes };
  }
  const slots = bellyCapacity(s.stage);
  if (s.belly.length >= slots) {
    say(s, nowMs, "Belly FULL. Burp pending.");
    return { state: s, ok: false, message: `Belly full (${slots} slots) — wait for digestion.`, notes };
  }
  const meme = s.memes.find(
    (m) => !m.hidden && ((target.memeId != null && m.id === target.memeId) || (target.memeKey != null && m.key === target.memeKey)),
  );
  if (!meme) {
    return { state: s, ok: false, message: "Meme not found.", notes };
  }
  if (s.belly.some((b) => b.memeId === meme.id)) {
    say(s, nowMs, "Already digesting that one!");
    return { state: s, ok: false, message: `"${meme.title}" is already in the belly.`, notes };
  }

  // Handheld "label IS feeding" flow optionally applies a vote at feed time
  if (target.label) {
    const weight = s.secrets["rizz"] ? 2 : 1;
    meme[target.label] += weight;
    meme.lastActivityGameMs = s.gameMs;
  }

  const power = memePower(meme, s.gameMs);
  s.belly.push({
    id: allocId(s),
    memeId: meme.id,
    memeKey: meme.key,
    fedAtReal: nowMs,
    fedAtGameMs: s.gameMs,
    powerAtFed: power,
  });
  s.fullness = clampFloat(s.fullness + 6, cap);

  const dom = dominantLabel(meme);
  let heatMsg = "";
  if (dom === "spicy" || meme.spicy > 0) {
    const heatDelta = dom === "spicy" ? 25 : 10;
    const newHeat = s.heat + heatDelta;
    if (newHeat >= 100) {
      // Secret move `rickroll` auto-recovers from Roasted once!
      if (s.buffs.rickrollSaveReady) {
        s.buffs.rickrollSaveReady = false;
        s.heat = 40;
        heatMsg = " 🎵 Rickroll saved you from getting Roasted! Heat reset to 40.";
        pushEvent(s, "🎵 Never Gonna Give You Up saved Mochi from Roasted!", nowMs);
        say(s, nowMs, "Never gonna give you up~");
      } else {
        s.heat = 100;
        s.isRoasted = true;
        s.roastedUntilReal = nowMs + timing.roastedRealMs;
        heatMsg = ` 🌡️ Too spicy! ROASTED for ${Math.round(timing.roastedRealMs / 60_000) || 1}m.`;
        pushEvent(s, "🔥 ROASTED! Too many spicy memes", nowMs);
        say(s, nowMs, "I'M ON FIRE (derogatory)");
      }
    } else {
      s.heat = newHeat;
      heatMsg = ` 🌶️ Heat rose to ${Math.round(newHeat)}/100.`;
    }
  }

  pushEvent(s, `🍽️ Fed "${meme.title}"${target.label ? ` (${target.label})` : ""}`, nowMs);
  if (!s.isRoasted && !heatMsg.includes("Rickroll")) {
    say(
      s,
      nowMs,
      target.label === "blech" ? "Blech. But ok." : target.label === "spicy" || dom === "spicy" ? "SPICY!! More!" : "Tasty. 10/10.",
    );
  }
  const digestLabel = timing.digestRealMs >= HOUR_MS ? `${Math.round(timing.digestRealMs / HOUR_MS)}h` : `${Math.round(timing.digestRealMs / 1000)}s`;
  return {
    state: s,
    ok: true,
    message: `Nom! "${meme.title}" is digesting (${digestLabel}, power ${power}).${heatMsg}`,
    notes,
  };
}

export function talkAction(input: GameState, rawText: string, nowMs: number): EngineResult {
  const { state: s, notes } = tickState(input, nowMs);
  const clean = rawText.trim();
  if (!clean) return { state: s, ok: false, message: "Say something to your monster!", notes };
  if (containsBlockedText(clean)) {
    say(s, nowMs, "Hey. Language.");
    return { state: s, ok: false, message: "Blocked by the profanity/PII filter.", notes };
  }
  const low = normalizePhrase(clean);

  // 1) Secret word check
  const secretRes = tryUnlockSecret(s, low, nowMs, notes);
  if (secretRes.unlocked) {
    return {
      state: s,
      ok: true,
      message: `Secret unlocked: ${secretRes.unlocked} — ${secretRes.effect} (+15 Drip)`,
      notes,
    };
  }
  if (secretRes.alreadyHad) {
    say(s, nowMs, "Already know that one.");
    return { state: s, ok: true, message: `Already unlocked: ${LAUNCH_SECRET_WORDS[low]?.move}.`, notes };
  }

  // 2) Voice care commands
  if (low === "feed" || low === "kibble") return careAction(s, "feed", nowMs);
  if (low === "groom" || low === "bath") return careAction(s, "groom", nowMs);
  if (low === "play") return careAction(s, "play", nowMs);
  if (low === "sleep" || low === "nap") {
    if (s.isSleeping) return { state: s, ok: true, message: "Already sleeping.", notes };
    return careAction(s, "sleep", nowMs);
  }
  if (low === "wake" || low === "wake up") return careAction(s, "wake", nowMs);

  // 3) Label voice reaction
  const cap = statCapFor(s, nowMs);
  if (low === "tasty" || low === "spicy" || low === "blech") {
    say(s, nowMs, `${low.toUpperCase()}! Noted.`);
    s.happiness = clampFloat(s.happiness + 2, cap);
    maybeUnfreezeEvolution(s, nowMs, notes);
    return {
      state: s,
      ok: true,
      message: `Heard "${low}" — open FEED and hold to feed a meme with that label.`,
      notes,
    };
  }

  // 4) Ambient pet banter
  const replies = [
    "Interesting. Feed it to me as a meme.",
    "Noted. Anyway — memes?",
    "Bold take. I respect it.",
    "I heard you. I choose memes.",
  ];
  const hash = [...low].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const reply = replies[Math.abs(hash) % replies.length] ?? replies[0]!;
  say(s, nowMs, reply, 5000);
  s.happiness = clampFloat(s.happiness + 1, cap);
  maybeUnfreezeEvolution(s, nowMs, notes);
  return { state: s, ok: true, message: `${s.name} heard: "${clean}"`, notes };
}

export function completeMiniGame(
  input: GameState,
  game: MiniGameId,
  rawScore: number,
  nowMs: number,
): EngineResult<{ xpGained: number; dripGained: number }> {
  const { state: s, notes } = tickState(input, nowMs);
  const timing = getTimingConfig(s.clock);
  const cap = statCapFor(s, nowMs);
  const score = Math.max(0, Math.min(500, Math.floor(rawScore)));

  // GDD §2: Hangry (fullness === 0) won't train.
  if (Math.round(s.fullness) <= 0) {
    say(s, nowMs, "Too hangry to train!");
    return {
      state: s,
      ok: false,
      message: "Your monster is Hangry (0 Fullness) and refuses to train. Feed it first!",
      notes,
      extra: { xpGained: 0, dripGained: 0 },
    };
  }

  // Secret moves: Chad (+30% power/score), Stonks (+25% training XP)
  const effectiveScore = s.secrets["chad"] ? Math.round(score * 1.3) : score;
  let baseXp = (20 + effectiveScore * 2) * timing.xpMultiplier;
  if (s.fullness < 30) baseXp *= 0.5; // GDD §2: Fullness < 30 -> training rewards -50%
  if (s.buffs.stonksUntilReal > nowMs) baseXp *= 1.25;

  const dripGained = Math.floor(effectiveScore / 3);
  s.happiness = clampFloat(s.happiness + CARE_EFFECTS.miniGameHappiness, cap);
  s.energy = clampFloat(s.energy - CARE_EFFECTS.miniGameEnergyCost, cap);
  s.drip += dripGained;

  maybeUnfreezeEvolution(s, nowMs, notes);
  const xpGained = awardXp(s, baseXp, nowMs, notes);

  const label = game === "dodge" ? "🏃 Meme Dodge" : "🧩 Label Match";
  const bonuses: string[] = [];
  if (s.secrets["chad"]) bonuses.push("Chad +30%");
  if (s.buffs.stonksUntilReal > nowMs) bonuses.push("Stonks +25%");
  if (s.fullness < 30) bonuses.push("Hungry −50%");

  pushEvent(s, `${label} score ${score} (+${xpGained} XP, +${dripGained} Drip)`, nowMs);
  if (!notes.some((n) => n.includes("EVOLVED"))) {
    say(s, nowMs, game === "dodge" ? "Untouchable. Basically Neo." : "Big brain. Huge.");
  }

  return {
    state: s,
    ok: true,
    message: `${label} complete! Score ${score}: +${xpGained} XP, +${CARE_EFFECTS.miniGameHappiness} Happiness, −${CARE_EFFECTS.miniGameEnergyCost} Energy, +${dripGained} Drip${bonuses.length ? ` (${bonuses.join(", ")})` : ""}`,
    notes,
    extra: { xpGained, dripGained },
  };
}

export function buyCosmetic(input: GameState, assetId: string, nowMs: number): EngineResult {
  const { state: s, notes } = tickState(input, nowMs);
  const item = COSMETICS.find((c) => c.id === assetId);
  if (!item) return { state: s, ok: false, message: "Item not found.", notes };
  if (s.ownedCosmetics.includes(item.id)) {
    return { state: s, ok: false, message: `${item.name} is already owned.`, notes };
  }
  if (s.drip < item.price) {
    say(s, nowMs, "Too broke for drip. Tragic.");
    return { state: s, ok: false, message: `Not enough Drip — need ${item.price}, have ${s.drip}.`, notes };
  }
  s.drip -= item.price;
  s.ownedCosmetics.push(item.id);
  pushEvent(s, `🛍️ Bought ${item.name} (−${item.price} Drip)`, nowMs);
  say(s, nowMs, "New drip acquired.");
  return { state: s, ok: true, message: `${item.emoji} ${item.name} bought for ${item.price} Drip!`, notes };
}

export function equipCosmetic(input: GameState, assetId: string, nowMs: number): EngineResult {
  const { state: s, notes } = tickState(input, nowMs);
  const cap = statCapFor(s, nowMs);
  const item = COSMETICS.find((c) => c.id === assetId);
  if (!item) return { state: s, ok: false, message: "Item not found.", notes };
  if (!s.ownedCosmetics.includes(item.id)) {
    return { state: s, ok: false, message: `You don't own ${item.name} yet — buy it in the Drip Shop first.`, notes };
  }

  if (s.equipped[item.slot] === item.id) {
    delete s.equipped[item.slot];
    pushEvent(s, `👕 Took off ${item.name}`, nowMs);
    return { state: s, ok: true, message: `${item.name} removed.`, notes };
  }

  s.equipped[item.slot] = item.id;
  let bonusMsg = "";
  // GDD §2: +5 Happiness strictly on FIRST wear of a new outfit (prevents infinite farm exploit)
  if (!s.firstWornCosmetics.includes(item.id)) {
    s.firstWornCosmetics.push(item.id);
    s.happiness = clampFloat(s.happiness + CARE_EFFECTS.firstWearHappiness, cap);
    maybeUnfreezeEvolution(s, nowMs, notes);
    bonusMsg = ` +${CARE_EFFECTS.firstWearHappiness} Happiness (first wear bonus!)`;
  }
  pushEvent(s, `✨ Equipped ${item.name}`, nowMs);
  say(s, nowMs, "How do I look? Iconic, right?");
  return { state: s, ok: true, message: `${item.emoji} ${item.name} equipped!${bonusMsg}`, notes };
}

export function updateSettings(
  input: GameState,
  patch: { clock?: ClockRate; soundOn?: boolean },
  nowMs: number,
): EngineResult {
  const { state: s, notes } = tickState(input, nowMs);
  const parts: string[] = [];
  if (patch.clock != null && patch.clock !== s.clock) {
    s.clock = patch.clock;
    parts.push(patch.clock === 1 ? "Clock: real-time (1×)" : "Clock: demo speed (60×)");
  }
  if (patch.soundOn != null && patch.soundOn !== s.soundOn) {
    s.soundOn = patch.soundOn;
    parts.push(patch.soundOn ? "Sound: on" : "Sound: off");
  }
  return { state: s, ok: true, message: parts.join(" · ") || "Settings unchanged.", notes };
}

export function toGameView(s: GameState, nowMs: number, notes: string[] = []): GameView {
  const timing = getTimingConfig(s.clock);
  const today = utcDateKey(nowMs);
  const stageDef = stageDefByNumber(s.stage);
  const displayDef = stageDefByNumber(s.displayStage);
  const nextStage = nextStageForStage(s.stage);
  const mood = computeMood(s);
  const todaysVotes = s.votes.filter((v) => v.voteDate === today);
  const votedIds = new Set(todaysVotes.map((v) => v.memeId));
  const voteBudget = voteBudgetForStage(s.stage);

  const visibleMemes = s.memes
    .filter((m) => !m.hidden)
    .map((m) => ({
      id: m.id,
      key: m.key,
      title: m.title,
      caption: m.caption,
      emoji: m.emoji,
      imageKey: m.imageKey,
      imageUrl: m.imageUrl,
      bg: m.bg,
      tasty: m.tasty,
      spicy: m.spicy,
      blech: m.blech,
      shares: m.shares,
      power: memePower(m, s.gameMs),
      dominant: dominantLabel(m),
      isFresh: isMemeFresh(m, s.gameMs),
      isRotten: isMemeRotten(m, s.gameMs),
      isSeed: m.isSeed,
      votedToday: votedIds.has(m.id),
      reports: m.reports,
      createdAtReal: m.createdAtReal,
      customLabels: s.customLabels
        .filter((l) => l.memeId === m.id && !l.hidden)
        .map((l) => ({ id: l.id, text: l.text, reports: l.reports })),
    }));

  const equippedItems = Object.entries(s.equipped)
    .map(([slot, assetId]) => {
      const def = COSMETICS.find((c) => c.id === assetId);
      return def ? { slot: def.slot, assetId: def.id, emoji: def.emoji, name: def.name } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return {
    monster: {
      name: s.name,
      xp: s.xp,
      stage: s.stage,
      stageName: stageDef.name,
      displayStage: s.displayStage,
      displayStageName: displayDef.name,
      nextStageXp: nextStage?.xp ?? null,
      nextStageName: nextStage?.name ?? null,
      fullness: Math.round(s.fullness),
      happiness: Math.round(s.happiness),
      hygiene: Math.round(s.hygiene),
      energy: Math.round(s.energy),
      heat: Math.round(s.heat),
      statCap: statCapFor(s, nowMs),
      drip: s.drip,
      isSleeping: s.isSleeping,
      isRoasted: s.isRoasted,
      roastedLeftSec: s.isRoasted ? Math.max(0, Math.ceil((s.roastedUntilReal - nowMs) / 1000)) : 0,
      digestedCount: s.digestedCount,
      memeSlots: bellyCapacity(s.stage),
      voteBudget,
      mood,
      moodLabel: moodDisplayLabel(mood),
      speech: nowMs < s.speechUntilReal ? s.speech : "",
      cooldowns: {
        feedSec: s.lastFeedReal > 0 ? Math.max(0, Math.ceil((timing.feedCdRealMs - (nowMs - s.lastFeedReal)) / 1000)) : 0,
        groomSec: s.lastGroomReal > 0 ? Math.max(0, Math.ceil((timing.groomCdRealMs - (nowMs - s.lastGroomReal)) / 1000)) : 0,
        playSec: s.lastPlayReal > 0 ? Math.max(0, Math.ceil((timing.playCdRealMs - (nowMs - s.lastPlayReal)) / 1000)) : 0,
      },
      activeBuffs: {
        stonksActive: s.buffs.stonksUntilReal > nowMs,
        noCapActive: s.buffs.noCapUntilReal > nowMs,
        basedBoostReady: s.buffs.basedBoostReady,
        rickrollSaveReady: s.buffs.rickrollSaveReady,
        ratioShieldReady: s.buffs.ratioShieldReady,
        dogeSpeed: Boolean(s.secrets["doge"]),
        chadStrength: Boolean(s.secrets["chad"]),
        susSense: Boolean(s.secrets["sus"]),
        rizzCharisma: Boolean(s.secrets["rizz"]),
        midCrisis: Boolean(s.secrets["mid meme"]),
      },
    },
    belly: s.belly.map((b) => {
      const meme = s.memes.find((m) => m.id === b.memeId || m.key === b.memeKey);
      const digestsAtReal = b.fedAtReal + timing.digestRealMs;
      return {
        id: b.id,
        memeId: b.memeId,
        memeKey: b.memeKey,
        title: meme?.title ?? b.memeKey,
        emoji: meme?.emoji ?? "❓",
        imageKey: meme?.imageKey ?? null,
        imageUrl: meme?.imageUrl ?? null,
        fedAtReal: b.fedAtReal,
        digestsAtReal,
        digestInSec: Math.max(0, Math.ceil((digestsAtReal - nowMs) / 1000)),
        powerAtFed: b.powerAtFed,
        powerNow: meme ? memePower(meme, s.gameMs) : b.powerAtFed,
      };
    }),
    memes: visibleMemes,
    bonusMemes: BONUS_MEMES.map((b) => ({
      key: b.key,
      title: b.title,
      imageKey: b.imageKey,
      added: s.memes.some((m) => m.key === b.key && !m.hidden),
    })),
    votesUsedToday: todaysVotes.length,
    voteBudget,
    secrets: Object.values(s.secrets).map((sec) => ({
      word: sec.word,
      move: sec.move,
      effect: sec.effect,
    })),
    cosmetics: COSMETICS.map((c) => ({
      id: c.id,
      slot: c.slot,
      name: c.name,
      emoji: c.emoji,
      price: c.price,
      owned: s.ownedCosmetics.includes(c.id),
      equipped: s.equipped[c.slot] === c.id,
      wornBefore: s.firstWornCosmetics.includes(c.id),
    })),
    equippedItems,
    events: s.events,
    notes,
    settings: {
      clock: s.clock,
      soundOn: s.soundOn,
      digestSeconds: Math.round(timing.digestRealMs / 1000),
      xpMultiplier: timing.xpMultiplier,
    },
    serverNow: nowMs,
  };
}
