import {
  addCustomLabel,
  buyCosmetic,
  careAction,
  completeMiniGame,
  containsBlockedText,
  createFreshState,
  equipCosmetic,
  feedMeme,
  MEME_IMAGE_KEYS,
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
  type GameState,
  type GameView,
} from "@memeagotchi/game-core";
import { defineAction, s, type ActionsModule } from "@memeagotchi/rpc-sdk";

export interface StateRepo {
  load(nowMs: number): GameState;
  save(state: GameState, nowMs: number): void;
  audit(actionName: string, ok: boolean, summary: string, nowMs: number): void;
}

export interface UrlUploader {
  fetchAndSaveUrl(rawUrl: string): Promise<{ imageUrl: string; suggestedTitle: string }>;
}

export interface ServerCtx {
  repo: StateRepo;
  uploads: UrlUploader;
  now: () => number;
}

const gameViewSchema = s.any<GameView>();

const okViewResponse = s.object({
  ok: s.boolean(),
  message: s.string(),
  view: gameViewSchema,
});

export const Actions = {
  getState: defineAction({
    description: "Returns the unified live game state after server-side decay, digestion, and backflow.",
    request: s.object({}),
    response: s.object({ view: gameViewSchema }),
    handler(ctx: ServerCtx) {
      const nowMs = ctx.now();
      const loaded = ctx.repo.load(nowMs);
      const { state, notes } = tickState(loaded, nowMs);
      ctx.repo.save(state, nowMs);
      return { view: toGameView(state, nowMs, notes) };
    },
  }),

  care: defineAction({
    description: "Performs a care action (feed kibble, groom, play, sleep, or wake).",
    request: s.object({ action: s.enum(["feed", "groom", "play", "sleep", "wake"] as const) }),
    response: okViewResponse,
    handler(ctx: ServerCtx, args) {
      const nowMs = ctx.now();
      const res = careAction(ctx.repo.load(nowMs), args.action, nowMs);
      ctx.repo.save(res.state, nowMs);
      ctx.repo.audit("care", res.ok, `${args.action}: ${res.message}`, nowMs);
      return { ok: res.ok, message: res.message, view: toGameView(res.state, nowMs, res.notes) };
    },
  }),

  renameMonster: defineAction({
    description: "Renames the monster (1–24 characters, profanity/PII filtered).",
    request: s.object({ name: s.string().min(1).max(24) }),
    response: okViewResponse,
    handler(ctx: ServerCtx, args) {
      const nowMs = ctx.now();
      const res = renameMonster(ctx.repo.load(nowMs), args.name, nowMs);
      ctx.repo.save(res.state, nowMs);
      ctx.repo.audit("renameMonster", res.ok, res.message, nowMs);
      return { ok: res.ok, message: res.message, view: toGameView(res.state, nowMs, res.notes) };
    },
  }),

  setDisplayStage: defineAction({
    description: "Nostalgia toggle: display any previously attained stage's look (unlocked at Stage 3).",
    request: s.object({ stage: s.number().int().min(1).max(5) }),
    response: okViewResponse,
    handler(ctx: ServerCtx, args) {
      const nowMs = ctx.now();
      const res = setDisplayStage(ctx.repo.load(nowMs), args.stage, nowMs);
      ctx.repo.save(res.state, nowMs);
      return { ok: res.ok, message: res.message, view: toGameView(res.state, nowMs, res.notes) };
    },
  }),

  voteMeme: defineAction({
    description: "Casts a daily label vote (tasty/spicy/blech) respecting the daily vote budget.",
    request: s.object({ memeId: s.number().int(), label: s.enum(["tasty", "spicy", "blech"] as const) }),
    response: okViewResponse,
    handler(ctx: ServerCtx, args) {
      const nowMs = ctx.now();
      const res = voteMeme(ctx.repo.load(nowMs), args.memeId, args.label, nowMs);
      ctx.repo.save(res.state, nowMs);
      return { ok: res.ok, message: res.message, view: toGameView(res.state, nowMs, res.notes) };
    },
  }),

  shareMeme: defineAction({
    description: "Shares a meme (+1 power to meme, +5 XP and +3 Drip commission).",
    request: s.object({ memeId: s.number().int() }),
    response: okViewResponse,
    handler(ctx: ServerCtx, args) {
      const nowMs = ctx.now();
      const res = shareMeme(ctx.repo.load(nowMs), args.memeId, nowMs);
      ctx.repo.save(res.state, nowMs);
      return { ok: res.ok, message: res.message, view: toGameView(res.state, nowMs, res.notes) };
    },
  }),

  addCustomLabel: defineAction({
    description: "Adds a custom label to a meme and checks server-side secret words.",
    request: s.object({ memeId: s.number().int(), text: s.string().min(1).max(40) }),
    response: okViewResponse.extend({ unlocked: s.string().nullable() }),
    handler(ctx: ServerCtx, args) {
      const nowMs = ctx.now();
      const res = addCustomLabel(ctx.repo.load(nowMs), args.memeId, args.text, nowMs);
      ctx.repo.save(res.state, nowMs);
      return {
        ok: res.ok,
        message: res.message,
        unlocked: res.extra?.unlocked ?? null,
        view: toGameView(res.state, nowMs, res.notes),
      };
    },
  }),

  reportMeme: defineAction({
    description: "Reports a meme; 3 reports auto-hide it pending review.",
    request: s.object({ memeId: s.number().int() }),
    response: okViewResponse,
    handler(ctx: ServerCtx, args) {
      const nowMs = ctx.now();
      const res = reportMeme(ctx.repo.load(nowMs), args.memeId, nowMs);
      ctx.repo.save(res.state, nowMs);
      return { ok: res.ok, message: res.message, view: toGameView(res.state, nowMs, res.notes) };
    },
  }),

  reportLabel: defineAction({
    description: "Reports a custom label; 3 reports auto-hide it pending review.",
    request: s.object({ labelId: s.number().int() }),
    response: okViewResponse,
    handler(ctx: ServerCtx, args) {
      const nowMs = ctx.now();
      const res = reportLabel(ctx.repo.load(nowMs), args.labelId, nowMs);
      ctx.repo.save(res.state, nowMs);
      return { ok: res.ok, message: res.message, view: toGameView(res.state, nowMs, res.notes) };
    },
  }),

  postMeme: defineAction({
    description: "Posts a new meme using a template photo or a locally uploaded image path.",
    request: s.object({
      title: s.string().min(1).max(80),
      caption: s.string().max(160).default(""),
      emoji: s.string().min(1).max(8).default("🖼️"),
      imageKey: s.enum(MEME_IMAGE_KEYS).nullable().default(null),
      imageUrl: s
        .string()
        .max(256)
        .refine((u) => u.startsWith("/uploads/"), "Only uploaded local paths are permitted")
        .nullable()
        .default(null),
      bg: s.string().max(16).default("#fef9c3"),
    }),
    response: okViewResponse.extend({ id: s.number() }),
    handler(ctx: ServerCtx, args) {
      const nowMs = ctx.now();
      const res = postMeme(ctx.repo.load(nowMs), args, nowMs);
      ctx.repo.save(res.state, nowMs);
      return {
        ok: res.ok,
        id: res.extra?.id ?? 0,
        message: res.message,
        view: toGameView(res.state, nowMs, res.notes),
      };
    },
  }),

  postBonusMeme: defineAction({
    description: "Adds one of the built-in bonus memes to the feed pack (handheld one-button POST screen).",
    request: s.object({ bonusKey: s.string().min(1).max(40) }),
    response: okViewResponse,
    handler(ctx: ServerCtx, args) {
      const nowMs = ctx.now();
      const res = postBonusMeme(ctx.repo.load(nowMs), args.bonusKey, nowMs);
      ctx.repo.save(res.state, nowMs);
      return { ok: res.ok, message: res.message, view: toGameView(res.state, nowMs, res.notes) };
    },
  }),

  postMemeFromUrl: defineAction({
    description: "Fetches an external image URL (SSRF-guarded, <= 5MB, magic-byte checked) and adds it to the feed.",
    request: s.object({ url: s.string().min(8).max(2000) }),
    response: okViewResponse,
    async handler(ctx: ServerCtx, args) {
      const nowMs = ctx.now();
      const current = ctx.repo.load(nowMs);
      try {
        const fetched = await ctx.uploads.fetchAndSaveUrl(args.url);
        const title = containsBlockedText(fetched.suggestedTitle) ? "My Posted Meme" : fetched.suggestedTitle;
        const res = postMeme(
          current,
          {
            title,
            caption: "Posted from companion URL",
            emoji: "🌐",
            imageKey: null,
            imageUrl: fetched.imageUrl,
            bg: "#e0f2fe",
          },
          nowMs,
        );
        ctx.repo.save(res.state, nowMs);
        return { ok: res.ok, message: res.message, view: toGameView(res.state, nowMs, res.notes) };
      } catch (err) {
        const ticked = tickState(current, nowMs);
        ctx.repo.save(ticked.state, nowMs);
        return {
          ok: false,
          message: `Couldn't fetch that image (${err instanceof Error ? err.message : "network error"}).`,
          view: toGameView(ticked.state, nowMs, ticked.notes),
        };
      }
    },
  }),

  feedMeme: defineAction({
    description: "Feeds a meme to the monster into a belly slot; optional label votes and feeds simultaneously.",
    request: s.object({
      memeId: s.number().int().optional(),
      memeKey: s.string().min(1).max(80).optional(),
      label: s.enum(["tasty", "spicy", "blech"] as const).optional(),
    }),
    response: okViewResponse,
    handler(ctx: ServerCtx, args) {
      const nowMs = ctx.now();
      const res = feedMeme(ctx.repo.load(nowMs), args, nowMs);
      ctx.repo.save(res.state, nowMs);
      return { ok: res.ok, message: res.message, view: toGameView(res.state, nowMs, res.notes) };
    },
  }),

  talk: defineAction({
    description: "Processes spoken/typed input to the monster (secret words, voice care commands, playful replies).",
    request: s.object({ text: s.string().min(1).max(120) }),
    response: okViewResponse,
    handler(ctx: ServerCtx, args) {
      const nowMs = ctx.now();
      const res = talkAction(ctx.repo.load(nowMs), args.text, nowMs);
      ctx.repo.save(res.state, nowMs);
      return { ok: res.ok, message: res.message, view: toGameView(res.state, nowMs, res.notes) };
    },
  }),

  completeMiniGame: defineAction({
    description: "Awards server-side XP, Drip, Happiness, and Energy for Meme Dodge or Label Match.",
    request: s.object({
      game: s.enum(["dodge", "match"] as const),
      score: s.number().int().min(0).max(500),
    }),
    response: okViewResponse.extend({ xpGained: s.number(), dripGained: s.number() }),
    handler(ctx: ServerCtx, args) {
      const nowMs = ctx.now();
      const res = completeMiniGame(ctx.repo.load(nowMs), args.game, args.score, nowMs);
      ctx.repo.save(res.state, nowMs);
      return {
        ok: res.ok,
        message: res.message,
        xpGained: res.extra?.xpGained ?? 0,
        dripGained: res.extra?.dripGained ?? 0,
        view: toGameView(res.state, nowMs, res.notes),
      };
    },
  }),

  buyCosmetic: defineAction({
    description: "Purchases a Drip shop cosmetic.",
    request: s.object({ assetId: s.string().min(1).max(40) }),
    response: okViewResponse,
    handler(ctx: ServerCtx, args) {
      const nowMs = ctx.now();
      const res = buyCosmetic(ctx.repo.load(nowMs), args.assetId, nowMs);
      ctx.repo.save(res.state, nowMs);
      return { ok: res.ok, message: res.message, view: toGameView(res.state, nowMs, res.notes) };
    },
  }),

  equipCosmetic: defineAction({
    description: "Equips or unequips an owned cosmetic (+5 Happiness on first wear only).",
    request: s.object({ assetId: s.string().min(1).max(40) }),
    response: okViewResponse,
    handler(ctx: ServerCtx, args) {
      const nowMs = ctx.now();
      const res = equipCosmetic(ctx.repo.load(nowMs), args.assetId, nowMs);
      ctx.repo.save(res.state, nowMs);
      return { ok: res.ok, message: res.message, view: toGameView(res.state, nowMs, res.notes) };
    },
  }),

  updateSettings: defineAction({
    description: "Updates clock speed (60 = demo, 1 = real-time GDD) and sound bleeps.",
    request: s.object({
      clock: s.union([s.literal(1), s.literal(60)] as const).optional(),
      soundOn: s.boolean().optional(),
    }),
    response: okViewResponse,
    handler(ctx: ServerCtx, args) {
      const nowMs = ctx.now();
      const res = updateSettings(ctx.repo.load(nowMs), args, nowMs);
      ctx.repo.save(res.state, nowMs);
      return { ok: res.ok, message: res.message, view: toGameView(res.state, nowMs, res.notes) };
    },
  }),

  resetPet: defineAction({
    description: "Resets the pet to a freshly hatched Stage 1 Blob.",
    request: s.object({}),
    response: okViewResponse,
    handler(ctx: ServerCtx) {
      const nowMs = ctx.now();
      const current = ctx.repo.load(nowMs);
      const fresh = createFreshState(nowMs, current.clock);
      fresh.soundOn = current.soundOn;
      ctx.repo.save(fresh, nowMs);
      ctx.repo.audit("resetPet", true, "Pet reset", nowMs);
      return { ok: true, message: "🥚 A new Mochi hatched!", view: toGameView(fresh, nowMs, []) };
    },
  }),
} satisfies ActionsModule<ServerCtx>;
