import { STAGES, type GameView, type Label, type MemeImageKey } from "@memeagotchi/game-core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, uploadMemeFile } from "./api";
import { LabelMatch } from "./components/LabelMatch";
import { MemeDodge } from "./components/MemeDodge";
import { MonsterSVG } from "./components/MonsterSVG";
import { MEME_IMAGES, MEME_TEMPLATES, resolveMemeImage } from "./memeImages";

const HANDHELD_URL = import.meta.env.DEV ? "http://localhost:5174" : "/handheld/";

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
        <span className={value < 30 ? "text-red-400 font-bold" : ""}>
          {value}
          {cap > 100 ? `/${cap}` : ""}
        </span>
      </div>
      <div className="h-3 rounded-full bg-black/40 overflow-hidden border border-[var(--border)]">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: value < 30 ? "#ef4444" : color }}
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

  const [game, setGame] = useState<"dodge" | "match" | null>(null);
  const [matchRunId, setMatchRunId] = useState(1);
  const [newName, setNewName] = useState("");
  const [talkDraft, setTalkDraft] = useState("");
  const [postTitle, setPostTitle] = useState("");
  const [postCaption, setPostCaption] = useState("");
  const [postImageKey, setPostImageKey] = useState<MemeImageKey>("distracted");
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [labelDrafts, setLabelDrafts] = useState<Record<number, string>>({});
  const [resetArmed, setResetArmed] = useState(false);
  const [nowSec, setNowSec] = useState(() => Date.now());

  // 1-second live countdown ticker for belly digestion & cooldowns
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

  useEffect(() => {
    if (view?.notes?.length) {
      showToast(view.notes.join(" · "));
    }
  }, [view?.notes, showToast]);

  const applyView = useCallback(
    (res: { message?: string; view: GameView }) => {
      qc.setQueryData(["gameState"], { view: res.view });
      const combined = [res.message, ...(res.view.notes ?? [])].filter(Boolean).join(" · ");
      if (combined) showToast(combined);
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
    onSuccess: applyView,
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
      }
    },
    onError: (e: Error) => showToast(e.message),
  });
  const finishGameMut = useMutation({
    mutationFn: (args: { game: "dodge" | "match"; score: number }) => api.completeMiniGame(args),
    onSuccess: (r) => {
      applyView(r);
      if (game === "dodge") setGame(null);
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
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-pixel text-[var(--accent)] text-sm truncate">MEMEAGOTCHI</span>
            <button
              type="button"
              onClick={() => settingsMut.mutate({ clock: view.settings.clock === 60 ? 1 : 60 })}
              className="px-2 py-1 rounded-full bg-[var(--surface2)] border border-[var(--border)] text-[11px] font-bold"
              title="Switch between Demo 60× speed and Real-Time GDD 1× speed"
            >
              ⏱ {view.settings.clock === 60 ? "Demo 60×" : "Real-Time 1×"}
            </button>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={HANDHELD_URL}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1 rounded-full bg-[#ffb02e] text-black font-bold text-[11px] hover:brightness-110"
            >
              📟 Handheld Sim ↗
            </a>
          </div>
        </div>
      </header>

      {toast && (
        <div
          className="fixed top-14 left-1/2 -translate-x-1/2 z-50 max-w-[92vw] bg-black/95 text-white text-sm px-4 py-3 rounded-2xl border-2 border-[var(--accent)] shadow-xl"
          role="status"
        >
          {toast}
        </div>
      )}

      {tab === "home" && (
        <main className="px-4 pt-4 max-w-2xl mx-auto">
          {/* Tamagotchi viewport */}
          <div
            className="rounded-[2rem] p-3 border-4 border-[var(--border)] shadow-2xl"
            style={{ background: "linear-gradient(160deg,#7c3aed,#db2777)" }}
          >
            <div className="rounded-[1.6rem] px-3 pt-3 pb-2 viewport-screen relative" style={{ backgroundColor: "var(--viewport)" }}>
              <div className="flex items-center justify-between text-black">
                <span className="font-pixel text-sm">{m.name}</span>
                <span className="font-pixel text-[11px] bg-black text-lime-300 px-2 py-1 rounded-full">
                  STAGE {m.displayStage} · {m.displayStageName}
                </span>
              </div>
              {m.speech && (
                <div className="mx-auto mt-1 max-w-[85%] rounded-xl bg-white border-2 border-black/80 px-3 py-1 text-center text-xs font-bold text-black shadow-sm">
                  “{m.speech}”
                </div>
              )}
              <MonsterSVG
                displayStage={m.displayStage}
                actualStage={m.stage}
                mood={m.mood}
                sleeping={m.isSleeping}
                roasted={m.isRoasted}
                equipped={view.equippedItems}
              />
              <p className="text-center text-black font-bold -mt-1">{m.moodLabel}</p>
              <p className="text-center text-black/60 text-xs">
                Actual stage: {m.stage} {m.stageName} · {m.digestedCount} memes digested
              </p>
            </div>
            <div className="flex justify-between items-center px-2 py-2 text-white text-sm font-bold">
              <span>💧 {m.drip} Drip</span>
              <span>🌡️ Heat {m.heat}/100</span>
              <span>⭐ {m.xp} XP</span>
            </div>
            <div className="px-2 pb-1">
              <div className="h-2.5 rounded-full bg-black/40 overflow-hidden">
                <div className="h-full bg-[var(--accent)] transition-all duration-300" style={{ width: `${xpPct}%` }} />
              </div>
              <p className="text-white/80 text-[11px] mt-1">
                {m.nextStageXp ? `${m.nextStageXp - m.xp} XP to ${m.nextStageName}` : "Max evolution reached 👑"}
              </p>
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
            <StatBar label="Fullness" value={m.fullness} cap={m.statCap} icon="🍖" color="#a3e635" />
            <StatBar label="Happiness" value={m.happiness} cap={m.statCap} icon="💛" color="#facc15" />
            <StatBar label="Hygiene" value={m.hygiene} cap={m.statCap} icon="🛁" color="#22d3ee" />
            <StatBar label="Energy" value={m.energy} cap={m.statCap} icon="⚡" color="#f472b6" />
          </section>

          {m.fullness === 0 && (
            <p className="mt-2 text-red-300 text-sm font-bold">
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
              className="py-3.5 rounded-2xl shadow-md bg-[var(--accent)] text-black font-bold text-sm disabled:opacity-50"
            >
              🍖
              <br />
              {feedCd > 0 ? `${feedCd}s` : "Feed"}
            </button>
            <button
              type="button"
              disabled={careMut.isPending || groomCd > 0}
              onClick={() => careMut.mutate("groom")}
              className="py-3.5 rounded-2xl shadow-md bg-[var(--accent3)] text-black font-bold text-sm disabled:opacity-50"
            >
              🛁
              <br />
              {groomCd > 0 ? `${groomCd}s` : "Groom"}
            </button>
            <button
              type="button"
              disabled={careMut.isPending || playCd > 0}
              onClick={() => careMut.mutate("play")}
              className="py-3.5 rounded-2xl shadow-md bg-[var(--accent2)] text-black font-bold text-sm disabled:opacity-50"
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
                className="py-3.5 rounded-2xl shadow-md bg-yellow-300 text-black font-bold text-sm"
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
                className="py-3.5 rounded-2xl shadow-md bg-indigo-300 text-black font-bold text-sm"
              >
                💤
                <br />
                Sleep
              </button>
            )}
          </section>

          {/* Voice / Talk box (shared with Handheld Muse brain) */}
          <form
            className="mt-4 rounded-2xl panel border border-[var(--border)] p-4 flex gap-2"
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
              className="flex-1 min-w-0 bg-[var(--surface2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={!talkDraft.trim() || talkMut.isPending}
              className="px-4 py-2 rounded-xl bg-[#ffb02e] text-black font-bold text-sm disabled:opacity-40"
            >
              Speak
            </button>
          </form>

          {/* Belly */}
          <section aria-label="Belly meme slots" className="mt-4 rounded-2xl panel border border-[var(--border)] p-4">
            <h2 className="font-pixel text-sm">
              BELLY — MEME SLOTS {view.belly.length}/{m.memeSlots}
            </h2>
            {view.belly.length === 0 ? (
              <p className="text-sm text-[var(--dim)] mt-2">
                Belly empty. Head to the Feed and feed {m.name} a meme — it digests in{" "}
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
                      className="flex justify-between items-center gap-2 bg-[var(--surface2)] rounded-xl px-3 py-2 text-sm"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        {thumb ? (
                          <img src={thumb} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                        ) : (
                          <span>{b.emoji}</span>
                        )}
                        <span className="truncate">{b.title}</span>
                      </span>
                      <span className="text-[var(--dim)] text-xs shrink-0">
                        power {b.powerAtFed} → {b.powerNow} · {secs > 0 ? `${secs}s` : "digesting…"}
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
                <div className="flex gap-2 flex-wrap">
                  {STAGES.filter((s) => s.stage <= m.stage).map((st) => (
                    <button
                      type="button"
                      key={st.stage}
                      onClick={() => stageMut.mutate(st.stage)}
                      className={`px-3 py-1.5 rounded-full text-sm border ${
                        m.displayStage === st.stage
                          ? "bg-[var(--accent)] text-black font-bold"
                          : "border-[var(--border)]"
                      }`}
                    >
                      {st.stage} {st.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-[var(--dim)]">
                🔒 Nostalgia toggle unlocks at Stage 3 (Beast) — display any earlier evolution's look while keeping Stage 5 aura.
              </p>
            )}
            <div className="flex gap-2">
              <input
                aria-label="New monster name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={`Rename ${m.name}…`}
                className="flex-1 min-w-0 bg-[var(--surface2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={!newName.trim() || renameMut.isPending}
                onClick={() => renameMut.mutate(newName)}
                className="px-4 py-2 rounded-xl bg-[var(--accent)] text-black font-bold text-sm disabled:opacity-40"
              >
                Save
              </button>
            </div>
            <div className="pt-1 flex justify-end">
              {!resetArmed ? (
                <button
                  type="button"
                  onClick={() => setResetArmed(true)}
                  className="text-xs text-[var(--dim)] hover:text-red-300 underline"
                >
                  Reset Pet
                </button>
              ) : (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-red-300">Hatch a fresh Blob?</span>
                  <button
                    type="button"
                    onClick={() => resetMut.mutate()}
                    className="px-2.5 py-1 rounded-lg bg-red-600 text-white font-bold"
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
                  None yet. Hint: type a famous meme phrase as a custom label on any meme — or say it to {m.name}! 👀
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
                Digestion milestones: 5 / 15 / 30 lifetime digestions (you're at {m.digestedCount}).
              </p>
            </div>
          </section>
        </main>
      )}

      {tab === "feed" && (
        <main className="px-4 pt-4 max-w-2xl mx-auto">
          <div className="flex items-end justify-between">
            <h2 className="font-pixel text-xl">MEME FEED</h2>
            <span className="text-sm panel border border-[var(--border)] rounded-full px-3 py-1">
              🗳️ {votesLeft}/{view.voteBudget} votes left
            </span>
          </div>
          <p className="text-sm text-[var(--dim)] mt-1">
            Label memes to grow their power — tasty +2, spicy +3 (adds Heat!), blech −1. Eat early for viral backflow!
          </p>

          {/* Post a Meme (Real <= 5MB File Upload OR Template) */}
          <form
            className="mt-4 rounded-2xl panel border border-[var(--border)] p-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (postTitle.trim()) postMut.mutate();
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-pixel text-xs">DROP YOUR OWN MEME</h3>
              <label className="px-3 py-1.5 rounded-xl bg-[var(--surface2)] border border-[var(--border)] text-xs font-bold cursor-pointer hover:border-[var(--accent)]">
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
              className="w-full bg-[var(--surface2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm"
            />
            <input
              aria-label="Meme caption"
              value={postCaption}
              onChange={(e) => setPostCaption(e.target.value)}
              placeholder="Caption (optional)…"
              className="w-full bg-[var(--surface2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={!postTitle.trim() || postMut.isPending || uploading}
              className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-black font-bold disabled:opacity-40"
            >
              Post to feed
            </button>
          </form>

          {/* Feed List */}
          <div className="mt-4 space-y-3">
            {view.memes.map((meme) => {
              const imgSrc = resolveMemeImage(meme);
              return (
                <article key={meme.id} className="rounded-2xl border border-[var(--border)] overflow-hidden panel">
                  {imgSrc && (
                    <img src={imgSrc} alt={`Meme: ${meme.title}`} className="w-full h-56 object-cover" loading="lazy" />
                  )}
                  <div className="p-4 flex gap-3" style={{ background: meme.bg }}>
                    <div className="text-black min-w-0">
                      <h3 className="font-bold leading-tight">
                        {meme.emoji} {meme.title}{" "}
                        {meme.isFresh && (
                          <span className="text-[10px] bg-lime-600 text-white px-1.5 py-0.5 rounded-full align-middle">
                            FRESH +1
                          </span>
                        )}
                        {meme.isRotten && (
                          <span className="text-[10px] bg-stone-700 text-white px-1.5 py-0.5 rounded-full align-middle">
                            ROTTEN −2
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-black/70">{meme.caption}</p>
                    </div>
                    <div className="ml-auto text-right shrink-0">
                      <div className="font-pixel text-black text-lg">{meme.power}</div>
                      <div className="text-[10px] text-black/60 font-bold">
                        POWER · {meme.dominant.toUpperCase()}
                      </div>
                    </div>
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="flex flex-wrap gap-2 text-sm items-center">
                      <button
                        type="button"
                        disabled={meme.votedToday || voteMut.isPending}
                        onClick={() => voteMut.mutate({ memeId: meme.id, label: "tasty" })}
                        className="px-3 py-1.5 rounded-full bg-lime-500/20 border border-lime-500/50 disabled:opacity-40"
                      >
                        😋 tasty · {meme.tasty}
                      </button>
                      <button
                        type="button"
                        disabled={meme.votedToday || voteMut.isPending}
                        onClick={() => voteMut.mutate({ memeId: meme.id, label: "spicy" })}
                        className="px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/50 disabled:opacity-40"
                      >
                        🌶️ spicy · {meme.spicy}
                      </button>
                      <button
                        type="button"
                        disabled={meme.votedToday || voteMut.isPending}
                        onClick={() => voteMut.mutate({ memeId: meme.id, label: "blech" })}
                        className="px-3 py-1.5 rounded-full bg-zinc-500/20 border border-zinc-500/50 disabled:opacity-40"
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
                        className="px-3 py-1.5 rounded-full bg-[var(--accent)] text-black font-bold disabled:opacity-40"
                      >
                        🍽️ Feed it
                      </button>
                      {!meme.isSeed && (
                        <button
                          type="button"
                          onClick={() => reportMemeMut.mutate(meme.id)}
                          className="ml-auto px-2 py-1 text-xs text-[var(--dim)] hover:text-red-300"
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
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--surface2)] border border-[var(--border)]"
                          >
                            #{lbl.text}
                            <button
                              type="button"
                              onClick={() => reportLabelMut.mutate(lbl.id)}
                              className="opacity-60 hover:opacity-100 hover:text-red-300"
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
                        className="flex-1 min-w-0 bg-[var(--surface2)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-sm"
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
        </main>
      )}

      {tab === "train" && (
        <main className="px-4 pt-4 max-w-2xl mx-auto">
          <h2 className="font-pixel text-xl">TRAINING</h2>
          <p className="text-sm text-[var(--dim)] mt-1">
            Mini-games cost <b>5 Energy</b> and grant <b>+20 Happiness</b> plus XP &amp; Drip (×{view.settings.xpMultiplier} XP in current clock mode).
          </p>
          {m.fullness > 0 && m.fullness < 30 && (
            <p className="mt-2 text-xs text-amber-300 font-bold">
              🍖 Low Fullness (&lt; 30): training XP is halved until you feed {m.name}.
            </p>
          )}
          {trainBlockReason && (
            <div className="mt-3 rounded-2xl border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-200">
              ⚠️ {trainBlockReason}
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button
              type="button"
              disabled={Boolean(trainBlockReason)}
              onClick={() => setGame("dodge")}
              className={`flex-1 py-3 rounded-2xl border font-bold disabled:opacity-40 ${
                game === "dodge" ? "bg-[var(--accent)] text-black" : "bg-[var(--surface)] border-[var(--border)]"
              }`}
            >
              🏃 Meme Dodge
            </button>
            <button
              type="button"
              disabled={Boolean(trainBlockReason)}
              onClick={() => {
                setMatchRunId((n) => n + 1);
                setGame("match");
              }}
              className={`flex-1 py-3 rounded-2xl border font-bold disabled:opacity-40 ${
                game === "match" ? "bg-[var(--accent)] text-black" : "bg-[var(--surface)] border-[var(--border)]"
              }`}
            >
              🧩 Label Match
            </button>
          </div>

          <div className="mt-4 rounded-2xl panel border border-[var(--border)] p-4">
            {game === "dodge" && (
              <MemeDodge
                dogeSpeed={m.activeBuffs.dogeSpeed}
                susSense={m.activeBuffs.susSense}
                onDone={(score) => finishGameMut.mutate({ game: "dodge", score })}
              />
            )}
            {game === "match" && (
              <LabelMatch
                key={matchRunId}
                susSense={m.activeBuffs.susSense}
                onDone={(score) => finishGameMut.mutate({ game: "match", score })}
              />
            )}
            {!game && (
              <p className="text-[var(--dim)] text-sm text-center py-8">
                Pick a game above to start training {m.name}.
              </p>
            )}
          </div>

          <div className="mt-4 rounded-2xl panel border border-[var(--border)] p-4">
            <h3 className="font-pixel text-xs mb-2">EVOLUTION ROAD</h3>
            <ol className="space-y-1.5 text-sm">
              {STAGES.map((st) => (
                <li
                  key={st.stage}
                  className={`flex justify-between ${
                    m.stage >= st.stage ? "text-[var(--accent)] font-bold" : "text-[var(--dim)]"
                  }`}
                >
                  <span>
                    {m.stage >= st.stage ? "✅" : "🔒"} Stage {st.stage} — {st.name}
                  </span>
                  <span>{st.xp.toLocaleString()} XP</span>
                </li>
              ))}
            </ol>
          </div>
        </main>
      )}

      {tab === "dress" && (
        <main className="px-4 pt-4 max-w-2xl mx-auto">
          <h2 className="font-pixel text-xl">DRIP SHOP</h2>
          <p className="text-sm text-[var(--dim)] mt-1">
            Balance: 💧 <b>{m.drip} Drip</b> — cosmetics only, never pay-to-win. First wear of each outfit grants +5 Happiness.
          </p>
          <div className="mt-3 rounded-[1.6rem] p-3 viewport-screen" style={{ backgroundColor: "var(--viewport)" }}>
            <MonsterSVG
              displayStage={m.displayStage}
              actualStage={m.stage}
              mood={m.mood}
              sleeping={false}
              roasted={m.isRoasted}
              equipped={view.equippedItems}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {view.cosmetics.map((c) => (
              <div key={c.id} className="rounded-2xl panel border border-[var(--border)] p-3">
                <div className="flex items-start justify-between">
                  <span className="text-4xl">{c.emoji}</span>
                  {!c.wornBefore && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-200 border border-pink-400/40">
                      +5 💛 1st wear
                    </span>
                  )}
                </div>
                <p className="font-bold text-sm mt-1">{c.name}</p>
                <p className="text-xs text-[var(--dim)] capitalize">{c.slot} slot</p>
                {c.owned ? (
                  <button
                    type="button"
                    onClick={() => equipMut.mutate(c.id)}
                    className={`mt-2 w-full py-2 rounded-xl font-bold text-sm ${
                      c.equipped ? "bg-[var(--accent2)] text-black" : "bg-[var(--accent)] text-black"
                    }`}
                  >
                    {c.equipped ? "Wearing ✓ — tap to remove" : "Equip"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={m.drip < c.price || buyMut.isPending}
                    onClick={() => buyMut.mutate(c.id)}
                    className="mt-2 w-full py-2 rounded-xl bg-[var(--surface2)] border border-[var(--border)] font-bold text-sm disabled:opacity-40"
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
              onClick={() => setTab(t)}
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
