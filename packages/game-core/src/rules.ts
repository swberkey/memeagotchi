import {
  BASE_STAT_CAP,
  DAY_MS,
  NO_CAP_STAT_CAP,
  ROTTEN_AGE_GAME_MS,
  STAGES,
} from "./constants.ts";
import type { ClockRate, GameState, Label, MemeRecord, Mood, StageDef, TimingConfig } from "./types.ts";

const PROFANITY_RE = /\b(fuck|fucking|shit|shitty|bitch|asshole|cunt|slur|damn|bastard)\b/i;
const PII_RE = /(\S+@\S+\.\S+|https?:\/\/|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|\d{7,})/i;

export function getTimingConfig(clock: ClockRate): TimingConfig {
  if (clock === 1) {
    return {
      clock: 1,
      digestRealMs: 24 * 3_600_000,
      feedCdRealMs: 5 * 60_000,
      groomCdRealMs: 10 * 60_000,
      playCdRealMs: 15 * 60_000,
      roastedRealMs: 60 * 60_000,
      xpMultiplier: 1,
    };
  }
  return {
    clock: 60,
    digestRealMs: 90_000,
    feedCdRealMs: 30_000,
    groomCdRealMs: 60_000,
    playCdRealMs: 90_000,
    roastedRealMs: 60_000,
    xpMultiplier: 5,
  };
}

export function statCapFor(state: Pick<GameState, "buffs">, nowMs: number): number {
  return state.buffs.noCapUntilReal > nowMs ? NO_CAP_STAT_CAP : BASE_STAT_CAP;
}

export function clampFloat(value: number, cap = BASE_STAT_CAP): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(cap, value));
}

export function stageForXp(xp: number): StageDef {
  let current = STAGES[0]!;
  for (const st of STAGES) {
    if (xp >= st.xp) current = st;
  }
  return current;
}

export function nextStageForStage(stage: number): StageDef | null {
  return STAGES.find((s) => s.stage === stage + 1) ?? null;
}

export function stageDefByNumber(stage: number): StageDef {
  return STAGES[Math.max(0, Math.min(STAGES.length - 1, stage - 1))] ?? STAGES[0]!;
}

export function bellyCapacity(stage: number): number {
  return Math.min(7, Math.max(3, 3 + (stage - 1)));
}

export function voteBudgetForStage(stage: number): number {
  return 3 + (stage >= 3 ? 1 : 0) + (stage >= 5 ? 1 : 0);
}

export function isMemeFresh(meme: Pick<MemeRecord, "createdAtGameMs">, nowGameMs: number): boolean {
  return nowGameMs - meme.createdAtGameMs < DAY_MS;
}

export function isMemeRotten(meme: Pick<MemeRecord, "lastActivityGameMs" | "isSeed">, nowGameMs: number): boolean {
  if (meme.isSeed) return false;
  return nowGameMs - meme.lastActivityGameMs >= ROTTEN_AGE_GAME_MS;
}

export function memePower(meme: Pick<MemeRecord, "tasty" | "spicy" | "blech" | "shares" | "createdAtGameMs" | "lastActivityGameMs" | "isSeed">, nowGameMs: number): number {
  let power = meme.tasty * 2 + meme.spicy * 3 - meme.blech + meme.shares;
  if (isMemeFresh(meme, nowGameMs)) power += 1;
  if (isMemeRotten(meme, nowGameMs)) power -= 2;
  return Math.max(0, power);
}

export function dominantLabel(meme: Pick<MemeRecord, "tasty" | "spicy" | "blech">): Label {
  if (meme.spicy > 0 && meme.spicy >= meme.tasty && meme.spicy >= meme.blech) return "spicy";
  if (meme.tasty >= meme.blech) return "tasty";
  return "blech";
}

export function normalizePhrase(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export function containsBlockedText(text: string, allowUrls = false): boolean {
  if (PROFANITY_RE.test(text)) return true;
  if (allowUrls) {
    return /(\S+@\S+\.\S+|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|\d{7,})/i.test(text);
  }
  return PII_RE.test(text);
}

export function computeMood(state: Pick<GameState, "isRoasted" | "isSleeping" | "fullness" | "happiness" | "hygiene" | "energy">): Mood {
  if (state.isRoasted) return "roasted";
  if (state.isSleeping) return "sleeping";
  if (Math.round(state.fullness) <= 0) return "hangry";
  if (state.hygiene < 30) return "sick";
  if (state.fullness < 30) return "hungry";
  if (state.energy < 30) return "sleepy";
  if (state.happiness < 30) return "sad";
  if (state.fullness >= 85 && state.happiness >= 85 && state.energy >= 70) return "excited";
  return "happy";
}

export function moodDisplayLabel(mood: Mood): string {
  switch (mood) {
    case "roasted": return "Roasted 🤒";
    case "sleeping": return "Sleeping 💤";
    case "hangry": return "Hangry 😤";
    case "sick": return "Stinky 🪰";
    case "hungry": return "Hungry 🤤";
    case "sleepy": return "Sleepy 😪";
    case "sad": return "Sulking 😞";
    case "eating": return "Munching 😋";
    case "excited": return "Excited ✨";
    default: return "Thriving 😄";
  }
}

export function utcDateKey(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}
