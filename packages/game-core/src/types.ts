export type Label = "tasty" | "spicy" | "blech";
export type CareAction = "feed" | "groom" | "play" | "sleep" | "wake";
export type MiniGameId = "dodge" | "match";
export type CosmeticSlot = "head" | "face" | "body" | "back" | "sticker";
export type ClockRate = 1 | 60;

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
  /** Market Manipulation (`stonks`): +25% training XP until timestamp */
  stonksUntilReal: number;
  /** Cap Breaker (`no cap`): stat cap = 105 until timestamp */
  noCapUntilReal: number;
  /** Based Boost (`based and correct`): next digestion power grant x2 */
  basedBoostReady: boolean;
  /** Never Gonna Give You Up (`rickroll`): auto-recover from Roasted once */
  rickrollSaveReady: boolean;
  /** Ratio Shield (`l + ratio`): immune to one blech penalty */
  ratioShieldReady: boolean;
}

export interface GameState {
  version: number;
  name: string;
  xp: number;
  /** Actual unlocked evolution stage (1..5); frozen when happiness === 0 */
  stage: number;
  /** Nostalgia visual look (1..stage); Stage 5 aura stays tied to `stage` */
  displayStage: number;
  /** Floating-point internal stats (rounded only in view projection) */
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

export interface GameView {
  monster: {
    name: string;
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
    statCap: number;
    drip: number;
    isSleeping: boolean;
    isRoasted: boolean;
    roastedLeftSec: number;
    digestedCount: number;
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
