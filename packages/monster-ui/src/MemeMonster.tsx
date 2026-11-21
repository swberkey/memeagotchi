import type { Mood } from "@memeagotchi/game-core";
import { useId } from "react";
import { CosmeticArtwork, type EquippedDisplayItem } from "./CosmeticArt.tsx";

const INK = "#282b47";

interface StagePalette {
  bodyTop: string;
  bodyMid: string;
  bodyBottom: string;
  belly: string;
  accent: string;
  accentLight: string;
  horn: string;
  hornShade: string;
}

/**
 * Unified mint-aqua & lavender palette derived directly from docs/art/character-sheet-v1.jpg,
 * progressing naturally from Baby Blob -> Critter -> Beast -> Legend -> Eldritch Meme Lord.
 */
const STAGE_PALETTES: readonly StagePalette[] = [
  // Stage 1: Blob (Baby Stage on sheet)
  {
    bodyTop: "#b8fbf0",
    bodyMid: "#89ecdf",
    bodyBottom: "#b9b3ee",
    belly: "#d2c5f9",
    accent: "#b7a6f3",
    accentLight: "#e4dcff",
    horn: "#b7a6f3",
    hornShade: "#8f7ad9",
  },
  // Stage 2: Critter (Teen Stage on sheet)
  {
    bodyTop: "#aef8ed",
    bodyMid: "#7ee6da",
    bodyBottom: "#b7aef0",
    belly: "#cfc0f7",
    accent: "#b59ef2",
    accentLight: "#e5dbff",
    horn: "#b49af0",
    hornShade: "#8b6fd6",
  },
  // Stage 3: Beast (Adult Stage on sheet)
  {
    bodyTop: "#a4f5ea",
    bodyMid: "#72dfd4",
    bodyBottom: "#b2a3ee",
    belly: "#cab6f7",
    accent: "#ae93ee",
    accentLight: "#e3d6ff",
    horn: "#b092ee",
    hornShade: "#8362cf",
  },
  // Stage 4: Legend (Celestial mint-gold evolution)
  {
    bodyTop: "#b4fcf4",
    bodyMid: "#6be0dc",
    bodyBottom: "#a898f2",
    belly: "#d8c8ff",
    accent: "#a78bfa",
    accentLight: "#fef08a",
    horn: "#facc15",
    hornShade: "#d97706",
  },
  // Stage 5: Eldritch Meme Lord (Cosmic opal-mint & nebula-violet evolution)
  {
    bodyTop: "#c4fff9",
    bodyMid: "#7ae2e6",
    bodyBottom: "#c084fc",
    belly: "#e9d5ff",
    accent: "#d946ef",
    accentLight: "#67e8f9",
    horn: "#e879f9",
    hornShade: "#9333ea",
  },
] as const;

interface StageAnchors {
  eyeY: number;
  eyeDX: number;
  mouthY: number;
  head: { x: number; y: number; scale: number };
  face: { x: number; y: number; scale: number };
  body: { x: number; y: number; scale: number };
  back: { x: number; y: number; scale: number };
  sticker: { x: number; y: number; scale: number };
}

const ANCHORS: readonly StageAnchors[] = [
  // Stage 1: Blob
  {
    eyeY: 108,
    eyeDX: 25,
    mouthY: 122,
    head: { x: 100, y: 40, scale: 0.72 },
    face: { x: 100, y: 108, scale: 0.96 },
    body: { x: 100, y: 148, scale: 0.85 },
    back: { x: 100, y: 128, scale: 1.08 },
    sticker: { x: 64, y: 136, scale: 0.34 },
  },
  // Stage 2: Critter
  {
    eyeY: 104,
    eyeDX: 26,
    mouthY: 118,
    head: { x: 100, y: 36, scale: 0.74 },
    face: { x: 100, y: 104, scale: 0.98 },
    body: { x: 100, y: 148, scale: 0.9 },
    back: { x: 100, y: 126, scale: 1.12 },
    sticker: { x: 62, y: 136, scale: 0.35 },
  },
  // Stage 3: Beast
  {
    eyeY: 101,
    eyeDX: 27,
    mouthY: 116,
    head: { x: 100, y: 34, scale: 0.76 },
    face: { x: 100, y: 101, scale: 1.02 },
    body: { x: 100, y: 148, scale: 0.95 },
    back: { x: 100, y: 126, scale: 1.18 },
    sticker: { x: 60, y: 136, scale: 0.36 },
  },
  // Stage 4: Legend
  {
    eyeY: 100,
    eyeDX: 27,
    mouthY: 115,
    head: { x: 100, y: 31, scale: 0.78 },
    face: { x: 100, y: 100, scale: 1.04 },
    body: { x: 100, y: 148, scale: 0.96 },
    back: { x: 100, y: 125, scale: 1.2 },
    sticker: { x: 59, y: 136, scale: 0.36 },
  },
  // Stage 5: Eldritch Meme Lord
  {
    eyeY: 100,
    eyeDX: 28,
    mouthY: 115,
    head: { x: 100, y: 28, scale: 0.8 },
    face: { x: 100, y: 100, scale: 1.06 },
    body: { x: 100, y: 148, scale: 0.98 },
    back: { x: 100, y: 124, scale: 1.24 },
    sticker: { x: 58, y: 136, scale: 0.36 },
  },
] as const;

function renderCosmeticAt(item: EquippedDisplayItem, a: StageAnchors) {
  const pt = a[item.slot];
  // Wizard hat / party hat sit slightly higher so brim kisses forehead cleanly
  const yOffset =
    item.assetId === "party-hat" ? -6 : item.assetId === "wizard-hat" ? -2 : item.assetId === "chef-hat" ? -2 : 0;
  return (
    <g
      key={item.assetId}
      transform={`translate(${pt.x}, ${pt.y + yOffset}) scale(${pt.scale}) translate(-50, -50)`}
      aria-hidden
    >
      <CosmeticArtwork assetId={item.assetId} />
    </g>
  );
}

/** GDD Decision #2: Stage 5 aura remains tied to actualStage even when Nostalgia shows an earlier look. */
function CosmicStage5Aura() {
  return (
    <g aria-hidden>
      <g className="anim-spin-slow">
        <ellipse
          cx="100"
          cy="108"
          rx="92"
          ry="84"
          fill="none"
          stroke="#e879f9"
          strokeWidth="3.5"
          strokeDasharray="8 10"
          opacity="0.78"
        />
      </g>
      <g className="anim-spin-rev">
        <ellipse
          cx="100"
          cy="108"
          rx="80"
          ry="72"
          fill="none"
          stroke="#38bdf8"
          strokeWidth="3"
          strokeDasharray="12 8"
          opacity="0.68"
        />
      </g>
      <g className="anim-spin-slower">
        <polygon points="100,10 105,19 95,19" fill="#fde047" />
        <circle cx="190" cy="108" r="5" fill="#f472b6" />
        <rect x="96" y="186" width="8" height="8" rx="1.5" fill="#38bdf8" />
        <polygon points="10,108 16,102 22,108 16,114" fill="#c084fc" />
      </g>
    </g>
  );
}

function LegendStage4Aura() {
  return (
    <g aria-hidden>
      <g className="anim-spin-slow">
        <ellipse
          cx="100"
          cy="108"
          rx="86"
          ry="78"
          fill="none"
          stroke="#fde047"
          strokeWidth="3.5"
          strokeDasharray="7 9"
          opacity="0.7"
        />
      </g>
      <polygon points="24,54 27,61 34,64 27,67 24,74 21,67 14,64 21,61" fill="#fde047" className="anim-twinkle" />
      <polygon
        points="176,58 178.5,64 184,66.5 178.5,69 176,75 173.5,69 168,66.5 173.5,64"
        fill="#67e8f9"
        className="anim-twinkle"
        style={{ animationDelay: "0.7s" }}
      />
    </g>
  );
}

function Eyes({ mood, a }: { mood: Mood; a: StageAnchors }) {
  const lx = 100 - a.eyeDX;
  const rx = 100 + a.eyeDX;
  const y = a.eyeY;

  if (mood === "sleeping" || mood === "sleepy") {
    return (
      <g stroke={INK} strokeWidth="4.4" strokeLinecap="round" fill="none">
        <path d={`M${lx - 11},${y + 1} Q${lx},${y + 10} ${lx + 11},${y + 1}`} />
        <path d={`M${rx - 11},${y + 1} Q${rx},${y + 10} ${rx + 11},${y + 1}`} />
      </g>
    );
  }

  if (mood === "sick" || mood === "roasted") {
    // Classic spiral dizzy eyes matching character-sheet-v1.jpg Sick column
    const spiral = (cx: number) => (
      <g fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round">
        <path
          d={`M${cx},${y} m-1,-1 a3.5,3.5 0 1,1 5,4 a7,7 0 1,1 -10,-6 a11,11 0 1,1 15,7`}
        />
      </g>
    );
    return (
      <g>
        {spiral(lx)}
        {spiral(rx)}
      </g>
    );
  }

  if (mood === "excited") {
    // Starry sparkle eyes matching character-sheet-v1.jpg Excited column
    const starEye = (cx: number) => (
      <g>
        <ellipse cx={cx} cy={y} rx="12" ry="13.5" fill={INK} />
        <polygon
          points={`${cx},${y - 9} ${cx + 3},${y - 3} ${cx + 9},${y} ${cx + 3},${y + 3} ${cx},${y + 9} ${cx - 3},${y + 3} ${cx - 9},${y} ${cx - 3},${y - 3}`}
          fill="#fde047"
        />
        <circle cx={cx - 4.5} cy={y - 5.5} r="2" fill="#ffffff" />
      </g>
    );
    return (
      <g>
        {starEye(lx)}
        {starEye(rx)}
      </g>
    );
  }

  return (
    <g>
      {mood === "sad" && (
        <g stroke={INK} strokeWidth="4" strokeLinecap="round">
          <line x1={lx - 11} y1={y - 14} x2={lx + 6} y2={y - 18} />
          <line x1={rx + 11} y1={y - 14} x2={rx - 6} y2={y - 18} />
        </g>
      )}
      {mood === "hangry" && (
        <g stroke={INK} strokeWidth="4.4" strokeLinecap="round">
          <line x1={lx - 11} y1={y - 17} x2={lx + 9} y2={y - 11} />
          <line x1={rx + 11} y1={y - 17} x2={rx - 9} y2={y - 11} />
        </g>
      )}
      <g className="anim-blink">
        <ellipse cx={lx} cy={y} rx="11" ry="12.5" fill={INK} />
        <ellipse cx={rx} cy={y} rx="11" ry="12.5" fill={INK} />
        {/* Crisp double kawaii specular highlights matching character-sheet-v1.jpg */}
        <circle cx={lx - 3.6} cy={y - 4.2} r="4" fill="#ffffff" />
        <circle cx={rx - 3.6} cy={y - 4.2} r="4" fill="#ffffff" />
        <circle cx={lx + 3.8} cy={y + 4.4} r="2" fill="#ffffff" opacity="0.92" />
        <circle cx={rx + 3.8} cy={y + 4.4} r="2" fill="#ffffff" opacity="0.92" />
      </g>
    </g>
  );
}

function Mouth({ mood, a }: { mood: Mood; a: StageAnchors }) {
  const y = a.mouthY;
  switch (mood) {
    case "sleepy":
    case "sleeping":
      return (
        <path
          d={`M93,${y + 4} Q100,${y - 2} 107,${y + 4} Q100,${y + 8} 93,${y + 4} Z`}
          fill={INK}
        />
      );
    case "sick":
    case "roasted":
      return (
        <path
          d={`M83,${y + 4} q4,-5 8.5,0 t8.5,0 t8.5,0 t8.5,0`}
          fill="none"
          stroke={INK}
          strokeWidth="3.8"
          strokeLinecap="round"
        />
      );
    case "sad":
      return (
        <path
          d={`M88,${y + 8} Q100,${y - 2} 112,${y + 8}`}
          fill="none"
          stroke={INK}
          strokeWidth="4"
          strokeLinecap="round"
        />
      );
    case "hangry":
      return (
        <g>
          <path d={`M85,${y + 7} Q100,${y - 4} 115,${y + 7} Q100,${y + 13} 85,${y + 7} Z`} fill={INK} />
          <polygon points={`92,${y + 4} 96,${y + 4} 94,${y + 9}`} fill="#ffffff" />
          <polygon points={`104,${y + 4} 108,${y + 4} 106,${y + 9}`} fill="#ffffff" />
        </g>
      );
    case "hungry":
      // Open hungry mouth + cute sky-blue drool drip matching character-sheet-v1.jpg
      return (
        <g>
          <path d={`M86,${y - 2} H114 Q114,${y + 16} 100,${y + 16} Q86,${y + 16} 86,${y - 2} Z`} fill={INK} />
          <ellipse cx="100" cy={y + 10} rx="9" ry="4.5" fill="#fb7185" />
          <path
            d={`M107,${y + 11} C111,${y + 11} 112,${y + 22} 109,${y + 27} C106,${y + 30} 103,${y + 26} 104,${y + 21} C105,${y + 17} 104,${y + 11} 107,${y + 11} Z`}
            fill="#bae6fd"
            stroke="#0284c7"
            strokeWidth="2.2"
          />
        </g>
      );
    case "eating":
      return (
        <g className="anim-chew">
          <path d={`M82,${y - 4} H118 Q118,${y + 20} 100,${y + 20} Q82,${y + 20} 82,${y - 4} Z`} fill={INK} />
          <ellipse cx="100" cy={y + 13} rx="11" ry="5" fill="#fb7185" />
        </g>
      );
    case "excited":
      return (
        <g>
          <path d={`M85,${y - 3} H115 Q115,${y + 20} 100,${y + 20} Q85,${y + 20} 85,${y - 3} Z`} fill={INK} />
          <ellipse cx="100" cy={y + 12} rx="10" ry="5.5" fill="#fb7185" />
        </g>
      );
    default:
      // Classic happy kawaii smile matching character-sheet-v1.jpg
      return (
        <g>
          <path d={`M88,${y - 1} H112 Q112,${y + 14} 100,${y + 14} Q88,${y + 14} 88,${y - 1} Z`} fill={INK} />
          <ellipse cx="100" cy={y + 9} rx="8" ry="4" fill="#fb7185" />
        </g>
      );
  }
}

function StageAppendages({
  stage,
  pal,
  excited,
}: {
  stage: number;
  pal: StagePalette;
  excited: boolean;
}) {
  const stroke = { stroke: INK, strokeWidth: 4.4, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  const armLift = excited ? -16 : 0;

  return (
    <g>
      {/* Stage 3+ spiky dragon tail peeking out bottom-right (Adult stage on sheet) */}
      {stage >= 3 && (
        <g>
          <path
            d="M144,142 Q168,150 172,165 Q154,174 134,162 Z"
            fill={pal.bodyMid}
            {...stroke}
          />
          <path d="M150,148 L156,141 L160,151 L167,147 L166,156" fill={pal.horn} stroke={INK} strokeWidth="2.8" strokeLinejoin="round" />
        </g>
      )}

      {/* Stage 3+ cute dragon wings (larger/celestial at 4 & 5) */}
      {stage >= 3 && (
        <g>
          {/* Left wing */}
          <path
            d={
              stage >= 4
                ? "M44,96 C22,74 6,78 4,94 C12,96 14,102 10,110 C22,108 26,114 24,122 C34,116 40,116 46,118 Z"
                : "M46,102 C28,88 12,92 10,104 C18,105 20,110 18,116 C28,113 34,115 44,118 Z"
            }
            fill={pal.accent}
            {...stroke}
          />
          <path d="M40,104 Q25,100 16,104" fill="none" stroke={pal.accentLight} strokeWidth="2.6" strokeLinecap="round" />
          {/* Right wing */}
          <path
            d={
              stage >= 4
                ? "M156,96 C178,74 194,78 196,94 C188,96 186,102 190,110 C178,108 174,114 176,122 C166,116 160,116 154,118 Z"
                : "M154,102 C172,88 188,92 190,104 C182,105 180,110 182,116 C172,113 166,115 156,118 Z"
            }
            fill={pal.accent}
            {...stroke}
          />
          <path d="M160,104 Q175,100 184,104" fill="none" stroke={pal.accentLight} strokeWidth="2.6" strokeLinecap="round" />
        </g>
      )}

      {/* Stage 1: Cute twin antennae on top (Baby stage on sheet) */}
      {stage === 1 && (
        <g>
          <path
            d="M97,56 C92,36 74,30 78,42 C80,48 91,52 96,58 Z"
            fill={pal.accent}
            {...stroke}
          />
          <path
            d="M103,56 C108,36 126,30 122,42 C120,48 109,52 104,58 Z"
            fill={pal.accent}
            {...stroke}
          />
          <ellipse cx="83" cy="39" rx="3" ry="1.8" fill="#ffffff" opacity="0.65" />
          <ellipse cx="117" cy="39" rx="3" ry="1.8" fill="#ffffff" opacity="0.65" />
        </g>
      )}

      {/* Stage 2: Little curved lavender horns (Teen stage on sheet — present on ALL moods including Sleepy!) */}
      {stage === 2 && (
        <g>
          <path d="M62,64 C52,48 54,36 62,40 C65,47 70,54 76,58 Z" fill={pal.horn} {...stroke} />
          <path d="M138,64 C148,48 146,36 138,40 C135,47 130,54 124,58 Z" fill={pal.horn} {...stroke} />
        </g>
      )}

      {/* Stage 3+: Larger curved striped horns (Adult stage + Legend/Eldritch crown horns) */}
      {stage >= 3 && (
        <g>
          <path d="M58,68 C42,48 44,24 58,28 C61,40 68,50 78,56 Z" fill={pal.horn} {...stroke} />
          <path d="M142,68 C158,48 156,24 142,28 C139,40 132,50 122,56 Z" fill={pal.horn} {...stroke} />
          {/* Horn ridges */}
          <path d="M53,48 Q60,44 65,48" fill="none" stroke={pal.hornShade} strokeWidth="2.8" strokeLinecap="round" />
          <path d="M147,48 Q140,44 135,48" fill="none" stroke={pal.hornShade} strokeWidth="2.8" strokeLinecap="round" />
          {/* Stage 5 extra cosmic side horns */}
          {stage >= 5 && (
            <>
              <path d="M78,52 L84,26 L94,48 Z" fill="#facc15" {...stroke} />
              <path d="M122,52 L116,26 L106,48 Z" fill="#facc15" {...stroke} />
            </>
          )}
        </g>
      )}

      {/* Stage 2+: Cute stubby arms (raise happily when excited!) */}
      {stage >= 2 && (
        <g>
          <path
            d={`M48,118 C34,${124 + armLift} 28,${138 + armLift} 40,${142 + armLift} C48,${143 + armLift} 54,${136 + armLift} 56,130`}
            fill={pal.bodyMid}
            {...stroke}
          />
          <path
            d={`M152,118 C166,${124 + armLift} 172,${138 + armLift} 160,${142 + armLift} C152,${143 + armLift} 146,${136 + armLift} 144,130`}
            fill={pal.bodyMid}
            {...stroke}
          />
        </g>
      )}

      {/* Stubby lavender feet matching character-sheet-v1.jpg */}
      <ellipse cx="72" cy="166" rx="16" ry="12" fill={pal.belly} {...stroke} />
      <ellipse cx="128" cy="166" rx="16" ry="12" fill={pal.belly} {...stroke} />
    </g>
  );
}

export interface MemeMonsterProps {
  /** Evolution look to render (1..5), supporting Nostalgia toggle */
  displayStage: number;
  /** True progression stage (1..5); keeps Stage 4/5 aura active under Nostalgia (GDD Decision #2) */
  actualStage?: number;
  mood: Mood;
  equipped?: EquippedDisplayItem[];
  className?: string;
}

export function MemeMonster({
  displayStage,
  actualStage,
  mood,
  equipped = [],
  className = "h-full w-full",
}: MemeMonsterProps) {
  const stageIdx = Math.min(5, Math.max(1, displayStage)) - 1;
  const trueStage = Math.min(5, Math.max(1, actualStage ?? displayStage));
  const pal = STAGE_PALETTES[stageIdx] ?? STAGE_PALETTES[0]!;
  const a = ANCHORS[stageIdx] ?? ANCHORS[0]!;
  const uid = useId().replace(/:/g, "");
  const gradId = `mochi-body-${uid}`;

  const backItems = equipped.filter((e) => e.slot === "back");
  const frontItems = equipped.filter((e) => e.slot !== "back");

  const topColor = mood === "roasted" ? "#fed7aa" : mood === "sick" ? "#95d5d2" : pal.bodyTop;
  const midColor = mood === "roasted" ? "#fb923c" : mood === "sick" ? "#76b9be" : pal.bodyMid;
  const botColor = mood === "roasted" ? "#ea580c" : mood === "sick" ? "#9ba8cf" : pal.bodyBottom;

  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      role="img"
      aria-label={`Meme Monster stage ${displayStage}, feeling ${mood}`}
    >
      <defs>
        <linearGradient id={gradId} x1="0.3" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor={topColor} />
          <stop offset="62%" stopColor={midColor} />
          <stop offset="100%" stopColor={botColor} />
        </linearGradient>
      </defs>

      {/* Progression Aura (GDD Decision #2: tied to actualStage!) */}
      {trueStage >= 5 ? <CosmicStage5Aura /> : trueStage === 4 ? <LegendStage4Aura /> : null}

      {/* Back cosmetics (Hero Cape) */}
      {backItems.map((it) => renderCosmeticAt(it, a))}

      <g className="anim-monster-breathe">
        <StageAppendages stage={displayStage} pal={pal} excited={mood === "excited"} />

        {/* Main rounded kawaii gummy body */}
        <path
          d="M100,52 C137,52 162,79 162,115 C162,149 138,170 100,170 C62,170 38,149 38,115 C38,79 63,52 100,52 Z"
          fill={`url(#${gradId})`}
          stroke={INK}
          strokeWidth="4.6"
          strokeLinejoin="round"
        />

        {/* Soft lavender belly cushion */}
        <ellipse cx="100" cy="147" rx="44" ry="18" fill={pal.belly} opacity="0.62" />

        {/* Signature gummy top-left gloss & dot highlight from character-sheet-v1.jpg */}
        <path
          d="M62,76 C68,64 82,59 94,61"
          fill="none"
          stroke="#ffffff"
          strokeWidth="6.5"
          strokeLinecap="round"
          opacity="0.72"
        />
        <circle cx="56" cy="87" r="3.4" fill="#ffffff" opacity="0.78" />

        {/* Stage 4 forehead star crystal */}
        {displayStage === 4 && (
          <g className="anim-gem" aria-hidden>
            <polygon points="100,64 109,75 100,86 91,75" fill="#67e8f9" stroke={INK} strokeWidth="2.8" strokeLinejoin="round" />
            <polygon points="100,68 104,75 100,80 96,75" fill="#ffffff" opacity="0.85" />
          </g>
        )}

        {/* Stage 5 cosmic third eye + subtle chromatic glitch bars */}
        {displayStage >= 5 && (
          <g aria-hidden>
            <g className="anim-glitch" opacity="0.45">
              <rect x="44" y="92" width="112" height="5" fill="#f472b6" />
              <rect x="52" y="130" width="96" height="5" fill="#38bdf8" />
            </g>
            <circle cx="100" cy="72" r="10" fill="#f472b6" opacity="0.32" className="anim-gem" />
            <circle cx="100" cy="72" r="6.8" fill="#ffffff" stroke={INK} strokeWidth="2.6" />
            <circle cx="100" cy="72" r="3.5" fill={INK} />
            <circle cx="98.8" cy="70.8" r="1.4" fill="#67e8f9" />
          </g>
        )}

        {/* Sick forehead chill blush */}
        {mood === "sick" && (
          <ellipse cx="100" cy="74" rx="34" ry="12" fill="#3b82f6" opacity="0.22" aria-hidden />
        )}

        {/* Roasted flame tufts */}
        {mood === "roasted" && (
          <g fill="#f97316" className="anim-flicker" style={{ transformOrigin: "100px 44px" }} aria-hidden>
            <polygon points="100,24 108,42 100,50 92,42" />
            <polygon points="74,34 80,46 73,52 68,42" fill="#facc15" />
            <polygon points="126,34 132,42 127,52 120,46" fill="#facc15" />
          </g>
        )}

        {/* Face */}
        <Eyes mood={mood} a={a} />
        <Mouth mood={mood} a={a} />

        {/* Soft rosy cheeks on cheerful moods */}
        {(mood === "happy" || mood === "excited" || mood === "eating" || mood === "hungry") && (
          <g fill="#f9a8d4" opacity="0.72" aria-hidden>
            <ellipse cx={100 - a.eyeDX - 11} cy={a.eyeY + 13} rx="7.5" ry="4.4" />
            <ellipse cx={100 + a.eyeDX + 11} cy={a.eyeY + 13} rx="7.5" ry="4.4" />
          </g>
        )}

        {/* Sleepy / Sleeping Zzz & floating bubbles matching character-sheet-v1.jpg */}
        {(mood === "sleepy" || mood === "sleeping") && (
          <g className="anim-zzz" aria-hidden>
            <circle cx="152" cy="54" r="6" fill="#bae6fd" stroke="#0284c7" strokeWidth="2.2" opacity="0.85" />
            <circle cx="164" cy="40" r="8.5" fill="#e0f2fe" stroke="#0284c7" strokeWidth="2.2" opacity="0.85" />
            <text x="150" y="74" fontSize="15" fontWeight="800" fill="#60a5fa" stroke={INK} strokeWidth="0.8">
              Z
            </text>
            <text x="164" y="62" fontSize="19" fontWeight="800" fill="#93c5fd" stroke={INK} strokeWidth="0.8">
              Z
            </text>
          </g>
        )}

        {/* Stinky wisps when hygiene < 30 */}
        {mood === "sick" && (
          <g fill="none" stroke="#84cc16" strokeWidth="3.5" strokeLinecap="round" opacity="0.75" aria-hidden>
            <path d="M40,78 q5,-8 0,-15 q-5,-7 0,-14" className="anim-wisp" />
            <path d="M160,74 q5,-8 0,-15 q-5,-7 0,-14" className="anim-wisp" style={{ animationDelay: "0.9s" }} />
          </g>
        )}
      </g>

      {/* Front cosmetics (head, face, body, sticker) */}
      {frontItems.map((it) => renderCosmeticAt(it, a))}
    </svg>
  );
}
