import { STAGES, type GameView, type Label, type Mood } from "@memeagotchi/game-core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "./api";
import { Monster } from "./Monster";

import imgDistracted from "./assets/meme-distracted.jpg";
import imgThisisfine from "./assets/meme-thisisfine.jpg";
import imgStonks from "./assets/meme-stonks.jpg";
import imgNpc from "./assets/meme-npc.jpg";
import imgDoge from "./assets/meme-doge.jpg";
import imgPepe from "./assets/meme-pepe.jpg";
import imgDisaster from "./assets/meme-disaster.jpg";
import imgButtons from "./assets/meme-buttons.jpg";
import imgSuccess from "./assets/meme-success.jpg";

const MEME_IMG: Record<string, string> = {
  distracted: imgDistracted,
  thisisfine: imgThisisfine,
  stonks: imgStonks,
  npc: imgNpc,
  doge: imgDoge,
  pepe: imgPepe,
  disaster: imgDisaster,
  buttons: imgButtons,
  success: imgSuccess,
};

const COMPANION_URL = import.meta.env.DEV ? "http://localhost:5173" : "/";

type CareAction = "feed" | "groom" | "play" | "sleep";
type Mode =
  | "pet"
  | "menu"
  | "feed"
  | "care"
  | "games"
  | "dodge"
  | "match"
  | "shop"
  | "bag"
  | "stats"
  | "post"
  | "settings";

const LABELS: Label[] = ["tasty", "spicy", "blech"];
const LABEL_FACE: Record<Label, string> = { tasty: "TASTY +2", spicy: "SPICY +3", blech: "BLECH -1" };
const LABEL_COLOR: Record<Label, string> = { tasty: "#37a24b", spicy: "#e2483d", blech: "#7a4fd0" };
const MENU: { id: Mode | "sleep"; label: string; glyph: string }[] = [
  { id: "feed", label: "FEED", glyph: "🖼️" },
  { id: "care", label: "CARE", glyph: "🧼" },
  { id: "games", label: "GAMES", glyph: "🎮" },
  { id: "shop", label: "SHOP", glyph: "🛍️" },
  { id: "bag", label: "BAG", glyph: "🎒" },
  { id: "stats", label: "STATS", glyph: "📊" },
  { id: "post", label: "POST", glyph: "📮" },
  { id: "settings", label: "SETTINGS", glyph: "⚙️" },
  { id: "sleep", label: "SLEEP", glyph: "💤" },
];
const CARE: { id: CareAction; label: string; glyph: string }[] = [
  { id: "feed", label: "FEED", glyph: "🍖" },
  { id: "groom", label: "GROOM", glyph: "🛁" },
  { id: "play", label: "PLAY", glyph: "🎾" },
  { id: "sleep", label: "SLEEP", glyph: "💤" },
];
const GAMES: { id: "dodge" | "match"; label: string; glyph: string; desc: string }[] = [
  { id: "dodge", label: "MEME DODGE", glyph: "🏃", desc: "JUMP THE BAD LABELS" },
  { id: "match", label: "LABEL MATCH", glyph: "🧩", desc: "NAME THE MEME'S VIBE" },
];
const DODGE_LABELS = ["BLECH", "MID", "RATIO", "CRINGE"];
const STAGE_COLORS = ["#8be04e", "#57c84a", "#3fc97e", "#2fbfae", "#b06ee8"];
const SECRET_HINTS = ["stonks", "doge", "chad", "rickroll", "sus", "rizz", "no cap", "L + ratio", "mid meme", "based and correct"];
const URL_RE = /^https?:\/\/\S+$/i;
const SETTINGS_COUNT = 4;

const STAT_COLORS: Record<string, string> = {
  Fullness: "#ff8a3c",
  Happiness: "#ff5da2",
  Hygiene: "#38bdf8",
  Energy: "#ffd23f",
  Heat: "#ff4747",
  FULLNESS: "#ff8a3c",
  HAPPY: "#ff5da2",
  HYGIENE: "#38bdf8",
  ENERGY: "#ffd23f",
  HEAT: "#ff4747",
};

function Pips({ label, glyph, value, heat }: { label: string; glyph: string; value: number; heat?: boolean }) {
  const filled = Math.max(0, Math.min(5, Math.round(value / 20)));
  const color = STAT_COLORS[label] ?? "#57e65c";
  return (
    <div className="flex items-center gap-[5px]" aria-label={`${label} ${value} of 100`}>
      <span className="w-[17px] text-[14px] leading-none">{glyph}</span>
      <span className="flex gap-[3px]">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="inline-block h-[13px] w-[11px] transition-colors duration-500"
            style={{
              background: i < filled ? (heat && filled >= 4 ? "#ff4747" : color) : "rgba(255,255,255,0.14)",
              border: "2px solid #0a0a24",
              boxShadow: i < filled ? "inset 0 3px 0 rgba(255,255,255,0.45)" : undefined,
            }}
          />
        ))}
      </span>
    </div>
  );
}

function StatRow({ label, glyph, value, heat }: { label: string; glyph: string; value: number; heat?: boolean }) {
  const filled = Math.max(0, Math.min(10, Math.round(value / 10)));
  const color = heat && value >= 75 ? "#ff4747" : (STAT_COLORS[label] ?? "#57e65c");
  return (
    <div className="flex items-center gap-2" aria-label={`${label} ${value} of 100`}>
      <span className="w-[19px] text-[15px] leading-none">{glyph}</span>
      <span className="font-game snes-text w-[104px] text-[10px] leading-none text-white">{label}</span>
      <span className="flex flex-1 gap-[3px]">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
          <span
            key={i}
            className="inline-block h-[14px] flex-1 transition-colors duration-500"
            style={{
              background: i < filled ? color : "rgba(255,255,255,0.13)",
              border: "2px solid #0a0a24",
              boxShadow: i < filled ? "inset 0 3px 0 rgba(255,255,255,0.4)" : undefined,
            }}
          />
        ))}
      </span>
      <span key={value} className="anim-num-pop font-pixel snes-text w-[30px] text-right text-[21px] leading-none text-white">
        {value}
      </span>
    </div>
  );
}

function ScreenText({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`font-pixel snes-text leading-none text-white ${className}`}>{children}</p>;
}

function Cursor() {
  return (
    <svg className="anim-cursor block" width="19" height="15" viewBox="0 0 19 15" aria-hidden>
      <polygon points="2,1.5 17,7.5 2,13.5 6,7.5" fill="#ffd23f" stroke="#0a0a24" strokeWidth="2.4" strokeLinejoin="round" />
    </svg>
  );
}

function MenuRow({ selected, children, tall }: { selected: boolean; children: React.ReactNode; tall?: boolean }) {
  return (
    <div
      className={`flex min-h-0 flex-1 items-center gap-1 px-1 ${tall ? "py-[1px]" : ""}`}
      style={{ background: selected ? "rgba(255,210,63,0.16)" : "transparent" }}
    >
      <span className="flex w-[24px] shrink-0 items-center justify-center">{selected ? <Cursor /> : null}</span>
      <div className={`font-game snes-text flex min-w-0 flex-1 items-center gap-2 text-[14px] leading-snug ${selected ? "text-[#ffd23f]" : "text-white"}`}>
        {children}
      </div>
    </div>
  );
}

function Banner({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="snes-banner flex items-center justify-between px-3 py-[9px]">
      <span className="font-game flex items-center gap-2 text-[14px] leading-none">
        <span aria-hidden className="text-[10px]">◆</span>
        {title}
        <span aria-hidden className="text-[10px]">◆</span>
      </span>
      {right}
    </div>
  );
}

type Tod = "day" | "evening" | "night";
const STARS: { l: string; t: string; d: string }[] = [
  { l: "8%", t: "10%", d: "0s" }, { l: "22%", t: "24%", d: "0.4s" }, { l: "38%", t: "8%", d: "0.9s" },
  { l: "55%", t: "18%", d: "0.2s" }, { l: "70%", t: "6%", d: "1.1s" }, { l: "84%", t: "22%", d: "0.6s" },
  { l: "92%", t: "12%", d: "1.4s" }, { l: "15%", t: "36%", d: "1.2s" }, { l: "64%", t: "32%", d: "0.8s" },
];

function SceneBg({ tod }: { tod: Tod }) {
  const sky =
    tod === "day"
      ? "linear-gradient(180deg,#3f9bf0 0%,#7cc4ff 52%,#c8ecff 76%,#eafaff 100%)"
      : tod === "evening"
        ? "linear-gradient(180deg,#2e2a6e 0%,#7a3d8f 42%,#e05e7a 70%,#ffab4d 100%)"
        : "linear-gradient(180deg,#04061f 0%,#101a45 55%,#1d3266 100%)";
  const ground = tod === "night" ? "#1d4d2a" : tod === "evening" ? "#2f7a35" : "#3f9e3f";
  const groundDark = tod === "night" ? "#12301b" : tod === "evening" ? "#256b2c" : "#358737";
  return (
    <div className="absolute inset-0" aria-hidden>
      <div className="absolute inset-0" style={{ background: sky }} />
      {tod === "night" &&
        STARS.map((s, i) => (
          <span key={i} className="anim-twinkle absolute block h-[4px] w-[4px] bg-white" style={{ left: s.l, top: s.t, animationDelay: s.d }} />
        ))}
      {tod === "day" && (
        <div
          className="absolute right-[11%] top-[8%] h-[36px] w-[36px] bg-[#ffd23f]"
          style={{ boxShadow: "0 0 0 5px rgba(255,210,63,0.35), 0 0 34px 10px rgba(255,210,63,0.45)" }}
        />
      )}
      {tod !== "day" && (
        <div className="absolute right-[12%] top-[9%] h-[32px] w-[32px] rounded-full" style={{ boxShadow: "inset -11px 4px 0 0 #f6f2da" }} />
      )}
      {tod !== "night" && (
        <>
          <div className="anim-cloud absolute left-[9%] top-[13%] h-[13px] w-[46px] bg-white/90" style={{ boxShadow: "15px -8px 0 0 rgba(255,255,255,0.9), 32px 0 0 0 rgba(255,255,255,0.9)" }} />
          <div className="anim-cloud2 absolute right-[16%] top-[26%] h-[11px] w-[36px] bg-white/70" style={{ boxShadow: "12px -7px 0 0 rgba(255,255,255,0.7), 25px 0 0 0 rgba(255,255,255,0.7)" }} />
        </>
      )}
      <div className="absolute inset-x-[-10%] bottom-[11%] h-[13%] rounded-[100%] opacity-70" style={{ background: groundDark }} />
      <div
        className="absolute inset-x-0 bottom-0 h-[14%] border-t-[3px] border-[#0a0a24]/40"
        style={{ background: `repeating-conic-gradient(${ground} 0% 25%, ${groundDark} 0% 50%)`, backgroundSize: "18px 18px" }}
      />
    </div>
  );
}

function windowStart(idx: number, total: number, size: number): number {
  if (total <= size) return 0;
  return Math.min(Math.max(idx - size + 1, 0), total - size);
}

interface Hazard { id: number; x: number; label: string; speed: number }
interface DodgeState {
  phase: "ready" | "run" | "done";
  hazards: Hazard[];
  air: number;
  dodged: number;
  startedAt: number;
  durationSec: number;
  score: number;
  msg: string;
}
const DODGE_FRESH: DodgeState = { phase: "ready", hazards: [], air: 0, dodged: 0, startedAt: 0, durationSec: 45, score: 0, msg: "" };

interface MatchState {
  phase: "ready" | "play" | "done";
  memeKey: string;
  correct: number;
  wrong: number;
  streak: number;
  best: number;
  feedback: string;
  score: number;
}
const MATCH_FRESH: MatchState = { phase: "ready", memeKey: "", correct: 0, wrong: 0, streak: 0, best: 0, feedback: "", score: 0 };

interface Nav {
  menu: number; care: number; shop: number; bag: number; games: number;
  post: number; settings: number; label: number; meme: number;
  statsPage: number; matchLabel: number;
}
const NAV_FRESH: Nav = { menu: 0, care: 0, shop: 0, bag: 0, games: 0, post: 0, settings: 0, label: 0, meme: 0, statsPage: 0, matchLabel: 0 };

const BURST_SPOTS: { dx: string; dy: string; delay: string; size: number }[] = [
  { dx: "-58px", dy: "-72px", delay: "0s", size: 21 },
  { dx: "46px", dy: "-84px", delay: "0.05s", size: 24 },
  { dx: "-84px", dy: "-26px", delay: "0.1s", size: 18 },
  { dx: "82px", dy: "-34px", delay: "0.02s", size: 19 },
  { dx: "-30px", dy: "-102px", delay: "0.08s", size: 17 },
  { dx: "24px", dy: "-108px", delay: "0.12s", size: 22 },
];

function Burst({ kind, burstKey }: { kind: "hearts" | "sparkles"; burstKey: number }) {
  const glyphs = kind === "hearts" ? ["💗", "💖", "💗", "💕"] : ["✨", "⭐", "✨", "💫"];
  return (
    <div key={burstKey} className="pointer-events-none absolute inset-0 z-20" aria-hidden>
      {BURST_SPOTS.map((s, i) => (
        <span
          key={i}
          className="anim-particle absolute"
          style={{ left: "50%", top: "40%", fontSize: s.size, animationDelay: s.delay, ["--dx" as string]: s.dx, ["--dy" as string]: s.dy }}
        >
          {glyphs[i % glyphs.length]}
        </span>
      ))}
    </div>
  );
}

export function App() {
  const queryClient = useQueryClient();
  const pet = useQuery({
    queryKey: ["gameState"],
    queryFn: () => api.getState({}),
    refetchInterval: 4000,
  });
  const view: GameView | undefined = pet.data?.view;
  const mon = view?.monster;

  const [mode, setMode] = useState<Mode>("pet");
  const [nav, setNav] = useState<Nav>(NAV_FRESH);
  const [eatingUntil, setEatingUntil] = useState(0);
  const [evoFlash, setEvoFlash] = useState<{ name: string; from: number } | null>(null);
  const [burst, setBurst] = useState<{ id: number; kind: "hearts" | "sparkles" } | null>(null);
  const [feedFx, setFeedFx] = useState<{ id: number; src: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [screenMsg, setScreenMsg] = useState("");
  const [gameMsg, setGameMsg] = useState("");
  const [talkText, setTalkText] = useState("");
  const [resetArm, setResetArm] = useState(false);
  const [flash, setFlash] = useState(0);
  const [dodge, setDodge] = useState<DodgeState>(DODGE_FRESH);
  const [match, setMatch] = useState<MatchState>(MATCH_FRESH);
  const [tickNow, setTickNow] = useState(() => Date.now());

  const prevStage = useRef<number | null>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const navRef = useRef(nav);
  navRef.current = nav;
  const viewRef = useRef(view);
  viewRef.current = view;
  const dodgeRef = useRef(dodge);
  dodgeRef.current = dodge;
  const matchRef = useRef(match);
  matchRef.current = match;
  const screenMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetArmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hazardId = useRef(0);

  useEffect(() => {
    const iv = setInterval(() => setTickNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const patchNav = useCallback((p: Partial<Nav>) => setNav((prev) => ({ ...prev, ...p })), []);

  useEffect(() => {
    if (mode !== "settings" && resetArm) {
      setResetArm(false);
      if (resetArmTimer.current) clearTimeout(resetArmTimer.current);
    }
  }, [mode, resetArm]);

  useEffect(() => {
    if (!burst) return;
    const t = setTimeout(() => setBurst(null), 1300);
    return () => clearTimeout(t);
  }, [burst]);

  useEffect(() => {
    if (!feedFx) return;
    const t = setTimeout(() => setFeedFx(null), 1000);
    return () => clearTimeout(t);
  }, [feedFx]);

  const showScreenMsg = useCallback((text: string) => {
    setScreenMsg(text);
    if (screenMsgTimer.current) clearTimeout(screenMsgTimer.current);
    screenMsgTimer.current = setTimeout(() => setScreenMsg(""), 3000);
  }, []);

  const audioRef = useRef<AudioContext | null>(null);
  const soundOnRef = useRef(true);
  useEffect(() => {
    soundOnRef.current = view?.settings.soundOn ?? true;
  }, [view?.settings.soundOn]);

  const bleep = useCallback((freq: number, dur = 0.06, delay = 0, type: OscillatorType = "square") => {
    if (!soundOnRef.current) return;
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      audioRef.current ??= new AC();
      const ac = audioRef.current;
      if (ac.state === "suspended") void ac.resume();
      const t0 = ac.currentTime + delay;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.035, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch {
      /* silent */
    }
  }, []);
  const blipOk = useCallback(() => { bleep(660, 0.05); bleep(990, 0.07, 0.06); }, [bleep]);
  const blipBad = useCallback(() => { bleep(170, 0.16, 0, "sawtooth"); }, [bleep]);
  const blipNav = useCallback(() => { bleep(880, 0.04); }, [bleep]);

  useEffect(() => {
    if (!mon) return;
    if (prevStage.current === null) {
      prevStage.current = mon.stage;
      return;
    }
    if (mon.stage > prevStage.current) {
      setEvoFlash({ name: mon.stageName, from: prevStage.current });
      const t = setTimeout(() => setEvoFlash(null), 2700);
      prevStage.current = mon.stage;
      return () => clearTimeout(t);
    }
    prevStage.current = mon.stage;
  }, [mon]);

  const applyResult = useCallback(
    (r: { ok: boolean; message: string; view: GameView }) => {
      queryClient.setQueryData(["gameState"], { view: r.view });
      if (r.message) setNotice(r.message);
      return r;
    },
    [queryClient],
  );

  const careMut = useMutation({
    mutationFn: (a: CareAction) => api.care({ action: a }),
    onSuccess: (r, a) => {
      applyResult(r);
      if (!r.ok) { showScreenMsg(r.message); blipBad(); return; }
      if (a === "groom" || a === "play") setBurst({ id: Date.now(), kind: "hearts" });
      blipOk();
    },
  });
  const feedMut = useMutation({
    mutationFn: (args: { memeKey: string; label: Label }) => api.feedMeme(args),
    onSuccess: (r, args) => {
      applyResult(r);
      if (!r.ok) { showScreenMsg(r.message); blipBad(); return; }
      setEatingUntil(Date.now() + 1400);
      const fed = r.view.memes.find((m) => m.key === args.memeKey);
      const src = fed ? (fed.imageUrl ?? (fed.imageKey ? MEME_IMG[fed.imageKey] : undefined) ?? MEME_IMG[fed.key] ?? "") : "";
      if (src) setFeedFx({ id: Date.now(), src });
      patchNav({ meme: navRef.current.meme + 1 });
      blipOk();
    },
  });
  const talkMut = useMutation({
    mutationFn: (text: string) => api.talk({ text }),
    onSuccess: (r) => {
      applyResult(r);
      if (r.ok) {
        blipOk();
        if (r.message.startsWith("Secret unlocked")) setBurst({ id: Date.now(), kind: "sparkles" });
      } else blipBad();
    },
  });
  const buyMut = useMutation({
    mutationFn: (id: string) => api.buyCosmetic({ assetId: id }),
    onSuccess: (r) => { applyResult(r); showScreenMsg(r.message); if (r.ok) blipOk(); else blipBad(); },
  });
  const equipMut = useMutation({
    mutationFn: (id: string) => api.equipCosmetic({ assetId: id }),
    onSuccess: (r) => { applyResult(r); showScreenMsg(r.message); if (r.ok) blipOk(); else blipBad(); },
  });
  const gameMut = useMutation({
    mutationFn: (args: { game: "dodge" | "match"; score: number }) => api.completeMiniGame(args),
    onSuccess: (r) => { applyResult(r); setGameMsg(r.message); if (r.ok) blipOk(); else blipBad(); },
  });
  const gameMutRef = useRef(gameMut.mutate);
  gameMutRef.current = gameMut.mutate;
  const bonusMut = useMutation({
    mutationFn: (key: string) => api.postBonusMeme({ bonusKey: key }),
    onSuccess: (r) => { applyResult(r); showScreenMsg(r.message); if (r.ok) blipOk(); else blipBad(); },
  });
  const urlMut = useMutation({
    mutationFn: (url: string) => api.postMemeFromUrl({ url }),
    onSuccess: (r) => {
      applyResult(r);
      if (r.ok) {
        patchNav({ meme: 0 });
        setMode("feed");
        blipOk();
      } else {
        showScreenMsg(r.message);
        blipBad();
      }
    },
  });
  const settingsMut = useMutation({
    mutationFn: (args: { clock?: 1 | 60; soundOn?: boolean }) => api.updateSettings(args),
    onSuccess: (r) => { applyResult(r); showScreenMsg(r.message); blipOk(); },
  });
  const stageMut = useMutation({
    mutationFn: (stage: number) => api.setDisplayStage({ stage }),
    onSuccess: (r) => { applyResult(r); showScreenMsg(r.message); if (r.ok) blipOk(); else blipBad(); },
  });
  const resetMut = useMutation({
    mutationFn: () => api.resetPet({}),
    onSuccess: (r) => {
      applyResult(r);
      setMode("pet");
      setNav(NAV_FRESH);
      setResetArm(false);
      prevStage.current = 1;
      blipOk();
    },
  });

  const busy = careMut.isPending || feedMut.isPending;

  /* ================= Meme Dodge ================= */
  const finishDodge = useCallback((score: number, hitLabel: string | null) => {
    const d = dodgeRef.current;
    if (d.phase !== "run") return;
    const next: DodgeState = {
      ...d,
      phase: "done",
      score,
      msg: hitLabel ? `💥 HIT BY ${hitLabel}!` : "🏁 TIME UP!",
    };
    dodgeRef.current = next;
    setDodge(next);
    setGameMsg("");
    gameMutRef.current({ game: "dodge", score });
  }, []);

  const tickDodge = useCallback(() => {
    const d = dodgeRef.current;
    if (d.phase !== "run") return;
    const elapsed = (Date.now() - d.startedAt) / 1000;
    const air = Math.max(0, d.air - 1);
    let dodged = d.dodged;
    let hazards = d.hazards
      .map((h) => ({ ...h, x: h.x - h.speed }))
      .filter((h) => {
        if (h.x < -20) { dodged += 1; return false; }
        return true;
      });
    const hit = hazards.find((h) => h.x > -8 && h.x < 24 && air === 0);
    if (hit || elapsed >= d.durationSec) {
      dodgeRef.current = { ...d, hazards, air, dodged };
      setDodge(dodgeRef.current);
      finishDodge(dodged + Math.floor(elapsed), hit ? hit.label : null);
      return;
    }
    const leftmost = hazards.length ? Math.min(...hazards.map((h) => h.x)) : 999;
    if (Math.random() < 0.34 && leftmost > 34) {
      hazardId.current += 1;
      hazards = [
        ...hazards,
        {
          id: hazardId.current,
          x: 104,
          label: DODGE_LABELS[Math.floor(Math.random() * DODGE_LABELS.length)] ?? "BLECH",
          speed: 8.5 + Math.min(6, elapsed / 6) + Math.random() * 2,
        },
      ];
    }
    dodgeRef.current = { ...d, hazards, air, dodged };
    setDodge(dodgeRef.current);
  }, [finishDodge]);

  useEffect(() => {
    if (mode !== "dodge" || dodge.phase !== "run") return;
    const iv = setInterval(tickDodge, 100);
    return () => clearInterval(iv);
  }, [mode, dodge.phase, tickDodge]);

  const startDodgeRun = useCallback(() => {
    const dur = viewRef.current?.monster.activeBuffs.dogeSpeed ? 58 : 45;
    const next: DodgeState = { ...DODGE_FRESH, phase: "run", startedAt: Date.now(), durationSec: dur };
    dodgeRef.current = next;
    setDodge(next);
    setGameMsg("");
  }, []);

  const dodgeJump = useCallback(() => {
    const d = dodgeRef.current;
    if (d.phase !== "run" || d.air > 0) return;
    const next = { ...d, air: 5 };
    dodgeRef.current = next;
    setDodge(next);
    bleep(720, 0.05);
  }, [bleep]);

  /* ================= Label Match ================= */
  const pickMatchMeme = useCallback((excludeKey: string): string => {
    const v = viewRef.current;
    if (!v || v.memes.length === 0) return "";
    const pool = v.memes.filter((m) => m.key !== excludeKey);
    const list = pool.length ? pool : v.memes;
    return list[Math.floor(Math.random() * list.length)]?.key ?? "";
  }, []);

  const startMatch = useCallback(() => {
    const next: MatchState = { ...MATCH_FRESH, phase: "play", memeKey: pickMatchMeme("") };
    matchRef.current = next;
    setMatch(next);
    patchNav({ matchLabel: 0 });
    setGameMsg("");
  }, [pickMatchMeme, patchNav]);

  const lockMatch = useCallback(() => {
    const v = viewRef.current;
    const m = matchRef.current;
    if (!v || m.phase !== "play") return;
    const meme = v.memes.find((x) => x.key === m.memeKey);
    if (!meme) return;
    const chosen = LABELS[navRef.current.matchLabel] ?? "tasty";
    const correct = chosen === meme.dominant;
    const next: MatchState = { ...m };
    if (correct) {
      next.correct += 1;
      next.streak += 1;
      next.best = Math.max(next.best, next.streak);
      next.feedback = `✓ YES! IT'S ${meme.dominant.toUpperCase()}`;
      bleep(1040, 0.07);
    } else {
      next.wrong += 1;
      next.streak = 0;
      next.feedback = `✗ NO — IT WAS ${meme.dominant.toUpperCase()}`;
      blipBad();
    }
    const rounds = next.correct + next.wrong;
    if (next.wrong >= 3 || rounds >= 12) {
      next.phase = "done";
      next.score = next.correct * 2 + next.best;
      setGameMsg("");
      gameMutRef.current({ game: "match", score: next.score });
    } else {
      next.memeKey = pickMatchMeme(m.memeKey);
      patchNav({ matchLabel: 0 });
    }
    matchRef.current = next;
    setMatch(next);
  }, [bleep, blipBad, pickMatchMeme, patchNav]);

  const gameBlock = useCallback((): string | null => {
    const m = viewRef.current?.monster;
    if (!m) return "LOADING…";
    if (m.isSleeping) return "ASLEEP — WAKE FIRST";
    if (m.fullness === 0) return "HANGRY — FEED FIRST";
    if (m.happiness < 30) return "HAPPINESS <30 — CARE PLAY FIRST";
    if (m.energy < 10) return "TOO TIRED — ENERGY <10";
    return null;
  }, []);

  /* ---------- ONE BUTTON ---------- */
  const doShort = useCallback(() => {
    const v = viewRef.current;
    if (!v || busy) return;
    if (v.monster.isSleeping) return;
    const n = navRef.current;
    blipNav();
    switch (modeRef.current) {
      case "pet": setMode("feed"); break;
      case "menu": patchNav({ menu: (n.menu + 1) % MENU.length }); break;
      case "feed": patchNav({ label: (n.label + 1) % 4 }); break;
      case "care": patchNav({ care: (n.care + 1) % CARE.length }); break;
      case "games": patchNav({ games: (n.games + 1) % GAMES.length }); break;
      case "dodge": dodgeJump(); break;
      case "match":
        if (matchRef.current.phase === "play") patchNav({ matchLabel: (n.matchLabel + 1) % LABELS.length });
        break;
      case "shop": patchNav({ shop: (n.shop + 1) % Math.max(1, v.cosmetics.length) }); break;
      case "bag": {
        const owned = v.cosmetics.filter((c) => c.owned);
        if (owned.length) patchNav({ bag: (n.bag + 1) % owned.length });
        break;
      }
      case "stats": patchNav({ statsPage: (n.statsPage + 1) % 2 }); break;
      case "post": patchNav({ post: (n.post + 1) % Math.max(1, v.bonusMemes.length) }); break;
      case "settings": patchNav({ settings: (n.settings + 1) % SETTINGS_COUNT }); break;
    }
  }, [busy, blipNav, dodgeJump, patchNav]);

  const doDouble = useCallback(() => {
    const v = viewRef.current;
    if (!v || v.monster.isSleeping) return;
    blipNav();
    switch (modeRef.current) {
      case "pet": setMode("menu"); patchNav({ menu: 0 }); break;
      case "menu": setMode("pet"); break;
      case "dodge":
      case "match": setMode("games"); break;
      default: setMode("menu"); break;
    }
  }, [blipNav, patchNav]);

  const doLong = useCallback(() => {
    const v = viewRef.current;
    if (!v || busy) return;
    const n = navRef.current;
    if (v.monster.isSleeping) {
      careMut.mutate("sleep");
      setMode("pet");
      return;
    }
    setFlash(Date.now());
    bleep(520, 0.05);
    bleep(880, 0.07, 0.06);
    switch (modeRef.current) {
      case "pet": setMode("menu"); patchNav({ menu: 0 }); break;
      case "menu": {
        const item = MENU[n.menu];
        if (!item) break;
        if (item.id === "sleep") {
          careMut.mutate("sleep");
          setMode("pet");
        } else {
          if (item.id === "stats") patchNav({ statsPage: 0 });
          if (item.id === "bag") patchNav({ bag: 0 });
          setMode(item.id);
        }
        break;
      }
      case "feed": {
        if (n.label >= LABELS.length) {
          patchNav({ meme: n.meme + 1, label: 0 });
          break;
        }
        const meme = v.memes[n.meme % Math.max(1, v.memes.length)];
        const label = LABELS[n.label];
        if (meme && label) feedMut.mutate({ memeKey: meme.key, label });
        break;
      }
      case "care": {
        const item = CARE[n.care];
        if (!item) break;
        careMut.mutate(item.id);
        setMode("pet");
        break;
      }
      case "games": {
        const g = GAMES[n.games];
        if (!g) break;
        const block = gameBlock();
        if (block) { showScreenMsg(block); blipBad(); break; }
        setGameMsg("");
        if (g.id === "dodge") { dodgeRef.current = DODGE_FRESH; setDodge(DODGE_FRESH); setMode("dodge"); }
        else { matchRef.current = MATCH_FRESH; setMatch(MATCH_FRESH); setMode("match"); }
        break;
      }
      case "dodge": {
        const d = dodgeRef.current;
        if (d.phase === "ready") startDodgeRun();
        else if (d.phase === "run") finishDodge(d.dodged + Math.floor((Date.now() - d.startedAt) / 1000), null);
        else { dodgeRef.current = DODGE_FRESH; setDodge(DODGE_FRESH); setMode("games"); }
        break;
      }
      case "match": {
        const m = matchRef.current;
        if (m.phase === "ready") startMatch();
        else if (m.phase === "play") lockMatch();
        else { matchRef.current = MATCH_FRESH; setMatch(MATCH_FRESH); setMode("games"); }
        break;
      }
      case "shop": {
        const item = v.cosmetics[n.shop % Math.max(1, v.cosmetics.length)];
        if (item) buyMut.mutate(item.id);
        break;
      }
      case "bag": {
        const owned = v.cosmetics.filter((c) => c.owned);
        const item = owned[n.bag % Math.max(1, owned.length)];
        if (item) equipMut.mutate(item.id);
        break;
      }
      case "stats": patchNav({ statsPage: (n.statsPage + 1) % 2 }); break;
      case "post": {
        const bonus = v.bonusMemes[n.post % Math.max(1, v.bonusMemes.length)];
        if (bonus) bonusMut.mutate(bonus.key);
        break;
      }
      case "settings": {
        if (n.settings === 0) {
          settingsMut.mutate({ clock: v.settings.clock === 1 ? 60 : 1 });
        } else if (n.settings === 1) {
          settingsMut.mutate({ soundOn: !v.settings.soundOn });
        } else if (n.settings === 2) {
          if (v.monster.stage < 3) { showScreenMsg("🔒 NOSTALGIA UNLOCKS AT STAGE 3"); blipBad(); }
          else stageMut.mutate((v.monster.displayStage % v.monster.stage) + 1);
        } else if (n.settings === 3) {
          if (!resetArm) {
            setResetArm(true);
            showScreenMsg("⚠ HOLD AGAIN TO CONFIRM RESET");
            blipBad();
            if (resetArmTimer.current) clearTimeout(resetArmTimer.current);
            resetArmTimer.current = setTimeout(() => setResetArm(false), 4000);
          } else {
            if (resetArmTimer.current) clearTimeout(resetArmTimer.current);
            resetMut.mutate();
          }
        }
        break;
      }
    }
  }, [busy, bleep, blipBad, showScreenMsg, patchNav, careMut, feedMut, buyMut, equipMut, bonusMut, settingsMut, stageMut, resetMut, gameBlock, startDodgeRun, finishDodge, startMatch, lockMatch, resetArm]);

  const downAt = useRef(0);
  const downTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSingle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressCount = useRef(0);
  const longFired = useRef(false);
  const pressActive = useRef(false);
  const [holding, setHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdRaf = useRef<number>(0);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(holdRaf.current);
      if (downTimer.current) clearTimeout(downTimer.current);
      if (pendingSingle.current) clearTimeout(pendingSingle.current);
      if (screenMsgTimer.current) clearTimeout(screenMsgTimer.current);
      if (resetArmTimer.current) clearTimeout(resetArmTimer.current);
    };
  }, []);

  const onPressStart = useCallback(() => {
    if (pressActive.current) return;
    pressActive.current = true;
    if (pendingSingle.current) { clearTimeout(pendingSingle.current); pendingSingle.current = null; }
    downAt.current = Date.now();
    longFired.current = false;
    setHolding(true);
    const step = () => {
      const p = Math.min(1, (Date.now() - downAt.current) / 600);
      setHoldProgress(p);
      if (p < 1) holdRaf.current = requestAnimationFrame(step);
    };
    holdRaf.current = requestAnimationFrame(step);
    downTimer.current = setTimeout(() => {
      longFired.current = true;
      pressCount.current = 0;
      if (pendingSingle.current) { clearTimeout(pendingSingle.current); pendingSingle.current = null; }
      doLong();
    }, 600);
  }, [doLong]);

  const onPressCancel = useCallback(() => {
    if (!pressActive.current) return;
    pressActive.current = false;
    pressCount.current = 0;
    setHolding(false);
    setHoldProgress(0);
    cancelAnimationFrame(holdRaf.current);
    if (downTimer.current) clearTimeout(downTimer.current);
  }, []);

  const onPressEnd = useCallback(() => {
    if (!pressActive.current) return;
    pressActive.current = false;
    setHolding(false);
    setHoldProgress(0);
    cancelAnimationFrame(holdRaf.current);
    if (downTimer.current) clearTimeout(downTimer.current);
    if (longFired.current) return;
    if (modeRef.current === "dodge" && dodgeRef.current.phase === "run") {
      doShort();
      return;
    }
    pressCount.current += 1;
    if (pressCount.current >= 2) {
      pressCount.current = 0;
      if (pendingSingle.current) { clearTimeout(pendingSingle.current); pendingSingle.current = null; }
      doDouble();
    } else {
      pendingSingle.current = setTimeout(() => {
        pressCount.current = 0;
        pendingSingle.current = null;
        doShort();
      }, 280);
    }
  }, [doShort, doDouble]);

  useEffect(() => {
    const down = (e: globalThis.KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      e.preventDefault();
      onPressStart();
    };
    const up = (e: globalThis.KeyboardEvent) => {
      if (e.code !== "Space") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      e.preventDefault();
      onPressEnd();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [onPressStart, onPressEnd]);

  const onTalk = (e: FormEvent) => {
    e.preventDefault();
    const t = talkText.trim();
    if (!t) return;
    if (modeRef.current === "post" && URL_RE.test(t)) urlMut.mutate(t);
    else talkMut.mutate(t);
    setTalkText("");
  };

  const eating = tickNow < eatingUntil;
  const mood: Mood = !mon ? "happy" : mon.isRoasted ? "roasted" : mon.isSleeping ? "sleeping" : eating ? "eating" : mon.mood;
  const animClass = mon?.isSleeping
    ? ""
    : mood === "happy" || mood === "eating" || mood === "excited"
      ? "anim-bounce"
      : mood === "roasted"
        ? "anim-shake"
        : mood === "sick"
          ? "anim-wobble"
          : mood === "hungry" || mood === "hangry"
            ? "anim-growl"
            : "anim-bob";

  const memeCount = Math.max(1, view?.memes.length ?? 1);
  const currentMeme = view?.memes[nav.meme % memeCount];
  const memeSrc = currentMeme ? (currentMeme.imageUrl ?? (currentMeme.imageKey ? MEME_IMG[currentMeme.imageKey] : undefined) ?? MEME_IMG[currentMeme.key] ?? "") : "";
  const currentLabel = LABELS[nav.label];
  const ownedItems = view?.cosmetics.filter((c) => c.owned) ?? [];
  const elapsedServerSec = view ? Math.max(0, Math.floor((tickNow - view.serverNow) / 1000)) : 0;

  const settingsRows = view && mon
    ? [
        `CLOCK: ${view.settings.clock === 1 ? "REAL-TIME 1×" : "DEMO 60×"}`,
        `SOUND: ${view.settings.soundOn ? "ON 🔊" : "OFF 🔇"}`,
        mon.stage >= 3 ? `LOOK: STG ${mon.displayStage} ${mon.displayStageName.toUpperCase()}` : "LOOK: 🔒 STAGE 3",
        resetArm ? "RESET PET — SURE?!" : "RESET PET",
      ]
    : [];

  const matchMeme = view?.memes.find((m) => m.key === match.memeKey);
  const matchMemeSrc = matchMeme ? (matchMeme.imageUrl ?? (matchMeme.imageKey ? MEME_IMG[matchMeme.imageKey] : undefined) ?? MEME_IMG[matchMeme.key] ?? "") : "";
  const hourNow = new Date().getHours();
  const tod: Tod = hourNow >= 7 && hourNow < 17 ? "day" : hourNow >= 17 && hourNow < 21 ? "evening" : "night";
  const screenKey = mon ? `${mode}-${mon.isSleeping ? "zzz" : "awake"}` : "boot";

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <main className="mx-auto flex max-w-[520px] flex-col items-center px-4 pb-10 pt-4">
        <div className="mb-2 flex w-full max-w-[448px] items-center justify-between text-xs">
          <a href={COMPANION_URL} className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 font-bold text-[#a3e635] hover:brightness-110">
            ← Companion App
          </a>
          <span className="text-[var(--dim)]">Live synced · Unified Core</span>
        </div>

        <h1 className="font-game text-center text-[19px] leading-relaxed text-[#ffd23f]" style={{ textShadow: "3px 3px 0 rgba(0,0,0,0.5)" }}>
          MEMEAGOTCHI
          <span className="font-pixel mt-1 block text-[18px] tracking-widest text-[var(--dim)]" style={{ textShadow: "none" }}>
            HANDHELD SIMULATOR · PHASE 0 · 192×192
          </span>
        </h1>

        <div
          className="mt-4 w-full max-w-[448px] rounded-[36px] border border-black/60 px-5 pb-6 pt-5 shadow-[0_18px_50px_rgba(0,0,0,0.55),inset_0_2px_0_rgba(255,255,255,0.08)]"
          style={{ background: "var(--shell)" }}
        >
          <div className="mb-3 flex items-center justify-between px-1">
            <span className="font-pixel whitespace-nowrap text-[14px] tracking-widest text-[#8f9096]">MEMEAGOTCHI-192 · ESP32-S3</span>
            <span className="flex gap-1" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className="h-[5px] w-[5px] rounded-full bg-black/50" />
              ))}
            </span>
          </div>

          <div className="relative mx-auto aspect-square w-full max-w-[384px] overflow-hidden rounded-[10px] border-4 border-black/80" style={{ background: "#0a0a24" }}>
            {pet.isPending || !view || !mon ? (
              <div className="flex h-full items-center justify-center">
                <div className="snes-window px-6 py-5">
                  <p className="font-game text-[14px] text-white">BOOTING…</p>
                </div>
              </div>
            ) : (
              <div key={screenKey} className="anim-screen-in absolute inset-0">
                {mon.isSleeping ? (
                  <div className="relative flex h-full flex-col items-center px-2 pb-2 pt-3">
                    <SceneBg tod="night" />
                    <div className="anim-breathe relative mt-1 h-[74%] w-[74%] opacity-95">
                      <Monster stage={mon.displayStage} actualStage={mon.stage} mood="sleeping" equipped={view.equippedItems} />
                    </div>
                    <span className="anim-zzz font-game absolute right-[13%] top-[10%] text-[22px] text-[#ffd23f]" style={{ textShadow: "2px 2px 0 rgba(5,5,28,0.8)" }}>Z z z</span>
                    <div className="snes-bar relative mt-auto w-full px-3 py-2 text-center">
                      <p className="font-game text-[11px] leading-relaxed text-white">SLEEPING… ENERGY {mon.energy}%</p>
                      <p className="font-pixel mt-[2px] text-[15px] leading-none text-white/75">LONG-PRESS = WAKE</p>
                    </div>
                  </div>
                ) : mode === "menu" ? (
                  <div className="snes-dots flex h-full flex-col p-[10px]" style={{ background: "linear-gradient(180deg,#23235e 0%,#10102e 100%)" }}>
                    <div className="snes-window flex flex-1 flex-col px-2 py-2">
                      <div className="flex items-center justify-between px-2 pb-1 pt-1">
                        <span className="font-game snes-text text-[15px] text-[#ffd23f]">◆ MENU ◆</span>
                        <span className="font-game snes-text text-[12px] text-white">💧{mon.drip}</span>
                      </div>
                      <div className="flex flex-1 flex-col justify-center">
                        {MENU.slice(windowStart(nav.menu, MENU.length, 6), windowStart(nav.menu, MENU.length, 6) + 6).map((item) => {
                          const i = MENU.indexOf(item);
                          return (
                            <MenuRow key={item.id} selected={i === nav.menu} tall>
                              <span className="text-[20px] leading-none">{item.glyph}</span>
                              <span className="flex-1">{item.label}</span>
                              {item.id === "bag" && <span className="font-pixel text-[17px]">{ownedItems.length} ITEMS</span>}
                              {item.id === "feed" && <span className="font-pixel text-[17px]">{view.memes.length} MEMES</span>}
                            </MenuRow>
                          );
                        })}
                      </div>
                      <ScreenText className="pb-1 text-center text-[15px] opacity-75">TAP: NEXT · HOLD: OPEN · 2×: BACK</ScreenText>
                    </div>
                  </div>
                ) : mode === "feed" && currentMeme ? (
                  <div className="relative h-full w-full">
                    {memeSrc ? (
                      <img src={memeSrc} alt={currentMeme.caption} className="pixelated h-full w-full object-cover" draggable={false} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-6xl" style={{ background: currentMeme.bg }}>
                        {currentMeme.emoji}
                      </div>
                    )}
                    <div className="snes-bar absolute inset-x-[6px] top-[6px] px-3 py-2">
                      <p className="font-game truncate text-[12px] leading-relaxed text-white">
                        {currentMeme.title.toUpperCase()} {!currentMeme.isSeed ? "· YOURS" : ""}
                      </p>
                      <p className="font-pixel text-[16px] leading-none text-[#ffd23f]">
                        {(nav.meme % memeCount) + 1}/{view.memes.length} · PWR {currentMeme.power} · ♥{currentMeme.tasty} 🌶{currentMeme.spicy} 🤢{currentMeme.blech}
                      </p>
                    </div>
                    <div className="snes-bar absolute inset-x-[6px] bottom-[6px] px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-[18px] leading-none text-[#ffd23f]" aria-hidden>◀</span>
                        {currentLabel ? (
                          <span
                            className="font-game inline-block border-[3px] border-[#0a0a24] px-3 py-[7px] text-[13px] leading-none text-white"
                            style={{ background: LABEL_COLOR[currentLabel], textShadow: "2px 2px 0 rgba(5,5,28,0.55)" }}
                          >
                            {LABEL_FACE[currentLabel]}
                          </span>
                        ) : (
                          <span className="font-game inline-block border-[3px] border-[#0a0a24] bg-[#ffd23f] px-3 py-[7px] text-[13px] leading-none text-[#40260a]">
                            NEXT MEME ▸
                          </span>
                        )}
                        <span className="text-[18px] leading-none text-[#ffd23f]" aria-hidden>▶</span>
                      </div>
                      <p className="font-pixel mt-[5px] text-[15px] leading-none text-white/90">
                        TAP: NEXT LABEL · HOLD: {currentLabel ? "FEED" : "SKIP"} · 2×TAP: MENU
                      </p>
                      <p className="font-pixel text-[15px] leading-none text-[#ffe9a8]">
                        BELLY {view.belly.length}/{mon.memeSlots}
                        {view.belly[0] ? ` · DIGESTING ${Math.max(0, view.belly[0].digestInSec - elapsedServerSec)}s` : ""}
                      </p>
                    </div>
                  </div>
                ) : mode === "care" ? (
                  <div className="snes-dots flex h-full flex-col gap-2 p-[10px]" style={{ background: "linear-gradient(180deg,#23235e 0%,#10102e 100%)" }}>
                    <Banner title="CARE" />
                    <div className="snes-window flex flex-1 flex-col px-2 py-2">
                      <div className="flex flex-1 flex-col justify-center">
                        {CARE.map((item, i) => {
                          const rawCd = item.id === "feed" ? mon.cooldowns.feedSec : item.id === "groom" ? mon.cooldowns.groomSec : item.id === "play" ? mon.cooldowns.playSec : 0;
                          const cd = Math.max(0, rawCd - elapsedServerSec);
                          return (
                            <MenuRow key={item.id} selected={i === nav.care} tall>
                              <span className="text-[21px] leading-none">{item.glyph}</span>
                              <span className="flex-1">{item.label}</span>
                              {cd > 0 && <span className="font-pixel text-[18px] text-[#ffd23f]">{cd}s</span>}
                            </MenuRow>
                          );
                        })}
                      </div>
                      <ScreenText className="pb-1 text-center text-[15px] opacity-75">TAP: NEXT · HOLD: DO IT · 2×: MENU</ScreenText>
                    </div>
                  </div>
                ) : mode === "games" ? (
                  <div className="snes-dots flex h-full flex-col gap-2 p-[10px]" style={{ background: "linear-gradient(180deg,#23235e 0%,#10102e 100%)" }}>
                    <Banner title="GAMES" />
                    <div className="snes-window flex flex-1 flex-col px-3 py-3">
                      <div className="flex flex-1 flex-col justify-center gap-3">
                        {GAMES.map((g, i) => {
                          const sel = i === nav.games;
                          return (
                            <div
                              key={g.id}
                              className="flex items-center gap-2 border-[3px] px-3 py-3"
                              style={{ borderColor: sel ? "#ffd23f" : "rgba(255,255,255,0.3)", background: sel ? "rgba(255,210,63,0.16)" : "rgba(255,255,255,0.05)" }}
                            >
                              <span className="flex w-[24px] shrink-0 items-center justify-center">{sel ? <Cursor /> : null}</span>
                              <span className="text-[26px] leading-none">{g.glyph}</span>
                              <span className="min-w-0">
                                <span className={`font-game snes-text block text-[14px] leading-relaxed ${sel ? "text-[#ffd23f]" : "text-white"}`}>{g.label}</span>
                                <span className="font-pixel block text-[16px] leading-none text-white/75">{g.desc}</span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <ScreenText className="text-center text-[14px] opacity-80">PLAY: −5 ENERGY · +20 HAPPINESS · XP + DRIP</ScreenText>
                      <ScreenText className="pb-1 text-center text-[15px] opacity-75">TAP: NEXT · HOLD: PLAY · 2×: MENU</ScreenText>
                    </div>
                  </div>
                ) : mode === "dodge" ? (
                  <div className="relative h-full w-full overflow-hidden">
                    <SceneBg tod={tod} />
                    {dodge.phase === "ready" && (
                      <div className="relative flex h-full flex-col items-center justify-center px-4">
                        <div className="snes-window px-4 py-4 text-center">
                          <p className="font-game snes-text text-[15px] leading-relaxed text-[#ffd23f]">🏃 MEME DODGE</p>
                          <ScreenText className="mt-3 text-[18px]">TAP = JUMP. DON'T GET HIT.</ScreenText>
                          <ScreenText className="mt-2 text-[18px]">SCORE = DODGES + SECONDS</ScreenText>
                          <p className="font-game snes-text mt-3 text-[11px] leading-relaxed text-[#ffd23f]">HOLD: START · 2×: QUIT</p>
                        </div>
                      </div>
                    )}
                    {dodge.phase === "run" && (
                      <>
                        <div className="snes-bar absolute left-2 top-2 px-2 py-1">
                          <p className="font-pixel text-[17px] leading-none text-white">
                            ⏱ {Math.max(0, dodge.durationSec - Math.floor((tickNow - dodge.startedAt) / 1000))}s · DODGED {dodge.dodged}
                          </p>
                        </div>
                        <div className="absolute h-[34%] w-[34%] transition-all duration-150" style={{ left: "6%", bottom: dodge.air > 0 ? "40%" : "14%" }}>
                          <div className="anim-bounce h-full w-full">
                            <Monster stage={mon.displayStage} actualStage={mon.stage} mood="happy" equipped={view.equippedItems} />
                          </div>
                        </div>
                        {dodge.hazards.map((h) => (
                          <div key={h.id} className="font-game absolute border-[3px] border-[#0a0a24] bg-[#e2483d] px-2 py-[5px] text-[10px] leading-none text-white" style={{ left: `${h.x}%`, bottom: "14%" }}>
                            {h.label}
                          </div>
                        ))}
                        <ScreenText className="absolute bottom-1 left-0 right-0 text-center text-[14px] opacity-80">TAP: JUMP · HOLD: END RUN</ScreenText>
                      </>
                    )}
                    {dodge.phase === "done" && (
                      <div className="relative flex h-full flex-col items-center justify-center px-4">
                        <div className="snes-window px-4 py-4 text-center">
                          <p className="font-game snes-text text-[14px] leading-relaxed text-white">{dodge.msg}</p>
                          <p className="font-game snes-text mt-3 text-[19px] text-[#ffd23f]">SCORE {dodge.score}</p>
                          <p className="font-pixel mt-3 px-1 text-[17px] leading-tight text-white">{gameMsg || "SCORING…"}</p>
                          <ScreenText className="mt-3 text-[15px] opacity-75">HOLD: BACK TO GAMES</ScreenText>
                        </div>
                      </div>
                    )}
                  </div>
                ) : mode === "match" ? (
                  <div className="relative h-full w-full">
                    {match.phase === "ready" && (
                      <div className="snes-dots flex h-full flex-col items-center justify-center px-4" style={{ background: "linear-gradient(180deg,#23235e 0%,#10102e 100%)" }}>
                        <div className="snes-window px-4 py-4 text-center">
                          <p className="font-game snes-text text-[15px] leading-relaxed text-[#ffd23f]">🧩 LABEL MATCH</p>
                          <ScreenText className="mt-3 text-[18px]">NAME EACH MEME'S DOMINANT LABEL.</ScreenText>
                          <ScreenText className="mt-2 text-[18px]">3 MISSES ENDS THE RUN.</ScreenText>
                          <p className="font-game snes-text mt-3 text-[11px] leading-relaxed text-[#ffd23f]">HOLD: START · 2×: QUIT</p>
                        </div>
                      </div>
                    )}
                    {match.phase === "play" && matchMeme && (
                      <>
                        {matchMemeSrc && <img src={matchMemeSrc} alt={matchMeme.caption} className="pixelated h-full w-full object-cover" draggable={false} />}
                        <div className="snes-bar absolute inset-x-[6px] top-[6px] px-3 py-2">
                          <p className="font-game truncate text-[12px] leading-relaxed text-white">{matchMeme.title.toUpperCase()}</p>
                          <p className="font-pixel text-[16px] leading-none text-[#ffd23f]">
                            STREAK {match.streak} · ✓{match.correct} ✗{match.wrong}/3
                            {mon.activeBuffs.susSense ? ` · 👁 ${matchMeme.dominant.toUpperCase()}` : ""}
                          </p>
                        </div>
                        <div className="snes-bar absolute inset-x-[6px] bottom-[6px] px-3 py-2 text-center">
                          {match.feedback && (
                            <p className="font-pixel text-[17px] leading-none" style={{ color: match.feedback.startsWith("✓") ? "#7dff8a" : "#ff8a8a" }}>
                              {match.feedback}
                            </p>
                          )}
                          <div className="mt-[4px] flex items-center justify-center gap-2">
                            <span className="text-[18px] leading-none text-[#ffd23f]" aria-hidden>◀</span>
                            <span
                              className="font-game inline-block border-[3px] border-[#0a0a24] px-3 py-[7px] text-[13px] leading-none text-white"
                              style={{ background: LABEL_COLOR[LABELS[nav.matchLabel] ?? "tasty"] }}
                            >
                              {(LABELS[nav.matchLabel] ?? "tasty").toUpperCase()}
                            </span>
                            <span className="text-[18px] leading-none text-[#ffd23f]" aria-hidden>▶</span>
                          </div>
                          <p className="font-pixel mt-[5px] text-[15px] leading-none text-white/90">TAP: LABEL · HOLD: LOCK IT IN</p>
                        </div>
                      </>
                    )}
                    {match.phase === "done" && (
                      <div className="snes-dots flex h-full flex-col items-center justify-center px-4" style={{ background: "linear-gradient(180deg,#23235e 0%,#10102e 100%)" }}>
                        <div className="snes-window px-4 py-4 text-center">
                          <p className="font-game snes-text text-[15px] leading-relaxed text-[#ffd23f]">🧩 RUN OVER</p>
                          <ScreenText className="mt-3 text-[18px]">✓{match.correct} CORRECT · BEST STREAK {match.best}</ScreenText>
                          <p className="font-game snes-text mt-2 text-[19px] text-[#ffd23f]">SCORE {match.score}</p>
                          <p className="font-pixel mt-3 px-1 text-[17px] leading-tight text-white">{gameMsg || "SCORING…"}</p>
                          <ScreenText className="mt-3 text-[15px] opacity-75">HOLD: BACK TO GAMES</ScreenText>
                        </div>
                      </div>
                    )}
                  </div>
                ) : mode === "shop" ? (
                  <div className="snes-dots flex h-full flex-col gap-2 p-[10px]" style={{ background: "linear-gradient(180deg,#23235e 0%,#10102e 100%)" }}>
                    <Banner title="SHOP" right={<span className="font-game text-[12px]">💧{mon.drip} DRIP</span>} />
                    <div className="snes-window flex flex-1 flex-col px-2 py-2">
                      <div className="flex flex-1 flex-col justify-center">
                        {view.cosmetics
                          .slice(windowStart(nav.shop, view.cosmetics.length, 5), windowStart(nav.shop, view.cosmetics.length, 5) + 5)
                          .map((c) => {
                            const i = view.cosmetics.indexOf(c);
                            return (
                              <MenuRow key={c.id} selected={i === nav.shop} tall>
                                <span className="text-[20px] leading-none">{c.emoji}</span>
                                <span className="min-w-0 flex-1 truncate text-[12px]">{c.name.toUpperCase()}</span>
                                <span className="font-pixel shrink-0 text-[18px] text-[#ffd23f]">
                                  {c.equipped ? "★ ON" : c.owned ? "IN BAG" : `💧${c.price}`}
                                </span>
                              </MenuRow>
                            );
                          })}
                      </div>
                      <ScreenText className="pb-1 text-center text-[15px] opacity-75">TAP: NEXT · HOLD: BUY · 2×: MENU</ScreenText>
                    </div>
                  </div>
                ) : mode === "bag" ? (
                  <div className="snes-dots flex h-full flex-col gap-2 p-[10px]" style={{ background: "linear-gradient(180deg,#23235e 0%,#10102e 100%)" }}>
                    <Banner title="BAG" />
                    <div className="snes-window flex flex-1 flex-col px-2 py-2">
                      {ownedItems.length === 0 ? (
                        <div className="flex flex-1 flex-col items-center justify-center text-center">
                          <p className="font-game snes-text text-[13px] leading-relaxed text-white">BAG'S EMPTY.</p>
                          <ScreenText className="mt-2 text-[17px] opacity-75">BUY DRIP IN THE SHOP.</ScreenText>
                        </div>
                      ) : (
                        <div className="flex flex-1 flex-col justify-center">
                          {ownedItems
                            .slice(windowStart(nav.bag, ownedItems.length, 6), windowStart(nav.bag, ownedItems.length, 6) + 6)
                            .map((c) => {
                              const i = ownedItems.indexOf(c);
                              return (
                                <MenuRow key={c.id} selected={i === nav.bag} tall>
                                  <span className="text-[20px] leading-none">{c.emoji}</span>
                                  <span className="min-w-0 flex-1 truncate text-[12px]">{c.name.toUpperCase()}</span>
                                  <span className="font-pixel shrink-0 text-[16px] text-[#ffd23f]">{c.equipped ? "★ WORN" : c.slot.toUpperCase()}</span>
                                </MenuRow>
                              );
                            })}
                        </div>
                      )}
                      <ScreenText className="pb-1 text-center text-[15px] opacity-75">TAP: NEXT · HOLD: WEAR / REMOVE · 2×: MENU</ScreenText>
                    </div>
                  </div>
                ) : mode === "stats" ? (
                  <div className="snes-dots flex h-full flex-col gap-2 p-[10px]" style={{ background: "linear-gradient(180deg,#23235e 0%,#10102e 100%)" }}>
                    {nav.statsPage === 0 ? (
                      <>
                        <Banner title="VITALS" />
                        <div className="snes-window flex flex-1 flex-col px-3 py-2">
                          <div className="flex flex-1 flex-col justify-center gap-[11px]">
                            <StatRow label="FULLNESS" glyph="🍖" value={mon.fullness} />
                            <StatRow label="HAPPY" glyph="♥️" value={mon.happiness} />
                            <StatRow label="HYGIENE" glyph="🛁" value={mon.hygiene} />
                            <StatRow label="ENERGY" glyph="⚡" value={mon.energy} />
                            <StatRow label="HEAT" glyph="🌶" value={mon.heat} heat />
                          </div>
                          <ScreenText className="pb-1 text-center text-[18px]">💧 {mon.drip} DRIP · 🫃 BELLY {view.belly.length}/{mon.memeSlots}</ScreenText>
                        </div>
                      </>
                    ) : (
                      <>
                        <Banner title="PROGRESS" />
                        <div className="snes-window flex flex-1 flex-col px-3 py-2">
                          <div className="mt-1 flex gap-[5px]">
                            {STAGES.map((st, i) => {
                              const reached = st.stage <= mon.stage;
                              const current = st.stage === mon.stage;
                              return (
                                <div
                                  key={st.stage}
                                  className="flex-1 border-[3px] border-[#0a0a24] px-[2px] py-[5px] text-center"
                                  style={{
                                    background: reached ? STAGE_COLORS[i] : "rgba(255,255,255,0.08)",
                                    boxShadow: current ? "0 0 0 2px #ffd23f" : undefined,
                                    opacity: reached ? 1 : 0.55,
                                  }}
                                >
                                  <span className="font-game block text-[9px] leading-relaxed" style={{ color: reached ? "#10102e" : "#ffffff" }}>
                                    {st.stage} {st.shortName}
                                  </span>
                                  <span className="font-pixel block text-[14px] leading-none" style={{ color: reached ? "#10102e" : "#ffffff" }}>
                                    {st.xp} XP
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                          <ScreenText className="mt-3 text-[19px]">
                            XP {mon.xp}{mon.nextStageXp ? ` / ${mon.nextStageXp}` : " · MAX STAGE!"}
                          </ScreenText>
                          <ScreenText className="text-[17px] opacity-85">
                            DIGESTED {mon.digestedCount} · SECRETS {view.secrets.length}/10
                          </ScreenText>
                          <div className="mt-1 flex-1 overflow-hidden">
                            {view.belly.length === 0 ? (
                              <ScreenText className="text-[17px] opacity-70">BELLY EMPTY — FEED A MEME.</ScreenText>
                            ) : (
                              view.belly.slice(0, 3).map((b) => (
                                <ScreenText key={b.id} className="truncate text-[17px]">
                                  🫃 {b.title.toUpperCase()} — {Math.max(0, b.digestInSec - elapsedServerSec)}s
                                </ScreenText>
                              ))
                            )}
                          </div>
                          <ScreenText className="pb-1 text-center text-[15px] opacity-75">TAP: PAGE {nav.statsPage + 1}/2 · 2×: MENU</ScreenText>
                        </div>
                      </>
                    )}
                  </div>
                ) : mode === "post" ? (
                  <div className="snes-dots flex h-full flex-col gap-2 p-[10px]" style={{ background: "linear-gradient(180deg,#23235e 0%,#10102e 100%)" }}>
                    <Banner title="POST" />
                    <div className="snes-window flex flex-1 flex-col px-2 py-2">
                      <ScreenText className="pt-1 text-center text-[16px] opacity-85">PASTE AN IMAGE URL IN TALK BOX, OR ADD BONUS:</ScreenText>
                      <div className="flex flex-1 flex-col justify-center">
                        {view.bonusMemes.map((b, i) => {
                          const sel = i === nav.post;
                          return (
                            <div key={b.key} className="flex min-h-[48px] items-center gap-1 px-1" style={{ background: sel ? "rgba(255,210,63,0.16)" : "transparent" }}>
                              <span className="flex w-[24px] shrink-0 items-center justify-center">{sel ? <Cursor /> : null}</span>
                              <img src={MEME_IMG[b.imageKey] ?? ""} alt="" className="pixelated h-[34px] w-[34px] shrink-0 border-[3px] border-[#0a0a24] object-cover" draggable={false} />
                              <span className={`font-game snes-text min-w-0 flex-1 truncate text-[12px] leading-relaxed ${sel ? "text-[#ffd23f]" : "text-white"}`}>{b.title.toUpperCase()}</span>
                              <span className="font-pixel shrink-0 text-[16px] text-[#ffd23f]">{b.added ? "✓ IN PACK" : "ADD"}</span>
                            </div>
                          );
                        })}
                      </div>
                      <ScreenText className="pb-1 text-center text-[15px] opacity-75">PACK: {view.memes.length} MEMES · HOLD: ADD · 2×: MENU</ScreenText>
                    </div>
                  </div>
                ) : mode === "settings" ? (
                  <div className="snes-dots flex h-full flex-col gap-2 p-[10px]" style={{ background: "linear-gradient(180deg,#23235e 0%,#10102e 100%)" }}>
                    <Banner title="SETTINGS" />
                    <div className="snes-window flex flex-1 flex-col px-2 py-2">
                      <div className="flex flex-1 flex-col justify-center">
                        {settingsRows.map((label, i) => (
                          <MenuRow key={label} selected={i === nav.settings} tall>
                            <span className="text-[12px]" style={i === 3 && resetArm ? { color: "#ff6b6b" } : undefined}>{label}</span>
                          </MenuRow>
                        ))}
                      </div>
                      <ScreenText className="pb-1 text-center text-[15px] opacity-75">TAP: NEXT · HOLD: CHANGE · 2×: MENU</ScreenText>
                    </div>
                  </div>
                ) : (
                  <div className="relative flex h-full flex-col px-1 pb-1 pt-1">
                    <SceneBg tod={tod} />
                    <div className="relative flex items-start justify-between gap-2">
                      <span className="snes-bar font-game max-w-[62%] truncate px-2 py-[5px] text-[11px] leading-none text-white">{mon.name.toUpperCase()}</span>
                      <span className="snes-bar font-pixel shrink-0 px-2 py-[3px] text-[16px] leading-none text-[#ffd23f]">STG {mon.stage} {mon.stageName.toUpperCase()}</span>
                    </div>
                    {mon.speech && (
                      <div className="absolute left-2 top-[48px] z-10 max-w-[78%] border-[3px] border-[#0a0a24] bg-white px-2 py-[5px]">
                        <p className="font-pixel text-[18px] leading-[1.05] text-[#191930]">“{mon.speech}”</p>
                        <span className="absolute -bottom-[9px] left-6 block h-[12px] w-[12px] rotate-45 border-b-[3px] border-r-[3px] border-[#0a0a24] bg-white" aria-hidden />
                      </div>
                    )}
                    <div className="relative flex min-h-0 flex-1 items-center justify-center py-0">
                      <div className={`aspect-square h-[118%] max-h-[118%] w-[118%] -my-[6%] ${animClass}`}>
                        <Monster stage={mon.displayStage} actualStage={mon.stage} mood={mood} equipped={view.equippedItems} />
                      </div>
                    </div>
                    <div className="relative mt-auto">
                      <ScreenText className="mb-[3px] text-center text-[14px] opacity-90">
                        {mon.nextStageXp ? `XP ${mon.xp}/${mon.nextStageXp} · TAP: FEED · 2×TAP: MENU` : `XP ${mon.xp} · MAX STAGE!`}
                        {mon.displayStage !== mon.stage ? ` · LOOK STG ${mon.displayStage}` : ""}
                      </ScreenText>
                      <div className="snes-bar grid grid-cols-2 gap-x-3 gap-y-[4px] px-3 py-[6px]">
                        <Pips label="Fullness" glyph="🍖" value={mon.fullness} />
                        <Pips label="Happiness" glyph="♥️" value={mon.happiness} />
                        <Pips label="Hygiene" glyph="🛁" value={mon.hygiene} />
                        <Pips label="Energy" glyph="⚡" value={mon.energy} />
                        <Pips label="Heat" glyph="🌶" value={mon.heat} heat />
                        <div className="flex items-center gap-[5px]">
                          <span className="w-[17px] text-[14px] leading-none">🫃</span>
                          <span className="font-pixel snes-text text-[18px] leading-none text-white">
                            {view.belly.length}/{mon.memeSlots} · 💧{mon.drip}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {feedFx && view && mon && (
              <div key={feedFx.id} className="pointer-events-none absolute inset-0 z-20" aria-hidden>
                <img src={feedFx.src} alt="" className="anim-feed-fly pixelated absolute left-[33%] top-[15%] h-[34%] w-[34%] border-[3px] border-[#0a0a24] object-cover" draggable={false} />
                <div className="absolute bottom-[1%] left-[23%] h-[54%] w-[54%]">
                  <Monster stage={mon.displayStage} actualStage={mon.stage} mood="eating" equipped={view.equippedItems} />
                </div>
              </div>
            )}
            {burst && <Burst kind={burst.kind} burstKey={burst.id} />}
            {screenMsg && mode !== "dodge" && mode !== "match" && (
              <div className="snes-window pointer-events-none absolute inset-x-2 bottom-2 z-20 px-3 py-2">
                <p className="font-pixel snes-text text-center text-[18px] leading-tight text-[#ffd23f]">{screenMsg}</p>
              </div>
            )}
            {evoFlash && view && mon && (
              <div className="anim-evo pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center px-3 text-center" style={{ background: "radial-gradient(circle at 50% 42%, #fff7cc 0%, #ffd23f 55%, #ff9d2e 100%)" }}>
                <p className="font-game text-[19px] leading-relaxed text-[#40260a]">★ EVOLVED! ★</p>
                <div className="relative mt-1 h-[66%] w-[66%]">
                  <div className="anim-evo-out absolute inset-0">
                    <Monster stage={evoFlash.from} actualStage={evoFlash.from} mood="happy" equipped={[]} />
                  </div>
                  <div className="anim-evo-in absolute inset-0">
                    <Monster stage={mon.stage} actualStage={mon.stage} mood="happy" equipped={view.equippedItems} />
                  </div>
                </div>
                <p className="font-game mt-1 text-[15px] leading-relaxed text-[#40260a]">{evoFlash.name.toUpperCase()}</p>
                <Burst kind="sparkles" burstKey={1} />
              </div>
            )}
            {flash > 0 && <div key={flash} className="anim-flash pointer-events-none absolute inset-0 z-30 bg-white" />}
            {holding && (
              <div className="pointer-events-none absolute bottom-2 right-2 z-30 h-[18px] w-[72px] border-[3px] border-[#0a0a24] bg-[#0a0a24]/60">
                <div className="h-full" style={{ width: `${Math.round(holdProgress * 100)}%`, background: "linear-gradient(180deg,#ffe066,#ffab2e)" }} />
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-col items-center">
            <button
              type="button"
              aria-label="The one button. Short press: next. Long press: select or confirm. Double press: back or open the menu."
              className="h-[76px] w-[76px] rounded-full border-b-[6px] border-[#a86a00] bg-[#ffb02e] shadow-[0_6px_18px_rgba(0,0,0,0.5)] transition-transform active:translate-y-[3px] active:border-b-[3px]"
              style={{ touchAction: "none", transform: holding ? "translateY(3px)" : undefined }}
              onPointerDown={(e) => {
                e.preventDefault();
                try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
                onPressStart();
              }}
              onPointerUp={onPressEnd}
              onPointerLeave={onPressCancel}
              onPointerCancel={onPressCancel}
              onContextMenu={(e) => e.preventDefault()}
            />
            <span className="font-pixel mt-2 text-[15px] tracking-widest text-[#8f9096]">PRESS · HOLD · 2×PRESS</span>
            <span className="mt-1 text-[10px] tracking-[0.3em] text-[#55565e]">— USB-C —</span>
          </div>
        </div>

        <section aria-label="Simulator controls" className="mt-6 w-full max-w-[448px]">
          {notice && (
            <p role="status" className="mb-3 border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]">
              {notice}
            </p>
          )}
          {pet.isError && (
            <p className="mb-3 border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-200">
              Couldn't reach the unified MemeAgotchi server.{" "}
              <button type="button" className="underline" onClick={() => pet.refetch()}>Retry</button>
            </p>
          )}

          <form onSubmit={onTalk} className="border border-[var(--border)] bg-[var(--surface)] p-3">
            <label htmlFor="talk" className="text-sm font-medium">
              🎙️ Talk to {mon?.name ?? "Mochi"} <span className="text-[var(--dim)]">(push-to-talk voice simulation)</span>
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="talk"
                value={talkText}
                onChange={(e) => setTalkText(e.target.value)}
                placeholder={mode === "post" ? "Paste an image URL to post it to the pack…" : 'Try "doge", "stonks", or "feed"'}
                className="min-w-0 flex-1 border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[16px] text-[var(--text)]"
              />
              <button type="submit" disabled={talkMut.isPending || urlMut.isPending || !talkText.trim()} className="shrink-0 bg-[#ffb02e] px-4 py-2 font-medium text-black disabled:opacity-40">
                Speak
              </button>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">
              Secret words: {SECRET_HINTS.join(" · ")}. Care words: feed, groom, play, sleep, wake.
              {view && view.secrets.length > 0 && ` Unlocked (${view.secrets.length}/10): ${view.secrets.map((s) => s.move).join(", ")}.`}
            </p>
          </form>

          {view && (
            <div className="mt-3 border border-[var(--border)] bg-[var(--surface)] p-3 text-sm">
              <h2 className="font-medium">Belly &amp; live event log</h2>
              {view.belly.length === 0 ? (
                <p className="mt-1 text-[var(--dim)]">Belly empty — feed a meme from MENU → FEED or the Companion App.</p>
              ) : (
                <ul className="mt-1 text-[var(--dim)]">
                  {view.belly.map((b) => (
                    <li key={b.id}>
                      🫃 {b.title} — digests in {Math.max(0, b.digestInSec - elapsedServerSec)}s (power {b.powerAtFed} → {b.powerNow})
                    </li>
                  ))}
                </ul>
              )}
              <ul className="mt-2 space-y-[2px] text-xs text-[var(--dim)]">
                {view.events.slice(0, 6).map((e) => (
                  <li key={e.id}>{e.text}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
