import type { CosmeticSlot, Mood } from "@memeagotchi/game-core";

const STAGE_COLORS = ["", "#8df0e0", "#76e4d4", "#6ad8cf", "#a78bfa", "#e879f9"];
const STAGE_BELLY = ["", "#d8c7f7", "#d3bdf7", "#cbb1f6", "#e9d5ff", "#f5d0fe"];
const STAGE_NAMES = ["", "Blob", "Critter", "Beast", "Legend", "Eldritch Meme Lord"];

const SLOT_POS: Record<CosmeticSlot, { top: string; left: string; size: number; z: number }> = {
  head: { top: "10%", left: "50%", size: 40, z: 4 },
  face: { top: "55%", left: "50%", size: 44, z: 5 },
  body: { top: "82%", left: "50%", size: 32, z: 3 },
  back: { top: "48%", left: "92%", size: 36, z: 1 },
  sticker: { top: "68%", left: "24%", size: 26, z: 4 },
};

export interface EquippedDisplayItem {
  slot: CosmeticSlot;
  assetId: string;
  emoji: string;
  name: string;
}

function renderIllustratedCosmetic(item: EquippedDisplayItem) {
  switch (item.assetId) {
    case "shades":
      return (
        <svg viewBox="0 0 120 34" className="w-[104px] h-[30px] drop-shadow" aria-hidden>
          {/* 8-bit Deal-With-It pixel shades matching the character sheet */}
          <rect x="4" y="4" width="112" height="8" fill="#1e1b4b" />
          <rect x="10" y="12" width="40" height="16" fill="#1e1b4b" />
          <rect x="70" y="12" width="40" height="16" fill="#1e1b4b" />
          <rect x="16" y="14" width="8" height="6" fill="#ffffff" />
          <rect x="26" y="20" width="8" height="6" fill="#ffffff" />
          <rect x="76" y="14" width="8" height="6" fill="#ffffff" />
          <rect x="86" y="20" width="8" height="6" fill="#ffffff" />
        </svg>
      );
    case "chef-hat":
      return (
        <svg viewBox="0 0 100 70" className="w-[84px] h-[60px] drop-shadow" aria-hidden>
          <path d="M22,42 C10,40 10,18 26,18 C30,6 50,4 58,14 C72,6 88,18 82,34 C88,42 78,46 74,46 L26,46 Z" fill="#ffffff" stroke="#1e1b4b" strokeWidth="4" strokeLinejoin="round" />
          <rect x="24" y="44" width="52" height="18" rx="4" fill="#f1f5f9" stroke="#1e1b4b" strokeWidth="4" />
        </svg>
      );
    case "party-hat":
      return (
        <svg viewBox="0 0 80 86" className="w-[62px] h-[68px] drop-shadow" aria-hidden>
          <polygon points="40,12 14,76 66,76" fill="#f472b6" stroke="#1e1b4b" strokeWidth="4" strokeLinejoin="round" />
          <polygon points="40,26 24,58 56,58" fill="#38bdf8" />
          <polygon points="40,42 30,66 50,66" fill="#facc15" />
          <circle cx="40" cy="10" r="8" fill="#a855f7" stroke="#1e1b4b" strokeWidth="3.5" />
        </svg>
      );
    case "wizard-hat":
      return (
        <svg viewBox="0 0 120 80" className="w-[96px] h-[64px] drop-shadow" aria-hidden>
          <ellipse cx="60" cy="64" rx="52" ry="12" fill="#7c3aed" stroke="#1e1b4b" strokeWidth="4" />
          <path d="M28,62 L58,8 L92,62 Z" fill="#8b5cf6" stroke="#1e1b4b" strokeWidth="4" strokeLinejoin="round" />
          <path d="M34,54 Q60,60 86,54" fill="none" stroke="#facc15" strokeWidth="5" />
          <circle cx="58" cy="34" r="4" fill="#fde047" />
          <circle cx="46" cy="46" r="3" fill="#fde047" />
        </svg>
      );
    case "wizard-robe":
      return (
        <svg viewBox="0 0 110 46" className="w-[96px] h-[40px] drop-shadow" aria-hidden>
          <path d="M22,6 Q55,18 88,6 L102,42 Q55,34 8,42 Z" fill="#7c3aed" stroke="#1e1b4b" strokeWidth="4" strokeLinejoin="round" />
          <circle cx="34" cy="26" r="3.5" fill="#fde047" />
          <circle cx="55" cy="29" r="4" fill="#fde047" />
          <circle cx="76" cy="26" r="3.5" fill="#fde047" />
        </svg>
      );
    default:
      return null;
  }
}

export function MonsterSVG({
  displayStage,
  actualStage,
  mood,
  sleeping,
  roasted,
  equipped,
}: {
  displayStage: number;
  actualStage: number;
  mood: Mood;
  sleeping: boolean;
  roasted: boolean;
  equipped: EquippedDisplayItem[];
}) {
  const color = STAGE_COLORS[displayStage] ?? "#8df0e0";
  const bellyColor = STAGE_BELLY[displayStage] ?? "#d8c7f7";
  const sad = mood === "sad" || mood === "hangry" || mood === "sick";
  const excited = mood === "excited";

  return (
    <div
      className="relative mx-auto w-[210px] h-[196px]"
      aria-label={`Monster, displaying stage ${displayStage} ${STAGE_NAMES[displayStage]} (actual stage ${actualStage})`}
    >
      {/* GDD Decision #2: Stage 4/5 aura stays tied to actualStage even under Nostalgia */}
      {actualStage >= 4 && (
        <div
          className="absolute inset-0 rounded-full opacity-45 blur-xl"
          style={{ background: actualStage >= 5 ? "#e879f9" : "#facc15" }}
        />
      )}
      {actualStage >= 5 && (
        <div
          className="absolute inset-2 rounded-full border-4 border-dashed opacity-60 anim-wiggle"
          style={{ borderColor: "#e879f9" }}
        />
      )}

      <div
        className={`absolute left-1/2 top-7 -translate-x-1/2 ${
          sleeping ? "" : actualStage >= 5 ? "anim-glitch" : "anim-bob"
        }`}
      >
        <div className="relative w-[170px] h-[152px]">
          <svg width="170" height="152" viewBox="0 0 170 152">
            {/* Stage 1 antennae (inspired by character sheet Baby stage) */}
            {displayStage === 1 && (
              <g stroke="#1e1b4b" strokeWidth="4" fill="#c4b5fd" strokeLinejoin="round">
                <path d="M82,25 C78,8 64,6 68,16 C70,22 78,24 82,26 Z" />
                <path d="M88,25 C92,8 106,6 102,16 C100,22 92,24 88,26 Z" />
              </g>
            )}
            {/* Stage 2+ horns (Teen/Adult progression) */}
            {displayStage >= 2 && (
              <g fill={displayStage >= 4 ? "#facc15" : "#c4b5fd"} stroke="#1e1b4b" strokeWidth="4" strokeLinejoin="round">
                <path d="M48,40 C36,24 38,10 48,14 C52,22 56,30 62,32 Z" />
                <path d="M122,40 C134,24 132,10 122,14 C118,22 114,30 108,32 Z" />
              </g>
            )}
            {/* Stage 3+ dragon wings */}
            {displayStage >= 3 && (
              <g fill="#c4b5fd" stroke="#1e1b4b" strokeWidth="4" strokeLinejoin="round">
                <path d="M28,74 L4,62 L12,86 L28,88 Z" />
                <path d="M142,74 L166,62 L158,86 L142,88 Z" />
              </g>
            )}
            {/* Stage 2+ arms & feet */}
            {displayStage >= 2 && (
              <g fill={color} stroke="#1e1b4b" strokeWidth="4">
                <ellipse cx="26" cy="102" rx="13" ry="8" />
                <ellipse cx="144" cy="102" rx="13" ry="8" />
              </g>
            )}
            <g fill={bellyColor} stroke="#1e1b4b" strokeWidth="4">
              <ellipse cx="56" cy="138" rx="15" ry="9" />
              <ellipse cx="114" cy="138" rx="15" ry="9" />
            </g>

            {/* Main body */}
            <path
              d="M85,22 C125,22 148,56 148,92 C148,122 122,140 85,140 C48,140 22,122 22,92 C22,56 45,22 85,22 Z"
              fill={roasted ? "#fb923c" : color}
              stroke="#1e1b4b"
              strokeWidth="5"
            />
            {/* Soft belly & top gloss */}
            <ellipse cx="85" cy="116" rx="34" ry="20" fill={bellyColor} opacity="0.88" />
            <ellipse cx="62" cy="48" rx="14" ry="8" fill="#ffffff" opacity="0.5" transform="rotate(-20 62 48)" />

            {/* Eyes */}
            {sleeping || mood === "sleepy" ? (
              <g stroke="#1e1b4b" strokeWidth="4" fill="none" strokeLinecap="round">
                <path d="M52,82 Q62,90 72,82" />
                <path d="M98,82 Q108,90 118,82" />
              </g>
            ) : mood === "sick" || roasted ? (
              <g stroke="#1e1b4b" strokeWidth="3.5" fill="none" strokeLinecap="round">
                <circle cx="62" cy="82" r="9" />
                <circle cx="62" cy="82" r="4" />
                <circle cx="108" cy="82" r="9" />
                <circle cx="108" cy="82" r="4" />
              </g>
            ) : excited ? (
              <g>
                <circle cx="62" cy="82" r="11" fill="#1e1b4b" />
                <circle cx="108" cy="82" r="11" fill="#1e1b4b" />
                <polygon points="62,74 64.5,79.5 70,82 64.5,84.5 62,90 59.5,84.5 54,82 59.5,79.5" fill="#fde047" />
                <polygon points="108,74 110.5,79.5 116,82 110.5,84.5 108,90 105.5,84.5 100,82 105.5,79.5" fill="#fde047" />
              </g>
            ) : (
              <g>
                <circle cx="62" cy="82" r="10" fill="#1e1b4b" />
                <circle cx="108" cy="82" r="10" fill="#1e1b4b" />
                <circle cx="58.5" cy="78" r="3.4" fill="#ffffff" />
                <circle cx="104.5" cy="78" r="3.4" fill="#ffffff" />
                <circle cx="65" cy="85" r="1.6" fill="#ffffff" />
                <circle cx="111" cy="85" r="1.6" fill="#ffffff" />
              </g>
            )}

            {/* Mouth */}
            {mood === "sick" || roasted ? (
              <polyline points="68,108 76,102 85,108 94,102 102,108" stroke="#1e1b4b" strokeWidth="4" fill="none" strokeLinecap="round" />
            ) : sad ? (
              <path d="M68,114 Q85,102 102,114" stroke="#1e1b4b" strokeWidth="4" fill="none" strokeLinecap="round" />
            ) : mood === "hungry" ? (
              <g>
                <path d="M70,102 H100 Q100,118 85,118 Q70,118 70,102 Z" fill="#1e1b4b" />
                <ellipse cx="85" cy="113" rx="8" ry="4" fill="#fb7185" />
                <path d="M98,110 Q103,124 98,128 Q93,124 98,110 Z" fill="#38bdf8" />
              </g>
            ) : sleeping || mood === "sleepy" ? (
              <ellipse cx="85" cy="107" rx="5" ry="4" fill="#1e1b4b" />
            ) : (
              <g>
                <path d="M70,100 H100 Q100,118 85,118 Q70,118 70,100 Z" fill="#1e1b4b" />
                <ellipse cx="85" cy="113" rx="8" ry="4" fill="#fb7185" />
              </g>
            )}

            {/* Cheeks */}
            <ellipse cx="44" cy="98" rx="8" ry="4.5" fill="#f9a8d4" opacity="0.8" />
            <ellipse cx="126" cy="98" rx="8" ry="4.5" fill="#f9a8d4" opacity="0.8" />
          </svg>

          {/* Equipped cosmetics (illustrated SVG where available, emoji fallback otherwise) */}
          {equipped.map((it) => {
            const p = SLOT_POS[it.slot] ?? SLOT_POS.sticker;
            const customSvg = renderIllustratedCosmetic(it);
            return (
              <span
                key={it.slot}
                aria-hidden="true"
                className="absolute pointer-events-none"
                style={{
                  top: p.top,
                  left: p.left,
                  fontSize: p.size,
                  lineHeight: 1,
                  transform: "translate(-50%,-50%)",
                  zIndex: p.z,
                  filter: "drop-shadow(0 2px 2px rgba(26,16,37,.45))",
                }}
              >
                {customSvg ?? it.emoji}
              </span>
            );
          })}
        </div>
      </div>

      {sleeping && <span className="absolute right-2 top-0 text-2xl">💤</span>}
      {roasted && <span className="absolute left-2 top-0 text-2xl">🌡️</span>}
      {mood === "sick" && (
        <>
          <span className="absolute left-3 top-14 text-lg">🪰</span>
          <span className="absolute right-3 top-22 text-lg">🪰</span>
        </>
      )}
    </div>
  );
}
