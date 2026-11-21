export type Label = "tasty" | "spicy" | "blech";
export type CareAction = "feed" | "groom" | "play" | "sleep" | "wake";
export type MiniGameId = "runner" | "blaster" | "beat" | "ember";
export type CosmeticSlot = "head" | "face" | "body" | "back" | "sticker";
export type ClockRate = 1 | 60;

export type SpeciesId =
  | "mint-dragon"
  | "spicy-imp"
  | "cyber-cat"
  | "cozy-frog"
  | "cursed-ghost";

export type SpecialMoveId =
  | "bubble-shield"
  | "fire-dash"
  | "glitch-blink"
  | "zen-slow"
  | "phantom-phase";

export type Mood =
  | "happy"
  | "excited"
  | "hungry"
  | "sleepy"
  | "sleeping"
  | "eating"
  | "sick"
  | "sad"
  | "hangry"
  | "roasted";

export interface SpeciesArchetype {
  readonly fullnessDecayMul: number;
  readonly happinessDecayMul: number;
  readonly hygieneDecayMul: number;
  readonly energyDecayMul: number;
  readonly sleepRestoreMul: number;
  readonly kibbleMul: number;
  readonly heatCap: number;
  readonly roastedResetHeat: number;
  readonly tastyMul: number;
  readonly spicyMul: number;
  readonly blechMul: number;
  readonly dripMul: number;
  readonly miniGameScoreMul: number;
}

export interface SpeciesDef {
  readonly id: SpeciesId;
  readonly name: string;
  readonly defaultPetName: string;
  readonly title: string;
  readonly tagline: string;
  readonly accentColor: string;
  readonly secondaryColor: string;
  readonly eggColors: readonly [string, string, string];
  readonly statBars: {
    readonly speed: number;
    readonly stamina: number;
    readonly spice: number;
    readonly luck: number;
  };
  readonly perkSummary: string;
  readonly tradeoffSummary: string;
  readonly specialMove: {
    readonly id: SpecialMoveId;
    readonly name: string;
    readonly description: string;
  };
  readonly archetype: SpeciesArchetype;
  readonly voiceLines: {
    readonly hatch: string;
    readonly feed: string;
    readonly play: string;
    readonly banter: readonly string[];
  };
}

export interface MiniGameDef {
  readonly id: MiniGameId;
  readonly name: string;
  readonly shortName: string;
  readonly glyph: string;
  readonly genre: string;
  readonly tagline: string;
  readonly controls: string;
}

export interface StageDef {
  readonly stage: number;
  readonly name: string;
  readonly shortName: string;
  readonly xp: number;
}

export interface SecretMoveDef {
  readonly word: string;
  readonly move: string;
  readonly effect: string;
  readonly line: string;
  readonly reserve?: boolean;
}

export interface CosmeticDef {
  readonly id: string;
  readonly slot: CosmeticSlot;
  readonly name: string;
  readonly emoji: string;
  readonly price: number;
  readonly artStyle?: "sheet" | "classic";
}

export interface SeedMemeDef {
  readonly key: string;
  readonly title: string;
  readonly caption: string;
  readonly emoji: string;
  readonly bg: string;
  readonly tasty: number;
  readonly spicy: number;
  readonly blech: number;
  readonly shares: number;
}

export interface BonusMemeDef {
  readonly key: string;
  readonly title: string;
  readonly caption: string;
  readonly emoji: string;
  readonly imageKey: string;
  readonly bg: string;
  readonly tasty: number;
  readonly spicy: number;
  readonly blech: number;
}

export interface CustomLabelRecord {
  id: number;
  memeId: number;
  text: string;
  createdAtReal: number;
  reports: number;
  hidden: boolean;
}

export interface MemeRecord {
  id: number;
  key: string;
  title: string;
  caption: string;
  emoji: string;
  imageKey: string | null;
  imageUrl: string | null;
  bg: string;
  tasty: number;
  spicy: number;
  blech: number;
  shares: number;
  isSeed: boolean;
  createdAtReal: number;
  createdAtGameMs: number;
  lastActivityGameMs: number;
  reports: number;
  hidden: boolean;
}

export interface BellyItem {
  id: number;
  memeId: number;
  memeKey: string;
  fedAtReal: number;
  fedAtGameMs: number;
  powerAtFed: number;
}

export interface DigestedRecord {
  memeId: number;
  memeKey: string;
  digestedAtReal: number;
  lastCreditedPower: number;
  backflowCreditedToday: number;
  backflowDateKey: string;
}

export interface VoteRecord {
  memeId: number;
  label: Label;
  voteDate: string;
  createdAtReal: number;
}

export interface UnlockedSecret {
  word: string;
  move: string;
  effect: string;
  unlockedAtReal: number;
  chargesRemaining?: number;
}

export interface FeedEventRecord {
  id: number;
  text: string;
  createdAtReal: number;
}

export interface ActiveBuffs {
  stonksUntilReal: number;
  noCapUntilReal: number;
  basedBoostReady: boolean;
  rickrollSaveReady: boolean;
  ratioShieldReady: boolean;
}

export interface CareStreakState {
  count: number;
  lastCareDate: string | null;
  bestStreak: number;
}

export interface HighScoreEntry {
  bestScore: number;
  bestCombo: number;
  plays: number;
}

export interface GameState {
  version: number;
  hatched: boolean;
  species: SpeciesId;
  name: string;
  xp: number;
  stage: number;
  displayStage: number;
  fullness: number;
  happiness: number;
  hygiene: number;
  energy: number;
  heat: number;
  drip: number;
  isSleeping: boolean;
  isRoasted: boolean;
  roastedUntilReal: number;
  lastTickReal: number;
  gameMs: number;
  bornGameMs: number;
  lastBackflowGameMs: number;
  lastFeedReal: number;
  lastGroomReal: number;
  lastPlayReal: number;
  lastSleepReal: number;
  digestedCount: number;
  careStreak: CareStreakState;
  highScores: Record<MiniGameId, HighScoreEntry>;
  belly: BellyItem[];
  digestedHistory: DigestedRecord[];
  memes: MemeRecord[];
  votes: VoteRecord[];
  customLabels: CustomLabelRecord[];
  secrets: Record<string, UnlockedSecret>;
  buffs: ActiveBuffs;
  ownedCosmetics: string[];
  firstWornCosmetics: string[];
  equipped: Partial<Record<CosmeticSlot, string>>;
  events: FeedEventRecord[];
  speech: string;
  speechUntilReal: number;
  clock: ClockRate;
  soundOn: boolean;
  nextId: number;
}

export interface TimingConfig {
  clock: ClockRate;
  digestRealMs: number;
  feedCdRealMs: number;
  groomCdRealMs: number;
  playCdRealMs: number;
  roastedRealMs: number;
  xpMultiplier: number;
}

export interface MilestonePowers {
  /** 5 digested: Species X Special recharges 35% faster */
  turboCharge: boolean;
  /** 15 digested: 1 automatic free hit-shield per mini-game run */
  secondWind: boolean;
  /** 30 digested: Start every mini-game with x1.5 Overdrive multiplier */
  memeOverdrive: boolean;
}

export interface DreamMemeView {
  memeId: number;
  memeKey: string;
  title: string;
  caption: string;
  emoji: string;
  imageKey: string | null;
  imageUrl: string | null;
  bg: string;
  fedAtReal: number;
  inBelly: boolean;
}

export interface GameView {
  hatched: boolean;
  speciesCatalog: readonly SpeciesDef[];
  miniGames: readonly MiniGameDef[];
  monster: {
    name: string;
    species: SpeciesId;
    speciesDef: SpeciesDef;
    xp: number;
    stage: number;
    stageName: string;
    displayStage: number;
    displayStageName: string;
    nextStageXp: number | null;
    nextStageName: string | null;
    fullness: number;
    happiness: number;
    hygiene: number;
    energy: number;
    heat: number;
    heatCap: number;
    statCap: number;
    drip: number;
    isSleeping: boolean;
    isRoasted: boolean;
    roastedLeftSec: number;
    digestedCount: number;
    careStreak: CareStreakState;
    highScores: Record<MiniGameId, HighScoreEntry>;
    milestonePowers: MilestonePowers;
    memeSlots: number;
    voteBudget: number;
    mood: Mood;
    moodLabel: string;
    speech: string;
    cooldowns: {
      feedSec: number;
      groomSec: number;
      playSec: number;
    };
    activeBuffs: {
      stonksActive: boolean;
      noCapActive: boolean;
      basedBoostReady: boolean;
      rickrollSaveReady: boolean;
      ratioShieldReady: boolean;
      dogeSpeed: boolean;
      chadStrength: boolean;
      susSense: boolean;
      rizzCharisma: boolean;
      midCrisis: boolean;
    };
  };
  belly: Array<{
    id: number;
    memeId: number;
    memeKey: string;
    title: string;
    emoji: string;
    imageKey: string | null;
    imageUrl: string | null;
    fedAtReal: number;
    digestsAtReal: number;
    digestInSec: number;
    powerAtFed: number;
    powerNow: number;
  }>;
  /** Unique memes the monster has fed on (currently in belly + previously digested), newest first, for the Sleep Dream Screensaver */
  dreamMemes: DreamMemeView[];
  memes: Array<{
    id: number;
    key: string;
    title: string;
    caption: string;
    emoji: string;
    imageKey: string | null;
    imageUrl: string | null;
    bg: string;
    tasty: number;
    spicy: number;
    blech: number;
    shares: number;
    power: number;
    dominant: Label;
    isFresh: boolean;
    isRotten: boolean;
    isSeed: boolean;
    votedToday: boolean;
    reports: number;
    createdAtReal: number;
    customLabels: Array<{ id: number; text: string; reports: number }>;
  }>;
  bonusMemes: Array<{
    key: string;
    title: string;
    imageKey: string;
    added: boolean;
  }>;
  votesUsedToday: number;
  voteBudget: number;
  secrets: Array<{ word: string; move: string; effect: string }>;
  cosmetics: Array<{
    id: string;
    slot: CosmeticSlot;
    name: string;
    emoji: string;
    price: number;
    owned: boolean;
    equipped: boolean;
    wornBefore: boolean;
  }>;
  equippedItems: Array<{
    slot: CosmeticSlot;
    assetId: string;
    emoji: string;
    name: string;
  }>;
  events: FeedEventRecord[];
  notes: string[];
  settings: {
    clock: ClockRate;
    soundOn: boolean;
    digestSeconds: number;
    xpMultiplier: number;
  };
  serverNow: number;
}

export interface EngineResult<TExtra extends Record<string, unknown> = Record<string, never>> {
  state: GameState;
  ok: boolean;
  message: string;
  notes: string[];
  extra?: TExtra;
}
