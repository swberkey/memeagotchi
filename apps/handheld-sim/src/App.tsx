import {
  MINI_GAMES_CATALOG,
  SPECIES_CATALOG,
  STAGES,
  type GameView,
  type Label,
  type MiniGameId,
  type Mood,
  type SpeciesId,
} from "@memeagotchi/game-core";
import { CosmeticBadge, DreamScreensaver, StarterEgg, type DreamSlide } from "@memeagotchi/monster-ui";
import {
  SnesArcadeCanvas,
  createGamepadController,
  type GamepadButton,
} from "@memeagotchi/snes-games";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent } from "react";
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
  | "title"
  | "hatch"
  | "pet"
  | "menu"
  | "feed"
  | "care"
  | "games"
  | "play_game"
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
  { id: "games", label: "ARCADE", glyph: "🎮" },
  { id: "shop", label: "SHOP", glyph: "🛍️" },
  { id: "bag", label: "BAG", glyph: "🎒" },
  { id: "stats", label: "STATS", glyph: "📊" },
  { id: "post", label: "POST", glyph: "📮" },
  { id: "settings", label: "CONFIG", glyph: "⚙️" },
  { id: "sleep", label: "SLEEP", glyph: "💤" },
  { id: "title", label: "TITLE", glyph: "🏠" },
];

const CARE: { id: CareAction; label: string; glyph: string }[] = [
  { id: "feed", label: "FEED KIBBLE", glyph: "🍖" },
  { id: "groom", label: "GROOM", glyph: "🛁" },
  { id: "play", label: "CARE PLAY", glyph: "🎾" },
  { id: "sleep", label: "TUCK IN / SLEEP", glyph: "💤" },
];

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

function Pips({
  label,
  glyph,
  value,
  cap = 100,
  heat,
}: {
  label: string;
  glyph: string;
  value: number;
  cap?: number;
  heat?: boolean;
}) {
  const filled = Math.max(0, Math.min(5, Math.round((value / Math.max(1, cap)) * 5)));
  const color = STAT_COLORS[label] ?? "#57e65c";
  return (
    <div className="flex items-center gap-[4px]" aria-label={`${label} ${value} of ${cap}`}>
      <span className="w-[15px] text-[12px] leading-none">{glyph}</span>
      <span className="flex gap-[2px]">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="inline-block h-[11px] w-[9px] transition-colors duration-300"
            style={{
              background: i < filled ? (heat && filled >= 4 ? "#ff4747" : color) : "rgba(255,255,255,0.14)",
              border: "1.5px solid #0a0a24",
              boxShadow: i < filled ? "inset 0 2px 0 rgba(255,255,255,0.4)" : undefined,
            }}
          />
        ))}
      </span>
    </div>
  );
}

function StatRow({
  label,
  glyph,
  value,
  cap = 100,
  heat,
}: {
  label: string;
  glyph: string;
  value: number;
  cap?: number;
  heat?: boolean;
}) {
  const filled = Math.max(0, Math.min(10, Math.round((value / Math.max(1, cap)) * 10)));
  const color = heat && value >= cap * 0.75 ? "#ff4747" : (STAT_COLORS[label] ?? "#57e65c");
  return (
    <div className="flex items-center gap-2" aria-label={`${label} ${value} of ${cap}`}>
      <span className="w-[16px] text-[13px] leading-none">{glyph}</span>
      <span className="font-game snes-text w-[86px] text-[9px] leading-none text-white">{label}</span>
      <span className="flex flex-1 gap-[2px]">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
          <span
            key={i}
            className="inline-block h-[11px] flex-1 transition-colors duration-300"
            style={{
              background: i < filled ? color : "rgba(255,255,255,0.13)",
              border: "1.5px solid #0a0a24",
              boxShadow: i < filled ? "inset 0 2px 0 rgba(255,255,255,0.4)" : undefined,
            }}
          />
        ))}
      </span>
      <span className="font-pixel snes-text w-[42px] text-right text-[17px] leading-none text-white">
        {value}{cap > 100 ? `/${cap}` : ""}
      </span>
    </div>
  );
}

function ScreenText({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`font-pixel snes-text leading-none text-white ${className}`}>{children}</p>;
}

function Cursor() {
  return (
    <svg className="anim-cursor block shrink-0" width="15" height="12" viewBox="0 0 19 15" aria-hidden>
      <polygon points="2,1.5 17,7.5 2,13.5 6,7.5" fill="#ffd23f" stroke="#0a0a24" strokeWidth="2.4" strokeLinejoin="round" />
    </svg>
  );
}

function MenuRow({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex min-h-0 flex-1 items-center gap-1 px-1.5 py-[2px] ${onClick ? "cursor-pointer" : ""}`}
      style={{ background: selected ? "rgba(255,210,63,0.18)" : "transparent" }}
    >
      <span className="flex w-[18px] shrink-0 items-center justify-center">{selected ? <Cursor /> : null}</span>
      <div className={`font-game snes-text flex min-w-0 flex-1 items-center gap-1.5 text-[11px] leading-snug ${selected ? "text-[#ffd23f]" : "text-white"}`}>
        {children}
      </div>
    </div>
  );
}

function Banner({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="snes-banner flex items-center justify-between px-2.5 py-[6px]">
      <span className="font-game flex items-center gap-1.5 text-[11px] leading-none">
        <span aria-hidden className="text-[8px]">◆</span>
        {title}
        <span aria-hidden className="text-[8px]">◆</span>
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
          <span key={i} className="anim-twinkle absolute block h-[3px] w-[3px] bg-white" style={{ left: s.l, top: s.t, animationDelay: s.d }} />
        ))}
      {tod === "day" && (
        <div
          className="absolute right-[9%] top-[9%] h-[28px] w-[28px] bg-[#ffd23f]"
          style={{ boxShadow: "0 0 0 4px rgba(255,210,63,0.35), 0 0 28px 8px rgba(255,210,63,0.45)" }}
        />
      )}
      {tod !== "day" && (
        <div className="absolute right-[10%] top-[9%] h-[26px] w-[26px] rounded-full" style={{ boxShadow: "inset -9px 3px 0 0 #f6f2da" }} />
      )}
      {tod !== "night" && (
        <>
          <div className="anim-cloud absolute left-[8%] top-[14%] h-[10px] w-[40px] bg-white/90" style={{ boxShadow: "12px -6px 0 0 rgba(255,255,255,0.9), 26px 0 0 0 rgba(255,255,255,0.9)" }} />
          <div className="anim-cloud2 absolute right-[15%] top-[25%] h-[9px] w-[32px] bg-white/70" style={{ boxShadow: "10px -6px 0 0 rgba(255,255,255,0.7), 22px 0 0 0 rgba(255,255,255,0.7)" }} />
        </>
      )}
      <div className="absolute inset-x-[-10%] bottom-[13%] h-[14%] rounded-[100%] opacity-70" style={{ background: groundDark }} />
      <div
        className="absolute inset-x-0 bottom-0 h-[16%] border-t-[3px] border-[#0a0a24]/40"
        style={{ background: `repeating-conic-gradient(${ground} 0% 25%, ${groundDark} 0% 50%)`, backgroundSize: "16px 16px" }}
      />
    </div>
  );
}

function windowStart(idx: number, total: number, size: number): number {
  if (total <= size) return 0;
  return Math.min(Math.max(idx - size + 1, 0), total - size);
}

interface Nav {
  title: number;
  hatchSpecies: number;
  menu: number;
  care: number;
  shop: number;
  bag: number;
  games: number;
  post: number;
  settings: number;
  label: number;
  meme: number;
  statsPage: number;
}

const NAV_FRESH: Nav = {
  title: 0,
  hatchSpecies: 0,
  menu: 0,
  care: 0,
  shop: 0,
  bag: 0,
  games: 0,
  post: 0,
  settings: 0,
  label: 0,
  meme: 0,
  statsPage: 0,
};

const BURST_SPOTS: { dx: string; dy: string; delay: string; size: number }[] = [
  { dx: "-52px", dy: "-60px", delay: "0s", size: 19 },
  { dx: "42px", dy: "-68px", delay: "0.05s", size: 21 },
  { dx: "-74px", dy: "-20px", delay: "0.1s", size: 17 },
  { dx: "72px", dy: "-26px", delay: "0.02s", size: 18 },
  { dx: "-26px", dy: "-86px", delay: "0.08s", size: 16 },
  { dx: "22px", dy: "-88px", delay: "0.12s", size: 20 },
];

function Burst({ kind, burstKey }: { kind: "hearts" | "sparkles"; burstKey: number }) {
  const glyphs = kind === "hearts" ? ["💗", "💖", "💗", "💕"] : ["✨", "⭐", "✨", "💫"];
  return (
    <div key={burstKey} className="pointer-events-none absolute inset-0 z-20" aria-hidden>
      {BURST_SPOTS.map((s, i) => (
        <span
          key={i}
          className="anim-particle absolute"
          style={{ left: "50%", top: "42%", fontSize: s.size, animationDelay: s.delay, ["--dx" as string]: s.dx, ["--dy" as string]: s.dy }}
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

  const gameController = useMemo(() => createGamepadController(), []);
  const [hwPressed, setHwPressed] = useState<Readonly<Record<GamepadButton, boolean>>>(() => ({
    ...gameController.pressed,
  }));
  useEffect(() => gameController.subscribeState(setHwPressed), [gameController]);

  const [mode, setMode] = useState<Mode>("pet");
  const [initRouted, setInitRouted] = useState(false);
  const [activeGame, setActiveGame] = useState<MiniGameId>("runner");
  const [nav, setNav] = useState<Nav>(NAV_FRESH);
  const [eatingUntil, setEatingUntil] = useState(0);
  const [evoFlash, setEvoFlash] = useState<{ name: string; from: number } | null>(null);
  const [burst, setBurst] = useState<{ id: number; kind: "hearts" | "sparkles" } | null>(null);
  const [feedFx, setFeedFx] = useState<{ id: number; src: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [screenMsg, setScreenMsg] = useState("");
  const [gameMsg, setGameMsg] = useState("");
  const [talkText, setTalkText] = useState("");
  const [pttActive, setPttActive] = useState(false);
  const [feedFullscreen, setFeedFullscreen] = useState(false);
  const [sleepStandby, setSleepStandby] = useState(false);
  const [sensorWakeBadge, setSensorWakeBadge] = useState<string | null>(null);
  const [dreamSlideIdx, setDreamSlideIdx] = useState<number | undefined>(undefined);
  const [resetArm, setResetArm] = useState(false);
  const [flash, setFlash] = useState(0);
  const [tickNow, setTickNow] = useState(() => Date.now());

  const talkInputRef = useRef<HTMLInputElement | null>(null);
  const prevStage = useRef<number | null>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const feedFullscreenRef = useRef(feedFullscreen);
  feedFullscreenRef.current = feedFullscreen;
  const sleepStandbyRef = useRef(sleepStandby);
  sleepStandbyRef.current = sleepStandby;
  const navRef = useRef(nav);
  navRef.current = nav;
  const viewRef = useRef(view);
  viewRef.current = view;
  const screenMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sensorBadgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetArmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pttHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pttFiredRef = useRef(false);

  // Route unhatched state automatically to Title Screen
  useEffect(() => {
    if (!view) return;
    if (!initRouted) {
      setInitRouted(true);
      if (!view.hatched) setMode("title");
    } else if (!view.hatched && modeRef.current !== "title" && modeRef.current !== "hatch" && modeRef.current !== "settings") {
      setMode("title");
    }
  }, [view, initRouted]);

  useEffect(() => {
    const iv = setInterval(() => setTickNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const patchNav = useCallback((p: Partial<Nav>) => {
    const next = { ...navRef.current, ...p };
    navRef.current = next;
    setNav(next);
  }, []);

  useEffect(() => {
    if (mode !== "settings" && resetArm) {
      setResetArm(false);
      if (resetArmTimer.current) clearTimeout(resetArmTimer.current);
    }
    if (mode !== "feed" && feedFullscreen) {
      setFeedFullscreen(false);
    }
  }, [mode, resetArm, feedFullscreen]);

  useEffect(() => {
    if (!mon?.isSleeping) {
      setSleepStandby(false);
      setDreamSlideIdx(undefined);
    }
  }, [mon?.isSleeping]);

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

  useEffect(() => {
    return () => {
      if (screenMsgTimer.current) clearTimeout(screenMsgTimer.current);
      if (sensorBadgeTimer.current) clearTimeout(sensorBadgeTimer.current);
      if (resetArmTimer.current) clearTimeout(resetArmTimer.current);
      if (pttHoldTimer.current) clearTimeout(pttHoldTimer.current);
    };
  }, []);

  const flashSensorBadge = useCallback((badge: string) => {
    setSensorWakeBadge(badge);
    if (sensorBadgeTimer.current) clearTimeout(sensorBadgeTimer.current);
    sensorBadgeTimer.current = setTimeout(() => setSensorWakeBadge(null), 3200);
  }, []);

  const showScreenMsg = useCallback((text: string) => {
    setScreenMsg(text);
    if (screenMsgTimer.current) clearTimeout(screenMsgTimer.current);
    screenMsgTimer.current = setTimeout(() => setScreenMsg(""), 2800);
  }, []);

  // Handheld UI Audio bleeps
  const audioRef = useRef<AudioContext | null>(null);
  const soundOnRef = useRef(true);
  useEffect(() => {
    soundOnRef.current = view?.settings.soundOn ?? true;
  }, [view?.settings.soundOn]);

  const bleep = useCallback((freq: number, dur = 0.055, delay = 0, type: OscillatorType = "square") => {
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
      gain.gain.setValueAtTime(0.032, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch {
      /* silent */
    }
  }, []);
  const blipOk = useCallback(() => { bleep(660, 0.05); bleep(990, 0.07, 0.055); }, [bleep]);
  const blipBad = useCallback(() => { bleep(170, 0.15, 0, "sawtooth"); }, [bleep]);
  const blipNav = useCallback(() => { bleep(860, 0.035); }, [bleep]);

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

  const hatchMut = useMutation({
    mutationFn: (args: { species: SpeciesId; name: string }) => api.hatchStarter(args),
    onSuccess: (r) => {
      applyResult(r);
      if (r.ok) {
        setBurst({ id: Date.now(), kind: "sparkles" });
        setMode("pet");
        prevStage.current = 1;
        blipOk();
      } else {
        showScreenMsg(r.message);
        blipBad();
      }
    },
  });
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
    mutationFn: (args: { game: MiniGameId; score: number; maxCombo: number }) => api.completeMiniGame(args),
    onSuccess: (r) => { applyResult(r); setGameMsg(r.message); if (r.ok) blipOk(); else blipBad(); },
  });
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
      setMode("title");
      setNav(NAV_FRESH);
      setResetArm(false);
      prevStage.current = 1;
      blipOk();
    },
  });

  const busy = careMut.isPending || feedMut.isPending || hatchMut.isPending;

  const gameBlock = useCallback((): string | null => {
    const m = viewRef.current?.monster;
    if (!m) return "LOADING…";
    if (m.isSleeping) return "ASLEEP — PRESS O TO WAKE";
    if (m.fullness === 0) return "HANGRY — FEED FIRST";
    if (m.happiness < 30) return "HAPPINESS <30 — CARE PLAY FIRST";
    if (m.energy < 10) return "TOO TIRED — ENERGY <10";
    return null;
  }, []);

  // Unified D-Pad + O / X / -- Handler for non-game handheld screens
  const handleUiButton = useCallback(
    (btn: GamepadButton) => {
      const v = viewRef.current;
      if (!v || busy) return;
      const n = navRef.current;
      const curMode = modeRef.current;

      // Sleeping pet: standby wakes into Dream Screensaver on any press; active Dream Saver browses with ◄► and wakes pet on O or --
      if (v.monster.isSleeping && curMode === "pet") {
        if (sleepStandbyRef.current) {
          setSleepStandby(false);
          flashSensorBadge("📳 MOTION WAKE");
          blipNav();
          return;
        }
        if (btn === "left" || btn === "right") {
          const total = Math.max(1, v.dreamMemes.length > 0 ? v.dreamMemes.length : Math.min(4, v.memes.length));
          setDreamSlideIdx((prev) => {
            const cur = prev ?? 0;
            return (cur + (btn === "right" ? 1 : total - 1)) % total;
          });
          blipNav();
          return;
        }
        if (btn === "o" || btn === "menu") {
          careMut.mutate("sleep");
          blipOk();
        }
        return;
      }

      if (curMode === "title") {
        const optionCount = v.hatched ? 3 : 2;
        if (btn === "up" || btn === "left") {
          blipNav();
          patchNav({ title: (n.title + optionCount - 1) % optionCount });
        } else if (btn === "down" || btn === "right") {
          blipNav();
          patchNav({ title: (n.title + 1) % optionCount });
        } else if (btn === "o") {
          setFlash(Date.now());
          blipOk();
          if (v.hatched) {
            if (n.title === 0) setMode("pet");
            else if (n.title === 1) {
              const curIdx = SPECIES_CATALOG.findIndex((s) => s.id === v.monster.species);
              patchNav({ hatchSpecies: Math.max(0, curIdx) });
              setMode("hatch");
            } else setMode("settings");
          } else {
            if (n.title === 0) setMode("hatch");
            else setMode("settings");
          }
        }
        return;
      }

      if (curMode === "hatch") {
        const total = SPECIES_CATALOG.length;
        if (btn === "left" || btn === "up") {
          blipNav();
          patchNav({ hatchSpecies: (n.hatchSpecies + total - 1) % total });
        } else if (btn === "right" || btn === "down") {
          blipNav();
          patchNav({ hatchSpecies: (n.hatchSpecies + 1) % total });
        } else if (btn === "x" || btn === "menu") {
          blipNav();
          setMode("title");
        } else if (btn === "o") {
          const sp = SPECIES_CATALOG[n.hatchSpecies % total]!;
          setFlash(Date.now());
          hatchMut.mutate({ species: sp.id, name: sp.defaultPetName });
        }
        return;
      }

      if (curMode === "pet") {
        if (btn === "o") {
          blipNav();
          setMode("feed");
        } else if (btn === "menu" || btn === "x") {
          blipNav();
          setMode("menu");
        } else if (btn === "right") {
          blipNav();
          setMode("games");
        } else if (btn === "left") {
          blipNav();
          setMode("care");
        } else if (btn === "up") {
          blipNav();
          setMode("stats");
        } else if (btn === "down") {
          blipNav();
          setMode("shop");
        }
        return;
      }

      if (curMode === "menu") {
        // 2-column × 5-row grid navigation
        const total = MENU.length;
        if (btn === "up") {
          blipNav();
          patchNav({ menu: (n.menu + total - 2) % total });
        } else if (btn === "down") {
          blipNav();
          patchNav({ menu: (n.menu + 2) % total });
        } else if (btn === "left") {
          blipNav();
          patchNav({ menu: (n.menu + total - 1) % total });
        } else if (btn === "right") {
          blipNav();
          patchNav({ menu: (n.menu + 1) % total });
        } else if (btn === "x" || btn === "menu") {
          blipNav();
          setMode("pet");
        } else if (btn === "o") {
          const item = MENU[n.menu];
          if (!item) return;
          setFlash(Date.now());
          blipOk();
          if (item.id === "sleep") {
            careMut.mutate("sleep");
            setMode("pet");
          } else {
            if (item.id === "stats") patchNav({ statsPage: 0 });
            if (item.id === "bag") patchNav({ bag: 0 });
            if (item.id === "title") patchNav({ title: 0 });
            setMode(item.id);
          }
        }
        return;
      }

      if (curMode === "feed") {
        const memeLen = Math.max(1, v.memes.length);
        if (btn === "up") {
          blipNav();
          setFeedFullscreen((f) => !f);
          return;
        }
        if (feedFullscreenRef.current) {
          if (btn === "left") {
            blipNav();
            patchNav({ meme: (n.meme + memeLen - 1) % memeLen });
          } else if (btn === "right") {
            blipNav();
            patchNav({ meme: (n.meme + 1) % memeLen });
          } else if (btn === "down") {
            blipNav();
            patchNav({ label: (n.label + 1) % LABELS.length });
          } else if (btn === "o") {
            const meme = v.memes[n.meme % memeLen];
            const label = LABELS[n.label % LABELS.length];
            if (meme && label) {
              setFlash(Date.now());
              feedMut.mutate({ memeKey: meme.key, label });
            }
          } else if (btn === "x") {
            blipNav();
            setFeedFullscreen(false);
          } else if (btn === "menu") {
            blipNav();
            setFeedFullscreen(false);
            setMode("menu");
          }
          return;
        }
        if (btn === "left") {
          blipNav();
          patchNav({ label: (n.label + LABELS.length - 1) % LABELS.length });
        } else if (btn === "right") {
          blipNav();
          patchNav({ label: (n.label + 1) % LABELS.length });
        } else if (btn === "down") {
          blipNav();
          patchNav({ meme: (n.meme + 1) % memeLen });
        } else if (btn === "o") {
          const meme = v.memes[n.meme % memeLen];
          const label = LABELS[n.label % LABELS.length];
          if (meme && label) {
            setFlash(Date.now());
            feedMut.mutate({ memeKey: meme.key, label });
          }
        } else if (btn === "x") {
          blipNav();
          setMode("pet");
        } else if (btn === "menu") {
          blipNav();
          setMode("menu");
        }
        return;
      }

      if (curMode === "care") {
        if (btn === "up" || btn === "left") {
          blipNav();
          patchNav({ care: (n.care + CARE.length - 1) % CARE.length });
        } else if (btn === "down" || btn === "right") {
          blipNav();
          patchNav({ care: (n.care + 1) % CARE.length });
        } else if (btn === "o") {
          const item = CARE[n.care];
          if (item) {
            setFlash(Date.now());
            careMut.mutate(item.id);
            setMode("pet");
          }
        } else if (btn === "x" || btn === "menu") {
          blipNav();
          setMode("menu");
        }
        return;
      }

      if (curMode === "games") {
        const total = MINI_GAMES_CATALOG.length;
        if (btn === "up" || btn === "left") {
          blipNav();
          patchNav({ games: (n.games + total - 1) % total });
        } else if (btn === "down" || btn === "right") {
          blipNav();
          patchNav({ games: (n.games + 1) % total });
        } else if (btn === "o") {
          const g = MINI_GAMES_CATALOG[n.games % total];
          if (!g) return;
          const block = gameBlock();
          if (block) {
            showScreenMsg(block);
            blipBad();
            return;
          }
          setFlash(Date.now());
          setGameMsg("");
          setActiveGame(g.id);
          setMode("play_game");
          blipOk();
        } else if (btn === "x" || btn === "menu") {
          blipNav();
          setMode("menu");
        }
        return;
      }

      if (curMode === "shop") {
        const len = Math.max(1, v.cosmetics.length);
        if (btn === "up" || btn === "left") {
          blipNav();
          patchNav({ shop: (n.shop + len - 1) % len });
        } else if (btn === "down" || btn === "right") {
          blipNav();
          patchNav({ shop: (n.shop + 1) % len });
        } else if (btn === "o") {
          const item = v.cosmetics[n.shop % len];
          if (item) buyMut.mutate(item.id);
        } else if (btn === "x" || btn === "menu") {
          blipNav();
          setMode("menu");
        }
        return;
      }

      if (curMode === "bag") {
        const owned = v.cosmetics.filter((c) => c.owned);
        if (btn === "up" || btn === "left") {
          if (owned.length) {
            blipNav();
            patchNav({ bag: (n.bag + owned.length - 1) % owned.length });
          }
        } else if (btn === "down" || btn === "right") {
          if (owned.length) {
            blipNav();
            patchNav({ bag: (n.bag + 1) % owned.length });
          }
        } else if (btn === "o") {
          const item = owned[n.bag % Math.max(1, owned.length)];
          if (item) equipMut.mutate(item.id);
        } else if (btn === "x" || btn === "menu") {
          blipNav();
          setMode("menu");
        }
        return;
      }

      if (curMode === "stats") {
        if (btn === "left") {
          blipNav();
          patchNav({ statsPage: (n.statsPage + 2) % 3 });
        } else if (btn === "right" || btn === "o") {
          blipNav();
          patchNav({ statsPage: (n.statsPage + 1) % 3 });
        } else if (btn === "x" || btn === "menu") {
          blipNav();
          setMode("menu");
        }
        return;
      }

      if (curMode === "post") {
        const len = Math.max(1, v.bonusMemes.length);
        if (btn === "up" || btn === "left") {
          blipNav();
          patchNav({ post: (n.post + len - 1) % len });
        } else if (btn === "down" || btn === "right") {
          blipNav();
          patchNav({ post: (n.post + 1) % len });
        } else if (btn === "o") {
          const bonus = v.bonusMemes[n.post % len];
          if (bonus) bonusMut.mutate(bonus.key);
        } else if (btn === "x" || btn === "menu") {
          blipNav();
          setMode("menu");
        }
        return;
      }

      if (curMode === "settings") {
        if (btn === "up" || btn === "left") {
          blipNav();
          patchNav({ settings: (n.settings + SETTINGS_COUNT - 1) % SETTINGS_COUNT });
        } else if (btn === "down" || btn === "right") {
          blipNav();
          patchNav({ settings: (n.settings + 1) % SETTINGS_COUNT });
        } else if (btn === "x" || btn === "menu") {
          blipNav();
          setMode(v.hatched ? "menu" : "title");
        } else if (btn === "o") {
          if (n.settings === 0) {
            settingsMut.mutate({ clock: v.settings.clock === 1 ? 60 : 1 });
          } else if (n.settings === 1) {
            settingsMut.mutate({ soundOn: !v.settings.soundOn });
          } else if (n.settings === 2) {
            if (v.monster.stage < 3) {
              showScreenMsg("🔒 NOSTALGIA UNLOCKS AT STAGE 3");
              blipBad();
            } else {
              stageMut.mutate((v.monster.displayStage % v.monster.stage) + 1);
            }
          } else if (n.settings === 3) {
            if (!resetArm) {
              setResetArm(true);
              showScreenMsg("⚠ PRESS O AGAIN TO RESET PET");
              blipBad();
              if (resetArmTimer.current) clearTimeout(resetArmTimer.current);
              resetArmTimer.current = setTimeout(() => setResetArm(false), 4000);
            } else {
              if (resetArmTimer.current) clearTimeout(resetArmTimer.current);
              resetMut.mutate();
            }
          }
        }
      }
    },
    [
      busy,
      blipNav,
      blipOk,
      blipBad,
      patchNav,
      careMut,
      hatchMut,
      feedMut,
      buyMut,
      equipMut,
      bonusMut,
      settingsMut,
      stageMut,
      resetMut,
      gameBlock,
      showScreenMsg,
      flashSensorBadge,
      resetArm,
    ],
  );

  // Route physical hardware buttons either into SnesArcadeCanvas or into handheld UI
  const pressHardwareButton = useCallback(
    (btn: GamepadButton) => {
      if (modeRef.current === "play_game") {
        gameController.press(btn);
        return;
      }
      if (btn === "menu") {
        pttFiredRef.current = false;
        if (pttHoldTimer.current) clearTimeout(pttHoldTimer.current);
        pttHoldTimer.current = setTimeout(() => {
          pttFiredRef.current = true;
          setPttActive(true);
          showScreenMsg("🎙️ VOICE PTT READY — TYPE OR SPEAK BELOW");
          blipOk();
          talkInputRef.current?.focus();
          setTimeout(() => setPttActive(false), 1800);
        }, 450);
        return;
      }
      handleUiButton(btn);
    },
    [gameController, handleUiButton, showScreenMsg, blipOk],
  );

  const releaseHardwareButton = useCallback(
    (btn: GamepadButton) => {
      if (modeRef.current === "play_game") {
        gameController.release(btn);
        return;
      }
      if (btn === "menu") {
        if (pttHoldTimer.current) {
          clearTimeout(pttHoldTimer.current);
          pttHoldTimer.current = null;
        }
        if (!pttFiredRef.current) {
          handleUiButton("menu");
        }
      }
    },
    [gameController, handleUiButton],
  );

  // Keyboard bindings for handheld UI screens (SnesArcadeCanvas handles keyboard during play_game)
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (modeRef.current === "play_game") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.repeat) return;
      let btn: GamepadButton | null = null;
      if (e.code === "ArrowUp" || e.code === "KeyW") btn = "up";
      else if (e.code === "ArrowDown" || e.code === "KeyS") btn = "down";
      else if (e.code === "ArrowLeft" || e.code === "KeyA") btn = "left";
      else if (e.code === "ArrowRight" || e.code === "KeyD") btn = "right";
      else if (e.code === "Space" || e.code === "Enter" || e.code === "KeyZ") btn = "o";
      else if (e.code === "KeyX" || e.code === "Backspace") btn = "x";
      else if (e.code === "Escape" || e.code === "KeyP" || e.code === "KeyM") btn = "menu";
      if (!btn) return;
      e.preventDefault();
      handleUiButton(btn);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleUiButton]);

  const bindHw = (btn: GamepadButton) => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      pressHardwareButton(btn);
    },
    onPointerUp: (e: PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      releaseHardwareButton(btn);
    },
    onPointerCancel: () => releaseHardwareButton(btn),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

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
  const memeSrc = currentMeme
    ? (currentMeme.imageUrl ?? (currentMeme.imageKey ? MEME_IMG[currentMeme.imageKey] : undefined) ?? MEME_IMG[currentMeme.key] ?? "")
    : "";
  const currentLabel = LABELS[nav.label % LABELS.length] ?? "tasty";
  const ownedItems = view?.cosmetics.filter((c) => c.owned) ?? [];
  const elapsedServerSec = view ? Math.max(0, Math.floor((tickNow - view.serverNow) / 1000)) : 0;
  const selectedStarter = SPECIES_CATALOG[nav.hatchSpecies % SPECIES_CATALOG.length] ?? SPECIES_CATALOG[0]!;

  const settingsRows =
    view && mon
      ? [
          `CLOCK: ${view.settings.clock === 1 ? "REAL-TIME 1×" : "DEMO 60×"}`,
          `SOUND: ${view.settings.soundOn ? "ON 🔊" : "OFF 🔇"}`,
          mon.stage >= 3 ? `LOOK: STG ${mon.displayStage} ${mon.displayStageName.toUpperCase()}` : "LOOK: 🔒 STAGE 3",
          resetArm ? "RESET PET — PRESS O!" : "RESET PET → NEW STARTER",
        ]
      : [];

  const hourNow = new Date().getHours();
  const tod: Tod = hourNow >= 7 && hourNow < 17 ? "day" : hourNow >= 17 && hourNow < 21 ? "evening" : "night";
  const screenKey = mon ? `${mode}-${mon.isSleeping ? "zzz" : "awake"}` : "boot";

  const hasFedMemes = (view?.dreamMemes.length ?? 0) > 0;
  const dreamSlides: DreamSlide[] = useMemo(() => {
    if (!view) return [];
    const source = view.dreamMemes.length > 0 ? view.dreamMemes : view.memes.slice(0, 4);
    return source.map((m) => {
      const key = "memeKey" in m ? m.memeKey : m.key;
      const src = m.imageUrl ?? (m.imageKey ? MEME_IMG[m.imageKey] : undefined) ?? MEME_IMG[key] ?? null;
      return {
        id: "memeId" in m ? m.memeId : m.id,
        title: m.title,
        emoji: m.emoji,
        bg: m.bg,
        src,
      };
    });
  }, [view]);

  const triggerAmbientSensor = useCallback(
    (kind: "light" | "sound" | "motion") => {
      const badge =
        kind === "light"
          ? "☀️ LIGHT WAKE"
          : kind === "sound"
            ? "🎙️ SOUND WAKE"
            : "📳 MOTION WAKE";
      if (!viewRef.current?.monster.isSleeping) {
        setMode("pet");
        careMut.mutate("sleep");
      } else {
        setMode("pet");
      }
      setSleepStandby(false);
      flashSensorBadge(badge);
      blipOk();
    },
    [careMut, flashSensorBadge, blipOk],
  );

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <main className="mx-auto flex max-w-[880px] flex-col items-center px-3 pb-10 pt-4">
        {/* Top nav bar */}
        <div className="mb-2 flex w-full max-w-[800px] items-center justify-between text-xs">
          <a
            href={COMPANION_URL}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 font-bold text-[#7be6d8] hover:brightness-110"
          >
            ← Companion App
          </a>
          <span className="text-[var(--dim)]">1.69" ST7789V2 · 280×240 IPS · Live Synced</span>
        </div>

        <h1 className="font-game text-center text-[17px] sm:text-[19px] leading-relaxed text-[#ffd23f]" style={{ textShadow: "3px 3px 0 rgba(0,0,0,0.5)" }}>
          MEMEAGOTCHI-280
          <span className="font-pixel mt-0.5 block text-[17px] tracking-widest text-[var(--dim)]" style={{ textShadow: "none" }}>
            ESP32-S3 LANDSCAPE HANDHELD · 280×240 · 262K COLOR IPS
          </span>
        </h1>

        {/* Landscape Micro-Console Shell */}
        <div
          className="mt-3 w-full max-w-[820px] rounded-[42px] border-2 border-black/70 px-4 py-4 sm:px-6 sm:py-5 shadow-[0_22px_60px_rgba(0,0,0,0.6),inset_0_2px_0_rgba(255,255,255,0.1)]"
          style={{ background: "linear-gradient(165deg, #2a283d 0%, #1d1c2b 65%, #161522 100%)" }}
        >
          {/* Hardware top bezel markings */}
          <div className="mb-3 flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  pttActive ? "bg-rose-400 shadow-[0_0_10px_#fb7185]" : "bg-[#7be6d8] shadow-[0_0_8px_#7be6d8]"
                }`}
                aria-hidden
              />
              <span className="font-pixel text-[14px] tracking-widest text-[#9d9bb0]">
                MEMEAGOTCHI-280 · ST7789V2 280×240 · {pttActive ? "🎙️ MIC PTT" : "WIFI SYNC"}
              </span>
            </div>
            <span className="flex gap-1.5" aria-hidden>
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className="h-[5px] w-[5px] rounded-full bg-black/60 shadow-inner" />
              ))}
            </span>
          </div>

          {/* 3-Column Landscape Console Body */}
          <div className="grid grid-cols-1 md:grid-cols-[136px_1fr_144px] items-center gap-4">
            {/* LEFT WING: 4-Way Tactile D-Pad */}
            <div className="order-2 md:order-1 flex md:flex-col items-center justify-around md:justify-center gap-3">
              <div className="grid grid-cols-3 grid-rows-3 gap-[3px]" role="group" aria-label="4-Way D-Pad">
                <div />
                <button
                  type="button"
                  aria-label="D-Pad Up"
                  {...bindHw("up")}
                  className={`h-10 w-10 rounded-t-lg border-2 border-[#090814] font-bold text-sm flex items-center justify-center shadow-md ${
                    hwPressed.up ? "bg-[#7be6d8] text-[#141026] translate-y-[1px]" : "bg-[#34314a] text-white hover:bg-[#403c5a]"
                  }`}
                >
                  ▲
                </button>
                <div />
                <button
                  type="button"
                  aria-label="D-Pad Left"
                  {...bindHw("left")}
                  className={`h-10 w-10 rounded-l-lg border-2 border-[#090814] font-bold text-sm flex items-center justify-center shadow-md ${
                    hwPressed.left ? "bg-[#7be6d8] text-[#141026] translate-y-[1px]" : "bg-[#34314a] text-white hover:bg-[#403c5a]"
                  }`}
                >
                  ◄
                </button>
                <div className="h-10 w-10 bg-[#27243a] border border-[#090814]/50 flex items-center justify-center">
                  <span className="h-3 w-3 rounded-full bg-[#181626] shadow-inner" />
                </div>
                <button
                  type="button"
                  aria-label="D-Pad Right"
                  {...bindHw("right")}
                  className={`h-10 w-10 rounded-r-lg border-2 border-[#090814] font-bold text-sm flex items-center justify-center shadow-md ${
                    hwPressed.right ? "bg-[#7be6d8] text-[#141026] translate-y-[1px]" : "bg-[#34314a] text-white hover:bg-[#403c5a]"
                  }`}
                >
                  ►
                </button>
                <div />
                <button
                  type="button"
                  aria-label="D-Pad Down"
                  {...bindHw("down")}
                  className={`h-10 w-10 rounded-b-lg border-2 border-[#090814] font-bold text-sm flex items-center justify-center shadow-md ${
                    hwPressed.down ? "bg-[#7be6d8] text-[#141026] translate-y-[1px]" : "bg-[#34314a] text-white hover:bg-[#403c5a]"
                  }`}
                >
                  ▼
                </button>
                <div />
              </div>
              <span className="font-pixel text-[13px] tracking-widest text-[#8f8da3] hidden md:block">D-PAD</span>
            </div>

            {/* CENTER: 280x240 (7:6) Rounded-Corner 262K IPS Display */}
            <div className="order-1 md:order-2 mx-auto w-full max-w-[448px] rounded-[28px] bg-[#090914] p-2.5 shadow-[inset_0_4px_14px_rgba(0,0,0,0.85)] border-2 border-black">
              <div
                className="relative w-full aspect-[7/6] overflow-hidden rounded-[22px] border-2 border-[#1e1e36]"
                style={{ background: "#0a0a24" }}
              >
                {pet.isPending || !view || !mon ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="snes-window px-6 py-4">
                      <p className="font-game text-[12px] text-white">BOOTING 280×240…</p>
                    </div>
                  </div>
                ) : mode === "play_game" ? (
                  <SnesArcadeCanvas
                    game={activeGame}
                    species={mon.species}
                    stage={mon.displayStage}
                    equippedIds={view.equippedItems.map((i) => i.assetId)}
                    soundOn={view.settings.soundOn}
                    milestonePowers={mon.milestonePowers}
                    buffs={{
                      dogeSpeed: mon.activeBuffs.dogeSpeed,
                      susSense: mon.activeBuffs.susSense,
                      chadStrength: mon.activeBuffs.chadStrength,
                    }}
                    bestScore={mon.highScores[activeGame].bestScore}
                    controller={gameController}
                    captureKeyboard={true}
                    resultBanner={gameMsg}
                    onComplete={({ game: gId, score, maxCombo }) =>
                      gameMut.mutate({ game: gId, score, maxCombo })
                    }
                    onExit={() => setMode("games")}
                    className="h-full w-full"
                  />
                ) : (
                  <div key={screenKey} className="anim-screen-in absolute inset-0">
                    {/* TITLE SCREEN */}
                    {mode === "title" ? (
                      <div className="snes-dots flex h-full flex-col justify-between p-3" style={{ background: "linear-gradient(180deg,#1e1a58 0%,#121036 100%)" }}>
                        <div className="text-center">
                          <span className="font-game snes-text text-[15px] text-[#ffd23f]">MEMEAGOTCHI</span>
                          <p className="font-pixel text-[14px] text-[#7be6d8]">280×240 · 5-STARTER EDITION</p>
                        </div>

                        {view.hatched ? (
                          <div className="flex items-center justify-center gap-3 px-2">
                            <div className="h-[88px] w-[88px] shrink-0 anim-bob">
                              <Monster species={mon.species} stage={mon.displayStage} actualStage={mon.stage} mood="excited" equipped={view.equippedItems} />
                            </div>
                            <div className="min-w-0 text-left">
                              <p className="font-game truncate text-[11px] text-[#7be6d8]">{mon.name.toUpperCase()}</p>
                              <p className="font-pixel text-[15px] text-white">{mon.speciesDef.name.toUpperCase()}</p>
                              <p className="font-pixel text-[14px] text-[#ffd23f]">STG {mon.stage} · ⭐{mon.xp} · 🔥{mon.careStreak.count}D</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5 py-1">
                            {SPECIES_CATALOG.map((sp) => (
                              <StarterEgg key={sp.id} species={sp.id} size={46} wobble />
                            ))}
                          </div>
                        )}

                        <div className="snes-window flex flex-col px-2 py-1.5">
                          {(view.hatched
                            ? [
                                `▶ CONTINUE (${mon.name.toUpperCase()})`,
                                "🥚 NEW STARTER PET",
                                "⚙️ SETTINGS",
                              ]
                            : ["🥚 CHOOSE STARTER PET", "⚙️ SETTINGS"]
                          ).map((lbl, idx) => (
                            <MenuRow
                              key={lbl}
                              selected={nav.title === idx}
                              onClick={() => {
                                patchNav({ title: idx });
                                handleUiButton("o");
                              }}
                            >
                              <span className="truncate">{lbl}</span>
                            </MenuRow>
                          ))}
                        </div>
                        <ScreenText className="text-center text-[13px] opacity-80">▲▼: MOVE · O: SELECT</ScreenText>
                      </div>
                    ) : mode === "hatch" ? (
                      /* 5-STARTER SPECIES PICKER ON 280x240 LCD */
                      <div className="snes-dots flex h-full flex-col gap-1.5 p-2.5" style={{ background: "linear-gradient(180deg,#23235e 0%,#10102e 100%)" }}>
                        <Banner
                          title={`STARTER ${(nav.hatchSpecies % SPECIES_CATALOG.length) + 1}/${SPECIES_CATALOG.length}`}
                          right={<span className="font-pixel text-[14px]">◄ ►</span>}
                        />
                        <div className="snes-window grid flex-1 grid-cols-[120px_1fr] items-center gap-2 px-2.5 py-2">
                          <div className="flex flex-col items-center gap-1">
                            <div
                              className="flex h-[106px] w-[106px] items-center justify-center rounded-xl border-2 border-[#0a0a24]"
                              style={{ background: `radial-gradient(circle, #ffffff 0%, ${selectedStarter.eggColors[0]} 65%, ${selectedStarter.eggColors[1]} 100%)` }}
                            >
                              <div className="h-[88px] w-[88px] anim-bob">
                                <Monster species={selectedStarter.id} stage={1} actualStage={1} mood="excited" equipped={[]} />
                              </div>
                            </div>
                            <div className="flex gap-1">
                              {SPECIES_CATALOG.map((sp, i) => (
                                <span
                                  key={sp.id}
                                  className="h-2 w-2 rounded-full"
                                  style={{ background: i === nav.hatchSpecies % SPECIES_CATALOG.length ? sp.accentColor : "rgba(255,255,255,0.25)" }}
                                />
                              ))}
                            </div>
                          </div>
                          <div className="min-w-0 space-y-1">
                            <p className="font-game truncate text-[11px]" style={{ color: selectedStarter.accentColor }}>
                              {selectedStarter.name.toUpperCase()}
                            </p>
                            <p className="font-pixel text-[15px] text-white leading-none">
                              NAME: {selectedStarter.defaultPetName.toUpperCase()}
                            </p>
                            <p className="font-pixel text-[14px] text-[#ffd23f] leading-tight">
                              X: {selectedStarter.specialMove.name.toUpperCase()}
                            </p>
                            <p className="font-pixel text-[13px] text-emerald-300 leading-tight">
                              {selectedStarter.perkSummary}
                            </p>
                            <p className="font-pixel text-[13px] text-white/75 leading-none">
                              SPD {selectedStarter.statBars.speed} · STA {selectedStarter.statBars.stamina} · SPC {selectedStarter.statBars.spice} · LCK {selectedStarter.statBars.luck}
                            </p>
                          </div>
                        </div>
                        <ScreenText className="text-center text-[13px] opacity-85">◄►: SPECIES · O: HATCH! · X: BACK</ScreenText>
                      </div>
                    ) : mon.isSleeping && mode === "pet" ? (
                      <DreamScreensaver
                        species={mon.species}
                        stage={mon.displayStage}
                        petName={mon.name}
                        energy={mon.energy}
                        slides={dreamSlides}
                        fromFedHistory={hasFedMemes}
                        manualIndex={dreamSlideIdx}
                        sensorBadge={sensorWakeBadge}
                        standby={sleepStandby}
                        wakeHint="O / -- : WAKE"
                        onWakeFromStandby={() => {
                          setSleepStandby(false);
                          flashSensorBadge("📳 MOTION WAKE");
                          blipNav();
                        }}
                      />
                    ) : mode === "menu" ? (
                      <div className="snes-dots flex h-full flex-col gap-1.5 p-2.5" style={{ background: "linear-gradient(180deg,#23235e 0%,#10102e 100%)" }}>
                        <Banner title="MAIN MENU" right={<span className="font-game text-[10px]">💧{mon.drip}</span>} />
                        <div className="snes-window grid flex-1 grid-cols-2 gap-x-1 gap-y-0.5 px-1.5 py-1.5">
                          {MENU.map((item, i) => (
                            <MenuRow
                              key={item.id}
                              selected={i === nav.menu}
                              onClick={() => {
                                patchNav({ menu: i });
                                handleUiButton("o");
                              }}
                            >
                              <span className="text-[15px] leading-none">{item.glyph}</span>
                              <span className="truncate text-[10px]">{item.label}</span>
                            </MenuRow>
                          ))}
                        </div>
                        <ScreenText className="text-center text-[13px] opacity-80">D-PAD: MOVE · O: OPEN · X: BACK</ScreenText>
                      </div>
                    ) : mode === "feed" && currentMeme ? (
                      feedFullscreen ? (
                        /* FULL-SCREEN 280x240 MEME FEED VIEW (toggled via ▲ Up Arrow) */
                        <div className="relative h-full w-full overflow-hidden bg-black">
                          {memeSrc ? (
                            <img
                              src={memeSrc}
                              alt={currentMeme.caption}
                              className="h-full w-full object-cover"
                              draggable={false}
                            />
                          ) : (
                            <div
                              className="flex h-full w-full items-center justify-center text-6xl"
                              style={{ background: currentMeme.bg }}
                            >
                              {currentMeme.emoji}
                            </div>
                          )}

                          {/* Subtle top index & title badge */}
                          <div className="pointer-events-none absolute inset-x-2 top-1.5 flex items-center justify-between gap-2">
                            <span
                              className="max-w-[74%] truncate rounded-full px-2.5 py-0.5 font-mono text-[9.5px] font-bold text-white"
                              style={{ background: "rgba(10, 10, 32, 0.78)" }}
                            >
                              {currentMeme.title}
                            </span>
                            <span
                              className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] font-bold text-[#ffd23f]"
                              style={{ background: "rgba(10, 10, 32, 0.78)" }}
                            >
                              {(nav.meme % memeCount) + 1}/{view.memes.length}
                            </span>
                          </div>

                          {/* Minimal bottom control bar so meme dominates screen */}
                          <div
                            className="absolute inset-x-2 bottom-1.5 flex items-center justify-between gap-1.5 rounded-lg px-2 py-1"
                            style={{ background: "rgba(10, 10, 32, 0.82)", border: "1px solid rgba(255,255,255,0.18)" }}
                          >
                            <span
                              className="rounded px-1.5 py-0.5 font-game text-[8px] text-white"
                              style={{ background: LABEL_COLOR[currentLabel] }}
                            >
                              {LABEL_FACE[currentLabel]}
                            </span>
                            <span className="font-mono text-[8.5px] font-bold text-white/90">
                              ◄► MEME · ▼ VIBE · O FEED · ▲ EXIT
                            </span>
                          </div>
                        </div>
                      ) : (
                        /* LANDSCAPE SPLIT FEED SCREEN */
                        <div className="snes-dots flex h-full flex-col gap-1.5 p-2" style={{ background: "linear-gradient(180deg,#23235e 0%,#10102e 100%)" }}>
                          <Banner
                            title={`FEED ${(nav.meme % memeCount) + 1}/${view.memes.length}`}
                            right={<span className="font-pixel text-[14px]">🫃 {view.belly.length}/{mon.memeSlots}</span>}
                          />
                          <div className="grid flex-1 min-h-0 grid-cols-[46%_1fr] gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                blipNav();
                                setFeedFullscreen(true);
                              }}
                              title="Press ▲ Up Arrow for Full Screen Meme"
                              className="relative overflow-hidden rounded-lg border-[3px] border-[#0a0a24] bg-black text-left"
                            >
                              {memeSrc ? (
                                <img src={memeSrc} alt={currentMeme.caption} className="pixelated h-full w-full object-cover" draggable={false} />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-4xl" style={{ background: currentMeme.bg }}>
                                  {currentMeme.emoji}
                                </div>
                              )}
                              <span
                                className="absolute bottom-1 right-1 rounded px-1.5 py-0.5 font-mono text-[8px] font-bold text-[#ffd23f]"
                                style={{ background: "rgba(10, 10, 32, 0.85)" }}
                              >
                                ▲ FULL
                              </span>
                            </button>
                            <div className="snes-window flex flex-col justify-between p-2">
                              <div>
                                <p className="font-game line-clamp-2 text-[9.5px] leading-snug text-white">
                                  {currentMeme.title.toUpperCase()}
                                </p>
                                <p className="font-pixel mt-1 text-[15px] text-[#ffd23f]">
                                  PWR {currentMeme.power} · ♥{currentMeme.tasty} 🌶{currentMeme.spicy} 🤢{currentMeme.blech}
                                </p>
                              </div>
                              <div className="text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <span className="text-[#ffd23f]">◀</span>
                                  <span
                                    className="font-game border-2 border-[#0a0a24] px-2 py-1 text-[9.5px] text-white"
                                    style={{ background: LABEL_COLOR[currentLabel] }}
                                  >
                                    {LABEL_FACE[currentLabel]}
                                  </span>
                                  <span className="text-[#ffd23f]">▶</span>
                                </div>
                                <p className="font-pixel mt-1 text-[12px] text-[#7be6d8]">
                                  ▲ FULLSCREEN · ▼ NEXT
                                </p>
                                <p className="font-pixel text-[12px] text-white/85">
                                  ◄► LABEL · O FEED
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    ) : mode === "care" ? (
                      <div className="snes-dots flex h-full flex-col gap-1.5 p-2.5" style={{ background: "linear-gradient(180deg,#23235e 0%,#10102e 100%)" }}>
                        <Banner title="CARE" />
                        <div className="snes-window flex flex-1 flex-col px-2 py-2">
                          <div className="flex flex-1 flex-col justify-center">
                            {CARE.map((item, i) => {
                              const rawCd = item.id === "feed" ? mon.cooldowns.feedSec : item.id === "groom" ? mon.cooldowns.groomSec : item.id === "play" ? mon.cooldowns.playSec : 0;
                              const cd = Math.max(0, rawCd - elapsedServerSec);
                              return (
                                <MenuRow key={item.id} selected={i === nav.care}>
                                  <span className="text-[17px] leading-none">{item.glyph}</span>
                                  <span className="flex-1">{item.label}</span>
                                  {cd > 0 && <span className="font-pixel text-[16px] text-[#ffd23f]">{cd}s</span>}
                                </MenuRow>
                              );
                            })}
                          </div>
                          <ScreenText className="text-center text-[13px] opacity-80">▲▼: PICK · O: DO IT · X: MENU</ScreenText>
                        </div>
                      </div>
                    ) : mode === "games" ? (
                      /* SNES 280x240 ARCADE CARTRIDGE LAUNCHER */
                      <div className="snes-dots flex h-full flex-col gap-1.5 p-2.5" style={{ background: "linear-gradient(180deg,#23235e 0%,#10102e 100%)" }}>
                        <Banner
                          title="SNES ARCADE"
                          right={
                            <span className="font-pixel text-[13px]">
                              {mon.milestonePowers.turboCharge ? "⚡" : ""}
                              {mon.milestonePowers.secondWind ? "🛡️" : ""}
                              {mon.milestonePowers.memeOverdrive ? "🔥" : ""}
                              X:{mon.speciesDef.specialMove.name.toUpperCase()}
                            </span>
                          }
                        />
                        <div className="snes-window flex flex-1 flex-col justify-between px-2 py-2">
                          <div className="flex flex-1 flex-col justify-center gap-1.5">
                            {MINI_GAMES_CATALOG.map((g, i) => {
                              const sel = i === nav.games;
                              const hs = mon.highScores[g.id];
                              return (
                                <div
                                  key={g.id}
                                  onClick={() => {
                                    const wasSel = navRef.current.games === i;
                                    patchNav({ games: i });
                                    if (wasSel) handleUiButton("o");
                                  }}
                                  className="flex cursor-pointer items-center gap-2 border-2 px-2 py-1.5"
                                  style={{
                                    borderColor: sel ? "#ffd23f" : "rgba(255,255,255,0.25)",
                                    background: sel ? "rgba(255,210,63,0.16)" : "rgba(255,255,255,0.04)",
                                  }}
                                >
                                  <span className="w-[16px] shrink-0">{sel ? <Cursor /> : null}</span>
                                  <span className="text-[19px] leading-none">{g.glyph}</span>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-1">
                                      <span className={`font-game text-[10px] ${sel ? "text-[#ffd23f]" : "text-white"}`}>{g.shortName}</span>
                                      <span className="font-pixel text-[14px] text-[#7be6d8]">BEST {hs.bestScore}</span>
                                    </div>
                                    <p className="font-pixel truncate text-[13px] text-white/75">{g.genre}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <ScreenText className="text-center text-[13px] opacity-80">▲▼: GAME · O: START · X: MENU</ScreenText>
                        </div>
                      </div>
                    ) : mode === "shop" ? (
                      <div className="snes-dots flex h-full flex-col gap-1.5 p-2.5" style={{ background: "linear-gradient(180deg,#23235e 0%,#10102e 100%)" }}>
                        <Banner title="DRIP SHOP" right={<span className="font-game text-[10px]">💧{mon.drip}</span>} />
                        <div className="snes-window flex flex-1 flex-col px-2 py-1.5">
                          <div className="flex flex-1 flex-col justify-center">
                            {view.cosmetics
                              .slice(windowStart(nav.shop, view.cosmetics.length, 5), windowStart(nav.shop, view.cosmetics.length, 5) + 5)
                              .map((c) => {
                                const i = view.cosmetics.indexOf(c);
                                return (
                                  <MenuRow key={c.id} selected={i === nav.shop}>
                                    <span className="inline-flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded bg-white/90 p-[1px]">
                                      <CosmeticBadge assetId={c.id} size={18} />
                                    </span>
                                    <span className="min-w-0 flex-1 truncate text-[10px]">{c.name.toUpperCase()}</span>
                                    <span className="font-pixel shrink-0 text-[15px] text-[#ffd23f]">
                                      {c.equipped ? "★ ON" : c.owned ? "OWNED" : `💧${c.price}`}
                                    </span>
                                  </MenuRow>
                                );
                              })}
                          </div>
                          <ScreenText className="text-center text-[13px] opacity-80">▲▼: ITEM · O: BUY · X: MENU</ScreenText>
                        </div>
                      </div>
                    ) : mode === "bag" ? (
                      <div className="snes-dots flex h-full flex-col gap-1.5 p-2.5" style={{ background: "linear-gradient(180deg,#23235e 0%,#10102e 100%)" }}>
                        <Banner title="WARDROBE BAG" />
                        <div className="snes-window flex flex-1 flex-col px-2 py-1.5">
                          {ownedItems.length === 0 ? (
                            <div className="flex flex-1 flex-col items-center justify-center text-center">
                              <p className="font-game text-[11px] text-white">BAG'S EMPTY.</p>
                              <ScreenText className="mt-1 text-[15px] opacity-75">BUY DRIP IN THE SHOP.</ScreenText>
                            </div>
                          ) : (
                            <div className="flex flex-1 flex-col justify-center">
                              {ownedItems
                                .slice(windowStart(nav.bag, ownedItems.length, 5), windowStart(nav.bag, ownedItems.length, 5) + 5)
                                .map((c) => {
                                  const i = ownedItems.indexOf(c);
                                  return (
                                    <MenuRow key={c.id} selected={i === nav.bag}>
                                      <span className="inline-flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded bg-white/90 p-[1px]">
                                        <CosmeticBadge assetId={c.id} size={18} />
                                      </span>
                                      <span className="min-w-0 flex-1 truncate text-[10px]">{c.name.toUpperCase()}</span>
                                      <span className="font-pixel shrink-0 text-[15px] text-[#ffd23f]">{c.equipped ? "★ WORN" : c.slot.toUpperCase()}</span>
                                    </MenuRow>
                                  );
                                })}
                            </div>
                          )}
                          <ScreenText className="text-center text-[13px] opacity-80">▲▼: ITEM · O: WEAR/OFF · X: MENU</ScreenText>
                        </div>
                      </div>
                    ) : mode === "stats" ? (
                      <div className="snes-dots flex h-full flex-col gap-1.5 p-2.5" style={{ background: "linear-gradient(180deg,#23235e 0%,#10102e 100%)" }}>
                        {nav.statsPage === 0 ? (
                          <>
                            <Banner title="VITALS · 1/3" right={<span className="font-pixel text-[14px]">🔥{mon.careStreak.count}D STREAK</span>} />
                            <div className="snes-window flex flex-1 flex-col justify-between px-3 py-2">
                              <div className="flex flex-1 flex-col justify-center gap-2">
                                <StatRow label="FULLNESS" glyph="🍖" value={mon.fullness} cap={mon.statCap} />
                                <StatRow label="HAPPY" glyph="♥️" value={mon.happiness} cap={mon.statCap} />
                                <StatRow label="HYGIENE" glyph="🛁" value={mon.hygiene} cap={mon.statCap} />
                                <StatRow label="ENERGY" glyph="⚡" value={mon.energy} cap={mon.statCap} />
                                <StatRow label="HEAT" glyph="🌶" value={mon.heat} cap={mon.heatCap} heat />
                              </div>
                              <ScreenText className="text-center text-[14px] text-[#7be6d8]">
                                {mon.speciesDef.name.toUpperCase()} · 💧{mon.drip} DRIP · ◄► PAGE
                              </ScreenText>
                            </div>
                          </>
                        ) : nav.statsPage === 1 ? (
                          <>
                            <Banner title="PROGRESS · 2/3" />
                            <div className="snes-window flex flex-1 flex-col justify-between px-2.5 py-2">
                              <div className="flex gap-1">
                                {STAGES.map((st, i) => {
                                  const reached = st.stage <= mon.stage;
                                  const current = st.stage === mon.stage;
                                  return (
                                    <div
                                      key={st.stage}
                                      className="flex-1 border-2 border-[#0a0a24] px-[2px] py-[3px] text-center"
                                      style={{
                                        background: reached ? STAGE_COLORS[i] : "rgba(255,255,255,0.08)",
                                        boxShadow: current ? "0 0 0 2px #ffd23f" : undefined,
                                        opacity: reached ? 1 : 0.55,
                                      }}
                                    >
                                      <span className="font-game block text-[7.5px]" style={{ color: reached ? "#10102e" : "#ffffff" }}>
                                        {st.stage} {st.shortName}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="space-y-1">
                                <ScreenText className="text-[16px]">
                                  XP {mon.xp}{mon.nextStageXp ? ` / ${mon.nextStageXp}` : " · MAX!"} · DIGESTED {mon.digestedCount}
                                </ScreenText>
                                <ScreenText className="text-[14px] text-[#ffd23f]">
                                  MILESTONES: {mon.milestonePowers.turboCharge ? "⚡TURBO ON" : `⚡${mon.digestedCount}/5`} · {mon.milestonePowers.secondWind ? "🛡️2ND ON" : `🛡️${mon.digestedCount}/15`} · {mon.milestonePowers.memeOverdrive ? "🔥×1.5 ON" : `🔥${mon.digestedCount}/30`}
                                </ScreenText>
                                <ScreenText className="text-[14px] opacity-85">
                                  SECRETS {view.secrets.length}/10 · BEST STREAK {mon.careStreak.bestStreak}D
                                </ScreenText>
                              </div>
                              <ScreenText className="text-center text-[13px] opacity-80">◄►: PAGE 2/3 · X: MENU</ScreenText>
                            </div>
                          </>
                        ) : (
                          <>
                            <Banner title="ARCADE BESTS · 3/3" />
                            <div className="snes-window flex flex-1 flex-col justify-between px-2.5 py-2">
                              <div className="space-y-1.5">
                                {MINI_GAMES_CATALOG.map((g) => {
                                  const hs = mon.highScores[g.id];
                                  return (
                                    <div key={g.id} className="flex items-center justify-between border-b border-white/15 pb-1">
                                      <span className="font-game text-[9.5px] text-white">
                                        {g.glyph} {g.shortName}
                                      </span>
                                      <span className="font-pixel text-[15px] text-[#ffd23f]">
                                        BEST {hs.bestScore} · ×{hs.bestCombo} · {hs.plays}P
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                              <ScreenText className="text-center text-[13px] opacity-80">◄►: PAGE 3/3 · X: MENU</ScreenText>
                            </div>
                          </>
                        )}
                      </div>
                    ) : mode === "post" ? (
                      <div className="snes-dots flex h-full flex-col gap-1.5 p-2.5" style={{ background: "linear-gradient(180deg,#23235e 0%,#10102e 100%)" }}>
                        <Banner title="POST BONUS" />
                        <div className="snes-window flex flex-1 flex-col px-2 py-1.5">
                          <ScreenText className="text-center text-[14px] opacity-85">PASTE URL IN VOICE DOCK, OR ADD:</ScreenText>
                          <div className="flex flex-1 flex-col justify-center">
                            {view.bonusMemes.map((b, i) => {
                              const sel = i === nav.post;
                              return (
                                <div key={b.key} className="flex min-h-[38px] items-center gap-1.5 px-1" style={{ background: sel ? "rgba(255,210,63,0.16)" : "transparent" }}>
                                  <span className="w-[16px] shrink-0">{sel ? <Cursor /> : null}</span>
                                  <img src={MEME_IMG[b.imageKey] ?? ""} alt="" className="pixelated h-[28px] w-[28px] shrink-0 border-2 border-[#0a0a24] object-cover" draggable={false} />
                                  <span className={`font-game min-w-0 flex-1 truncate text-[9.5px] ${sel ? "text-[#ffd23f]" : "text-white"}`}>{b.title.toUpperCase()}</span>
                                  <span className="font-pixel shrink-0 text-[14px] text-[#ffd23f]">{b.added ? "✓ ADDED" : "ADD"}</span>
                                </div>
                              );
                            })}
                          </div>
                          <ScreenText className="text-center text-[13px] opacity-80">▲▼: PICK · O: ADD · X: MENU</ScreenText>
                        </div>
                      </div>
                    ) : mode === "settings" ? (
                      <div className="snes-dots flex h-full flex-col gap-1.5 p-2.5" style={{ background: "linear-gradient(180deg,#23235e 0%,#10102e 100%)" }}>
                        <Banner title="SETTINGS" />
                        <div className="snes-window flex flex-1 flex-col px-2 py-1.5">
                          <div className="flex flex-1 flex-col justify-center">
                            {settingsRows.map((label, i) => (
                              <MenuRow key={label} selected={i === nav.settings}>
                                <span className="text-[10px]" style={i === 3 && resetArm ? { color: "#ff6b6b" } : undefined}>{label}</span>
                              </MenuRow>
                            ))}
                          </div>
                          <ScreenText className="text-center text-[13px] opacity-80">▲▼: PICK · O: CHANGE · X: BACK</ScreenText>
                        </div>
                      </div>
                    ) : (
                      /* LANDSCAPE 280x240 PET HOME SCREEN */
                      <div className="relative flex h-full flex-col px-2 pb-1.5 pt-1.5">
                        <SceneBg tod={tod} />
                        <div className="relative flex items-center justify-between gap-1.5">
                          <span className="snes-bar font-game max-w-[54%] truncate px-2 py-[4px] text-[9.5px] leading-none text-white">
                            {mon.name.toUpperCase()}
                          </span>
                          <span className="snes-bar font-pixel shrink-0 px-2 py-[3px] text-[14px] leading-none text-[#ffd23f]">
                            STG {mon.stage} · 🔥{mon.careStreak.count}D
                          </span>
                        </div>

                        {mon.speech && (
                          <div className="absolute left-2.5 top-[38px] z-10 max-w-[68%] border-2 border-[#0a0a24] bg-white px-2 py-[3px]">
                            <p className="font-pixel text-[15px] leading-none text-[#191930]">“{mon.speech}”</p>
                          </div>
                        )}

                        <div className="relative flex min-h-0 flex-1 items-center justify-center">
                          <div className={`aspect-square h-[108%] max-h-[175px] ${animClass}`}>
                            <Monster species={mon.species} stage={mon.displayStage} actualStage={mon.stage} mood={mood} equipped={view.equippedItems} />
                          </div>
                        </div>

                        <div className="relative mt-auto">
                          <ScreenText className="mb-[2px] text-center text-[13px] opacity-95">
                            O: FEED · ►: ARCADE · --: MENU · HOLD --: VOICE
                          </ScreenText>
                          <div className="snes-bar grid grid-cols-3 gap-x-2 gap-y-[3px] px-2 py-[5px]">
                            <Pips label="Fullness" glyph="🍖" value={mon.fullness} cap={mon.statCap} />
                            <Pips label="Happiness" glyph="♥️" value={mon.happiness} cap={mon.statCap} />
                            <Pips label="Hygiene" glyph="🛁" value={mon.hygiene} cap={mon.statCap} />
                            <Pips label="Energy" glyph="⚡" value={mon.energy} cap={mon.statCap} />
                            <Pips label="Heat" glyph="🌶" value={mon.heat} cap={mon.heatCap} heat />
                            <div className="flex items-center gap-[4px]">
                              <span className="text-[11px]">💧</span>
                              <span className="font-pixel snes-text text-[14px] leading-none text-[#ffd23f]">
                                {mon.drip} · 🫃{view.belly.length}/{mon.memeSlots}
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
                    <img src={feedFx.src} alt="" className="anim-feed-fly pixelated absolute left-[35%] top-[14%] h-[32%] w-[30%] border-2 border-[#0a0a24] object-cover" draggable={false} />
                    <div className="absolute bottom-[2%] left-[28%] h-[52%] aspect-square">
                      <Monster species={mon.species} stage={mon.displayStage} actualStage={mon.stage} mood="eating" equipped={view.equippedItems} />
                    </div>
                  </div>
                )}
                {burst && <Burst kind={burst.kind} burstKey={burst.id} />}
                {screenMsg && mode !== "play_game" && (
                  <div className="snes-window pointer-events-none absolute inset-x-2 bottom-2 z-20 px-2.5 py-1.5">
                    <p className="font-pixel snes-text text-center text-[15px] leading-tight text-[#ffd23f]">{screenMsg}</p>
                  </div>
                )}
                {evoFlash && view && mon && (
                  <div className="anim-evo pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center px-3 text-center" style={{ background: "radial-gradient(circle at 50% 42%, #fff7cc 0%, #ffd23f 55%, #ff9d2e 100%)" }}>
                    <p className="font-game text-[15px] text-[#40260a]">★ EVOLVED! ★</p>
                    <div className="relative mt-1 h-[62%] aspect-square">
                      <div className="anim-evo-out absolute inset-0">
                        <Monster species={mon.species} stage={evoFlash.from} actualStage={evoFlash.from} mood="happy" equipped={[]} />
                      </div>
                      <div className="anim-evo-in absolute inset-0">
                        <Monster species={mon.species} stage={mon.stage} actualStage={mon.stage} mood="happy" equipped={view.equippedItems} />
                      </div>
                    </div>
                    <p className="font-game mt-1 text-[13px] text-[#40260a]">{evoFlash.name.toUpperCase()}</p>
                    <Burst kind="sparkles" burstKey={1} />
                  </div>
                )}
                {flash > 0 && <div key={flash} className="anim-flash pointer-events-none absolute inset-0 z-30 bg-white" />}
              </div>
            </div>

            {/* RIGHT WING: O (Confirm/Action), X (Back/Special), -- (Menu/Pause + Hold Voice PTT) */}
            <div className="order-3 flex md:flex-col items-center justify-around md:justify-center gap-4">
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center gap-1 mt-6">
                  <button
                    type="button"
                    aria-label="X Button: Back or Species Signature Special"
                    {...bindHw("x")}
                    className={`h-13 w-13 rounded-full border-b-[5px] border-[#4c1d95] font-black text-lg shadow-lg flex items-center justify-center ${
                      hwPressed.x
                        ? "bg-[#f472b6] text-[#141026] translate-y-[2px]"
                        : "bg-gradient-to-b from-[#c084fc] to-[#7c3aed] text-white"
                    }`}
                  >
                    X
                  </button>
                  <span className="font-pixel text-[12px] text-[#c4b5fd]">BACK / SP</span>
                </div>

                <div className="flex flex-col items-center gap-1 -mt-6">
                  <button
                    type="button"
                    aria-label="O Button: Confirm or Primary Action"
                    {...bindHw("o")}
                    className={`h-14 w-14 rounded-full border-b-[5px] border-[#0f766e] font-black text-xl shadow-lg flex items-center justify-center ${
                      hwPressed.o
                        ? "bg-[#fde047] text-[#141026] translate-y-[2px]"
                        : "bg-gradient-to-b from-[#7be6d8] to-[#14b8a6] text-[#141026]"
                    }`}
                  >
                    O
                  </button>
                  <span className="font-pixel text-[12px] text-[#7be6d8]">OK / ACT</span>
                </div>
              </div>

              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  aria-label="Menu Pause Button (Hold for Push-to-Talk Voice)"
                  {...bindHw("menu")}
                  className={`px-5 py-1.5 rounded-full border-b-[4px] border-[#111022] font-mono text-xs font-black tracking-widest shadow ${
                    hwPressed.menu || pttActive
                      ? "bg-[#fde047] text-[#141026] translate-y-[1px]"
                      : "bg-[#383454] text-[#e5e1ff] hover:bg-[#464166]"
                  }`}
                >
                  --
                </button>
                <span className="font-pixel text-[12px] text-[#9a97a3]">MENU / HOLD:🎙️</span>
              </div>
            </div>
          </div>

          <p className="mt-3 text-center text-[11px] text-[#8f8da3]">
            Keyboard: <b>Arrows/WASD</b> D-Pad (<b>▲</b> Fullscreen in Feed) · <b>Z/Space/Enter</b> = O · <b>X/Backspace</b> = X · <b>Esc/P</b> = -- Menu
          </p>
        </div>

        {/* Always-On Carry Hardware Wake Sensor Simulator (Light / Sound / Motion -> Meme Dream Screensaver) */}
        <section
          aria-label="Ambient Carry Wake Sensors"
          className="mt-3 flex w-full max-w-[820px] flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-xs"
        >
          <div className="min-w-0">
            <span className="font-bold text-[#ffd23f]">💭 Sleep Meme Dream Saver</span>
            <span className="ml-2 text-[var(--dim)]">
              Auto-wakes display on Light, Sound, or Motion ({view?.dreamMemes.length ?? 0} fed memes in dream reel)
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {mon?.isSleeping && (
              <button
                type="button"
                onClick={() => setSleepStandby((s) => !s)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                  sleepStandby
                    ? "border-slate-500 bg-slate-800 text-slate-200"
                    : "border-[var(--border)] bg-black/30 text-[var(--dim)] hover:text-white"
                }`}
              >
                {sleepStandby ? "🌑 In Standby" : "🌑 Dim Standby"}
              </button>
            )}
            <button
              type="button"
              onClick={() => triggerAmbientSensor("light")}
              className="rounded-full border border-amber-400/40 bg-amber-400/15 px-2.5 py-1 text-[11px] font-bold text-amber-200 hover:bg-amber-400/25"
              title="Simulate Ambient Light Sensor wake into Meme Dream Screensaver"
            >
              ☀️ Light
            </button>
            <button
              type="button"
              onClick={() => triggerAmbientSensor("sound")}
              className="rounded-full border border-teal-400/40 bg-teal-400/15 px-2.5 py-1 text-[11px] font-bold text-teal-200 hover:bg-teal-400/25"
              title="Simulate I2S Mic Sound wake into Meme Dream Screensaver"
            >
              🎙️ Sound
            </button>
            <button
              type="button"
              onClick={() => triggerAmbientSensor("motion")}
              className="rounded-full border border-violet-400/40 bg-violet-400/15 px-2.5 py-1 text-[11px] font-bold text-violet-200 hover:bg-violet-400/25"
              title="Simulate IMU Motion/Pickup wake into Meme Dream Screensaver"
            >
              📳 Motion
            </button>
          </div>
        </section>

        {/* Voice / URL Dock */}
        <form onSubmit={onTalk} className="mt-4 flex w-full max-w-[820px] gap-2">
          <input
            ref={talkInputRef}
            value={talkText}
            onChange={(e) => setTalkText(e.target.value)}
            placeholder={
              mode === "post"
                ? "Paste an image URL (https://…) to post to feed, or talk to your pet…"
                : "🎙️ Hold -- or type here to talk (try 'feed', 'stonks', 'doge', 'sus')…"
            }
            className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-sm text-[var(--text)] outline-none focus:border-[#7be6d8]"
          />
          <button
            type="submit"
            disabled={!talkText.trim() || talkMut.isPending || urlMut.isPending}
            className="rounded-xl bg-[#ffd23f] px-4 py-2 text-sm font-bold text-[#141026] disabled:opacity-40"
          >
            {mode === "post" && URL_RE.test(talkText.trim()) ? "Post URL" : "Speak"}
          </button>
        </form>

        {notice && (
          <p className="mt-2 w-full max-w-[820px] rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs text-[#7be6d8]">
            {notice}
          </p>
        )}

        <details className="mt-3 w-full max-w-[820px] rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs text-[var(--dim)]">
          <summary className="cursor-pointer font-semibold text-[var(--text)]">
            Hardware Spec &amp; Secret Voice Words ({view?.secrets.length ?? 0}/10 unlocked)
          </summary>
          <p className="mt-2 leading-relaxed">
            Display: <b>1.69" ST7789V2 IPS TFT</b> (240×280 native, rotated <b>280×240 landscape</b>, 262K color, SPI, rounded glass corners) · MCU: <b>ESP32-S3-WROOM-1</b> · Controls: <b>4-way D-Pad + O + X + -- (Hold for I2S Mic PTT)</b> · Carry Wake Sensors: <b>Light (ALS/LDR) + Sound (INMP441 Mic) + Motion (LIS3DH/IMU)</b> wake directly into the Meme Dream Screensaver.
          </p>
          <p className="mt-1.5">
            Secret words to try: <span className="font-mono text-[#ffd23f]">{SECRET_HINTS.join(" · ")}</span>
          </p>
        </details>
      </main>
    </div>
  );
}
