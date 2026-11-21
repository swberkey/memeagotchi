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
import { api, claimPairCode, clearPairedDevice, getPairedDevice, type StoredPairedDevice } from "./api";
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

type ShellThemeId = "obsidian" | "lavender" | "mint" | "snes";

interface ShellTheme {
  id: ShellThemeId;
  name: string;
  swatch: string;
  shellBg: string;
  shellBorder: string;
  textMuted: string;
  wellBg: string;
  dpadBg: string;
  dpadText: string;
}

const SHELL_THEMES: readonly ShellTheme[] = [
  {
    id: "obsidian",
    name: "Obsidian",
    swatch: "#26233d",
    shellBg: "linear-gradient(160deg, #2d2948 0%, #1d1a33 58%, #141226 100%)",
    shellBorder: "rgba(196,181,253,0.22)",
    textMuted: "#a49ec4",
    wellBg: "radial-gradient(circle at 50% 50%, #100e20 0%, #1a1730 100%)",
    dpadBg: "linear-gradient(180deg, #3c385c 0%, #26233d 100%)",
    dpadText: "#f5f3ff",
  },
  {
    id: "lavender",
    name: "Atomic Purple",
    swatch: "#7c5fd4",
    shellBg: "linear-gradient(160deg, #6d55c7 0%, #523da6 55%, #3b2a82 100%)",
    shellBorder: "rgba(233,213,255,0.4)",
    textMuted: "#e5dcff",
    wellBg: "radial-gradient(circle at 50% 50%, #2d1f66 0%, #422e8c 100%)",
    dpadBg: "linear-gradient(180deg, #2a2444 0%, #1a1530 100%)",
    dpadText: "#ffffff",
  },
  {
    id: "mint",
    name: "Mint Cream",
    swatch: "#7be6d8",
    shellBg: "linear-gradient(160deg, #b8fbf0 0%, #7be6d8 52%, #52c7be 100%)",
    shellBorder: "rgba(255,255,255,0.65)",
    textMuted: "#1a3c42",
    wellBg: "radial-gradient(circle at 50% 50%, #3aa39d 0%, #58c2bb 100%)",
    dpadBg: "linear-gradient(180deg, #2b2d47 0%, #1a1c30 100%)",
    dpadText: "#ffffff",
  },
  {
    id: "snes",
    name: "Retro SNES",
    swatch: "#d6d3df",
    shellBg: "linear-gradient(160deg, #e5e3ec 0%, #cbc7d8 55%, #b1acc2 100%)",
    shellBorder: "rgba(255,255,255,0.7)",
    textMuted: "#47435c",
    wellBg: "radial-gradient(circle at 50% 50%, #9b96ad 0%, #b7b2c7 100%)",
    dpadBg: "linear-gradient(180deg, #3c3a4c 0%, #232230 100%)",
    dpadText: "#ffffff",
  },
];

const LABELS: Label[] = ["tasty", "spicy", "blech"];
const LABEL_FACE: Record<Label, string> = { tasty: "TASTY +2", spicy: "SPICY +3", blech: "BLECH -1" };
const LABEL_COLOR: Record<Label, string> = { tasty: "#10b981", spicy: "#ef4444", blech: "#8b5cf6" };

const MENU: { id: Mode | "sleep"; label: string; glyph: string; tint: string }[] = [
  { id: "feed", label: "FEED", glyph: "🖼️", tint: "#34d399" },
  { id: "care", label: "CARE", glyph: "🧼", tint: "#38bdf8" },
  { id: "games", label: "ARCADE", glyph: "🎮", tint: "#f472b6" },
  { id: "shop", label: "SHOP", glyph: "🛍️", tint: "#fbbf24" },
  { id: "bag", label: "BAG", glyph: "🎒", tint: "#a78bfa" },
  { id: "stats", label: "STATS", glyph: "📊", tint: "#60a5fa" },
  { id: "post", label: "POST", glyph: "📮", tint: "#fb923c" },
  { id: "settings", label: "CONFIG", glyph: "⚙️", tint: "#94a3b8" },
  { id: "sleep", label: "SLEEP", glyph: "💤", tint: "#818cf8" },
  { id: "title", label: "TITLE", glyph: "🏠", tint: "#2dd4bf" },
];

const CARE: { id: CareAction; label: string; glyph: string; desc: string; color: string }[] = [
  { id: "feed", label: "KIBBLE", glyph: "🍖", desc: "+30 Fullness · +XP", color: "#34d399" },
  { id: "groom", label: "GROOM", glyph: "🛁", desc: "+25 Hygiene · Sparkly", color: "#38bdf8" },
  { id: "play", label: "PLAY", glyph: "🎾", desc: "+20 Happy · −5 Energy", color: "#f472b6" },
  { id: "sleep", label: "SLEEP", glyph: "💤", desc: "Rest + Dream Saver", color: "#a78bfa" },
];

const STAGE_COLORS = ["#7be6d8", "#4ade80", "#38bdf8", "#fbbf24", "#c084fc"];
const SECRET_HINTS = ["stonks", "doge", "chad", "rickroll", "sus", "rizz", "no cap", "L + ratio", "mid meme", "based and correct"];
const URL_RE = /^https?:\/\/\S+$/i;
const SETTINGS_COUNT = 4;

const STAT_COLORS: Record<string, string> = {
  FULLNESS: "#ff8a3c",
  HAPPY: "#ff5da2",
  HYGIENE: "#38bdf8",
  ENERGY: "#ffd23f",
  HEAT: "#ff4747",
};

function MiniStatBar({
  glyph,
  value,
  cap = 100,
  color,
  heat,
}: {
  glyph: string;
  value: number;
  cap?: number;
  color: string;
  heat?: boolean;
}) {
  const pct = Math.min(100, Math.max(0, (value / Math.max(1, cap)) * 100));
  const fill = heat && pct >= 75 ? "#fb7185" : value < 25 && !heat ? "#fb7185" : color;
  return (
    <div className="flex items-center gap-1.5" title={`${value}/${cap}`}>
      <span className="text-[11px] leading-none">{glyph}</span>
      <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-white/15 border border-black/50">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: fill }} />
      </div>
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
  const pct = Math.min(100, Math.max(0, (value / Math.max(1, cap)) * 100));
  const color = heat && pct >= 75 ? "#fb7185" : (STAT_COLORS[label] ?? "#7be6d8");
  return (
    <div className="flex items-center gap-2" aria-label={`${label} ${value} of ${cap}`}>
      <span className="w-[16px] text-[13px] leading-none">{glyph}</span>
      <span className="font-mono text-[10px] font-extrabold tracking-wider text-white/90 w-[68px]">{label}</span>
      <div className="h-[10px] flex-1 overflow-hidden rounded-full bg-white/12 border border-black/60">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="font-mono text-[11px] font-bold text-white w-[42px] text-right">
        {value}{cap > 100 ? `/${cap}` : ""}
      </span>
    </div>
  );
}

function ScreenHeader({
  title,
  right,
  onBack,
}: {
  title: string;
  right?: React.ReactNode;
  onBack?: () => void;
}) {
  return (
    <div
      className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 border border-white/15"
      style={{ background: "linear-gradient(90deg, rgba(124,95,212,0.55), rgba(45,212,191,0.35))" }}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="rounded-md bg-black/35 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-white/90 hover:bg-black/60"
            title="Back (X)"
          >
            ←
          </button>
        )}
        <span className="font-game truncate text-[10px] text-[#fde047] snes-text">{title}</span>
      </div>
      {right}
    </div>
  );
}

type Tod = "day" | "evening" | "night";
const STARS: { l: string; t: string; d: string }[] = [
  { l: "8%", t: "12%", d: "0s" }, { l: "22%", t: "24%", d: "0.4s" }, { l: "38%", t: "10%", d: "0.9s" },
  { l: "55%", t: "19%", d: "0.2s" }, { l: "70%", t: "8%", d: "1.1s" }, { l: "84%", t: "22%", d: "0.6s" },
  { l: "92%", t: "14%", d: "1.4s" }, { l: "15%", t: "36%", d: "1.2s" }, { l: "64%", t: "32%", d: "0.8s" },
];

function SceneBg({ tod }: { tod: Tod }) {
  const sky =
    tod === "day"
      ? "linear-gradient(180deg, #38bdf8 0%, #7dd3fc 48%, #d6f5ff 78%, #f0fdf4 100%)"
      : tod === "evening"
        ? "linear-gradient(180deg, #272262 0%, #6d3b8e 44%, #e26485 74%, #ffb76b 100%)"
        : "linear-gradient(180deg, #090b29 0%, #192154 55%, #2b3878 100%)";
  const hillBack = tod === "night" ? "#1e3a5f" : tod === "evening" ? "#4c3f7a" : "#6ee7b7";
  const ground = tod === "night" ? "#1b4332" : tod === "evening" ? "#2d6a4f" : "#4ade80";
  const groundDark = tod === "night" ? "#122b21" : tod === "evening" ? "#1f4d39" : "#22c55e";
  return (
    <div className="absolute inset-0" aria-hidden>
      <div className="absolute inset-0" style={{ background: sky }} />
      {tod === "night" &&
        STARS.map((s, i) => (
          <span key={i} className="anim-twinkle absolute block h-[3px] w-[3px] rounded-full bg-white" style={{ left: s.l, top: s.t, animationDelay: s.d }} />
        ))}
      {tod === "day" && (
        <div
          className="absolute right-[9%] top-[12%] h-[28px] w-[28px] rounded-full bg-[#fde047]"
          style={{ boxShadow: "0 0 0 6px rgba(253,224,71,0.3), 0 0 28px 8px rgba(253,224,71,0.45)" }}
        />
      )}
      {tod !== "day" && (
        <div className="absolute right-[10%] top-[12%] h-[26px] w-[26px] rounded-full" style={{ boxShadow: "inset -9px 3px 0 0 #fef9c3" }} />
      )}
      {tod !== "night" && (
        <>
          <div className="anim-cloud absolute left-[8%] top-[18%] h-[11px] w-[42px] rounded-full bg-white/85" />
          <div className="anim-cloud2 absolute right-[18%] top-[28%] h-[9px] w-[32px] rounded-full bg-white/65" />
        </>
      )}
      <div className="absolute inset-x-[-10%] bottom-[16%] h-[16%] rounded-[100%] opacity-65" style={{ background: hillBack }} />
      <div
        className="absolute inset-x-0 bottom-0 h-[20%] border-t-2 border-black/25"
        style={{ background: `linear-gradient(180deg, ${ground} 0%, ${groundDark} 100%)` }}
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
  const [pairedDevice, setPairedDevice] = useState<StoredPairedDevice | null>(() => getPairedDevice());
  const [pairCodeInput, setPairCodeInput] = useState("");
  const [sseLive, setSseLive] = useState(false);

  const pet = useQuery({
    queryKey: ["gameState", pairedDevice?.deviceId ?? "local"],
    queryFn: async () => {
      try {
        return await api.getState({});
      } catch (err) {
        // If paired device token was revoked remotely, fall back cleanly to local session
        if (pairedDevice && err instanceof Error && err.message.toLowerCase().includes("revoked")) {
          clearPairedDevice();
          setPairedDevice(null);
        }
        throw err;
      }
    },
    refetchInterval: 8000,
  });
  const view: GameView | undefined = pet.data?.view;
  const mon = view?.monster;

  // Real-time Server-Sent Events (SSE) live sync stream
  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const sseUrl = pairedDevice
      ? `/api/events?deviceToken=${encodeURIComponent(pairedDevice.deviceToken)}`
      : "/api/events";
    const es = new EventSource(sseUrl);
    const onConnected = () => setSseLive(true);
    const onError = () => setSseLive(false);
    const onUpdate = () => {
      void queryClient.invalidateQueries({ queryKey: ["gameState"] });
    };
    es.addEventListener("connected", onConnected);
    es.addEventListener("state_updated", onUpdate);
    es.addEventListener("network_updated", onUpdate);
    es.onerror = onError;
    return () => {
      setSseLive(false);
      es.close();
    };
  }, [queryClient, pairedDevice]);

  const gameController = useMemo(() => createGamepadController(), []);
  const [hwPressed, setHwPressed] = useState<Readonly<Record<GamepadButton, boolean>>>(() => ({
    ...gameController.pressed,
  }));
  useEffect(() => gameController.subscribeState(setHwPressed), [gameController]);

  const [shellId, setShellId] = useState<ShellThemeId>("obsidian");
  const shell = SHELL_THEMES.find((s) => s.id === shellId) ?? SHELL_THEMES[0]!;

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

  // Audio bleeps
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
      queryClient.setQueryData(["gameState", pairedDevice?.deviceId ?? "local"], { view: r.view });
      if (r.message) setNotice(r.message);
      return r;
    },
    [queryClient, pairedDevice?.deviceId],
  );

  const pairMut = useMutation({
    mutationFn: (code: string) => claimPairCode(code, "MemeAgotchi-320 Handheld"),
    onSuccess: (dev) => {
      prevStage.current = null;
      setInitRouted(false);
      setMode("pet");
      setPairedDevice(dev);
      setPairCodeInput("");
      setNotice(`🔗 Paired with ${dev.accountHandle}! Live cloud sync active.`);
      showScreenMsg(`🔗 PAIRED TO ${dev.accountHandle.toUpperCase()}!`);
      void queryClient.invalidateQueries({ queryKey: ["gameState"] });
      blipOk();
    },
    onError: (err: Error) => {
      setNotice(`⚠️ ${err.message}`);
      showScreenMsg(err.message);
      blipBad();
    },
  });

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

  const launchGame = useCallback(
    (gId: MiniGameId) => {
      const block = gameBlock();
      if (block) {
        showScreenMsg(block);
        blipBad();
        return;
      }
      setFlash(Date.now());
      setGameMsg("");
      setActiveGame(gId);
      setMode("play_game");
      blipOk();
    },
    [gameBlock, showScreenMsg, blipBad, blipOk],
  );

  // Unified D-Pad + O / X / -- Handler for non-game handheld screens
  const handleUiButton = useCallback(
    (btn: GamepadButton) => {
      const v = viewRef.current;
      if (!v || busy) return;
      const n = navRef.current;
      const curMode = modeRef.current;

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
        // 5-column × 2-row visual app icon launcher grid!
        const total = MENU.length;
        if (btn === "up" || btn === "down") {
          blipNav();
          patchNav({ menu: (n.menu + 5) % total });
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
        if (btn === "left") {
          blipNav();
          patchNav({ games: (n.games + total - 1) % total });
        } else if (btn === "right") {
          blipNav();
          patchNav({ games: (n.games + 1) % total });
        } else if (btn === "up") {
          blipNav();
          patchNav({ games: (n.games + total - 2) % total });
        } else if (btn === "down") {
          blipNav();
          patchNav({ games: (n.games + 2) % total });
        } else if (btn === "o") {
          const g = MINI_GAMES_CATALOG[n.games % total];
          if (g) launchGame(g.id);
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
      launchGame,
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
          `CLOCK SPEED: ${view.settings.clock === 1 ? "REAL-TIME 1×" : "DEMO 60×"}`,
          `CHIPTUNE AUDIO: ${view.settings.soundOn ? "ON 🔊" : "OFF 🔇"}`,
          mon.stage >= 3 ? `NOSTALGIA LOOK: STG ${mon.displayStage}` : "NOSTALGIA LOOK: 🔒 STG 3",
          resetArm ? "CONFIRM RESET? PRESS O" : "RESET PET → NEW STARTER",
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

  const dpadBtnStyle = (active: boolean) => ({
    background: active
      ? "linear-gradient(180deg, #99f6e4 0%, #2dd4bf 100%)"
      : shell.dpadBg,
    color: active ? "#141026" : shell.dpadText,
    borderColor: "#0c0a18",
    boxShadow: active
      ? "0 0 12px rgba(123,230,216,0.6), inset 0 1px 0 rgba(255,255,255,0.5)"
      : "inset 0 1px 0 rgba(255,255,255,0.16), 0 2px 5px rgba(0,0,0,0.45)",
    transform: active ? "translateY(1px)" : undefined,
  });

  return (
    <div className="min-h-screen text-[var(--text)]">
      <main className="mx-auto flex max-w-[940px] flex-col items-center px-3 pb-12 pt-4">
        {/* Top bar: Companion link + Collectible Shell Colorway Swatches */}
        <div className="mb-3 flex w-full max-w-[880px] flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <a
              href={COMPANION_URL}
              className="rounded-full border border-[var(--border)] bg-[var(--surface)]/90 px-3.5 py-1.5 font-bold text-[#7be6d8] hover:border-[#7be6d8]"
            >
              ← Web Companion
            </a>
            <span className="hidden sm:inline-block rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-[var(--dim)]">
              2.0" ST7789VW · 320×240 (4:3) IPS
            </span>
          </div>

          {/* Live Pocket Shell Colorway Switcher */}
          <div className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)]/90 px-2.5 py-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--dim)] px-1">Shell:</span>
            {SHELL_THEMES.map((th) => (
              <button
                key={th.id}
                type="button"
                onClick={() => setShellId(th.id)}
                title={`${th.name} Shell`}
                aria-label={`${th.name} console shell`}
                style={{ background: th.swatch, minHeight: "22px", width: "22px", height: "22px" }}
                className={`rounded-full border-2 shrink-0 transition-transform ${
                  shellId === th.id ? "scale-110 border-[#fde047] ring-2 ring-[#fde047]/40" : "border-black/40 opacity-80 hover:opacity-100"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Boutique Landscape 320x240 (4:3) Micro-Console Shell */}
        <div
          className="w-full max-w-[880px] rounded-[46px] border-2 px-4 py-4 sm:px-7 sm:py-5 transition-all duration-300"
          style={{
            background: shell.shellBg,
            borderColor: shell.shellBorder,
            boxShadow:
              "0 28px 70px rgba(4, 2, 16, 0.72), inset 0 2px 1px rgba(255,255,255,0.22), inset 0 -6px 16px rgba(0,0,0,0.25)",
          }}
        >
          {/* Top Molded Console Branding Strip */}
          <div className="mb-3 flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full transition-colors"
                style={{
                  background: pttActive ? "#fb7185" : (mon?.speciesDef.accentColor ?? "#7be6d8"),
                  boxShadow: `0 0 10px ${pttActive ? "#fb7185" : (mon?.speciesDef.accentColor ?? "#7be6d8")}`,
                }}
                aria-hidden
              />
              <span className="font-game text-[10px] tracking-wider" style={{ color: shell.textMuted }}>
                MEMEAGOTCHI-320
              </span>
              <span className="hidden sm:inline font-mono text-[10px] font-bold opacity-80" style={{ color: shell.textMuted }}>
                · ESP32-S3 · 320×240 IPS · {pttActive ? "🎙️ MIC PTT" : pairedDevice ? `🔗 ${pairedDevice.accountHandle}` : sseLive ? "⚡ SSE LIVE" : "SYNC"}
              </span>
            </div>
            {/* Speaker grille */}
            <span className="flex gap-1.5" aria-hidden>
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className="h-[5px] w-[5px] rounded-full bg-black/45 shadow-inner" />
              ))}
            </span>
          </div>

          {/* 3-Column Ergonomic Handheld Deck */}
          <div className="grid grid-cols-1 md:grid-cols-[136px_1fr_144px] items-center gap-4">
            {/* LEFT WING: Recessed 4-Way Cross D-Pad */}
            <div className="order-2 md:order-1 flex md:flex-col items-center justify-around md:justify-center gap-2.5">
              <div
                className="rounded-full p-2.5"
                style={{
                  background: shell.wellBg,
                  boxShadow: "inset 0 4px 10px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.12)",
                }}
              >
                <div className="grid grid-cols-3 grid-rows-3 gap-[2px]" role="group" aria-label="4-Way D-Pad">
                  <div />
                  <button
                    type="button"
                    aria-label="D-Pad Up"
                    {...bindHw("up")}
                    style={dpadBtnStyle(hwPressed.up)}
                    className="h-9 w-9 rounded-t-lg border font-bold text-xs flex items-center justify-center"
                  >
                    ▲
                  </button>
                  <div />
                  <button
                    type="button"
                    aria-label="D-Pad Left"
                    {...bindHw("left")}
                    style={dpadBtnStyle(hwPressed.left)}
                    className="h-9 w-9 rounded-l-lg border font-bold text-xs flex items-center justify-center"
                  >
                    ◄
                  </button>
                  <div className="h-9 w-9 flex items-center justify-center" style={{ background: "#232038" }}>
                    <span className="h-3 w-3 rounded-full bg-black/60 shadow-inner" />
                  </div>
                  <button
                    type="button"
                    aria-label="D-Pad Right"
                    {...bindHw("right")}
                    style={dpadBtnStyle(hwPressed.right)}
                    className="h-9 w-9 rounded-r-lg border font-bold text-xs flex items-center justify-center"
                  >
                    ►
                  </button>
                  <div />
                  <button
                    type="button"
                    aria-label="D-Pad Down"
                    {...bindHw("down")}
                    style={dpadBtnStyle(hwPressed.down)}
                    className="h-9 w-9 rounded-b-lg border font-bold text-xs flex items-center justify-center"
                  >
                    ▼
                  </button>
                  <div />
                </div>
              </div>
              <span className="font-mono text-[10px] font-bold tracking-widest hidden md:block" style={{ color: shell.textMuted }}>
                D-PAD
              </span>
            </div>

            {/* CENTER: Flush Glass-Lensed 320x240 (4:3) 262K Color IPS Display */}
            <div
              className="order-1 md:order-2 mx-auto w-full max-w-[496px] rounded-[24px] p-2.5 border-2 border-black"
              style={{
                background: "linear-gradient(155deg, #161524 0%, #090812 100%)",
                boxShadow: "inset 0 2px 12px rgba(0,0,0,0.9), 0 6px 20px rgba(0,0,0,0.45)",
              }}
            >
              <div
                className="relative w-full aspect-[4/3] overflow-hidden rounded-[15px] border border-white/10"
                style={{ background: "#0b0920" }}
              >
                {pet.isPending || !view || !mon ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="rounded-2xl border border-white/20 bg-[#1a1638] px-6 py-4 text-center">
                      <p className="font-game text-[11px] text-[#7be6d8]">BOOTING 320×240…</p>
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
                      <div
                        className="flex h-full flex-col justify-between p-3"
                        style={{ background: "radial-gradient(circle at 50% 0%, #312573 0%, #141033 70%, #0b0920 100%)" }}
                      >
                        <div className="text-center">
                          <span className="font-game text-[15px] text-transparent bg-clip-text bg-gradient-to-r from-[#7be6d8] via-[#fde047] to-[#f472b6]">
                            MEMEAGOTCHI
                          </span>
                          <p className="font-mono text-[10px] font-bold text-[#a6a0c4]">320×240 QVGA · 5-STARTER EDITION</p>
                        </div>

                        {view.hatched ? (
                          <div className="flex items-center justify-center gap-3 rounded-2xl border border-white/12 bg-white/6 px-3 py-2">
                            <div className="h-[84px] w-[84px] shrink-0 anim-bob">
                              <Monster species={mon.species} stage={mon.displayStage} actualStage={mon.stage} mood="excited" equipped={view.equippedItems} />
                            </div>
                            <div className="min-w-0 text-left space-y-0.5">
                              <p className="font-game truncate text-[11px]" style={{ color: mon.speciesDef.accentColor }}>
                                {mon.name.toUpperCase()}
                              </p>
                              <p className="text-[11px] font-bold text-white/90">
                                {mon.speciesDef.name} · Stage {mon.stage}
                              </p>
                              <p className="font-mono text-[10px] font-bold text-[#fde047]">
                                ⭐ {mon.xp} XP · 💧 {mon.drip} · 🔥 {mon.careStreak.count}d
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2 py-1">
                            {SPECIES_CATALOG.map((sp) => (
                              <StarterEgg key={sp.id} species={sp.id} size={46} wobble />
                            ))}
                          </div>
                        )}

                        <div className="grid gap-1.5">
                          {(view.hatched
                            ? [
                                { lbl: `▶ Continue with ${mon.name}`, hi: true },
                                { lbl: "🥚 Hatch New Starter", hi: false },
                                { lbl: "⚙️ Settings", hi: false },
                              ]
                            : [
                                { lbl: "🥚 Choose Your Starter!", hi: true },
                                { lbl: "⚙️ Settings", hi: false },
                              ]
                          ).map((row, idx) => {
                            const sel = nav.title === idx;
                            return (
                              <button
                                key={row.lbl}
                                type="button"
                                onClick={() => {
                                  patchNav({ title: idx });
                                  handleUiButton("o");
                                }}
                                className="flex items-center justify-between rounded-xl px-3 py-1.5 text-left text-xs font-bold transition-all border"
                                style={{
                                  background: sel
                                    ? "linear-gradient(90deg, rgba(123,230,216,0.28), rgba(253,224,71,0.18))"
                                    : "rgba(255,255,255,0.05)",
                                  borderColor: sel ? "#7be6d8" : "rgba(255,255,255,0.12)",
                                  color: sel ? "#ffffff" : "#cbd5e1",
                                }}
                              >
                                <span className="truncate">{row.lbl}</span>
                                {sel && <span className="font-mono text-[10px] text-[#fde047]">O</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : mode === "hatch" ? (
                      /* 5-STARTER SPECIES PICKER ON 320x240 */
                      <div
                        className="flex h-full flex-col gap-2 p-2.5"
                        style={{ background: "radial-gradient(circle at 50% 0%, #2b2266 0%, #110e2b 100%)" }}
                      >
                        <ScreenHeader
                          title={`CHOOSE STARTER (${(nav.hatchSpecies % SPECIES_CATALOG.length) + 1}/5)`}
                          onBack={() => setMode("title")}
                          right={
                            <div className="flex gap-1">
                              {SPECIES_CATALOG.map((sp, i) => (
                                <button
                                  key={sp.id}
                                  type="button"
                                  onClick={() => patchNav({ hatchSpecies: i })}
                                  className="rounded-full border border-black/50 shrink-0"
                                  style={{
                                    width: "10px",
                                    height: "10px",
                                    minHeight: "10px",
                                    background: i === nav.hatchSpecies % SPECIES_CATALOG.length ? sp.accentColor : "rgba(255,255,255,0.25)",
                                  }}
                                  aria-label={sp.name}
                                />
                              ))}
                            </div>
                          }
                        />
                        <div className="grid flex-1 min-h-0 grid-cols-[126px_1fr] items-center gap-3 rounded-2xl border border-white/15 bg-white/5 p-2.5">
                          <div className="flex flex-col items-center gap-1.5">
                            <div
                              className="flex h-[112px] w-[112px] items-center justify-center rounded-2xl border-2 border-black/30 shadow-inner"
                              style={{ background: `radial-gradient(circle, #ffffff 0%, ${selectedStarter.eggColors[0]} 65%, ${selectedStarter.eggColors[1]} 100%)` }}
                            >
                              <div className="h-[94px] w-[94px] anim-bob">
                                <Monster species={selectedStarter.id} stage={1} actualStage={1} mood="excited" equipped={[]} />
                              </div>
                            </div>
                          </div>
                          <div className="min-w-0 space-y-1">
                            <p className="font-game truncate text-[11px]" style={{ color: selectedStarter.accentColor }}>
                              {selectedStarter.name.toUpperCase()}
                            </p>
                            <p className="text-[11px] font-bold text-white">
                              Default: {selectedStarter.defaultPetName} · <span className="text-[#fde047]">X: {selectedStarter.specialMove.name}</span>
                            </p>
                            <p className="text-[10px] leading-snug text-emerald-300 font-semibold">
                              ✦ {selectedStarter.perkSummary}
                            </p>
                            <p className="font-mono text-[10px] text-white/80">
                              SPD {selectedStarter.statBars.speed} · STA {selectedStarter.statBars.stamina} · SPC {selectedStarter.statBars.spice} · LCK {selectedStarter.statBars.luck}
                            </p>
                            <button
                              type="button"
                              onClick={() => handleUiButton("o")}
                              className="mt-1 w-full rounded-xl py-1.5 font-game text-[9.5px] text-[#141026] shadow"
                              style={{ background: `linear-gradient(90deg, ${selectedStarter.accentColor}, #fde047)` }}
                            >
                              🥚 HATCH {selectedStarter.defaultPetName.toUpperCase()} (O)
                            </button>
                          </div>
                        </div>
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
                      /* STYLISH 5x2 VISUAL APP LAUNCHER GRID (320x240) */
                      <div
                        className="flex h-full flex-col gap-2 p-2.5"
                        style={{ background: "radial-gradient(circle at 50% 0%, #2a2263 0%, #110e29 100%)" }}
                      >
                        <ScreenHeader
                          title="LAUNCHER"
                          onBack={() => setMode("pet")}
                          right={<span className="font-mono text-[10px] font-bold text-[#fde047]">💧 {mon.drip} Drip</span>}
                        />
                        <div className="grid flex-1 grid-cols-5 grid-rows-2 gap-1.5">
                          {MENU.map((item, i) => {
                            const sel = i === nav.menu;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  patchNav({ menu: i });
                                  handleUiButton("o");
                                }}
                                className="flex flex-col items-center justify-center gap-1 rounded-xl border transition-all p-1"
                                style={{
                                  background: sel
                                    ? `linear-gradient(180deg, ${item.tint}44 0%, rgba(18,14,44,0.92) 100%)`
                                    : "rgba(255,255,255,0.05)",
                                  borderColor: sel ? "#fde047" : "rgba(255,255,255,0.1)",
                                  boxShadow: sel ? `0 0 12px ${item.tint}55` : undefined,
                                }}
                              >
                                <span className="text-[20px] leading-none">{item.glyph}</span>
                                <span
                                  className="font-mono text-[9px] font-extrabold tracking-tight"
                                  style={{ color: sel ? "#fde047" : "#e2e8f0" }}
                                >
                                  {item.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-center font-mono text-[9.5px] text-white/65">
                          Tap any icon or use D-Pad + O · X returns to {mon.name}
                        </p>
                      </div>
                    ) : mode === "feed" && currentMeme ? (
                      feedFullscreen ? (
                        /* FULL-SCREEN 320x240 (4:3) MEME FEED VIEW (toggled via ▲ Up Arrow) */
                        <div className="relative h-full w-full overflow-hidden bg-black">
                          {memeSrc ? (
                            <img src={memeSrc} alt={currentMeme.caption} className="h-full w-full object-cover" draggable={false} />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-6xl" style={{ background: currentMeme.bg }}>
                              {currentMeme.emoji}
                            </div>
                          )}

                          <div className="pointer-events-none absolute inset-x-2 top-1.5 flex items-center justify-between gap-2">
                            <span className="max-w-[76%] truncate rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold text-white" style={{ background: "rgba(10, 10, 32, 0.78)" }}>
                              {currentMeme.title}
                            </span>
                            <span className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[9.5px] font-bold text-[#fde047]" style={{ background: "rgba(10, 10, 32, 0.78)" }}>
                              {(nav.meme % memeCount) + 1}/{view.memes.length}
                            </span>
                          </div>

                          <div
                            className="absolute inset-x-2 bottom-1.5 flex items-center justify-between gap-1.5 rounded-xl px-2 py-1"
                            style={{ background: "rgba(10, 10, 32, 0.84)", border: "1px solid rgba(255,255,255,0.2)" }}
                          >
                            <button
                              type="button"
                              onClick={() => handleUiButton("down")}
                              className="rounded-md px-2 py-0.5 font-mono text-[9.5px] font-extrabold text-white"
                              style={{ background: LABEL_COLOR[currentLabel] }}
                            >
                              {LABEL_FACE[currentLabel]}
                            </button>
                            <span className="font-mono text-[9px] font-bold text-white/85">
                              ◄► MEME · ▼ VIBE · O FEED
                            </span>
                            <button
                              type="button"
                              onClick={() => setFeedFullscreen(false)}
                              className="rounded-md bg-white/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#fde047]"
                            >
                              ▲ EXIT
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* STYLISH 320x240 4:3 SPLIT FEED SCREEN */
                        <div
                          className="flex h-full flex-col gap-2 p-2.5"
                          style={{ background: "radial-gradient(circle at 50% 0%, #2a2263 0%, #110e29 100%)" }}
                        >
                          <ScreenHeader
                            title={`MEME FEED ${(nav.meme % memeCount) + 1}/${view.memes.length}`}
                            onBack={() => setMode("pet")}
                            right={
                              <span className="font-mono text-[10px] font-bold text-[#7be6d8]">
                                🫃 Belly {view.belly.length}/{mon.memeSlots}
                              </span>
                            }
                          />
                          <div className="grid flex-1 min-h-0 grid-cols-[52%_1fr] gap-2.5">
                            <button
                              type="button"
                              onClick={() => {
                                blipNav();
                                setFeedFullscreen(true);
                              }}
                              title="Press ▲ Up Arrow for Full Screen Meme"
                              className="relative overflow-hidden rounded-2xl border-2 border-white/15 bg-black shadow-lg text-left"
                            >
                              {memeSrc ? (
                                <img src={memeSrc} alt={currentMeme.caption} className="h-full w-full object-cover" draggable={false} />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-5xl" style={{ background: currentMeme.bg }}>
                                  {currentMeme.emoji}
                                </div>
                              )}
                              <span
                                className="absolute bottom-1.5 right-1.5 rounded-full px-2 py-0.5 font-mono text-[9px] font-bold text-[#fde047] border border-white/20"
                                style={{ background: "rgba(10, 10, 32, 0.85)" }}
                              >
                                ⤢ ▲ FULL
                              </span>
                            </button>

                            <div className="flex flex-col justify-between rounded-2xl border border-white/12 bg-white/6 p-2.5">
                              <div>
                                <p className="line-clamp-2 text-[11px] font-extrabold leading-tight text-white">
                                  {currentMeme.title}
                                </p>
                                <p className="mt-1 font-mono text-[10px] font-bold text-[#fde047]">
                                  PWR {currentMeme.power} · 😋{currentMeme.tasty} 🌶️{currentMeme.spicy} 🤢{currentMeme.blech}
                                </p>
                              </div>

                              <div className="space-y-1.5">
                                <div className="grid grid-cols-3 gap-1">
                                  {LABELS.map((lb, idx) => {
                                    const active = idx === nav.label % LABELS.length;
                                    return (
                                      <button
                                        key={lb}
                                        type="button"
                                        onClick={() => patchNav({ label: idx })}
                                        className="rounded-lg py-1 font-mono text-[8.5px] font-extrabold uppercase border transition-all"
                                        style={{
                                          background: active ? LABEL_COLOR[lb] : "rgba(255,255,255,0.07)",
                                          borderColor: active ? "#ffffff" : "rgba(255,255,255,0.12)",
                                          color: "#ffffff",
                                        }}
                                      >
                                        {lb}
                                      </button>
                                    );
                                  })}
                                </div>
                                <div className="flex gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleUiButton("o")}
                                    className="flex-1 rounded-xl bg-gradient-to-r from-[#7be6d8] to-[#2dd4bf] py-1.5 font-mono text-[10px] font-black text-[#141026] shadow"
                                  >
                                    🍽️ FEED (O)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUiButton("down")}
                                    className="rounded-xl border border-white/15 bg-white/10 px-2.5 py-1.5 font-mono text-[10px] font-bold text-white"
                                    title="Next meme (▼)"
                                  >
                                    ▼
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    ) : mode === "care" ? (
                      <div
                        className="flex h-full flex-col gap-2 p-2.5"
                        style={{ background: "radial-gradient(circle at 50% 0%, #2a2263 0%, #110e29 100%)" }}
                      >
                        <ScreenHeader title="CARE STATION" onBack={() => setMode("pet")} />
                        <div className="grid flex-1 grid-cols-2 grid-rows-2 gap-2">
                          {CARE.map((item, i) => {
                            const rawCd = item.id === "feed" ? mon.cooldowns.feedSec : item.id === "groom" ? mon.cooldowns.groomSec : item.id === "play" ? mon.cooldowns.playSec : 0;
                            const cd = Math.max(0, rawCd - elapsedServerSec);
                            const sel = i === nav.care;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  patchNav({ care: i });
                                  handleUiButton("o");
                                }}
                                className="flex flex-col items-start justify-between rounded-2xl border p-2.5 text-left transition-all"
                                style={{
                                  background: sel ? `${item.color}28` : "rgba(255,255,255,0.05)",
                                  borderColor: sel ? "#fde047" : "rgba(255,255,255,0.12)",
                                }}
                              >
                                <div className="flex w-full items-center justify-between">
                                  <span className="text-xl leading-none">{item.glyph}</span>
                                  {cd > 0 && (
                                    <span className="rounded-full bg-black/50 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-[#fde047]">
                                      {cd}s
                                    </span>
                                  )}
                                </div>
                                <div>
                                  <p className="font-game text-[10px] text-white">{item.label}</p>
                                  <p className="text-[10px] text-white/70">{item.desc}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : mode === "games" ? (
                      /* SNES 320x240 ARCADE CARTRIDGE LAUNCHER */
                      <div
                        className="flex h-full flex-col gap-2 p-2.5"
                        style={{ background: "radial-gradient(circle at 50% 0%, #2d1e6b 0%, #100c28 100%)" }}
                      >
                        <ScreenHeader
                          title="SNES ARCADE"
                          onBack={() => setMode("pet")}
                          right={
                            <span className="font-mono text-[9.5px] font-bold text-[#fde047] whitespace-nowrap shrink-0">
                              {mon.milestonePowers.turboCharge ? "⚡" : ""}
                              {mon.milestonePowers.secondWind ? "🛡️" : ""}
                              {mon.milestonePowers.memeOverdrive ? "🔥" : ""}
                              {" "}X: {mon.speciesDef.specialMove.name}
                            </span>
                          }
                        />
                        <div className="grid flex-1 min-h-0 grid-cols-2 grid-rows-2 gap-1.5">
                          {MINI_GAMES_CATALOG.map((g, i) => {
                            const sel = i === nav.games;
                            const hs = mon.highScores[g.id];
                            return (
                              <button
                                key={g.id}
                                type="button"
                                onClick={() => {
                                  patchNav({ games: i });
                                  launchGame(g.id);
                                }}
                                className="flex flex-col justify-between rounded-2xl border px-2.5 py-2 text-left transition-all min-w-0 overflow-hidden"
                                style={{
                                  borderColor: sel ? "#fde047" : g.id === "ember" ? "rgba(242,160,61,0.45)" : "rgba(255,255,255,0.14)",
                                  background: sel
                                    ? "linear-gradient(135deg, rgba(123,230,216,0.24), rgba(253,224,71,0.16))"
                                    : g.id === "ember"
                                      ? "linear-gradient(135deg, rgba(242,160,61,0.14), rgba(32,20,44,0.65))"
                                      : "rgba(255,255,255,0.05)",
                                }}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-lg leading-none">{g.glyph}</span>
                                  <span className="rounded-full bg-black/45 px-1.5 py-0.5 font-mono text-[8.5px] font-bold text-[#7be6d8] whitespace-nowrap">
                                    BEST {hs.bestScore}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <p className={`font-game truncate text-[9.5px] ${sel ? "text-[#fde047]" : "text-white"}`}>
                                    {g.shortName}
                                  </p>
                                  <p className="truncate text-[9px] text-white/70 mt-0.5">
                                    {g.id === "ember" ? "16-Bit Action RPG" : g.genre}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : mode === "shop" ? (
                      <div
                        className="flex h-full flex-col gap-2 p-2.5"
                        style={{ background: "radial-gradient(circle at 50% 0%, #2a2263 0%, #110e29 100%)" }}
                      >
                        <ScreenHeader
                          title="DRIP BOUTIQUE"
                          onBack={() => setMode("menu")}
                          right={<span className="font-mono text-[10px] font-bold text-[#fde047]">💧 {mon.drip}</span>}
                        />
                        <div className="flex flex-1 flex-col gap-1 overflow-hidden">
                          {view.cosmetics
                            .slice(windowStart(nav.shop, view.cosmetics.length, 5), windowStart(nav.shop, view.cosmetics.length, 5) + 5)
                            .map((c) => {
                              const i = view.cosmetics.indexOf(c);
                              const sel = i === nav.shop;
                              return (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => {
                                    patchNav({ shop: i });
                                    buyMut.mutate(c.id);
                                  }}
                                  className="flex flex-1 items-center gap-2 rounded-xl border px-2 py-1 text-left"
                                  style={{
                                    borderColor: sel ? "#fde047" : "rgba(255,255,255,0.08)",
                                    background: sel ? "rgba(253,224,71,0.14)" : "rgba(255,255,255,0.04)",
                                  }}
                                >
                                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/95 p-0.5">
                                    <CosmeticBadge assetId={c.id} size={20} />
                                  </span>
                                  <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-white">{c.name}</span>
                                  <span className="font-mono text-[10px] font-extrabold text-[#fde047]">
                                    {c.equipped ? "★ ON" : c.owned ? "OWNED" : `💧${c.price}`}
                                  </span>
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    ) : mode === "bag" ? (
                      <div
                        className="flex h-full flex-col gap-2 p-2.5"
                        style={{ background: "radial-gradient(circle at 50% 0%, #2a2263 0%, #110e29 100%)" }}
                      >
                        <ScreenHeader title="WARDROBE BAG" onBack={() => setMode("menu")} />
                        {ownedItems.length === 0 ? (
                          <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-center p-4">
                            <p className="font-game text-[11px] text-white">WARDROBE EMPTY</p>
                            <p className="mt-1 text-xs text-white/70">Visit Drip Boutique to unlock hats &amp; shades!</p>
                          </div>
                        ) : (
                          <div className="flex flex-1 flex-col gap-1">
                            {ownedItems
                              .slice(windowStart(nav.bag, ownedItems.length, 5), windowStart(nav.bag, ownedItems.length, 5) + 5)
                              .map((c) => {
                                const i = ownedItems.indexOf(c);
                                const sel = i === nav.bag;
                                return (
                                  <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => {
                                      patchNav({ bag: i });
                                      equipMut.mutate(c.id);
                                    }}
                                    className="flex flex-1 items-center gap-2 rounded-xl border px-2 py-1 text-left"
                                    style={{
                                      borderColor: sel ? "#7be6d8" : "rgba(255,255,255,0.08)",
                                      background: sel ? "rgba(123,230,216,0.16)" : "rgba(255,255,255,0.04)",
                                    }}
                                  >
                                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/95 p-0.5">
                                      <CosmeticBadge assetId={c.id} size={20} />
                                    </span>
                                    <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-white">{c.name}</span>
                                    <span className="font-mono text-[10px] font-extrabold text-[#7be6d8]">
                                      {c.equipped ? "★ WORN" : c.slot.toUpperCase()}
                                    </span>
                                  </button>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    ) : mode === "stats" ? (
                      <div
                        className="flex h-full flex-col gap-2 p-2.5"
                        style={{ background: "radial-gradient(circle at 50% 0%, #2a2263 0%, #110e29 100%)" }}
                      >
                        <ScreenHeader
                          title="STATUS"
                          onBack={() => setMode("pet")}
                          right={
                            <div className="flex gap-1">
                              {["Vitals", "Evo", "Arcade"].map((tabName, idx) => (
                                <button
                                  key={tabName}
                                  type="button"
                                  onClick={() => patchNav({ statsPage: idx })}
                                  className="rounded-md px-1.5 py-0.5 font-mono text-[9px] font-bold"
                                  style={{
                                    background: nav.statsPage === idx ? "#fde047" : "rgba(255,255,255,0.12)",
                                    color: nav.statsPage === idx ? "#141026" : "#ffffff",
                                  }}
                                >
                                  {tabName}
                                </button>
                              ))}
                            </div>
                          }
                        />
                        {nav.statsPage === 0 ? (
                          <div className="flex flex-1 flex-col justify-between rounded-2xl border border-white/12 bg-white/5 p-3">
                            <div className="space-y-2">
                              <StatRow label="FULLNESS" glyph="🍖" value={mon.fullness} cap={mon.statCap} />
                              <StatRow label="HAPPY" glyph="♥️" value={mon.happiness} cap={mon.statCap} />
                              <StatRow label="HYGIENE" glyph="🛁" value={mon.hygiene} cap={mon.statCap} />
                              <StatRow label="ENERGY" glyph="⚡" value={mon.energy} cap={mon.statCap} />
                              <StatRow label="HEAT" glyph="🌶" value={mon.heat} cap={mon.heatCap} heat />
                            </div>
                            <p className="text-center font-mono text-[10px] font-bold text-[#7be6d8]">
                              {mon.speciesDef.name} · 🔥 {mon.careStreak.count}d Streak · 💧 {mon.drip} Drip
                            </p>
                          </div>
                        ) : nav.statsPage === 1 ? (
                          <div className="flex flex-1 flex-col justify-between rounded-2xl border border-white/12 bg-white/5 p-3">
                            <div className="grid grid-cols-5 gap-1">
                              {STAGES.map((st, i) => {
                                const reached = st.stage <= mon.stage;
                                const current = st.stage === mon.stage;
                                return (
                                  <div
                                    key={st.stage}
                                    className="rounded-lg border px-1 py-1.5 text-center"
                                    style={{
                                      background: reached ? STAGE_COLORS[i] : "rgba(255,255,255,0.06)",
                                      borderColor: current ? "#ffffff" : "rgba(0,0,0,0.4)",
                                      opacity: reached ? 1 : 0.55,
                                    }}
                                  >
                                    <span className="font-mono block text-[9px] font-black" style={{ color: reached ? "#141026" : "#ffffff" }}>
                                      S{st.stage} {st.shortName}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="space-y-1 font-mono text-[10.5px]">
                              <p className="font-bold text-white">
                                XP {mon.xp.toLocaleString()}{mon.nextStageXp ? ` / ${mon.nextStageXp.toLocaleString()}` : " · MAX!"} · Digested {mon.digestedCount}
                              </p>
                              <p className="font-bold text-[#fde047]">
                                {mon.milestonePowers.turboCharge ? "⚡Turbo ON" : `⚡${mon.digestedCount}/5`} · {mon.milestonePowers.secondWind ? "🛡️2ndWind ON" : `🛡️${mon.digestedCount}/15`} · {mon.milestonePowers.memeOverdrive ? "🔥×1.5 ON" : `🔥${mon.digestedCount}/30`}
                              </p>
                              <p className="text-white/75">
                                Secrets {view.secrets.length}/10 · Best Streak {mon.careStreak.bestStreak}d
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-1 flex-col justify-between rounded-2xl border border-white/12 bg-white/5 p-3">
                            <div className="space-y-2">
                              {MINI_GAMES_CATALOG.map((g) => {
                                const hs = mon.highScores[g.id];
                                return (
                                  <div key={g.id} className="flex items-center justify-between rounded-xl bg-black/25 px-2.5 py-1.5">
                                    <span className="text-xs font-bold text-white">
                                      {g.glyph} {g.name}
                                    </span>
                                    <span className="font-mono text-[10.5px] font-bold text-[#fde047]">
                                      BEST {hs.bestScore} · ×{hs.bestCombo} · {hs.plays}P
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                            <p className="text-center font-mono text-[10px] text-[#7be6d8]">
                              Signature X Move: {mon.speciesDef.specialMove.name}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : mode === "post" ? (
                      <div
                        className="flex h-full flex-col gap-2 p-2.5"
                        style={{ background: "radial-gradient(circle at 50% 0%, #2a2263 0%, #110e29 100%)" }}
                      >
                        <ScreenHeader title="BONUS MEMES" onBack={() => setMode("menu")} />
                        <div className="flex flex-1 flex-col gap-1.5">
                          {view.bonusMemes.map((b, i) => {
                            const sel = i === nav.post;
                            return (
                              <button
                                key={b.key}
                                type="button"
                                onClick={() => {
                                  patchNav({ post: i });
                                  bonusMut.mutate(b.key);
                                }}
                                className="flex flex-1 items-center gap-2 rounded-xl border px-2 py-1 text-left"
                                style={{
                                  borderColor: sel ? "#fde047" : "rgba(255,255,255,0.1)",
                                  background: sel ? "rgba(253,224,71,0.14)" : "rgba(255,255,255,0.05)",
                                }}
                              >
                                <img src={MEME_IMG[b.imageKey] ?? ""} alt="" className="h-8 w-8 shrink-0 rounded-lg border border-black/40 object-cover" draggable={false} />
                                <span className="min-w-0 flex-1 truncate text-xs font-bold text-white">{b.title}</span>
                                <span className="font-mono text-[10px] font-extrabold text-[#7be6d8]">{b.added ? "✓ IN PACK" : "+ ADD"}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : mode === "settings" ? (
                      <div
                        className="flex h-full flex-col gap-2 p-2.5"
                        style={{ background: "radial-gradient(circle at 50% 0%, #2a2263 0%, #110e29 100%)" }}
                      >
                        <ScreenHeader title="SETTINGS" onBack={() => setMode(view.hatched ? "menu" : "title")} />
                        <div className="flex flex-1 flex-col gap-1.5">
                          {settingsRows.map((label, i) => {
                            const sel = i === nav.settings;
                            return (
                              <button
                                key={label}
                                type="button"
                                onClick={() => {
                                  patchNav({ settings: i });
                                  handleUiButton("o");
                                }}
                                className="flex flex-1 items-center justify-between rounded-xl border px-3 py-1.5 text-left font-mono text-[10.5px] font-bold"
                                style={{
                                  borderColor: sel ? "#fde047" : "rgba(255,255,255,0.1)",
                                  background: sel ? "rgba(253,224,71,0.16)" : "rgba(255,255,255,0.05)",
                                  color: i === 3 && resetArm ? "#fb7185" : sel ? "#fde047" : "#ffffff",
                                }}
                              >
                                <span>{label}</span>
                                {sel && <span>O</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      /* STYLISH 320x240 (4:3) PET HABITAT HOME SCREEN */
                      <div className="relative flex h-full flex-col px-2.5 pb-2 pt-2">
                        <SceneBg tod={tod} />

                        {/* Floating Glass Top Status Bar */}
                        <div className="relative flex items-center justify-between gap-1.5">
                          <div
                            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 border border-white/20 shadow-sm max-w-[60%]"
                            style={{ background: "rgba(15, 12, 36, 0.78)" }}
                          >
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: mon.speciesDef.accentColor }} />
                            <span className="font-game truncate text-[9.5px] text-white">{mon.name.toUpperCase()}</span>
                            <span className="font-mono text-[9px] font-bold text-white/70 shrink-0">S{mon.stage}</span>
                          </div>
                          <div
                            className="flex items-center gap-2 rounded-full px-2.5 py-1 border border-white/20 font-mono text-[10px] font-bold shadow-sm"
                            style={{ background: "rgba(15, 12, 36, 0.78)" }}
                          >
                            <span className="text-[#fde047]">💧{mon.drip}</span>
                            <span className="text-orange-300">🔥{mon.careStreak.count}d</span>
                          </div>
                        </div>

                        {mon.speech && (
                          <div className="absolute left-3 top-[42px] z-10 max-w-[62%] rounded-2xl rounded-bl-sm border-2 border-[#1b1d36] bg-white/95 px-2.5 py-1 shadow-md">
                            <p className="text-[11px] font-bold leading-tight text-[#1b1d36]">“{mon.speech}”</p>
                          </div>
                        )}

                        {/* Monster Stage with Subtle Ground Shadow */}
                        <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center">
                          <div className={`aspect-square h-[106%] max-h-[162px] ${animClass}`}>
                            <Monster species={mon.species} stage={mon.displayStage} actualStage={mon.stage} mood={mood} equipped={view.equippedItems} />
                          </div>
                          <div className="-mt-3 h-2.5 w-20 rounded-full bg-black/25 blur-[2px]" aria-hidden />
                        </div>

                        {/* Sleek Frosted Bottom HUD + Clickable Quick-Action Dock */}
                        <div
                          className="relative mt-auto rounded-2xl border border-white/20 px-2.5 py-1.5 shadow-lg space-y-1.5"
                          style={{ background: "rgba(14, 11, 34, 0.86)" }}
                        >
                          <div className="grid grid-cols-5 gap-2">
                            <MiniStatBar glyph="🍖" value={mon.fullness} cap={mon.statCap} color="#34d399" />
                            <MiniStatBar glyph="💛" value={mon.happiness} cap={mon.statCap} color="#f472b6" />
                            <MiniStatBar glyph="🛁" value={mon.hygiene} cap={mon.statCap} color="#38bdf8" />
                            <MiniStatBar glyph="⚡" value={mon.energy} cap={mon.statCap} color="#fde047" />
                            <MiniStatBar glyph="🌶" value={mon.heat} cap={mon.heatCap} color="#fb923c" heat />
                          </div>
                          <div className="grid grid-cols-4 gap-1.5">
                            {(
                              [
                                ["feed", "🖼️ Feed (O)"],
                                ["care", "🧼 Care"],
                                ["games", "🎮 Arcade"],
                                ["menu", "☰ Menu"],
                              ] as const
                            ).map(([target, lbl]) => (
                              <button
                                key={target}
                                type="button"
                                onClick={() => {
                                  blipNav();
                                  setMode(target);
                                }}
                                className="rounded-lg bg-white/10 hover:bg-white/20 py-0.5 font-mono text-[9px] font-bold text-white/95 transition-colors"
                              >
                                {lbl}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {feedFx && view && mon && (
                  <div key={feedFx.id} className="pointer-events-none absolute inset-0 z-20" aria-hidden>
                    <img src={feedFx.src} alt="" className="anim-feed-fly absolute left-[35%] top-[14%] h-[32%] w-[30%] rounded-lg border-2 border-[#0a0a24] object-cover" draggable={false} />
                    <div className="absolute bottom-[2%] left-[30%] h-[52%] aspect-square">
                      <Monster species={mon.species} stage={mon.displayStage} actualStage={mon.stage} mood="eating" equipped={view.equippedItems} />
                    </div>
                  </div>
                )}
                {burst && <Burst kind={burst.kind} burstKey={burst.id} />}
                {screenMsg && mode !== "play_game" && (
                  <div
                    className="pointer-events-none absolute inset-x-3 bottom-2.5 z-20 rounded-xl border border-[#fde047]/60 px-3 py-1.5 text-center shadow-xl"
                    style={{ background: "rgba(12, 10, 32, 0.92)" }}
                  >
                    <p className="font-mono text-[10.5px] font-bold text-[#fde047]">{screenMsg}</p>
                  </div>
                )}
                {evoFlash && view && mon && (
                  <div className="anim-evo pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center px-3 text-center" style={{ background: "radial-gradient(circle at 50% 42%, #fff7cc 0%, #ffd23f 55%, #ff9d2e 100%)" }}>
                    <p className="font-game text-[14px] text-[#40260a]">★ EVOLVED! ★</p>
                    <div className="relative mt-1 h-[62%] aspect-square">
                      <div className="anim-evo-out absolute inset-0">
                        <Monster species={mon.species} stage={evoFlash.from} actualStage={evoFlash.from} mood="happy" equipped={[]} />
                      </div>
                      <div className="anim-evo-in absolute inset-0">
                        <Monster species={mon.species} stage={mon.stage} actualStage={mon.stage} mood="happy" equipped={view.equippedItems} />
                      </div>
                    </div>
                    <p className="font-game mt-1 text-[12px] text-[#40260a]">{evoFlash.name.toUpperCase()}</p>
                    <Burst kind="sparkles" burstKey={1} />
                  </div>
                )}
                {flash > 0 && <div key={flash} className="anim-flash pointer-events-none absolute inset-0 z-30 bg-white" />}
              </div>
            </div>

            {/* RIGHT WING: Glossy Candy-Glass O (Confirm/Action), X (Back/Special), -- (Menu/Pause + Hold PTT) */}
            <div className="order-3 flex md:flex-col items-center justify-around md:justify-center gap-4">
              <div className="flex items-center gap-3.5">
                <div className="flex flex-col items-center gap-1 mt-6">
                  <button
                    type="button"
                    aria-label="X Button: Back or Species Signature Special"
                    {...bindHw("x")}
                    style={{
                      background: hwPressed.x
                        ? "linear-gradient(180deg, #f9a8d4 0%, #ec4899 100%)"
                        : "linear-gradient(180deg, #d8b4fe 0%, #9333ea 60%, #6b21a8 100%)",
                      color: hwPressed.x ? "#141026" : "#ffffff",
                      borderBottom: "5px solid #3b0764",
                      boxShadow: "0 6px 14px rgba(107,33,168,0.45), inset 0 2px 3px rgba(255,255,255,0.42)",
                      transform: hwPressed.x ? "translateY(2px)" : undefined,
                    }}
                    className="h-13 w-13 rounded-full font-black text-lg flex items-center justify-center"
                  >
                    X
                  </button>
                  <span className="font-mono text-[10px] font-bold" style={{ color: shell.textMuted }}>
                    {mode === "play_game" && activeGame === "ember" ? "SWORD / OK" : "BACK / SP"}
                  </span>
                </div>

                <div className="flex flex-col items-center gap-1 -mt-6">
                  <button
                    type="button"
                    aria-label="O Button: Confirm or Primary Action"
                    {...bindHw("o")}
                    style={{
                      background: hwPressed.o
                        ? "linear-gradient(180deg, #fef08a 0%, #facc15 100%)"
                        : "linear-gradient(180deg, #99f6e4 0%, #2dd4bf 58%, #0d9488 100%)",
                      color: "#141026",
                      borderBottom: "5px solid #115e59",
                      boxShadow: "0 6px 16px rgba(20,184,166,0.45), inset 0 2px 3px rgba(255,255,255,0.5)",
                      transform: hwPressed.o ? "translateY(2px)" : undefined,
                    }}
                    className="h-14 w-14 rounded-full font-black text-xl flex items-center justify-center"
                  >
                    O
                  </button>
                  <span className="font-mono text-[10px] font-bold" style={{ color: shell.textMuted }}>
                    {mode === "play_game" && activeGame === "ember" ? "ITEM / BACK" : "OK / ACT"}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  aria-label="Menu Pause Button (Hold for Push-to-Talk Voice)"
                  {...bindHw("menu")}
                  style={{
                    background: hwPressed.menu || pttActive
                      ? "linear-gradient(180deg, #fef08a 0%, #facc15 100%)"
                      : shell.dpadBg,
                    color: hwPressed.menu || pttActive ? "#141026" : shell.dpadText,
                    borderBottom: "4px solid #100e1f",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22), 0 4px 10px rgba(0,0,0,0.35)",
                    transform: hwPressed.menu ? "translateY(1px)" : undefined,
                  }}
                  className="px-5 py-1.5 rounded-full font-mono text-xs font-black tracking-widest"
                >
                  --
                </button>
                <span className="font-mono text-[9.5px] font-bold" style={{ color: shell.textMuted }}>
                  {mode === "play_game" && activeGame === "ember" ? "START / SAVE" : "MENU / HOLD:🎙️"}
                </span>
              </div>
            </div>
          </div>

          <p className="mt-3 text-center text-[11px] font-medium" style={{ color: shell.textMuted }}>
            {mode === "play_game" && activeGame === "ember" ? (
              <>
                Ember Vale: <b>Arrows/WASD</b> Move · <b>X/J/Space</b> Sword/OK · <b>Z/K/O</b> Item/Back · <b>Enter/Esc</b> Start Menu (Save &amp; Exit)
              </>
            ) : (
              <>
                Keys: <b>Arrows/WASD</b> D-Pad (<b>▲</b> Fullscreen in Feed) · <b>Z/Space/Enter</b> O · <b>X/Backspace</b> X · <b>Esc/P</b> --
              </>
            )}
          </p>
        </div>

        {/* Always-On Carry Hardware Wake Sensor Strip (Light / Sound / Motion -> Meme Dream Screensaver) */}
        <section
          aria-label="Ambient Carry Wake Sensors"
          className="mt-3.5 flex w-full max-w-[880px] flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/90 px-4 py-2.5 text-xs shadow-lg"
        >
          <div className="min-w-0">
            <span className="font-bold text-[#fde047]">💭 Sleep Meme Dream Saver</span>
            <span className="ml-2 text-[var(--dim)]">
              Carry wake triggers ({view?.dreamMemes.length ?? 0} fed memes in dream reel)
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
              className="rounded-full border border-amber-400/40 bg-amber-400/15 px-3 py-1 text-[11px] font-bold text-amber-200 hover:bg-amber-400/25"
            >
              ☀️ Light
            </button>
            <button
              type="button"
              onClick={() => triggerAmbientSensor("sound")}
              className="rounded-full border border-teal-400/40 bg-teal-400/15 px-3 py-1 text-[11px] font-bold text-teal-200 hover:bg-teal-400/25"
            >
              🎙️ Sound
            </button>
            <button
              type="button"
              onClick={() => triggerAmbientSensor("motion")}
              className="rounded-full border border-violet-400/40 bg-violet-400/15 px-3 py-1 text-[11px] font-bold text-violet-200 hover:bg-violet-400/25"
            >
              📳 Motion
            </button>
          </div>
        </section>

        {/* Cloud Account Pairing Strip (6-Char ESP32-S3 Bearer Sync Protocol) */}
        <section
          aria-label="Cloud Account Device Pairing"
          className="mt-3 flex w-full max-w-[880px] flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/90 px-4 py-2.5 text-xs shadow-lg"
        >
          {pairedDevice ? (
            <>
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                <span className="font-bold text-emerald-300">🔗 Paired to {pairedDevice.accountHandle}</span>
                <span className="text-[var(--dim)] hidden sm:inline">· ESP32-S3 Bearer Sync + Real-Time SSE active</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  prevStage.current = null;
                  setInitRouted(false);
                  setMode("pet");
                  clearPairedDevice();
                  setPairedDevice(null);
                  setNotice("Unpaired handheld — switched back to browser session.");
                  void queryClient.invalidateQueries({ queryKey: ["gameState"] });
                }}
                className="rounded-full border border-rose-400/40 bg-rose-500/15 px-3 py-1 text-[11px] font-bold text-rose-200 hover:bg-rose-500/25"
              >
                Unpair Handheld
              </button>
            </>
          ) : (
            <>
              <div className="min-w-0">
                <span className="font-bold text-[#7be6d8]">🌐 Pair Handheld to Cloud Account</span>
                <span className="ml-2 text-[var(--dim)]">
                  Get a 6-character code from Companion → Online → Pair
                </span>
              </div>
              <form
                className="flex items-center gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (pairCodeInput.trim().length >= 6) pairMut.mutate(pairCodeInput.trim());
                }}
              >
                <input
                  aria-label="6-character pairing code"
                  maxLength={8}
                  value={pairCodeInput}
                  onChange={(e) => setPairCodeInput(e.target.value.toUpperCase())}
                  placeholder="6-CHAR CODE"
                  className="w-28 rounded-xl border border-[var(--border)] bg-black/35 px-2.5 py-1 font-mono text-xs font-bold tracking-widest text-[#fde047] uppercase outline-none focus:border-[#7be6d8]"
                />
                <button
                  type="submit"
                  disabled={pairCodeInput.trim().length < 6 || pairMut.isPending}
                  className="rounded-xl bg-[#7be6d8] px-3 py-1 text-[11px] font-extrabold text-[#141026] disabled:opacity-40"
                >
                  {pairMut.isPending ? "Pairing…" : "🔗 Pair"}
                </button>
              </form>
            </>
          )}
        </section>

        {/* Voice / URL Dock */}
        <form onSubmit={onTalk} className="mt-3 flex w-full max-w-[880px] gap-2">
          <input
            ref={talkInputRef}
            value={talkText}
            onChange={(e) => setTalkText(e.target.value)}
            placeholder={
              mode === "post"
                ? "Paste an image URL (https://…) to post to feed, or talk to your pet…"
                : "🎙️ Hold -- or type here to talk (try 'feed', 'stonks', 'doge', 'sus')…"
            }
            className="flex-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/90 px-4 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[#7be6d8]"
          />
          <button
            type="submit"
            disabled={!talkText.trim() || talkMut.isPending || urlMut.isPending}
            className="rounded-2xl bg-gradient-to-r from-[#7be6d8] to-[#fde047] px-5 py-2.5 text-sm font-extrabold text-[#141026] disabled:opacity-40"
          >
            {mode === "post" && URL_RE.test(talkText.trim()) ? "Post URL" : "Speak"}
          </button>
        </form>

        {notice && (
          <p className="mt-2 w-full max-w-[880px] rounded-2xl border border-[#7be6d8]/35 bg-[var(--surface)]/90 px-4 py-2 text-xs font-medium text-[#7be6d8]">
            {notice}
          </p>
        )}

        <details className="mt-3 w-full max-w-[880px] rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 px-4 py-2.5 text-xs text-[var(--dim)]">
          <summary className="cursor-pointer font-semibold text-[var(--text)]">
            Hardware Spec (320×240 IPS) &amp; Secret Voice Words ({view?.secrets.length ?? 0}/10 unlocked)
          </summary>
          <p className="mt-2 leading-relaxed">
            Display: <b>2.0" ST7789VW / 2.4" ILI9341 IPS TFT</b> (240×320 native, rotated <b>320×240 4:3 landscape</b>, 262K color, 4-wire SPI) · MCU: <b>ESP32-S3-N16R8</b> · Controls: <b>4-way D-Pad + O + X + -- (Hold for I2S Mic PTT)</b> · Carry Wake Sensors: <b>Light (BH1750/LDR) + Sound (INMP441 Mic) + Motion (LIS3DH/QMI8658 IMU)</b> wake directly into the Meme Dream Screensaver.
          </p>
          <p className="mt-1.5">
            Secret words to try: <span className="font-mono text-[#fde047]">{SECRET_HINTS.join(" · ")}</span>
          </p>
        </details>
      </main>
    </div>
  );
}
