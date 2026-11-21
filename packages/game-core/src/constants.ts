import type { BonusMemeDef, CosmeticDef, SecretMoveDef, SeedMemeDef, StageDef } from "./types.ts";

export const STATE_VERSION = 2;

export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;
export const LONG_OFFLINE_GAME_MS = 72 * HOUR_MS;
export const BACKFLOW_INTERVAL_GAME_MS = 15 * 60_000;
export const ROTTEN_AGE_GAME_MS = 7 * DAY_MS;

export const BASE_STAT_CAP = 100;
export const NO_CAP_STAT_CAP = 105;
export const OFFLINE_DECAY_FLOOR = 25;
export const AUTO_HIDE_REPORT_THRESHOLD = 3;

/**
 * Decay and recovery rates per game-hour.
 * Energy follows the Nov 17 playtest retuning (ADR-001):
 * awake −1/hr (was −4), sleeping +20/hr (was +10), play/mini-game −5 (was −15).
 */
export const DECAY_RATES = {
  fullnessPerHour: 5,
  happinessPerHour: 3,
  hygienePerHour: 2,
  energyAwakePerHour: 1,
  energySleepRestorePerHour: 20,
  sleepWakeThreshold: 80,
  sleepOtherDecayFactor: 0.5,
} as const;

export const CARE_EFFECTS = {
  feedFullness: 30,
  feedXp: 10,
  groomHygiene: 25,
  groomXp: 8,
  playHappiness: 20,
  playEnergyCost: 5,
  playXp: 12,
  miniGameHappiness: 20,
  miniGameEnergyCost: 5,
  firstWearHappiness: 5,
  shareXp: 5,
  shareDrip: 3,
} as const;

export const STAGES: readonly StageDef[] = [
  { stage: 1, name: "Blob", shortName: "BLOB", xp: 0 },
  { stage: 2, name: "Critter", shortName: "CRIT", xp: 500 },
  { stage: 3, name: "Beast", shortName: "BEAST", xp: 2500 },
  { stage: 4, name: "Legend", shortName: "LEGEND", xp: 10000 },
  { stage: 5, name: "Eldritch Meme Lord", shortName: "ELDRCH", xp: 40000 },
] as const;

export const DIGESTION_MILESTONES = [5, 15, 30] as const;

export const LAUNCH_SECRET_WORDS: Record<string, SecretMoveDef> = {
  stonks: {
    word: "stonks",
    move: "Market Manipulation",
    effect: "Training XP +25% for 1h",
    line: "STONKS! Only up. ONLY UP.",
  },
  doge: {
    word: "doge",
    move: "Much Speed",
    effect: "Meme Dodge time +30%",
    line: "wow. much speed. very fast.",
  },
  chad: {
    word: "chad",
    move: "Gigachad Strength",
    effect: "Mini-game score power +30%",
    line: "Yes. I am the chad now.",
  },
  rickroll: {
    word: "rickroll",
    move: "Never Gonna Give You Up",
    effect: "Auto-recovers from one Roasted state",
    line: "Never gonna give you up~",
  },
  sus: {
    word: "sus",
    move: "Imposter Sense",
    effect: "Reveals upcoming mini-game patterns",
    line: "...that was kinda sus.",
  },
  rizz: {
    word: "rizz",
    move: "Charisma",
    effect: "Your votes carry +1 extra weight",
    line: "Rizz levels: critical.",
  },
  "no cap": {
    word: "no cap",
    move: "Cap Breaker",
    effect: "Stat cap +5 (to 105) for 24h",
    line: "No cap detected. Fr fr.",
  },
  "l + ratio": {
    word: "l + ratio",
    move: "Ratio Shield",
    effect: "Immune to one blech penalty",
    line: "L + ratio + blocked.",
  },
  "mid meme": {
    word: "mid meme",
    move: "Mid Crisis",
    effect: "Converts blech digestion into neutral tasty boost",
    line: "It's... fine. It's mid.",
  },
  "based and correct": {
    word: "based and correct",
    move: "Based Boost",
    effect: "Next meme digestion power grant ×2",
    line: "Based. And, dare I say, correct.",
  },
};

export const RESERVE_SECRET_WORDS: readonly string[] = [
  "gyatt",
  "skibidi",
  "sigma",
  "goated",
  "delulu",
] as const;

export const COSMETICS: readonly CosmeticDef[] = [
  { id: "cap-red", slot: "head", name: "Backward Cap", emoji: "🧢", price: 40, artStyle: "classic" },
  { id: "chef-hat", slot: "head", name: "Chef Hat", emoji: "👨‍🍳", price: 55, artStyle: "sheet" },
  { id: "party-hat", slot: "head", name: "Party Hat", emoji: "🥳", price: 50, artStyle: "sheet" },
  { id: "wizard-hat", slot: "head", name: "Wizard Hat", emoji: "🧙", price: 95, artStyle: "sheet" },
  { id: "crown", slot: "head", name: "Tiny Crown", emoji: "👑", price: 120, artStyle: "classic" },
  { id: "shades", slot: "face", name: "Deal-With-It Shades", emoji: "🕶️", price: 60, artStyle: "sheet" },
  { id: "star-glasses", slot: "face", name: "Star Glasses", emoji: "🤩", price: 80, artStyle: "classic" },
  { id: "chain", slot: "body", name: "Gold Chain", emoji: "📿", price: 90, artStyle: "classic" },
  { id: "wizard-robe", slot: "body", name: "Wizard Robe", emoji: "🔮", price: 115, artStyle: "sheet" },
  { id: "cape", slot: "back", name: "Hero Cape", emoji: "🦸", price: 110, artStyle: "classic" },
  { id: "flame-sticker", slot: "sticker", name: "Flame Sticker", emoji: "🔥", price: 30, artStyle: "classic" },
  { id: "sparkle-sticker", slot: "sticker", name: "Sparkle Sticker", emoji: "✨", price: 30, artStyle: "classic" },
] as const;

export const MEME_IMAGE_KEYS = [
  "distracted",
  "thisisfine",
  "stonks",
  "npc",
  "doge",
  "pepe",
  "disaster",
  "buttons",
  "success",
] as const;

export type MemeImageKey = (typeof MEME_IMAGE_KEYS)[number];

export const SEED_MEMES: readonly SeedMemeDef[] = [
  {
    key: "distracted",
    title: "Distracted Boyfriend IRL",
    caption: "me, my responsibilities, and a shiny new hyperfixation",
    emoji: "👀",
    bg: "#dbeafe",
    tasty: 14,
    spicy: 3,
    blech: 1,
    shares: 0,
  },
  {
    key: "thisisfine",
    title: "This Is Fine (It's Not)",
    caption: "the group project is due tomorrow and nobody has started",
    emoji: "🔥",
    bg: "#ffedd5",
    tasty: 11,
    spicy: 8,
    blech: 0,
    shares: 1,
  },
  {
    key: "stonks",
    title: "Stonks Only Go Up",
    caption: "bought the dip. the dip bought more dip.",
    emoji: "📈",
    bg: "#dcfce7",
    tasty: 9,
    spicy: 12,
    blech: 2,
    shares: 2,
  },
  {
    key: "npc",
    title: "NPC Energy",
    caption: "when you rehearse the conversation 40 times and still say 'you too' to the waiter",
    emoji: "😐",
    bg: "#f3e8ff",
    tasty: 13,
    spicy: 1,
    blech: 3,
    shares: 0,
  },
  {
    key: "success",
    title: "Success Kid Touched Grass",
    caption: "day 47 inside was the rumor. he made it to the beach. fist full of sand, mission complete.",
    emoji: "🌱",
    bg: "#fef9c3",
    tasty: 7,
    spicy: 2,
    blech: 1,
    shares: 1,
  },
  {
    key: "pepe",
    title: "Pepe's Bruh Moment",
    caption: "deleted the file. the file was the backup. pepe has seen things.",
    emoji: "💀",
    bg: "#ffe4e6",
    tasty: 10,
    spicy: 5,
    blech: 4,
    shares: 2,
  },
  {
    key: "doge",
    title: "Doge Judging You",
    caption: "much side-eye. very judgment. wow.",
    emoji: "🐕",
    bg: "#fef3c7",
    tasty: 12,
    spicy: 2,
    blech: 2,
    shares: 0,
  },
  {
    key: "disaster",
    title: "Disaster Girl Energy",
    caption: "walked away from the group project like it was nothing",
    emoji: "😏",
    bg: "#fee2e2",
    tasty: 8,
    spicy: 11,
    blech: 1,
    shares: 1,
  },
  {
    key: "buttons",
    title: "Two Buttons, One Brain Cell",
    caption: "feed the monster a tasty meme or a spicy one. choose wisely. sweating.",
    emoji: "😅",
    bg: "#e0f2fe",
    tasty: 6,
    spicy: 6,
    blech: 2,
    shares: 2,
  },
] as const;

export const BONUS_MEMES: readonly BonusMemeDef[] = [
  {
    key: "bonus-wow",
    title: "Surprised Pikachu Energy",
    caption: "did the thing. shocked by the thing.",
    emoji: "⚡",
    imageKey: "disaster",
    bg: "#fef9c3",
    tasty: 6,
    spicy: 2,
    blech: 1,
  },
  {
    key: "bonus-chill",
    title: "Chill Guy Hours",
    caption: "hands in pockets. zero worries. maximum chill.",
    emoji: "😎",
    imageKey: "doge",
    bg: "#e0f2fe",
    tasty: 8,
    spicy: 0,
    blech: 0,
  },
  {
    key: "bonus-coffee",
    title: "Coffee First, Questions Later",
    caption: "the fire is fine because the coffee is hot",
    emoji: "☕",
    imageKey: "thisisfine",
    bg: "#ffedd5",
    tasty: 5,
    spicy: 4,
    blech: 1,
  },
] as const;
