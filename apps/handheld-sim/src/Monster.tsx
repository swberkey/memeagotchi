import type { CosmeticSlot, Mood } from "@memeagotchi/game-core";

export interface EquippedItem {
  slot: CosmeticSlot;
  assetId: string;
  emoji: string;
  name: string;
}

const FACE = [
  { eyeY: 86, eyeDX: 27, eyeW: 19, eyeH: 24, mouthY: 122, glassesY: 80 },
  { eyeY: 80, eyeDX: 30, eyeW: 19, eyeH: 24, mouthY: 118, glassesY: 74 },
  { eyeY: 74, eyeDX: 34, eyeW: 20, eyeH: 26, mouthY: 114, glassesY: 68 },
  { eyeY: 70, eyeDX: 36, eyeW: 20, eyeH: 26, mouthY: 112, glassesY: 64 },
  { eyeY: 66, eyeDX: 38, eyeW: 20, eyeH: 27, mouthY: 110, glassesY: 60 },
] as const;

const COSMETIC_ANCHORS = [
  { head: { x: 96, y: 34, size: 46 }, body: { x: 96, y: 152, size: 34 }, back: { x: 170, y: 108, size: 42 }, sticker: { x: 50, y: 136, size: 27 } },
  { head: { x: 96, y: 26, size: 47 }, body: { x: 96, y: 150, size: 34 }, back: { x: 172, y: 108, size: 44 }, sticker: { x: 46, y: 134, size: 27 } },
  { head: { x: 96, y: 22, size: 50 }, body: { x: 96, y: 148, size: 35 }, back: { x: 175, y: 104, size: 46 }, sticker: { x: 42, y: 132, size: 29 } },
  { head: { x: 96, y: 18, size: 50 }, body: { x: 96, y: 148, size: 35 }, back: { x: 177, y: 102, size: 46 }, sticker: { x: 40, y: 130, size: 29 } },
  { head: { x: 96, y: 14, size: 52 }, body: { x: 96, y: 152, size: 35 }, back: { x: 179, y: 100, size: 48 }, sticker: { x: 38, y: 128, size: 29 } },
] as const;

const PALETTES = [
  { body: "#8be04e", dark: "#5da832", deep: "#3f7a20", light: "#dcf9b0", rim: "#eaffc9" },
  { body: "#57c84a", dark: "#37912c", deep: "#256b1e", light: "#c2f2ab", rim: "#e2ffc9" },
  { body: "#3fc97e", dark: "#27955a", deep: "#1a6b3e", light: "#b2efcd", rim: "#d2ffe6" },
  { body: "#2fbfae", dark: "#1d8a7e", deep: "#13665c", light: "#abece4", rim: "#d0fff8" },
  { body: "#b06ee8", dark: "#7e3fc4", deep: "#5b2a94", light: "#e9caff", rim: "#f6e3ff" },
] as const;

const OUTLINE = "#191930";
const INK = "#191930";
const AMBER = "#ffb02e";
const GOLD = "#ffd23f";
const PINK = "#ff5da2";
const CYAN = "#5ff2ff";
const TONGUE = "#ff7d9c";

type Pal = (typeof PALETTES)[number];
type FaceT = (typeof FACE)[number];

function Eyes({ mood, f }: { mood: Mood; f: FaceT }) {
  const lx = 96 - f.eyeDX - f.eyeW;
  const rx = 96 + f.eyeDX;
  const y = f.eyeY;
  const cxL = lx + f.eyeW / 2;
  const cxR = rx + f.eyeW / 2;

  if (mood === "sleeping" || mood === "sleepy") {
    return (
      <g stroke={INK} strokeWidth={4} strokeLinecap="round" fill="none">
        <path d={`M${lx + 1},${y + 10} q${f.eyeW / 2},7 ${f.eyeW - 2},0`} />
        <path d={`M${rx + 1},${y + 10} q${f.eyeW / 2},7 ${f.eyeW - 2},0`} />
        <line x1={lx + 3} y1={y + 16} x2={lx} y2={y + 20} strokeWidth={3} />
        <line x1={rx + f.eyeW - 3} y1={y + 16} x2={rx + f.eyeW} y2={y + 20} strokeWidth={3} />
      </g>
    );
  }
  if (mood === "sick" || mood === "roasted") {
    const xEye = (cx: number) => (
      <g stroke={INK} strokeWidth={4.5} strokeLinecap="round">
        <line x1={cx - 8} y1={y + 1} x2={cx + 8} y2={y + 17} />
        <line x1={cx + 8} y1={y + 1} x2={cx - 8} y2={y + 17} />
      </g>
    );
    return (
      <g>
        {xEye(cxL)}
        {xEye(cxR)}
      </g>
    );
  }
  if (mood === "excited") {
    const starEye = (cx: number, cy: number) => (
      <g>
        <circle cx={cx} cy={cy} r={11} fill={INK} />
        <polygon
          points={`${cx},${cy - 8} ${cx + 2.4},${cy - 2.4} ${cx + 8},${cy} ${cx + 2.4},${cy + 2.4} ${cx},${cy + 8} ${cx - 2.4},${cy + 2.4} ${cx - 8},${cy} ${cx - 2.4},${cy - 2.4}`}
          fill={GOLD}
        />
      </g>
    );
    return (
      <g>
        {starEye(cxL, y + f.eyeH / 2)}
        {starEye(cxR, y + f.eyeH / 2)}
      </g>
    );
  }
  const pupilY = mood === "sad" ? y + 9 : y + 7;
  return (
    <g>
      {mood === "sad" && (
        <g fill={INK}>
          <rect x={lx - 1} y={y - 6} width={f.eyeW + 2} height={4.5} rx={2} transform={`rotate(-13 ${cxL} ${y - 4})`} />
          <rect x={rx - 1} y={y - 6} width={f.eyeW + 2} height={4.5} rx={2} transform={`rotate(13 ${cxR} ${y - 4})`} />
        </g>
      )}
      {(mood === "hungry" || mood === "hangry") && (
        <g fill={INK}>
          <rect x={lx - 1} y={y - 6} width={f.eyeW + 2} height={4.5} rx={2} transform={`rotate(11 ${cxL} ${y - 4})`} />
          <rect x={rx - 1} y={y - 6} width={f.eyeW + 2} height={4.5} rx={2} transform={`rotate(-11 ${cxR} ${y - 4})`} />
        </g>
      )}
      <g className="anim-blink">
        <rect x={lx} y={y} width={f.eyeW} height={f.eyeH} rx={7} fill="#ffffff" stroke={INK} strokeWidth={3} />
        <rect x={rx} y={y} width={f.eyeW} height={f.eyeH} rx={7} fill="#ffffff" stroke={INK} strokeWidth={3} />
        <ellipse cx={cxL} cy={pupilY + 6} rx={5.6} ry={7.4} fill={INK} />
        <ellipse cx={cxR} cy={pupilY + 6} rx={5.6} ry={7.4} fill={INK} />
        <circle cx={cxL - 2} cy={pupilY + 2.5} r={2.4} fill="#ffffff" />
        <circle cx={cxR - 2} cy={pupilY + 2.5} r={2.4} fill="#ffffff" />
        <circle cx={cxL + 2.6} cy={pupilY + 9} r={1.3} fill="#ffffff" opacity={0.9} />
        <circle cx={cxR + 2.6} cy={pupilY + 9} r={1.3} fill="#ffffff" opacity={0.9} />
      </g>
    </g>
  );
}

function Mouth({ mood, f }: { mood: Mood; f: FaceT }) {
  const y = f.mouthY;
  switch (mood) {
    case "eating":
      return (
        <g className="anim-chew">
          <path d="M74,0 h44 v6 a22,17 0 0 1 -44,0 z" transform={`translate(0 ${y - 6})`} fill={INK} />
          <g fill="#ffffff">
            <polygon points={`78,${y - 6} 86,${y - 6} 82,${y + 1}`} />
            <polygon points={`90,${y - 6} 98,${y - 6} 94,${y + 1}`} />
            <polygon points={`102,${y - 6} 110,${y - 6} 106,${y + 1}`} />
            <polygon points={`86,${y + 15} 93,${y + 15} 89.5,${y + 9}`} />
            <polygon points={`99,${y + 15} 106,${y + 15} 102.5,${y + 9}`} />
          </g>
          <ellipse cx={96} cy={y + 12} rx={11} ry={4.5} fill={TONGUE} />
        </g>
      );
    case "hungry":
    case "hangry":
      return (
        <g>
          <path d={`M78,${y} h36 v4 a18,13 0 0 1 -36,0 z`} fill={INK} />
          <polygon points={`84,${y} 92,${y} 88,${y + 6}`} fill="#ffffff" />
          <polygon points={`100,${y} 108,${y} 104,${y + 6}`} fill="#ffffff" />
          <ellipse cx={96} cy={y + 11} rx={9} ry={3.6} fill={TONGUE} />
          <rect x={112} y={y + 8} width={3.4} height={8} rx={1.7} fill={CYAN} opacity={0.9} />
          <circle cx={113.7} cy={y + 19} r={3.2} fill={CYAN} opacity={0.9} />
        </g>
      );
    case "sad":
      return (
        <g fill="none" stroke={INK} strokeWidth={4.5} strokeLinecap="round">
          <path d={`M80,${y + 10} q16,-11 32,0`} />
        </g>
      );
    case "roasted":
      return (
        <g fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round">
          <polyline points={`76,${y + 4} 86,${y - 2} 96,${y + 4} 106,${y - 2} 116,${y + 4}`} />
        </g>
      );
    case "sleeping":
    case "sleepy":
      return <ellipse cx={96} cy={y + 4} rx={5.5} ry={7} fill={INK} />;
    case "sick":
      return (
        <g fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round">
          <polyline points={`80,${y + 6} 88,${y + 1} 96,${y + 6} 104,${y + 1} 112,${y + 6}`} />
        </g>
      );
    default:
      return (
        <g>
          <path d={`M76,${y - 2} h40 v3 a20,14 0 0 1 -40,0 z`} fill={INK} />
          <polygon points={`82,${y - 2} 90,${y - 2} 86,${y + 5}`} fill="#ffffff" />
          <polygon points={`102,${y - 2} 109,${y - 2} 105.5,${y + 4}`} fill="#ffffff" opacity={0.92} />
          <ellipse cx={96} cy={y + 10.5} rx={10} ry={4} fill={TONGUE} />
        </g>
      );
  }
}

function Layers({ pal, bellyY, bellyRx, bellyRy }: { pal: Pal; bellyY: number; bellyRx: number; bellyRy: number }) {
  return (
    <g aria-hidden>
      <ellipse cx={118} cy={bellyY + 16} rx={bellyRx + 26} ry={bellyRy + 12} fill={pal.dark} opacity={0.38} />
      <ellipse cx={96} cy={bellyY} rx={bellyRx} ry={bellyRy} fill={pal.light} opacity={0.92} />
      <ellipse cx={96} cy={bellyY + bellyRy - 4} rx={bellyRx - 7} ry={5} fill={pal.dark} opacity={0.28} />
      <ellipse cx={66} cy={62} rx={17} ry={10} fill="#ffffff" opacity={0.4} transform="rotate(-24 66 62)" />
      <ellipse cx={60} cy={57} rx={7} ry={4} fill="#ffffff" opacity={0.65} transform="rotate(-24 60 57)" />
      <path d="M148,58 q17,26 13,62" fill="none" stroke={pal.rim} strokeWidth={5} strokeLinecap="round" opacity={0.75} />
      <path d="M52,44 q14,-13 34,-16" fill="none" stroke={pal.rim} strokeWidth={4} strokeLinecap="round" opacity={0.5} />
    </g>
  );
}

function Star({ x, y, s, fill, delay }: { x: number; y: number; s: number; fill: string; delay: string }) {
  return (
    <polygon
      className="anim-twinkle"
      style={{ animationDelay: delay }}
      points={`${x},${y - s} ${x + s * 0.28},${y - s * 0.28} ${x + s},${y} ${x + s * 0.28},${y + s * 0.28} ${x},${y + s} ${x - s * 0.28},${y + s * 0.28} ${x - s},${y} ${x - s * 0.28},${y - s * 0.28}`}
      fill={fill}
      aria-hidden
    />
  );
}

/** GDD Decision #2: Stage 5 aura remains visible even when Nostalgia displays an earlier stage. */
function Stage5AuraOverlay() {
  return (
    <g aria-hidden>
      <g className="anim-spin-slow">
        <ellipse cx={96} cy={102} rx={93} ry={89} fill="none" stroke={PINK} strokeWidth={4} strokeDasharray="7 10" opacity={0.8} />
      </g>
      <g className="anim-spin-rev">
        <ellipse cx={96} cy={102} rx={82} ry={78} fill="none" stroke={AMBER} strokeWidth={4} strokeDasharray="12 7" opacity={0.7} />
      </g>
      <g className="anim-spin-slower">
        <text x={96} y={14} fontSize={16} textAnchor="middle" fill={GOLD}>▲</text>
        <text x={182} y={108} fontSize={16} textAnchor="middle" fill={PINK}>●</text>
        <text x={96} y={190} fontSize={16} textAnchor="middle" fill={CYAN}>■</text>
        <text x={10} y={108} fontSize={16} textAnchor="middle" fill={AMBER}>◆</text>
      </g>
    </g>
  );
}

const SHAPE = { stroke: OUTLINE, strokeWidth: 4, strokeLinejoin: "round" as const };

function Body({ stage }: { stage: number }) {
  const pal = PALETTES[Math.min(5, Math.max(1, stage)) - 1] ?? PALETTES[0];
  switch (stage) {
    case 1:
      return (
        <g>
          <g aria-hidden>
            <path d="M94,50 q1,-14 0,-22" fill="none" stroke={pal.deep} strokeWidth={5} strokeLinecap="round" />
            <ellipse cx={82} cy={26} rx={13} ry={6.5} fill={pal.dark} transform="rotate(-26 82 26)" />
            <ellipse cx={111} cy={22} rx={13} ry={6.5} fill={pal.body} stroke={pal.deep} strokeWidth={2.4} transform="rotate(24 111 22)" />
            <ellipse cx={108} cy={20} rx={5} ry={2.2} fill="#ffffff" opacity={0.55} transform="rotate(24 108 20)" />
          </g>
          <path d="M96,44 C126,44 152,66 160,98 C167,126 164,152 150,166 C138,177 54,177 42,166 C28,152 25,126 32,98 C40,66 66,44 96,44 Z" fill={pal.body} {...SHAPE} />
          <Layers pal={pal} bellyY={140} bellyRx={30} bellyRy={24} />
          <g fill={pal.body} stroke={OUTLINE} strokeWidth={3} aria-hidden>
            <circle cx={62} cy={172} r={8} />
            <circle cx={96} cy={176} r={6.5} />
            <circle cx={130} cy={172} r={7.5} />
          </g>
          <g fill="none" stroke="#ffffff" strokeWidth={2.4} opacity={0.75} aria-hidden>
            <circle cx={52} cy={104} r={5.5} />
            <circle cx={142} cy={92} r={4.4} />
            <circle cx={136} cy={132} r={6} />
          </g>
        </g>
      );
    case 2:
      return (
        <g>
          <path d="M158,118 q30,-6 26,20 q-3,20 -28,16 q-8,-16 2,-36" fill={pal.dark} {...SHAPE} />
          <polygon points="48,58 58,18 84,44" fill={pal.body} {...SHAPE} />
          <polygon points="144,58 134,18 108,44" fill={pal.body} {...SHAPE} />
          <polygon points="57,50 62,30 76,44" fill={PINK} opacity={0.8} />
          <polygon points="135,50 130,30 116,44" fill={PINK} opacity={0.8} />
          <rect x={52} y={162} width={30} height={15} rx={6} fill={pal.dark} {...SHAPE} />
          <rect x={110} y={162} width={30} height={15} rx={6} fill={pal.dark} {...SHAPE} />
          <path d="M28,104 q-12,22 2,38 l16,-6 q-8,-16 -4,-32 z" fill={pal.body} {...SHAPE} />
          <path d="M164,104 q12,22 -2,38 l-16,-6 q8,-16 4,-32 z" fill={pal.body} {...SHAPE} />
          <path d="M96,38 C128,38 156,58 164,92 C171,122 166,152 152,166 C140,176 52,176 40,166 C26,152 21,122 28,92 C36,58 64,38 96,38 Z" fill={pal.body} {...SHAPE} />
          <Layers pal={pal} bellyY={138} bellyRx={32} bellyRy={25} />
          <ellipse cx={96} cy={138} rx={32} ry={25} fill="none" stroke={pal.deep} strokeWidth={2.6} strokeDasharray="6 5" opacity={0.75} aria-hidden />
        </g>
      );
    case 3:
      return (
        <g>
          <polygon points="38,30 60,52 42,62" fill={AMBER} {...SHAPE} />
          <polygon points="154,30 132,52 150,62" fill={AMBER} {...SHAPE} />
          <rect x={50} y={166} width={32} height={15} rx={6} fill={pal.dark} {...SHAPE} />
          <rect x={110} y={166} width={32} height={15} rx={6} fill={pal.dark} {...SHAPE} />
          <path d="M24,100 q-13,24 0,44 l17,-5 q-9,-18 -5,-36 z" fill={pal.body} {...SHAPE} />
          <path d="M168,100 q13,24 0,44 l-17,-5 q9,-18 5,-36 z" fill={pal.body} {...SHAPE} />
          <polygon points="162,128 186,140 163,150" fill={pal.dark} {...SHAPE} />
          <path d="M96,34 C130,34 158,54 166,90 C173,122 168,154 154,168 C142,179 50,179 38,168 C24,154 19,122 26,90 C34,54 62,34 96,34 Z" fill={pal.body} {...SHAPE} />
          <g fill={AMBER} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" aria-hidden>
            <polygon points="164,66 184,76 165,86" />
            <polygon points="167,94 188,104 167,114" />
            <polygon points="74,38 84,20 94,36" />
            <polygon points="96,36 106,18 116,38" />
          </g>
          <Layers pal={pal} bellyY={140} bellyRx={33} bellyRy={26} />
        </g>
      );
    case 4:
      return (
        <g>
          <g className="anim-spin-slow">
            <ellipse cx={96} cy={102} rx={90} ry={86} fill="none" stroke={GOLD} strokeWidth={4} strokeDasharray="8 8" opacity={0.65} />
          </g>
          <polygon points="34,74 4,54 12,96 32,100" fill={pal.light} {...SHAPE} />
          <polygon points="158,74 188,54 180,96 160,100" fill={pal.light} {...SHAPE} />
          <polygon points="40,22 58,50 42,58" fill={GOLD} {...SHAPE} />
          <polygon points="152,22 134,50 150,58" fill={GOLD} {...SHAPE} />
          <polygon points="96,10 108,38 84,38" fill={GOLD} {...SHAPE} />
          <rect x={52} y={168} width={31} height={15} rx={6} fill={pal.dark} {...SHAPE} />
          <rect x={109} y={168} width={31} height={15} rx={6} fill={pal.dark} {...SHAPE} />
          <path d="M26,102 q-12,24 1,42 l17,-5 q-9,-17 -5,-35 z" fill={pal.body} {...SHAPE} />
          <path d="M166,102 q12,24 -1,42 l-17,-5 q9,-17 5,-35 z" fill={pal.body} {...SHAPE} />
          <path d="M96,30 C130,30 158,50 166,88 C173,120 168,154 154,169 C142,180 50,180 38,169 C24,154 19,120 26,88 C34,50 62,30 96,30 Z" fill={pal.body} {...SHAPE} />
          <Layers pal={pal} bellyY={142} bellyRx={34} bellyRy={26} />
          <g className="anim-gem" aria-hidden>
            <polygon points="96,42 108,56 96,70 84,56" fill={CYAN} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
            <polygon points="96,47 102,56 96,61 90,56" fill="#ffffff" opacity={0.8} />
          </g>
          <Star x={26} y={40} s={8} fill={GOLD} delay="0s" />
          <Star x={168} y={48} s={7} fill={GOLD} delay="0.7s" />
        </g>
      );
    default:
      return (
        <g>
          <polygon points="30,14 52,46 34,56" fill={PINK} {...SHAPE} />
          <polygon points="162,14 140,46 158,56" fill={PINK} {...SHAPE} />
          <polygon points="66,4 78,30 58,32" fill={AMBER} {...SHAPE} />
          <polygon points="126,4 114,30 134,32" fill={AMBER} {...SHAPE} />
          <rect x={50} y={170} width={31} height={15} rx={6} fill={pal.dark} {...SHAPE} />
          <rect x={111} y={170} width={31} height={15} rx={6} fill={pal.dark} {...SHAPE} />
          <g fill="none" strokeLinecap="round" aria-hidden>
            <path d="M28,102 q-20,12 -13,36 q4,11 14,12" stroke={OUTLINE} strokeWidth={19} />
            <path d="M28,102 q-20,12 -13,36 q4,11 14,12" stroke={pal.body} strokeWidth={12} />
            <path d="M164,102 q20,12 13,36 q-4,11 -14,12" stroke={OUTLINE} strokeWidth={19} />
            <path d="M164,102 q20,12 13,36 q-4,11 -14,12" stroke={pal.body} strokeWidth={12} />
          </g>
          <path d="M96,26 C132,26 160,46 168,86 C175,120 170,156 156,171 C144,182 48,182 36,171 C22,156 17,120 24,86 C32,46 60,26 96,26 Z" fill={pal.body} {...SHAPE} />
          <Layers pal={pal} bellyY={144} bellyRx={35} bellyRy={27} />
          <g className="anim-glitch" aria-hidden>
            <rect x={28} y={82} width={136} height={7} fill={PINK} opacity={0.5} />
            <rect x={38} y={128} width={116} height={7} fill={AMBER} opacity={0.5} />
          </g>
          <g aria-hidden>
            <circle cx={96} cy={48} r={13} fill={PINK} opacity={0.35} className="anim-gem" />
            <circle cx={96} cy={48} r={8.5} fill="#ffffff" stroke={INK} strokeWidth={2.6} />
            <circle cx={96} cy={48} r={4.6} fill={INK} />
          </g>
          <Star x={20} y={30} s={7.5} fill={PINK} delay="0.3s" />
          <Star x={174} y={26} s={7} fill={CYAN} delay="1s" />
        </g>
      );
  }
}

function CosmeticLayer({ item, stage, f }: { item: EquippedItem; stage: number; f: FaceT }) {
  const anchors = COSMETIC_ANCHORS[Math.min(5, Math.max(1, stage)) - 1] ?? COSMETIC_ANCHORS[0];
  if (item.assetId === "shades") {
    const lx = 96 - f.eyeDX - f.eyeW;
    const rx = 96 + f.eyeDX;
    return (
      <g aria-hidden>
        <rect x={lx - 6} y={f.glassesY} width={f.eyeW + 12} height={f.eyeH + 10} rx={4} fill={INK} opacity={0.95} />
        <rect x={rx - 6} y={f.glassesY} width={f.eyeW + 12} height={f.eyeH + 10} rx={4} fill={INK} opacity={0.95} />
        <rect x={lx + f.eyeW + 6} y={f.glassesY + 8} width={f.eyeDX * 2 - f.eyeW} height={6} fill={INK} />
        <rect x={lx - 2} y={f.glassesY + 4} width={9} height={4} fill="#ffffff" opacity={0.85} />
        <rect x={rx - 2} y={f.glassesY + 4} width={9} height={4} fill="#ffffff" opacity={0.85} />
      </g>
    );
  }
  if (item.assetId === "chef-hat") {
    const y = anchors.head.y;
    return (
      <g transform={`translate(56, ${y - 24}) scale(0.8)`} aria-hidden>
        <path d="M22,42 C10,40 10,18 26,18 C30,6 50,4 58,14 C72,6 88,18 82,34 C88,42 78,46 74,46 L26,46 Z" fill="#ffffff" stroke={OUTLINE} strokeWidth="4" strokeLinejoin="round" />
        <rect x="24" y="44" width="52" height="16" rx="4" fill="#f1f5f9" stroke={OUTLINE} strokeWidth="4" />
      </g>
    );
  }
  if (item.assetId === "party-hat") {
    const y = anchors.head.y;
    return (
      <g transform={`translate(66, ${y - 32}) scale(0.75)`} aria-hidden>
        <polygon points="40,12 14,72 66,72" fill={PINK} stroke={OUTLINE} strokeWidth="4" strokeLinejoin="round" />
        <polygon points="40,26 24,56 56,56" fill={CYAN} />
        <circle cx="40" cy="10" r="8" fill={GOLD} stroke={OUTLINE} strokeWidth="3.5" />
      </g>
    );
  }
  if (item.assetId === "wizard-hat") {
    const y = anchors.head.y;
    return (
      <g transform={`translate(44, ${y - 30}) scale(0.86)`} aria-hidden>
        <ellipse cx="60" cy="60" rx="52" ry="12" fill="#7c3aed" stroke={OUTLINE} strokeWidth="4" />
        <path d="M28,58 L58,8 L92,58 Z" fill="#8b5cf6" stroke={OUTLINE} strokeWidth="4" strokeLinejoin="round" />
        <circle cx="58" cy="34" r="4" fill={GOLD} />
      </g>
    );
  }
  if (item.assetId === "wizard-robe") {
    const y = anchors.body.y;
    return (
      <g transform={`translate(46, ${y - 16}) scale(0.9)`} aria-hidden>
        <path d="M22,4 Q55,16 88,4 L102,40 Q55,32 8,40 Z" fill="#7c3aed" stroke={OUTLINE} strokeWidth="4" strokeLinejoin="round" />
        <circle cx="34" cy="24" r="3.5" fill={GOLD} />
        <circle cx="55" cy="27" r="4" fill={GOLD} />
        <circle cx="76" cy="24" r="3.5" fill={GOLD} />
      </g>
    );
  }
  if (item.slot === "face") {
    return (
      <text x={96} y={f.glassesY + f.eyeH + 4} fontSize={40} textAnchor="middle" dominantBaseline="central" aria-hidden>
        {item.emoji}
      </text>
    );
  }
  const a = anchors[item.slot as keyof typeof anchors];
  if (!a) return null;
  return (
    <text x={a.x} y={a.y} fontSize={a.size} textAnchor="middle" dominantBaseline="central" aria-hidden>
      {item.emoji}
    </text>
  );
}

function StinkWisps() {
  const wisp = (x: number, delay: string) => (
    <path
      d={`M${x},64 q6,-9 0,-17 q-6,-8 0,-16`}
      fill="none"
      stroke="#8a9a5b"
      strokeWidth={4}
      strokeLinecap="round"
      opacity={0.75}
      className="anim-wisp"
      style={{ animationDelay: delay }}
    />
  );
  return (
    <g aria-hidden>
      {wisp(36, "0s")}
      {wisp(152, "0.8s")}
      {wisp(64, "1.5s")}
    </g>
  );
}

function GrowlMarks() {
  const zig = (x: number, y: number, delay: string) => (
    <polyline
      points={`${x},${y} ${x + 7},${y - 5} ${x + 14},${y} ${x + 21},${y - 5}`}
      fill="none"
      stroke={INK}
      strokeWidth={3.2}
      opacity={0.55}
      className="anim-gem"
      style={{ animationDelay: delay }}
    />
  );
  return (
    <g aria-hidden>
      {zig(30, 134, "0s")}
      {zig(140, 138, "0.5s")}
    </g>
  );
}

export function Monster({
  stage,
  actualStage,
  mood,
  equipped,
}: {
  stage: number;
  actualStage?: number;
  mood: Mood;
  equipped: EquippedItem[];
}) {
  const effectiveActual = actualStage ?? stage;
  const f = FACE[Math.min(5, Math.max(1, stage)) - 1] ?? FACE[0];
  const pal = PALETTES[Math.min(5, Math.max(1, stage)) - 1] ?? PALETTES[0];
  const back = equipped.filter((e) => e.slot === "back");
  const front = equipped.filter((e) => e.slot !== "back");
  return (
    <svg viewBox="0 0 192 192" className="h-full w-full" role="img" aria-label={`Monster, stage ${stage}, feeling ${mood}`}>
      {/* GDD Decision #2: Stage 5 aura stays visible even when displaying an older Nostalgia stage */}
      {effectiveActual >= 5 && <Stage5AuraOverlay />}
      {back.map((it) => (
        <CosmeticLayer key={it.assetId} item={it} stage={stage} f={f} />
      ))}
      <g className="anim-monster-breathe">
        <Body stage={stage} />
        {mood === "roasted" && (
          <g fill={AMBER} className="anim-flicker" style={{ transformOrigin: "96px 24px" }}>
            <polygon points="96,0 104,16 96,24 88,16" />
            <polygon points="66,8 73,20 65,26 61,15" fill={PINK} />
            <polygon points="126,8 133,15 129,26 121,20" />
          </g>
        )}
        {mood === "sick" && (
          <g fill={pal.dark}>
            <circle cx={42} cy={56} r={5.5} />
            <circle cx={152} cy={46} r={4.2} />
            <circle cx={140} cy={70} r={3.4} />
          </g>
        )}
        {mood === "sick" && <StinkWisps />}
        {(mood === "hungry" || mood === "hangry") && <GrowlMarks />}
        <Eyes mood={mood} f={f} />
        <Mouth mood={mood} f={f} />
        {(mood === "happy" || mood === "eating" || mood === "excited") && (
          <g fill={PINK} opacity={0.55} aria-hidden>
            <ellipse cx={96 - f.eyeDX - 13} cy={f.mouthY - 4} rx={9} ry={5.5} />
            <ellipse cx={96 + f.eyeDX + 13} cy={f.mouthY - 4} rx={9} ry={5.5} />
          </g>
        )}
      </g>
      {front.map((it) => (
        <CosmeticLayer key={it.assetId} item={it} stage={stage} f={f} />
      ))}
    </svg>
  );
}
