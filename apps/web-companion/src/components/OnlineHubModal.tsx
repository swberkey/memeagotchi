import type { GameView } from "@memeagotchi/game-core";
import { MemeMonster } from "@memeagotchi/monster-ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  authLogin,
  authLogout,
  authRegister,
  cheerPlayer,
  createDevicePairCode,
  fetchAuthMe,
  fetchLeaderboard,
  fetchPlayerProfile,
  giftMemeToPlayer,
  revokePairedDevice,
  type LeaderboardEntry,
} from "../api";
import { resolveMemeImage } from "../memeImages";

type HubTab = "account" | "pair" | "leaderboard";
type BoardMetric = "xp" | "streak" | "runner" | "blaster" | "beat" | "ember";

function metricValue(e: LeaderboardEntry, m: BoardMetric): number {
  if (m === "xp") return e.xp;
  if (m === "streak") return e.careStreak;
  return e.highScores[m]?.bestScore ?? 0;
}

function metricLabel(e: LeaderboardEntry, m: BoardMetric): string {
  if (m === "xp") return `${e.xp.toLocaleString()} XP`;
  if (m === "streak") return `🔥 ${e.careStreak}d`;
  const hs = e.highScores[m];
  return `${hs?.bestScore ?? 0} pts (×${hs?.bestCombo ?? 0})`;
}

export function OnlineHubModal({
  liveConnected,
  myMemes = [],
  onClose,
  onNotify,
}: {
  liveConnected: boolean;
  myMemes?: GameView["memes"];
  onClose: () => void;
  onNotify: (msg: string) => void;
}) {
  const qc = useQueryClient();
  const [hubTab, setHubTab] = useState<HubTab>("account");
  const [authMode, setAuthMode] = useState<"register" | "login">("register");
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [pairCode, setPairCode] = useState<{ code: string; expiresAt: number } | null>(null);
  const [metric, setMetric] = useState<BoardMetric>("xp");
  const [visitingUserId, setVisitingUserId] = useState<string | null>(null);
  const [giftMemeId, setGiftMemeId] = useState<number>(() => myMemes[0]?.id ?? 0);
  const [giftNote, setGiftNote] = useState("");

  const authQuery = useQuery({
    queryKey: ["authMe"],
    queryFn: fetchAuthMe,
  });

  const lbQuery = useQuery({
    queryKey: ["leaderboard"],
    queryFn: fetchLeaderboard,
    enabled: hubTab === "leaderboard",
  });

  const profileQuery = useQuery({
    queryKey: ["playerProfile", visitingUserId],
    queryFn: () => fetchPlayerProfile(visitingUserId!),
    enabled: hubTab === "leaderboard" && Boolean(visitingUserId),
  });

  const refreshAll = () => {
    void qc.invalidateQueries({ queryKey: ["authMe"] });
    void qc.invalidateQueries({ queryKey: ["gameState"] });
    void qc.invalidateQueries({ queryKey: ["leaderboard"] });
    if (visitingUserId) {
      void qc.invalidateQueries({ queryKey: ["playerProfile", visitingUserId] });
    }
  };

  const registerMut = useMutation({
    mutationFn: () => authRegister({ handle, password, displayName: displayName.trim() || undefined }),
    onSuccess: (r) => {
      setAuthError("");
      setPassword("");
      refreshAll();
      onNotify(`🌐 Account @${r.user.handle} created & signed in!`);
    },
    onError: (e: Error) => setAuthError(e.message),
  });

  const loginMut = useMutation({
    mutationFn: () => authLogin({ handle, password }),
    onSuccess: (r) => {
      setAuthError("");
      setPassword("");
      refreshAll();
      onNotify(`🌐 Welcome back, @${r.user.handle}!`);
    },
    onError: (e: Error) => setAuthError(e.message),
  });

  const logoutMut = useMutation({
    mutationFn: authLogout,
    onSuccess: () => {
      setPairCode(null);
      refreshAll();
      onNotify("Signed out — switched to local Guest session.");
    },
  });

  const pairCodeMut = useMutation({
    mutationFn: createDevicePairCode,
    onSuccess: (r) => {
      setPairCode({ code: r.code, expiresAt: r.expiresAt });
      onNotify(`📟 Pair code ${r.code} ready for your 320×240 handheld!`);
    },
    onError: (e: Error) => onNotify(e.message),
  });

  const revokeMut = useMutation({
    mutationFn: revokePairedDevice,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["authMe"] });
      onNotify("Handheld device unpaired.");
    },
  });

  const cheerMut = useMutation({
    mutationFn: (uid: string) => cheerPlayer(uid),
    onSuccess: (r) => {
      refreshAll();
      onNotify(r.message);
    },
    onError: (e: Error) => onNotify(`⚠️ ${e.message}`),
  });

  const giftMut = useMutation({
    mutationFn: ({ uid, memeId, note }: { uid: string; memeId: number; note: string }) =>
      giftMemeToPlayer(uid, { memeId, note }),
    onSuccess: (r) => {
      setGiftNote("");
      refreshAll();
      onNotify(r.message);
    },
    onError: (e: Error) => onNotify(`⚠️ ${e.message}`),
  });

  const user = authQuery.data?.actor.user ?? null;
  const pairedDevices = authQuery.data?.pairedDevices ?? [];

  const sortedBoard = [...(lbQuery.data?.entries ?? [])].sort(
    (a, b) => metricValue(b, metric) - metricValue(a, metric) || b.xp - a.xp,
  );

  const visited = profileQuery.data?.profile ?? null;
  const effectiveGiftId = myMemes.some((m) => m.id === giftMemeId) ? giftMemeId : (myMemes[0]?.id ?? 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4"
      role="dialog"
      aria-modal="true"
      aria-label="MemeAgotchi Online Hub"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-[2rem] panel border border-white/15 p-5 shadow-2xl space-y-4 max-h-[88vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-pixel text-base text-[var(--accent)]">MEMEAGOTCHI ONLINE</h2>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  liveConnected ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-200"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${liveConnected ? "bg-emerald-400" : "bg-amber-400"}`} />
                {liveConnected ? "SSE Live" : "Syncing"}
              </span>
            </div>
            <p className="text-xs text-[var(--dim)] mt-0.5">
              Cloud accounts, Ember Vale cloud saves, handheld pairing &amp; friend visits.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-xs font-bold text-white hover:bg-white/15"
          >
            ✕ Close
          </button>
        </div>

        {/* 3 Hub Tabs */}
        <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-[var(--bg)]/70 p-1 border border-white/8">
          {(
            [
              ["account", user ? `👤 @${user.handle}` : "👤 Account"],
              ["pair", `📟 Pair (${pairedDevices.length})`],
              ["leaderboard", "🏆 Rankings & Visit"],
            ] as const
          ).map(([id, lbl]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setHubTab(id);
                if (id !== "leaderboard") setVisitingUserId(null);
              }}
              className={`py-2 rounded-xl text-xs font-bold truncate px-2 transition-all ${
                hubTab === id
                  ? "bg-[var(--accent)] text-[#141026] shadow"
                  : "text-[var(--dim)] hover:text-white"
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>

        {/* TAB 1: ACCOUNT */}
        {hubTab === "account" && (
          <div className="space-y-3">
            {user ? (
              <div className="rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-pixel text-sm text-white">{user.displayName}</p>
                    <p className="text-xs text-[var(--accent)] font-bold">@{user.handle}</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-1 text-[11px] font-bold text-emerald-200">
                    ✓ Cloud Synced
                  </span>
                </div>
                <p className="text-xs text-[var(--dim)]">
                  Your pet save, Drip wardrobe, fed meme dreams, SNES high scores, and <b>Ember Vale RPG saves</b> sync automatically to <b>@{user.handle}</b> across phone, desktop, and paired 320×240 handhelds!
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setHubTab("pair")}
                    className="flex-1 rounded-xl bg-[var(--accent)] py-2 text-xs font-extrabold text-[#141026]"
                  >
                    📟 Pair a 320×240 Handheld
                  </button>
                  <button
                    type="button"
                    disabled={logoutMut.isPending}
                    onClick={() => logoutMut.mutate()}
                    className="rounded-xl border border-rose-400/40 bg-rose-500/15 px-3.5 py-2 text-xs font-bold text-rose-200 hover:bg-rose-500/25"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("register");
                      setAuthError("");
                    }}
                    className={`flex-1 py-2 rounded-xl font-bold border ${
                      authMode === "register"
                        ? "border-[var(--accent)] bg-[var(--accent)]/15 text-white"
                        : "border-white/10 bg-white/5 text-[var(--dim)]"
                    }`}
                  >
                    Create Cloud Account
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("login");
                      setAuthError("");
                    }}
                    className={`flex-1 py-2 rounded-xl font-bold border ${
                      authMode === "login"
                        ? "border-[var(--accent)] bg-[var(--accent)]/15 text-white"
                        : "border-white/10 bg-white/5 text-[var(--dim)]"
                    }`}
                  >
                    Sign In
                  </button>
                </div>

                <form
                  className="space-y-2.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (authMode === "register") registerMut.mutate();
                    else loginMut.mutate();
                  }}
                >
                  <input
                    aria-label="Handle"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    placeholder="@handle (3–20 letters, numbers, _)"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)]/70 px-3.5 py-2.5 text-sm"
                    required
                  />
                  {authMode === "register" && (
                    <input
                      aria-label="Display name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Display name (optional)"
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)]/70 px-3.5 py-2.5 text-sm"
                    />
                  )}
                  <input
                    type="password"
                    aria-label="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password (min 6 characters)"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)]/70 px-3.5 py-2.5 text-sm"
                    required
                  />
                  {authError && <p className="text-xs font-bold text-rose-300">⚠️ {authError}</p>}
                  <button
                    type="submit"
                    disabled={registerMut.isPending || loginMut.isPending}
                    className="w-full rounded-xl bg-gradient-to-r from-[#7be6d8] to-[#fde047] py-2.5 text-sm font-extrabold text-[#141026] disabled:opacity-50"
                  >
                    {authMode === "register" ? "🚀 Create Account & Play Online" : "🔓 Sign In"}
                  </button>
                </form>
                <p className="text-[11px] text-[var(--dim)] text-center">
                  Currently playing as <b>Local Guest</b>. Creating an account isolates your pet &amp; Ember Vale saves and puts you on the live Leaderboard.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PAIR 320x240 HANDHELD */}
        {hubTab === "pair" && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/12 bg-white/5 p-4 text-center space-y-3">
              <p className="text-xs text-[var(--dim)]">
                Link a <b>320×240 Handheld Simulator</b> or physical <b>ESP32-S3 MemeAgotchi</b> to{" "}
                <b className="text-white">{user ? `@${user.handle}` : "your Guest session"}</b> using a one-time 6-character code.
              </p>

              {pairCode ? (
                <div className="rounded-2xl border-2 border-[var(--accent)] bg-[#0b091c] py-3 px-4 space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--dim)]">
                    Enter on Handheld · Expires in 10 min
                  </p>
                  <p className="font-pixel text-3xl tracking-[0.22em] text-[#fde047]">{pairCode.code}</p>
                  <div className="flex justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(pairCode.code);
                        onNotify(`Copied pair code ${pairCode.code}!`);
                      }}
                      className="rounded-full bg-white/12 px-3 py-1 text-[11px] font-bold text-white hover:bg-white/20"
                    >
                      📋 Copy Code
                    </button>
                    <button
                      type="button"
                      onClick={() => pairCodeMut.mutate()}
                      className="rounded-full bg-white/8 px-3 py-1 text-[11px] font-bold text-[var(--dim)] hover:text-white"
                    >
                      ↻ New Code
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={pairCodeMut.isPending}
                  onClick={() => pairCodeMut.mutate()}
                  className="w-full rounded-xl bg-gradient-to-r from-[#7be6d8] to-[#c4b5fd] py-2.5 text-sm font-extrabold text-[#141026]"
                >
                  {pairCodeMut.isPending ? "Generating…" : "📟 Generate 6-Character Pair Code"}
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <h3 className="font-pixel text-xs text-[var(--dim)]">PAIRED HANDHELDS ({pairedDevices.length})</h3>
              {pairedDevices.length === 0 ? (
                <p className="text-xs text-[var(--dim)] rounded-xl bg-white/4 p-3">
                  No handhelds paired yet. Generate a code above and enter it in the Handheld Simulator&apos;s Cloud Pairing bar!
                </p>
              ) : (
                pairedDevices.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate">📟 {d.deviceName}</p>
                      <p className="text-[10px] text-[var(--dim)]">
                        Active {new Date(d.lastSeenAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={revokeMut.isPending}
                      onClick={() => revokeMut.mutate(d.id)}
                      className="rounded-lg border border-rose-400/40 bg-rose-500/15 px-2.5 py-1 text-[11px] font-bold text-rose-200 hover:bg-rose-500/25"
                    >
                      Unpair
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: GLOBAL LEADERBOARD + FRIEND HABITAT VISIT / CHEER / MEME GIFT */}
        {hubTab === "leaderboard" && (
          <div className="space-y-3">
            {visitingUserId ? (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setVisitingUserId(null)}
                  className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-xs font-bold text-[#7be6d8] hover:bg-white/15"
                >
                  ← Back to Global Rankings
                </button>

                {profileQuery.isPending ? (
                  <p className="text-center text-xs text-[var(--dim)] py-8">Visiting trainer habitat…</p>
                ) : !visited ? (
                  <p className="text-center text-xs text-rose-300 py-8">Could not load this trainer&apos;s pet.</p>
                ) : (
                  <div className="space-y-3">
                    {/* Visited Monster Card */}
                    <div className="rounded-2xl border border-[var(--accent)]/40 bg-gradient-to-b from-[#1e1846] to-[#120e29] p-4 space-y-3">
                      <div className="flex items-center gap-3.5">
                        <div className="w-24 h-24 shrink-0 rounded-2xl bg-black/30 border border-white/10 p-1.5">
                          <MemeMonster
                            species={visited.species}
                            displayStage={visited.displayStage}
                            actualStage={visited.stage}
                            mood={visited.mood}
                            equipped={visited.equippedItems}
                          />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-pixel text-base text-white truncate">{visited.petName}</p>
                            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-[#7be6d8]">
                              {visited.handle}
                            </span>
                          </div>
                          <p className="text-xs text-[var(--dim)]">
                            Stage {visited.stage} {visited.stageName} · 🔥 {visited.careStreak}d Streak · 🤝 {visited.cheerCount} Cheers
                          </p>
                          <p className="font-mono text-xs font-bold text-[#fde047]">
                            ⭐ {visited.xp.toLocaleString()} XP · 💧 {visited.drip} Drip · 🍽️ {visited.digestedCount} Digested
                          </p>
                        </div>
                      </div>

                      {/* 4 SNES Arcade High Scores */}
                      <div className="grid grid-cols-4 gap-1.5 text-center">
                        {(
                          [
                            ["🏃", "Runner", visited.highScores.runner.bestScore],
                            ["💥", "Blaster", visited.highScores.blaster.bestScore],
                            ["🎵", "Beat", visited.highScores.beat.bestScore],
                            ["⚔️", "Ember", visited.highScores.ember.bestScore],
                          ] as const
                        ).map(([glyph, lbl, score]) => (
                          <div key={lbl} className="rounded-xl border border-white/10 bg-black/25 py-1.5 px-1">
                            <p className="text-[10px] text-[var(--dim)]">{glyph} {lbl}</p>
                            <p className="font-mono text-xs font-extrabold text-white">{score}</p>
                          </div>
                        ))}
                      </div>

                      {/* Dream Memes Showcase */}
                      {visited.dreamMemes.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--dim)] mb-1.5">
                            💭 {visited.petName}&apos;s Recent Fed Memes
                          </p>
                          <div className="flex gap-1.5 overflow-x-auto pb-1">
                            {visited.dreamMemes.map((dm, idx) => {
                              const src = resolveMemeImage({ imageUrl: dm.imageUrl, imageKey: dm.imageKey ?? dm.memeKey });
                              return (
                                <div
                                  key={`${dm.memeKey}-${idx}`}
                                  title={dm.title}
                                  className="h-12 w-16 shrink-0 overflow-hidden rounded-lg border border-white/15 bg-black/40 flex items-center justify-center"
                                >
                                  {src ? (
                                    <img src={src} alt={dm.title} className="h-full w-full object-contain" />
                                  ) : (
                                    <span className="text-xl">{dm.emoji}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Cheer & Gift Actions (for visiting friends) */}
                      {!visited.isSelf ? (
                        <div className="space-y-2.5 pt-1 border-t border-white/10">
                          <button
                            type="button"
                            disabled={visited.cheeredTodayByViewer || cheerMut.isPending}
                            onClick={() => cheerMut.mutate(visited.userId)}
                            className="w-full rounded-xl bg-gradient-to-r from-[#7be6d8] to-[#fde047] py-2 text-xs font-extrabold text-[#141026] disabled:opacity-45"
                          >
                            {visited.cheeredTodayByViewer
                              ? "✓ Already Cheered Today! Come Back Tomorrow"
                              : cheerMut.isPending
                                ? "Sending Cheer…"
                                : `🤝 Cheer ${visited.petName} (+8 Happy for Them · +5 Drip for You!)`}
                          </button>

                          {myMemes.length > 0 && (
                            <form
                              className="rounded-xl border border-white/10 bg-black/25 p-2.5 space-y-2"
                              onSubmit={(e) => {
                                e.preventDefault();
                                if (!effectiveGiftId) return;
                                giftMut.mutate({ uid: visited.userId, memeId: effectiveGiftId, note: giftNote });
                              }}
                            >
                              <p className="text-[11px] font-bold text-[#c4b5fd]">
                                🎁 Gift a Meme (+20 XP &amp; +6 Drip for {visited.petName}, +6 Drip for you)
                              </p>
                              <select
                                aria-label="Select meme to gift"
                                value={effectiveGiftId}
                                onChange={(e) => setGiftMemeId(Number(e.target.value))}
                                className="w-full rounded-lg border border-white/15 bg-[#120e29] px-2.5 py-1.5 text-xs text-white"
                              >
                                {myMemes.slice(0, 20).map((mm) => (
                                  <option key={mm.id} value={mm.id}>
                                    {mm.emoji} {mm.title}
                                  </option>
                                ))}
                              </select>
                              <div className="flex gap-1.5">
                                <input
                                  aria-label="Optional gift message"
                                  value={giftNote}
                                  onChange={(e) => setGiftNote(e.target.value)}
                                  maxLength={60}
                                  placeholder="Optional note (e.g. Fresh meme delivery!)"
                                  className="flex-1 rounded-lg border border-white/15 bg-[#120e29] px-2.5 py-1.5 text-xs text-white"
                                />
                                <button
                                  type="submit"
                                  disabled={giftMut.isPending || !effectiveGiftId}
                                  className="rounded-lg bg-[#c4b5fd] px-3 py-1.5 text-xs font-extrabold text-[#141026] disabled:opacity-45"
                                >
                                  {giftMut.isPending ? "…" : "🎁 Send"}
                                </button>
                              </div>
                            </form>
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] text-center text-[var(--dim)] pt-1 border-t border-white/10">
                          This is your public trainer card! Share your handle so friends can visit &amp; cheer {visited.petName}.
                        </p>
                      )}
                    </div>

                    {/* Recent Visitor Guestbook */}
                    <div className="space-y-1.5">
                      <h3 className="font-pixel text-[11px] text-[var(--dim)]">RECENT VISITORS</h3>
                      {visited.recentVisits.length === 0 ? (
                        <p className="text-xs text-[var(--dim)] rounded-xl bg-white/4 p-3">
                          No visits yet — be the first to drop a Cheer or Meme Gift!
                        </p>
                      ) : (
                        <ul className="space-y-1">
                          {visited.recentVisits.map((v) => (
                            <li
                              key={v.id}
                              className="flex items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-1.5 text-[11px]"
                            >
                              <span className="truncate text-white/90">
                                {v.kind === "cheer"
                                  ? `🤝 ${v.fromHandle} cheered ${visited.petName}`
                                  : `🎁 ${v.fromHandle} gifted "${v.memeTitle ?? "Meme"}"${v.note ? ` — "${v.note}"` : ""}`}
                              </span>
                              <span className="text-[10px] text-[var(--dim)] shrink-0">
                                {new Date(v.createdAt).toLocaleDateString()}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      ["xp", "⭐ XP"],
                      ["streak", "🔥 Streak"],
                      ["runner", "🏃 Runner"],
                      ["blaster", "💥 Blaster"],
                      ["beat", "🎵 Vibe Beat"],
                      ["ember", "⚔️ Ember Vale"],
                    ] as const
                  ).map(([mId, lbl]) => (
                    <button
                      key={mId}
                      type="button"
                      onClick={() => setMetric(mId)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold border ${
                        metric === mId
                          ? "border-[var(--accent)] bg-[var(--accent)] text-[#141026]"
                          : "border-white/12 bg-white/5 text-[var(--dim)]"
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>

                <p className="text-[11px] text-[var(--dim)]">
                  Tap any trainer below to visit their monster, drop a daily Cheer, or send a Meme Gift!
                </p>

                {lbQuery.isPending ? (
                  <p className="text-center text-xs text-[var(--dim)] py-6">Loading rankings…</p>
                ) : sortedBoard.length === 0 ? (
                  <p className="text-center text-xs text-[var(--dim)] py-6">Hatch a starter pet to join the rankings!</p>
                ) : (
                  <ul className="space-y-1.5">
                    {sortedBoard.map((entry, idx) => {
                      const isMe = entry.userId === lbQuery.data?.currentUserId;
                      const rankIcon = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;
                      return (
                        <li key={entry.userId}>
                          <button
                            type="button"
                            onClick={() => setVisitingUserId(entry.userId)}
                            className={`w-full flex items-center gap-2.5 rounded-2xl border px-3 py-2 text-left transition-all hover:border-[var(--accent)] ${
                              isMe ? "border-[var(--accent)] bg-[var(--accent)]/12" : "border-white/10 bg-white/4 hover:bg-white/8"
                            }`}
                          >
                            <span className="w-7 text-center font-bold text-sm shrink-0">{rankIcon}</span>
                            <div className="w-9 h-9 shrink-0">
                              <MemeMonster species={entry.species} displayStage={entry.stage} actualStage={entry.stage} mood="happy" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-extrabold text-white truncate">
                                {entry.petName}{" "}
                                <span className="font-normal text-[var(--dim)]">({entry.handle})</span>
                              </p>
                              <p className="text-[10px] text-[var(--dim)]">
                                Stage {entry.stage} {entry.stageName} · {entry.digestedCount} digested
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="block font-mono text-xs font-extrabold text-[#fde047]">
                                {metricLabel(entry, metric)}
                              </span>
                              <span className="text-[10px] font-bold text-[#7be6d8]">
                                {isMe ? "Card →" : "Visit →"}
                              </span>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
