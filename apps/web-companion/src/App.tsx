import {
  MINI_GAMES_CATALOG,
  STAGES,
  type CosmeticSlot,
  type GameView,
  type Label,
  type MemeImageKey,
  type MiniGameId,
  type SpeciesId,
} from "@memeagotchi/game-core";
import { CosmeticBadge, DreamScreensaver, MemeMonster, type DreamSlide } from "@memeagotchi/monster-ui";
import { ArcadeGamepad, SnesArcadeCanvas, createGamepadController } from "@memeagotchi/snes-games";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, uploadMemeFile } from "./api";
import { MonsterSVG } from "./components/MonsterSVG";
import { TitleHatchScreen } from "./components/TitleHatchScreen";
import { MEME_IMAGES, MEME_TEMPLATES, resolveMemeImage } from "./memeImages";
import { sfx } from "./sound";

const HANDHELD_URL = import.meta.env.DEV ? "http://localhost:5174" : "/handheld/";

type FeedFilter = "all" | "hot" | "tasty" | "spicy" | "fresh";
type SlotFilter = "all" | CosmeticSlot;

function getViewportSky(isSleeping: boolean): { bg: string; textDark: boolean; label: string } {
  if (isSleeping) {
    return {
      bg: "linear-gradient(180deg, #171847 0%, #2b2970 55%, #3f3d94 100%)",
      textDark: false,
      label: "night",
    };
  }
  const h = new Date().getHours();
  if (h >= 7 && h < 17) {
    return {
      bg: "linear-gradient(180deg, #dff8ff 0%, #eefcf9 58%, #f4edff 100%)",
      textDark: true,
      label: "day",
    };
  }
  if (h >= 17 && h < 21) {
    return {
      bg: "linear-gradient(180deg, #fde4f2 0%, #efe6ff 55%, #dcf6f4 100%)",
      textDark: true,
      label: "evening",
    };
  }
  return {
    bg: "linear-gradient(180deg, #1b1c4b 0%, #2d296c 55%, #413788 100%)",
    textDark: false,
    label: "night",
  };
}

function StatBar({
  label,
  value,
  cap,
  icon,
  color,
}: {
  label: string;
  value: number;
  cap: number;
  icon: string;
  color: string;
}) {
  const pct = Math.min(100, Math.max(0, (value / cap) * 100));
  return (
    <div>
      <div className="flex justify-between text-xs text-[var(--dim)] mb-1">
        <span>
          {icon} {label}
        </span>
        <span className={value < 30 ? "text-rose-400 font-bold" : "font-medium"}>
          {value}
          {cap > 100 ? `/${cap}` : ""}
        </span>
      </div>
      <div className="h-3 rounded-full bg-black/40 overflow-hidden border border-[var(--border)]">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: value < 30 ? "#fb7185" : color }}
        />
      </div>
    </div>
  );
}

export function App() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"home" | "feed" | "train" | "dress">("home");
  const [toast, setToast] = useState("");
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showTitle, setShowTitle] = useState(false);
  const [game, setGame] = useState<MiniGameId | null>("runner");
  const [gameResultBanner, setGameResultBanner] = useState("");
  const gamepad = useMemo(() => createGamepadController(), []);
  const [newName, setNewName] = useState("");
  const [talkDraft, setTalkDraft] = useState("");

  // Feed filters + collapsible composer + ▲ Full-Screen Meme Viewer
  const [feedFilter, setFeedFilter] = useState<FeedFilter>("all");
  const [fullscreenMemeIdx, setFullscreenMemeIdx] = useState<number | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [postTitle, setPostTitle] = useState("");
  const [postCaption, setPostCaption] = useState("");
  const [postImageKey, setPostImageKey] = useState<MemeImageKey>("distracted");
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [labelDrafts, setLabelDrafts] = useState<Record<number, string>>({});

  // Drip shop slot filter
  const [slotFilter, setSlotFilter] = useState<SlotFilter>("all");

  const [resetArmed, setResetArmed] = useState(false);
  const [eatingUntil, setEatingUntil] = useState(0);
  const [nowSec, setNowSec] = useState(() => Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNowSec(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    if (!msg) return;
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(""), 4500);
  }, []);

  const stateQuery = useQuery({
    queryKey: ["gameState"],
    queryFn: () => api.getState({}),
    refetchInterval: 5000,
  });

  const view: GameView | undefined = stateQuery.data?.view;
  const soundOn = view?.settings.soundOn ?? true;

  useEffect(() => {
    if (view?.notes?.length) {
      showToast(view.notes.join(" · "));
    }
  }, [view?.notes, showToast]);

  const applyView = useCallback(
    (res: { ok?: boolean; message?: string; view: GameView }) => {
      qc.setQueryData(["gameState"], { view: res.view });
      const combined = [res.message, ...(res.view.notes ?? [])].filter(Boolean).join(" · ");
      if (combined) showToast(combined);
      if (res.ok === false) sfx.bad(res.view.settings.soundOn);
      else if (combined.includes("SECRET") || combined.includes("EVOLVED")) sfx.sparkle(res.view.settings.soundOn);
      else sfx.ok(res.view.settings.soundOn);
    },
    [qc, showToast],
  );

  const careMut = useMutation({
    mutationFn: (action: "feed" | "groom" | "play" | "sleep" | "wake") => api.care({ action }),
    onSuccess: applyView,
    onError: (e: Error) => showToast(e.message),
  });
  const renameMut = useMutation({
    mutationFn: (name: string) => api.renameMonster({ name }),
    onSuccess: (r) => {
      applyView(r);
      if (r.ok) setNewName("");
    },
    onError: (e: Error) => showToast(e.message),
  });
  const talkMut = useMutation({
    mutationFn: (text: string) => api.talk({ text }),
    onSuccess: (r) => {
      applyView(r);
      setTalkDraft("");
    },
    onError: (e: Error) => showToast(e.message),
  });
  const voteMut = useMutation({
    mutationFn: (args: { memeId: number; label: Label }) => api.voteMeme(args),
    onSuccess: applyView,
    onError: (e: Error) => showToast(e.message),
  });
  const feedMemeMut = useMutation({
    mutationFn: (memeId: number) => api.feedMeme({ memeId }),
    onSuccess: (r) => {
      if (r.ok) setEatingUntil(Date.now() + 1800);
      applyView(r);
    },
    onError: (e: Error) => showToast(e.message),
  });
  const shareMut = useMutation({
    mutationFn: (memeId: number) => api.shareMeme({ memeId }),
    onSuccess: applyView,
    onError: (e: Error) => showToast(e.message),
  });
  const labelMut = useMutation({
    mutationFn: (args: { memeId: number; text: string }) => api.addCustomLabel(args),
    onSuccess: (r, vars) => {
      applyView(r);
      if (r.ok) setLabelDrafts((d) => ({ ...d, [vars.memeId]: "" }));
    },
    onError: (e: Error) => showToast(e.message),
  });
  const reportMemeMut = useMutation({
    mutationFn: (memeId: number) => api.reportMeme({ memeId }),
    onSuccess: applyView,
  });
  const reportLabelMut = useMutation({
    mutationFn: (labelId: number) => api.reportLabel({ labelId }),
    onSuccess: applyView,
  });
  const postMut = useMutation({
    mutationFn: () => {
      const tpl = MEME_TEMPLATES.find((t) => t.key === postImageKey);
      return api.postMeme({
        title: postTitle,
        caption: postCaption,
        emoji: uploadedUrl ? "📸" : (tpl?.emoji ?? "🖼️"),
        imageKey: uploadedUrl ? null : postImageKey,
        imageUrl: uploadedUrl,
        bg: "#fef9c3",
      });
    },
    onSuccess: (r) => {
      applyView(r);
      if (r.ok) {
        setPostTitle("");
        setPostCaption("");
        setUploadedUrl(null);
        setComposerOpen(false);
      }
    },
    onError: (e: Error) => showToast(e.message),
  });
  const hatchMut = useMutation({
    mutationFn: (args: { species: SpeciesId; name: string }) => api.hatchStarter(args),
    onSuccess: (r) => {
      applyView(r);
      if (r.ok) {
        setShowTitle(false);
        setTab("home");
      }
    },
    onError: (e: Error) => showToast(e.message),
  });
  const finishGameMut = useMutation({
    mutationFn: (args: { game: MiniGameId; score: number; maxCombo: number }) => api.completeMiniGame(args),
    onSuccess: (r) => {
      applyView(r);
      setGameResultBanner(r.message);
    },
    onError: (e: Error) => showToast(e.message),
  });
  const buyMut = useMutation({
    mutationFn: (assetId: string) => api.buyCosmetic({ assetId }),
    onSuccess: applyView,
  });
  const equipMut = useMutation({
    mutationFn: (assetId: string) => api.equipCosmetic({ assetId }),
    onSuccess: applyView,
  });
  const stageMut = useMutation({
    mutationFn: (stage: number) => api.setDisplayStage({ stage }),
    onSuccess: applyView,
  });
  const settingsMut = useMutation({
    mutationFn: (patch: { clock?: 1 | 60; soundOn?: boolean }) => api.updateSettings(patch),
    onSuccess: applyView,
  });
  const resetMut = useMutation({
    mutationFn: () => api.resetPet({}),
    onSuccess: (r) => {
      setResetArmed(false);
      setShowTitle(true);
      applyView(r);
    },
  });

  const handleFileChange = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadMemeFile(file);
      setUploadedUrl(url);
      showToast("📸 Image uploaded! Add a title and post to the feed.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const filteredMemes = useMemo(() => {
    const list = view?.memes ?? [];
    if (feedFilter === "hot") return [...list].sort((a, b) => b.power - a.power);
    if (feedFilter === "tasty") return list.filter((m) => m.dominant === "tasty");
    if (feedFilter === "spicy") return list.filter((m) => m.dominant === "spicy");
    if (feedFilter === "fresh") return list.filter((m) => m.isFresh);
    return list;
  }, [view?.memes, feedFilter]);

  const filteredCosmetics = useMemo(() => {
    const list = view?.cosmetics ?? [];
    return slotFilter === "all" ? list : list.filter((c) => c.slot === slotFilter);
  }, [view?.cosmetics, slotFilter]);

  const hasFedMemes = (view?.dreamMemes.length ?? 0) > 0;
  const dreamSlides: DreamSlide[] = useMemo(() => {
    if (!view) return [];
    const source = view.dreamMemes.length > 0 ? view.dreamMemes : view.memes.slice(0, 4);
    return source.map((dm) => {
      const key = "memeKey" in dm ? dm.memeKey : dm.key;
      return {
        id: "memeId" in dm ? dm.memeId : dm.id,
        title: dm.title,
        emoji: dm.emoji,
        bg: dm.bg,
        src: resolveMemeImage({ imageUrl: dm.imageUrl, imageKey: dm.imageKey ?? key }),
      };
    });
  }, [view]);

  // Press ▲ Up Arrow while on Feed tab to toggle Full-Screen Meme mode (◄► browse, O/Enter feed, ▲/Esc exit)
  useEffect(() => {
    if (tab !== "feed") {
      setFullscreenMemeIdx(null);
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowUp") {
        if (filteredMemes.length === 0) return;
        e.preventDefault();
        setFullscreenMemeIdx((cur) => (cur === null ? 0 : null));
      } else if (fullscreenMemeIdx !== null) {
        if (e.key === "Escape") {
          e.preventDefault();
          setFullscreenMemeIdx(null);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          setFullscreenMemeIdx((cur) =>
            cur === null ? 0 : (cur + filteredMemes.length - 1) % Math.max(1, filteredMemes.length),
          );
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          setFullscreenMemeIdx((cur) =>
            cur === null ? 0 : (cur + 1) % Math.max(1, filteredMemes.length),
          );
        } else if (e.key === "Enter" || e.key === "o" || e.key === "O") {
          const active = filteredMemes[fullscreenMemeIdx];
          if (active && !feedMemeMut.isPending) {
            e.preventDefault();
            feedMemeMut.mutate(active.id);
          }
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tab, filteredMemes, fullscreenMemeIdx, feedMemeMut]);

  if (stateQuery.isPending) {
    return <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-8 text-center font-pixel">HATCHING…</div>;
  }
  if (stateQuery.error || !view) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-8 text-center">
        Couldn't connect to MemeAgotchi server.{" "}
        <button type="button" className="underline text-[var(--accent)]" onClick={() => stateQuery.refetch()}>
          Retry
        </button>
      </div>
    );
  }

  if (!view.hatched || showTitle) {
    return (
      <TitleHatchScreen
        view={view}
        handheldUrl={HANDHELD_URL}
        hatching={hatchMut.isPending}
        onContinue={() => setShowTitle(false)}
        onHatch={(species, name) => hatchMut.mutate({ species, name })}
        onToggleClock={() => settingsMut.mutate({ clock: view.settings.clock === 60 ? 1 : 60 })}
        onToggleSound={() => settingsMut.mutate({ soundOn: !soundOn })}
      />
    );
  }

  const m = view.monster;
  const elapsedSinceServer = Math.max(0, Math.floor((nowSec - view.serverNow) / 1000));
  const feedCd = Math.max(0, m.cooldowns.feedSec - elapsedSinceServer);
  const groomCd = Math.max(0, m.cooldowns.groomSec - elapsedSinceServer);
  const playCd = Math.max(0, m.cooldowns.playSec - elapsedSinceServer);

  const curStageDef = STAGES[m.stage - 1] ?? STAGES[0]!;
  const xpPct = m.nextStageXp
    ? Math.min(100, Math.max(0, ((m.xp - curStageDef.xp) / (m.nextStageXp - curStageDef.xp)) * 100))
    : 100;
  const votesLeft = Math.max(0, view.voteBudget - view.votesUsedToday);
  const sky = getViewportSky(m.isSleeping);
  const displayMood = nowSec < eatingUntil ? "eating" : m.mood;

  const trainBlockReason = m.isSleeping
    ? "Your monster is asleep — wake it up before training."
    : m.fullness === 0
      ? "Hangry (0 Fullness) — feed kibble before training!"
      : m.happiness < 30
        ? "Happiness is below 30 — use Care Play or Groom to cheer it up first!"
        : m.energy < 10
          ? "Energy is below 10 — tuck it in for a quick nap!"
          : null;

  const activeBuffBadges: string[] = [];
  if (m.activeBuffs.stonksActive) activeBuffBadges.push("📈 Stonks +25% XP");
  if (m.activeBuffs.dogeSpeed) activeBuffBadges.push("🐕 Doge +30% Time");
  if (m.activeBuffs.chadStrength) activeBuffBadges.push("💪 Chad +30% Score");
  if (m.activeBuffs.rickrollSaveReady) activeBuffBadges.push("🎵 Rickroll Save");
  if (m.activeBuffs.susSense) activeBuffBadges.push("👁️ Sus Sense");
  if (m.activeBuffs.rizzCharisma) activeBuffBadges.push("✨ Rizz ×2 Votes");
  if (m.activeBuffs.noCapActive) activeBuffBadges.push("🧢 No Cap 105");
  if (m.activeBuffs.ratioShieldReady) activeBuffBadges.push("🛡️ Ratio Shield");
  if (m.activeBuffs.midCrisis) activeBuffBadges.push("⚖️ Mid Crisis");
  if (m.activeBuffs.basedBoostReady) activeBuffBadges.push("⚡ Based ×2 Next Digest");

  return (
    <div className="min-h-screen bg-[var(--bg)] app-texture text-[var(--text)] pb-24">
      {/* Top sync & simulator bar */}
      <header className="sticky top-0 z-30 bg-[var(--bg)]/90 backdrop-blur border-b border-[var(--border)]">
        <div className="max-w-2xl mx-auto px-4 py-2 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={() => setShowTitle(true)}
              className="font-pixel text-[var(--accent)] text-sm truncate hover:brightness-110"
              title="Open Title Screen & Starter Picker"
            >
              MEMEAGOTCHI
            </button>
            <button
              type="button"
              onClick={() => setShowTitle(true)}
              className="px-2 py-1 rounded-full bg-[var(--surface2)] border border-[var(--border)] text-[11px] font-bold hover:border-[var(--accent)]"
              title="Title Screen / Switch Starter"
            >
              🏠 Title
            </button>
            <button
              type="button"
              onClick={() => settingsMut.mutate({ clock: view.settings.clock === 60 ? 1 : 60 })}
              className="px-2 py-1 rounded-full bg-[var(--surface2)] border border-[var(--border)] text-[11px] font-bold hover:border-[var(--accent)]"
              title="Switch between Demo 60× speed and Real-Time GDD 1× speed"
            >
              ⏱ {view.settings.clock === 60 ? "Demo 60×" : "Real-Time 1×"}
            </button>
            <button
              type="button"
              onClick={() => settingsMut.mutate({ soundOn: !soundOn })}
              className="px-2 py-1 rounded-full bg-[var(--surface2)] border border-[var(--border)] text-[11px]"
              aria-label={soundOn ? "Mute sound effects" : "Enable sound effects"}
              title={soundOn ? "Sound On" : "Sound Off"}
            >
              {soundOn ? "🔊" : "🔇"}
            </button>
          </div>
          <a
            href={HANDHELD_URL}
            target="_blank"
            rel="noreferrer"
            className="px-2.5 py-1 rounded-full bg-[#ffd23f] text-[#141026] font-bold text-[11px] hover:brightness-110 shrink-0"
          >
            📟 280×240 Sim ↗
          </a>
        </div>
      </header>

      {toast && (
        <button
          type="button"
          onClick={() => setToast("")}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-[90vw] bg-[#100c20]/95 text-white text-xs px-3.5 py-2 rounded-2xl border-2 border-[var(--accent)] shadow-2xl text-center"
          role="status"
          title="Click to dismiss"
        >
          {toast}
        </button>
      )}

      {tab === "home" && (
        <main className="px-4 pt-4 max-w-2xl mx-auto">
          {/* Tamagotchi Mint/Lavender Shell */}
          <div
            className="rounded-[2.1rem] p-3 border-4 border-[var(--border)] shadow-2xl"
            style={{ background: "linear-gradient(155deg, #5b4bb7 0%, #7c5fd4 48%, #47b5b1 100%)" }}
          >
            {m.isSleeping ? (
              <div className="rounded-[1.6rem] h-[278px] viewport-screen relative overflow-hidden">
                <DreamScreensaver
                  species={m.species}
                  stage={m.displayStage}
                  petName={m.name}
                  energy={m.energy}
                  slides={dreamSlides}
                  fromFedHistory={hasFedMemes}
                  wakeHint="TAP WAKE BELOW"
                />
              </div>
            ) : (
              <div
                className="rounded-[1.6rem] px-3 pt-3 pb-2.5 viewport-screen relative overflow-hidden"
                style={{ background: sky.bg }}
              >
                {!sky.textDark && (
                  <div
                    className="pointer-events-none absolute inset-0 opacity-45"
                    style={{ backgroundImage: "radial-gradient(#ffffff 1.2px, transparent 1.5px)", backgroundSize: "34px 34px" }}
                  />
                )}
                <div className={`relative flex items-center justify-between ${sky.textDark ? "text-[#282b47]" : "text-white"}`}>
                  <span className="font-pixel text-sm">{m.name}</span>
                  <span className="font-pixel text-[11px] bg-[#282b47] text-[#7be6d8] px-2.5 py-1 rounded-full">
                    STAGE {m.displayStage} · {m.displayStageName}
                  </span>
                </div>

                {m.speech && (
                  <div className="relative mx-auto mt-1.5 max-w-[86%] rounded-xl bg-white/95 border-2 border-[#282b47] px-3 py-1 text-center text-xs font-bold text-[#282b47] shadow-sm">
                    “{m.speech}”
                  </div>
                )}

                <div className="relative">
                  <MonsterSVG
                    species={m.species}
                    name={m.name}
                    displayStage={m.displayStage}
                    actualStage={m.stage}
                    mood={displayMood}
                    sleeping={m.isSleeping}
                    roasted={m.isRoasted}
                    equipped={view.equippedItems}
                    onPet={() => {
                      sfx.pet(soundOn);
                      showToast(`💖 ${m.name} loves head pats! (Tap care buttons or feed a meme)`);
                    }}
                  />
                </div>

                <p className={`relative text-center font-bold -mt-1 ${sky.textDark ? "text-[#282b47]" : "text-white"}`}>
                  {m.moodLabel}
                </p>
                <p className={`relative text-center text-xs ${sky.textDark ? "text-[#282b47]/65" : "text-white/70"}`}>
                  {m.speciesDef.name} · Stage {m.stage} {m.stageName} · {m.digestedCount} digested · tap {m.name} to pet!
                </p>
              </div>
            )}

            <div className="flex flex-wrap justify-between items-center gap-2 px-2.5 py-2 text-white text-sm font-bold">
              <span>💧 {m.drip} Drip</span>
              <span>🌡️ Heat {m.heat}/{m.heatCap}</span>
              <span title={`Best streak: ${m.careStreak.bestStreak} days`}>
                🔥 {m.careStreak.count}d Streak
              </span>
              <span>⭐ {m.xp.toLocaleString()} XP</span>
            </div>
            <div className="px-2 pb-1">
              <div className="h-2.5 rounded-full bg-black/35 overflow-hidden">
                <div
                  className="h-full transition-all duration-300"
                  style={{ width: `${xpPct}%`, background: "linear-gradient(90deg, #7be6d8, #fde047)" }}
                />
              </div>
              <div className="flex items-center justify-between gap-2 text-white/85 text-[11px] mt-1">
                <span>
                  {m.nextStageXp ? `${(m.nextStageXp - m.xp).toLocaleString()} XP to ${m.nextStageName}` : "Max evolution reached 👑"}
                </span>
                <span className="font-bold text-[#fde047] truncate">
                  X: {m.speciesDef.specialMove.name}
                </span>
              </div>
            </div>
          </div>

          {/* Active Secret Buffs */}
          {activeBuffBadges.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {activeBuffBadges.map((b) => (
                <span
                  key={b}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[var(--accent)]/15 border border-[var(--accent)]/50 text-[var(--accent)]"
                >
                  {b}
                </span>
              ))}
            </div>
          )}

          {/* Stats */}
          <section
            aria-label="Monster stats"
            className="mt-4 rounded-2xl panel border border-[var(--border)] p-4 grid grid-cols-2 gap-x-5 gap-y-3"
          >
            <StatBar label="Fullness" value={m.fullness} cap={m.statCap} icon="🍖" color="#7be6d8" />
            <StatBar label="Happiness" value={m.happiness} cap={m.statCap} icon="💛" color="#fde047" />
            <StatBar label="Hygiene" value={m.hygiene} cap={m.statCap} icon="🛁" color="#38bdf8" />
            <StatBar label="Energy" value={m.energy} cap={m.statCap} icon="⚡" color="#c4b5fd" />
          </section>

          {m.fullness === 0 && (
            <p className="mt-2 text-rose-300 text-sm font-bold">
              ⚠️ Hangry! Your monster won't train or gain digestion power until fed.
            </p>
          )}
          {m.happiness === 0 && (
            <p className="mt-2 text-amber-300 text-sm font-bold">
              😞 Moping (0 Happiness) — evolution is frozen until you play with {m.name}!
            </p>
          )}
          {m.isRoasted && (
            <p className="mt-2 text-orange-300 text-sm font-bold">
              🌶️ Roasted from too much spice — cooling down ({Math.max(0, m.roastedLeftSec - elapsedSinceServer)}s left).
            </p>
          )}

          {/* Care actions */}
          <section aria-label="Care actions" className="mt-4 grid grid-cols-4 gap-2">
            <button
              type="button"
              disabled={careMut.isPending || feedCd > 0}
              onClick={() => careMut.mutate("feed")}
              className="py-3.5 rounded-2xl shadow-md bg-[#7be6d8] text-[#141026] font-bold text-sm disabled:opacity-45"
            >
              🍖
              <br />
              {feedCd > 0 ? `${feedCd}s` : "Feed"}
            </button>
            <button
              type="button"
              disabled={careMut.isPending || groomCd > 0}
              onClick={() => careMut.mutate("groom")}
              className="py-3.5 rounded-2xl shadow-md bg-[#7dd3fc] text-[#141026] font-bold text-sm disabled:opacity-45"
            >
              🛁
              <br />
              {groomCd > 0 ? `${groomCd}s` : "Groom"}
            </button>
            <button
              type="button"
              disabled={careMut.isPending || playCd > 0}
              onClick={() => careMut.mutate("play")}
              className="py-3.5 rounded-2xl shadow-md bg-[#f9a8d4] text-[#141026] font-bold text-sm disabled:opacity-45"
            >
              🎾
              <br />
              {playCd > 0 ? `${playCd}s` : "Play"}
            </button>
            {m.isSleeping ? (
              <button
                type="button"
                disabled={careMut.isPending}
                onClick={() => careMut.mutate("wake")}
                className="py-3.5 rounded-2xl shadow-md bg-[#fde047] text-[#141026] font-bold text-sm"
              >
                ☀️
                <br />
                Wake
              </button>
            ) : (
              <button
                type="button"
                disabled={careMut.isPending}
                onClick={() => careMut.mutate("sleep")}
                className="py-3.5 rounded-2xl shadow-md bg-[#c4b5fd] text-[#141026] font-bold text-sm"
              >
                💤
                <br />
                Sleep
              </button>
            )}
          </section>

          {/* Voice / Talk box */}
          <form
            className="mt-4 rounded-2xl panel border border-[var(--border)] p-3.5 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (talkDraft.trim()) talkMut.mutate(talkDraft.trim());
            }}
          >
            <input
              aria-label={`Talk to ${m.name}`}
              value={talkDraft}
              onChange={(e) => setTalkDraft(e.target.value)}
              placeholder={`🎙️ Talk to ${m.name} (try "feed", "doge", "stonks")…`}
              className="flex-1 min-w-0 bg-[var(--bg)]/60 border border-[var(--border)] rounded-xl px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={!talkDraft.trim() || talkMut.isPending}
              className="px-4 py-2 rounded-xl bg-[#ffd23f] text-[#141026] font-bold text-sm disabled:opacity-40"
            >
              Speak
            </button>
          </form>

          {/* Belly */}
          <section aria-label="Belly meme slots" className="mt-4 rounded-2xl panel border border-[var(--border)] p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-pixel text-sm">
                BELLY — MEME SLOTS {view.belly.length}/{m.memeSlots}
              </h2>
              <button
                type="button"
                onClick={() => setTab("feed")}
                className="text-xs font-bold text-[var(--accent)] hover:underline"
              >
                Browse Feed →
              </button>
            </div>
            {view.belly.length === 0 ? (
              <p className="text-sm text-[var(--dim)] mt-2">
                Belly empty. Feed {m.name} a meme from the Feed — it digests in{" "}
                {view.settings.digestSeconds >= 3600
                  ? `${Math.round(view.settings.digestSeconds / 3600)}h`
                  : `${view.settings.digestSeconds}s`}{" "}
                and grants permanent power + viral backflow.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {view.belly.map((b) => {
                  const secs = Math.max(0, b.digestInSec - elapsedSinceServer);
                  const thumb = resolveMemeImage(b);
                  return (
                    <li
                      key={b.id}
                      className="flex justify-between items-center gap-2 bg-[var(--bg)]/50 border border-[var(--border)]/60 rounded-xl px-3 py-2 text-sm"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        {thumb ? (
                          <img src={thumb} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                        ) : (
                          <span>{b.emoji}</span>
                        )}
                        <span className="truncate font-medium">{b.title}</span>
                      </span>
                      <span className="text-[var(--dim)] text-xs shrink-0">
                        pwr {b.powerAtFed} → {b.powerNow} · {secs > 0 ? `${secs}s` : "digesting…"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Nostalgia + Rename + Reset */}
          <section className="mt-4 rounded-2xl panel border border-[var(--border)] p-4 space-y-3">
            {m.stage >= 3 ? (
              <div>
                <h3 className="font-pixel text-xs mb-2">NOSTALGIA — DISPLAY OLDER LOOK</h3>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {STAGES.filter((s) => s.stage <= m.stage).map((st) => (
                    <button
                      type="button"
                      key={st.stage}
                      onClick={() => stageMut.mutate(st.stage)}
                      className={`p-2 rounded-xl border text-center ${
                        m.displayStage === st.stage
                          ? "bg-[var(--accent)]/20 border-[var(--accent)] text-[var(--accent)] font-bold"
                          : "border-[var(--border)] bg-[var(--bg)]/40"
                      }`}
                    >
                      <div className="w-12 h-12 mx-auto">
                        <MemeMonster species={m.species} displayStage={st.stage} actualStage={m.stage} mood="happy" />
                      </div>
                      <span className="text-[11px] block mt-1">{st.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-[var(--dim)]">
                🔒 Nostalgia toggle unlocks at Stage 3 (Beast) — display any earlier look while keeping your Stage 5 aura.
              </p>
            )}
            <div className="flex gap-2">
              <input
                aria-label="New monster name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={`Rename ${m.name}…`}
                className="flex-1 min-w-0 bg-[var(--bg)]/60 border border-[var(--border)] rounded-xl px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={!newName.trim() || renameMut.isPending}
                onClick={() => renameMut.mutate(newName)}
                className="px-4 py-2 rounded-xl bg-[var(--accent)] text-[#141026] font-bold text-sm disabled:opacity-40"
              >
                Save
              </button>
            </div>
            <div className="pt-1 flex justify-end">
              {!resetArmed ? (
                <button
                  type="button"
                  onClick={() => setResetArmed(true)}
                  className="text-xs text-[var(--dim)] hover:text-rose-300 underline"
                >
                  Reset Pet
                </button>
              ) : (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-rose-300">Hatch a fresh Blob?</span>
                  <button
                    type="button"
                    onClick={() => resetMut.mutate()}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold"
                  >
                    Confirm Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetArmed(false)}
                    className="px-2.5 py-1 rounded-lg bg-[var(--surface2)]"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Events + Secrets */}
          <section className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl panel border border-[var(--border)] p-4">
              <h3 className="font-pixel text-xs mb-2">FEED PULSE</h3>
              <ul className="text-sm space-y-1.5 text-[var(--dim)]">
                {view.events.slice(0, 8).map((e) => (
                  <li key={e.id}>{e.text}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl panel border border-[var(--border)] p-4">
              <h3 className="font-pixel text-xs mb-2">SECRET MOVES ({view.secrets.length}/10)</h3>
              {view.secrets.length === 0 ? (
                <p className="text-sm text-[var(--dim)]">
                  None yet. Type a famous meme phrase as a custom label on any meme — or say it to {m.name}! 👀
                </p>
              ) : (
                <ul className="text-sm space-y-1.5">
                  {view.secrets.map((s) => (
                    <li key={s.word}>
                      🔓 <b>{s.move}</b> — <span className="text-[var(--dim)]">{s.effect}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-[var(--dim)] mt-2">
                Digestion milestones: 5 / 15 / 30 lifetime digestions (currently {m.digestedCount}).
              </p>
            </div>
          </section>
        </main>
      )}

      {tab === "feed" && (
        <main className="px-4 pt-4 max-w-2xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-pixel text-xl">MEME FEED</h2>
            <div className="flex items-center gap-2 text-xs">
              <span className="panel border border-[var(--border)] rounded-full px-3 py-1 font-bold">
                🫃 Belly {view.belly.length}/{m.memeSlots}
              </span>
              <span className="panel border border-[var(--border)] rounded-full px-3 py-1 font-bold">
                🗳️ {votesLeft}/{view.voteBudget} votes
              </span>
            </div>
          </div>
          <p className="text-sm text-[var(--dim)] mt-1">
            Label memes to grow power — tasty +2, spicy +3 (adds Heat!), blech −1. Press <b>▲ Up Arrow</b> for Full-Screen Meme mode.
          </p>

          {/* Filter pills + Collapsible Meme Composer button */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["all", "All"],
                  ["hot", "🔥 Hot"],
                  ["tasty", "😋 Tasty"],
                  ["spicy", "🌶️ Spicy"],
                  ["fresh", "✨ Fresh"],
                ] as const
              ).map(([key, lbl]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFeedFilter(key)}
                  className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    feedFilter === key
                      ? "bg-[var(--accent)] text-[#141026] border-[var(--accent)]"
                      : "bg-[var(--surface)] border-[var(--border)] text-[var(--dim)]"
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setComposerOpen((o) => !o)}
              className="px-3.5 py-1.5 rounded-xl bg-[var(--accent2)] text-[#141026] font-bold text-xs"
            >
              {composerOpen ? "✕ Close" : "＋ Drop a Meme"}
            </button>
          </div>

          {composerOpen && (
            <form
              className="mt-3 rounded-2xl panel border border-[var(--accent)]/50 p-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (postTitle.trim()) postMut.mutate();
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-pixel text-xs">DROP YOUR OWN MEME</h3>
                <label className="px-3 py-1.5 rounded-xl bg-[var(--bg)]/60 border border-[var(--border)] text-xs font-bold cursor-pointer hover:border-[var(--accent)]">
                  {uploading ? "Uploading…" : "📤 Upload Image (≤5 MB)"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={(e) => void handleFileChange(e.target.files?.[0])}
                  />
                </label>
              </div>

              {uploadedUrl ? (
                <div className="relative rounded-xl overflow-hidden border-2 border-[var(--accent)]">
                  <img src={uploadedUrl} alt="Uploaded meme preview" className="w-full h-44 object-cover" />
                  <button
                    type="button"
                    onClick={() => setUploadedUrl(null)}
                    className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-black/80 text-xs text-white"
                  >
                    ✕ Use template instead
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Meme template photo">
                  {MEME_TEMPLATES.map((t) => (
                    <button
                      type="button"
                      key={t.key}
                      role="radio"
                      aria-checked={postImageKey === t.key}
                      onClick={() => setPostImageKey(t.key)}
                      className={`rounded-xl overflow-hidden border-2 text-left ${
                        postImageKey === t.key
                          ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/40"
                          : "border-[var(--border)] opacity-80"
                      }`}
                    >
                      <img src={MEME_IMAGES[t.key]} alt={t.name} className="w-full h-16 object-cover" loading="lazy" />
                      <span className="block text-[10px] font-bold px-1.5 py-1 truncate">
                        {t.emoji} {t.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <input
                aria-label="Meme title"
                value={postTitle}
                onChange={(e) => setPostTitle(e.target.value)}
                placeholder="Meme title…"
                className="w-full bg-[var(--bg)]/60 border border-[var(--border)] rounded-xl px-3 py-2 text-sm"
              />
              <input
                aria-label="Meme caption"
                value={postCaption}
                onChange={(e) => setPostCaption(e.target.value)}
                placeholder="Caption (optional)…"
                className="w-full bg-[var(--bg)]/60 border border-[var(--border)] rounded-xl px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={!postTitle.trim() || postMut.isPending || uploading}
                className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-[#141026] font-bold disabled:opacity-40"
              >
                Post to feed
              </button>
            </form>
          )}

          {/* Feed List */}
          <div className="mt-4 space-y-3">
            {filteredMemes.length === 0 && (
              <p className="text-center text-sm text-[var(--dim)] py-8">No memes match this filter yet.</p>
            )}
            {filteredMemes.map((meme, memeIdx) => {
              const imgSrc = resolveMemeImage(meme);
              return (
                <article key={meme.id} className="rounded-2xl border border-[var(--border)] overflow-hidden panel">
                  {imgSrc && (
                    <div className="relative">
                      <img
                        src={imgSrc}
                        alt={`Meme: ${meme.title}`}
                        onClick={() => setFullscreenMemeIdx(memeIdx)}
                        className="w-full h-56 object-cover cursor-pointer"
                        loading="lazy"
                      />
                      <button
                        type="button"
                        onClick={() => setFullscreenMemeIdx(memeIdx)}
                        className="absolute top-2.5 right-2.5 rounded-full bg-black/75 border border-white/25 px-2.5 py-1 text-[11px] font-bold text-[#fde047] hover:bg-black/90"
                        title="Display meme full screen (or press ▲ Up Arrow)"
                      >
                        ⤢ Full Screen (▲)
                      </button>
                    </div>
                  )}
                  <div className="p-4 flex gap-3" style={{ background: meme.bg }}>
                    <div className="text-[#1e1b4b] min-w-0">
                      <h3 className="font-bold leading-tight">
                        {meme.emoji} {meme.title}{" "}
                        {meme.isFresh && (
                          <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded-full align-middle">
                            FRESH +1
                          </span>
                        )}
                        {meme.isRotten && (
                          <span className="text-[10px] bg-stone-700 text-white px-1.5 py-0.5 rounded-full align-middle">
                            ROTTEN −2
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-[#1e1b4b]/75">{meme.caption}</p>
                    </div>
                    <div className="ml-auto text-right shrink-0">
                      <div className="font-pixel text-[#1e1b4b] text-lg">{meme.power}</div>
                      <div className="text-[10px] text-[#1e1b4b]/65 font-bold">
                        PWR · {meme.dominant.toUpperCase()}
                      </div>
                    </div>
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="flex flex-wrap gap-2 text-sm items-center">
                      <button
                        type="button"
                        disabled={meme.votedToday || voteMut.isPending}
                        onClick={() => voteMut.mutate({ memeId: meme.id, label: "tasty" })}
                        className="px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 disabled:opacity-40"
                      >
                        😋 tasty · {meme.tasty}
                      </button>
                      <button
                        type="button"
                        disabled={meme.votedToday || voteMut.isPending}
                        onClick={() => voteMut.mutate({ memeId: meme.id, label: "spicy" })}
                        className="px-3 py-1.5 rounded-full bg-rose-500/20 border border-rose-400/50 disabled:opacity-40"
                      >
                        🌶️ spicy · {meme.spicy}
                      </button>
                      <button
                        type="button"
                        disabled={meme.votedToday || voteMut.isPending}
                        onClick={() => voteMut.mutate({ memeId: meme.id, label: "blech" })}
                        className="px-3 py-1.5 rounded-full bg-violet-500/20 border border-violet-400/50 disabled:opacity-40"
                      >
                        🤢 blech · {meme.blech}
                      </button>
                      <button
                        type="button"
                        onClick={() => shareMut.mutate(meme.id)}
                        className="px-3 py-1.5 rounded-full border border-[var(--border)]"
                      >
                        🔁 {meme.shares}
                      </button>
                      <button
                        type="button"
                        disabled={feedMemeMut.isPending}
                        onClick={() => feedMemeMut.mutate(meme.id)}
                        className="px-3.5 py-1.5 rounded-full bg-[var(--accent)] text-[#141026] font-bold disabled:opacity-40"
                      >
                        🍽️ Feed it
                      </button>
                      {!meme.isSeed && (
                        <button
                          type="button"
                          onClick={() => reportMemeMut.mutate(meme.id)}
                          className="ml-auto px-2 py-1 text-xs text-[var(--dim)] hover:text-rose-300"
                          title="Report meme (3 reports auto-hide)"
                        >
                          🚩
                        </button>
                      )}
                    </div>
                    {meme.votedToday && <p className="text-[11px] text-[var(--dim)]">You voted on this one today.</p>}
                    {meme.customLabels.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 text-xs text-[var(--dim)]">
                        {meme.customLabels.map((lbl) => (
                          <span
                            key={lbl.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--bg)]/60 border border-[var(--border)]"
                          >
                            #{lbl.text}
                            <button
                              type="button"
                              onClick={() => reportLabelMut.mutate(lbl.id)}
                              className="opacity-60 hover:opacity-100 hover:text-rose-300"
                              title="Report label"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        aria-label={`Custom label for ${meme.title}`}
                        value={labelDrafts[meme.id] ?? ""}
                        onChange={(e) => setLabelDrafts((d) => ({ ...d, [meme.id]: e.target.value }))}
                        placeholder="Add a custom label… (psst, secret words hide here)"
                        className="flex-1 min-w-0 bg-[var(--bg)]/60 border border-[var(--border)] rounded-xl px-3 py-1.5 text-sm"
                      />
                      <button
                        type="button"
                        disabled={!(labelDrafts[meme.id] ?? "").trim() || labelMut.isPending}
                        onClick={() => labelMut.mutate({ memeId: meme.id, text: labelDrafts[meme.id]! })}
                        className="px-3 py-1.5 rounded-xl bg-[var(--surface2)] border border-[var(--border)] text-sm font-bold disabled:opacity-40"
                      >
                        Label
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Full-Screen Meme Feed Lightbox (opened via ▲ Up Arrow or Full Screen button) */}
          {fullscreenMemeIdx !== null && filteredMemes[fullscreenMemeIdx] && (() => {
            const fsMeme = filteredMemes[fullscreenMemeIdx]!;
            const fsSrc = resolveMemeImage(fsMeme);
            return (
              <div
                className="fixed inset-0 z-50 flex flex-col bg-[#080614]/96 backdrop-blur-md p-3 sm:p-5"
                role="dialog"
                aria-modal="true"
                aria-label={`Full screen meme: ${fsMeme.title}`}
              >
                <div className="flex items-center justify-between gap-2 text-xs text-white/85 pb-2">
                  <span className="font-pixel text-sm text-[var(--accent)] truncate">
                    {fsMeme.emoji} {fsMeme.title} ({fullscreenMemeIdx + 1}/{filteredMemes.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setFullscreenMemeIdx(null)}
                    className="rounded-full border border-white/25 bg-white/10 px-3 py-1 font-bold text-white hover:bg-white/20 shrink-0"
                  >
                    ✕ Exit (▲ / Esc)
                  </button>
                </div>

                <div className="relative flex-1 min-h-0 flex items-center justify-center">
                  <button
                    type="button"
                    aria-label="Previous meme"
                    onClick={() =>
                      setFullscreenMemeIdx((cur) =>
                        cur === null ? 0 : (cur + filteredMemes.length - 1) % filteredMemes.length,
                      )
                    }
                    className="absolute left-1 sm:left-3 z-10 h-11 w-11 rounded-full bg-black/70 border border-white/25 text-lg font-bold text-white hover:bg-black/90"
                  >
                    ◄
                  </button>

                  {fsSrc ? (
                    <img
                      src={fsSrc}
                      alt={fsMeme.caption || fsMeme.title}
                      className="max-h-full max-w-full rounded-2xl object-contain border-2 border-[var(--border)] shadow-2xl"
                    />
                  ) : (
                    <div
                      className="flex h-72 w-72 items-center justify-center rounded-3xl text-7xl"
                      style={{ background: fsMeme.bg }}
                    >
                      {fsMeme.emoji}
                    </div>
                  )}

                  <button
                    type="button"
                    aria-label="Next meme"
                    onClick={() =>
                      setFullscreenMemeIdx((cur) =>
                        cur === null ? 0 : (cur + 1) % filteredMemes.length,
                      )
                    }
                    className="absolute right-1 sm:right-3 z-10 h-11 w-11 rounded-full bg-black/70 border border-white/25 text-lg font-bold text-white hover:bg-black/90"
                  >
                    ►
                  </button>
                </div>

                <div className="pt-3 space-y-2 max-w-2xl mx-auto w-full text-center">
                  {fsMeme.caption && <p className="text-sm text-white/85">{fsMeme.caption}</p>}
                  <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                    <button
                      type="button"
                      disabled={fsMeme.votedToday || voteMut.isPending}
                      onClick={() => voteMut.mutate({ memeId: fsMeme.id, label: "tasty" })}
                      className="px-3 py-1.5 rounded-full bg-emerald-500/25 border border-emerald-400/60 font-bold disabled:opacity-40"
                    >
                      😋 Tasty · {fsMeme.tasty}
                    </button>
                    <button
                      type="button"
                      disabled={fsMeme.votedToday || voteMut.isPending}
                      onClick={() => voteMut.mutate({ memeId: fsMeme.id, label: "spicy" })}
                      className="px-3 py-1.5 rounded-full bg-rose-500/25 border border-rose-400/60 font-bold disabled:opacity-40"
                    >
                      🌶️ Spicy · {fsMeme.spicy}
                    </button>
                    <button
                      type="button"
                      disabled={fsMeme.votedToday || voteMut.isPending}
                      onClick={() => voteMut.mutate({ memeId: fsMeme.id, label: "blech" })}
                      className="px-3 py-1.5 rounded-full bg-violet-500/25 border border-violet-400/60 font-bold disabled:opacity-40"
                    >
                      🤢 Blech · {fsMeme.blech}
                    </button>
                    <button
                      type="button"
                      disabled={feedMemeMut.isPending}
                      onClick={() => feedMemeMut.mutate(fsMeme.id)}
                      className="px-4 py-1.5 rounded-full bg-[var(--accent)] text-[#141026] font-bold disabled:opacity-40"
                    >
                      🍽️ Feed to {m.name} (O / Enter)
                    </button>
                  </div>
                  <p className="text-[11px] text-[var(--dim)]">
                    Keys: <b>◄ ►</b> Browse · <b>O / Enter</b> Feed · <b>▲ / Esc</b> Exit Full Screen
                  </p>
                </div>
              </div>
            );
          })()}
        </main>
      )}

      {tab === "train" && (
        <main className="px-4 pt-4 max-w-2xl mx-auto space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-pixel text-xl">SNES ARCADE · 280×240</h2>
              <p className="text-sm text-[var(--dim)] mt-0.5">
                Cost <b>5 Energy</b> → <b>+20 Happiness</b> + XP &amp; Drip (×{view.settings.xpMultiplier} XP · {m.speciesDef.name} special: <b>{m.speciesDef.specialMove.name}</b>).
              </p>
            </div>
            <span className="panel border border-[var(--border)] rounded-full px-3 py-1 text-xs font-bold text-[#fde047]">
              🔥 {m.careStreak.count}d Streak Bonus
            </span>
          </div>

          {m.fullness > 0 && m.fullness < 30 && (
            <p className="text-xs text-amber-300 font-bold">
              🍖 Low Fullness (&lt; 30): training XP is halved until you feed {m.name}.
            </p>
          )}
          {trainBlockReason && (
            <div className="rounded-2xl border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-200">
              ⚠️ {trainBlockReason}
            </div>
          )}

          {/* Active 5 / 15 / 30 Digestion Milestone Powers */}
          <section aria-label="Digestion Milestone Powers" className="grid grid-cols-3 gap-2">
            {[
              {
                req: 5,
                unlocked: m.milestonePowers.turboCharge,
                icon: "⚡",
                name: "Turbo Charge",
                desc: "X Special recharges 35% faster",
              },
              {
                req: 15,
                unlocked: m.milestonePowers.secondWind,
                icon: "🛡️",
                name: "Second Wind",
                desc: "1 free hit-shield per run",
              },
              {
                req: 30,
                unlocked: m.milestonePowers.memeOverdrive,
                icon: "🔥",
                name: "Overdrive ×1.5",
                desc: "Start every game at ×1.5 score",
              },
            ].map((pw) => (
              <div
                key={pw.req}
                className={`rounded-2xl p-2.5 border text-left ${
                  pw.unlocked
                    ? "bg-[var(--accent)]/15 border-[var(--accent)]"
                    : "bg-[var(--surface)]/70 border-[var(--border)] opacity-70"
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>
                    {pw.icon} {pw.name}
                  </span>
                  <span className={pw.unlocked ? "text-emerald-300" : "text-[var(--dim)]"}>
                    {pw.unlocked ? "ON" : `${Math.min(m.digestedCount, pw.req)}/${pw.req}`}
                  </span>
                </div>
                <p className="text-[10px] text-[var(--dim)] mt-1 leading-snug">{pw.desc}</p>
              </div>
            ))}
          </section>

          {/* 3 SNES Game Cards with Personal Bests */}
          <div className="grid grid-cols-3 gap-2">
            {MINI_GAMES_CATALOG.map((g) => {
              const hs = m.highScores[g.id];
              const active = game === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  disabled={Boolean(trainBlockReason)}
                  onClick={() => {
                    setGame(g.id);
                    setGameResultBanner("");
                  }}
                  className={`p-3 rounded-2xl border-2 text-left transition-all disabled:opacity-40 ${
                    active
                      ? "bg-[var(--accent)]/20 border-[var(--accent)] shadow-lg"
                      : "bg-[var(--surface)] border-[var(--border)] hover:border-[var(--accent2)]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg">{g.glyph}</span>
                    <span className="text-[10px] font-bold text-[#fde047]">BEST {hs.bestScore}</span>
                  </div>
                  <p className="font-pixel text-xs mt-1 leading-tight">{g.shortName}</p>
                  <p className="text-[10px] text-[var(--dim)] mt-0.5 leading-tight">
                    Max ×{hs.bestCombo} · {hs.plays} plays
                  </p>
                </button>
              );
            })}
          </div>

          {/* 280x240 SNES Screen + On-Screen D-Pad + O / X / -- Gamepad */}
          <div className="rounded-3xl panel border-2 border-[var(--border)] p-4 space-y-3">
            {game && !trainBlockReason ? (
              <>
                <div className="max-w-[440px] mx-auto rounded-[24px] p-2 bg-[#0d0c1d] border-4 border-[#3f336d] shadow-2xl">
                  <div className="rounded-[18px] overflow-hidden">
                    <SnesArcadeCanvas
                      game={game}
                      species={m.species}
                      stage={m.displayStage}
                      equippedIds={view.equippedItems.map((i) => i.assetId)}
                      soundOn={soundOn}
                      milestonePowers={m.milestonePowers}
                      buffs={{
                        dogeSpeed: m.activeBuffs.dogeSpeed,
                        susSense: m.activeBuffs.susSense,
                        chadStrength: m.activeBuffs.chadStrength,
                      }}
                      bestScore={m.highScores[game].bestScore}
                      controller={gamepad}
                      resultBanner={gameResultBanner}
                      onComplete={({ game: gId, score, maxCombo }) =>
                        finishGameMut.mutate({ game: gId, score, maxCombo })
                      }
                      onExit={() => setGame(null)}
                    />
                  </div>
                </div>

                <div className="max-w-[440px] mx-auto">
                  <ArcadeGamepad
                    controller={gamepad}
                    specialLabel={m.speciesDef.specialMove.name}
                  />
                  <p className="text-[11px] text-center text-[var(--dim)] mt-2">
                    Keys: <b>Arrows/WASD</b> D-Pad · <b>Z/Space</b> O · <b>X/Shift</b> Special · <b>P/Esc</b> --
                  </p>
                </div>
              </>
            ) : (
              <p className="text-[var(--dim)] text-sm text-center py-8">
                {trainBlockReason
                  ? "Take care of your monster first to unlock the 280×240 SNES Arcade!"
                  : `Pick one of the 3 SNES cartridges above to train ${m.name}!`}
              </p>
            )}
          </div>

          {/* Visual 5-Stage Evolution Road */}
          <div className="rounded-2xl panel border border-[var(--border)] p-4">
            <h3 className="font-pixel text-xs mb-3">EVOLUTION ROAD · {m.speciesDef.name.toUpperCase()}</h3>
            <div className="grid grid-cols-5 gap-2">
              {STAGES.map((st) => {
                const unlocked = m.stage >= st.stage;
                const current = m.stage === st.stage;
                return (
                  <div
                    key={st.stage}
                    className={`rounded-xl p-2 border text-center ${
                      current
                        ? "border-[var(--accent)] bg-[var(--accent)]/15"
                        : unlocked
                          ? "border-[var(--accent2)]/50 bg-[var(--bg)]/50"
                          : "border-[var(--border)] bg-[var(--bg)]/30 opacity-55"
                    }`}
                  >
                    <div className={`w-14 h-14 mx-auto ${unlocked ? "" : "grayscale contrast-50"}`}>
                      <MemeMonster species={m.species} displayStage={st.stage} actualStage={st.stage} mood="happy" />
                    </div>
                    <p className="text-[10px] font-bold mt-1 leading-tight break-words">{st.name}</p>
                    <p className="text-[10px] text-[var(--dim)]">{st.xp.toLocaleString()} XP</p>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      )}

      {tab === "dress" && (
        <main className="px-4 pt-4 max-w-2xl mx-auto">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-pixel text-xl">DRIP SHOP</h2>
            <span className="panel border border-[var(--border)] rounded-full px-3 py-1 text-sm font-bold">
              💧 {m.drip} Drip
            </span>
          </div>
          <p className="text-sm text-[var(--dim)] mt-1">
            Cosmetics only, never pay-to-win. First wear of each outfit grants +5 Happiness!
          </p>

          <div
            className="mt-3 rounded-[1.6rem] p-3 viewport-screen border-2 border-[var(--border)]"
            style={{ background: sky.bg }}
          >
            <MonsterSVG
              species={m.species}
              name={m.name}
              displayStage={m.displayStage}
              actualStage={m.stage}
              mood="excited"
              sleeping={false}
              roasted={m.isRoasted}
              equipped={view.equippedItems}
            />
          </div>

          {/* Slot filter tabs */}
          <div className="mt-4 flex flex-wrap gap-1.5">
            {(["all", "head", "face", "body", "back", "sticker"] as const).map((sl) => (
              <button
                key={sl}
                type="button"
                onClick={() => setSlotFilter(sl)}
                className={`px-3 py-1 rounded-full text-xs font-bold capitalize border ${
                  slotFilter === sl
                    ? "bg-[var(--accent)] text-[#141026] border-[var(--accent)]"
                    : "bg-[var(--surface)] border-[var(--border)] text-[var(--dim)]"
                }`}
              >
                {sl}
              </button>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            {filteredCosmetics.map((c) => (
              <div key={c.id} className="rounded-2xl panel border border-[var(--border)] p-3 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-14 h-14 rounded-xl bg-white/90 border border-[#282b47]/20 flex items-center justify-center p-1">
                    <CosmeticBadge assetId={c.id} size={46} />
                  </div>
                  {!c.wornBefore && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-200 border border-pink-400/40">
                      +5 💛 1st wear
                    </span>
                  )}
                </div>
                <p className="font-bold text-sm mt-2">{c.name}</p>
                <p className="text-xs text-[var(--dim)] capitalize">{c.slot} slot</p>
                {c.owned ? (
                  <button
                    type="button"
                    onClick={() => equipMut.mutate(c.id)}
                    className={`mt-2.5 w-full py-2 rounded-xl font-bold text-sm ${
                      c.equipped ? "bg-[var(--accent2)] text-[#141026]" : "bg-[var(--accent)] text-[#141026]"
                    }`}
                  >
                    {c.equipped ? "Wearing ✓ — remove" : "Equip"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={m.drip < c.price || buyMut.isPending}
                    onClick={() => buyMut.mutate(c.id)}
                    className="mt-2.5 w-full py-2 rounded-xl bg-[var(--bg)]/70 border border-[var(--border)] font-bold text-sm disabled:opacity-40"
                  >
                    Buy · 💧{c.price}
                  </button>
                )}
              </div>
            ))}
          </div>
        </main>
      )}

      {/* Bottom nav */}
      <nav
        aria-label="Main sections"
        className="fixed bottom-0 inset-x-0 bg-[var(--surface)]/95 backdrop-blur border-t border-[var(--border)]"
      >
        <div className="max-w-2xl mx-auto grid grid-cols-4">
          {(
            [
              ["home", "🥚", "Monster"],
              ["feed", "📰", "Feed"],
              ["train", "🎮", "Train"],
              ["dress", "👕", "Drip"],
            ] as const
          ).map(([t, icon, label]) => (
            <button
              type="button"
              key={t}
              aria-current={tab === t ? "page" : undefined}
              onClick={() => {
                sfx.tap(soundOn);
                setTab(t);
              }}
              className={`py-2 text-center ${tab === t ? "text-[var(--accent)]" : "text-[var(--dim)]"}`}
            >
              <span className={`inline-block px-4 py-0.5 rounded-full text-xl leading-6 ${tab === t ? "bg-[var(--accent)]/20" : ""}`}>
                {icon}
              </span>
              <span className="text-[11px] font-bold block">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
