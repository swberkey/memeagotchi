import type { SpeciesId } from "@memeagotchi/game-core";

interface PixelPalette {
  ink: string;
  body: string;
  shade: string;
  belly: string;
  accent: string;
  cheek: string;
}

const PALETTES: Record<SpeciesId, PixelPalette> = {
  "mint-dragon": {
    ink: "#1c1f3a",
    body: "#82e8dc",
    shade: "#b7b0ef",
    belly: "#e5ddff",
    accent: "#a78bfa",
    cheek: "#f9a8d4",
  },
  "spicy-imp": {
    ink: "#1c1f3a",
    body: "#ff7246",
    shade: "#dc2626",
    belly: "#fef08a",
    accent: "#fde047",
    cheek: "#fda4af",
  },
  "cyber-cat": {
    ink: "#1c1f3a",
    body: "#62dcff",
    shade: "#9f94f7",
    belly: "#e0d4ff",
    accent: "#e879f9",
    cheek: "#f472b6",
  },
  "cozy-frog": {
    ink: "#1c1f3a",
    body: "#94c98b",
    shade: "#69a668",
    belly: "#f3f5d0",
    accent: "#4ade80",
    cheek: "#fca5a5",
  },
  "cursed-ghost": {
    ink: "#1c1f3a",
    body: "#f3efff",
    shade: "#c4b5fd",
    belly: "#ffffff",
    accent: "#5eead4",
    cheek: "#f0abfc",
  },
};

/**
 * Crisp 16x16 retro pixel-art sleeping monster sprite resting on a tiny dream cloud.
 * Designed to render at ~1/8 screen scale while gliding across the Meme Dream Screensaver.
 */
export function PixelSleepingSprite({
  species = "mint-dragon",
  stage = 1,
  flip = false,
  className = "",
}: {
  species?: SpeciesId;
  stage?: number;
  flip?: boolean;
  className?: string;
}) {
  const p = PALETTES[species];
  const isGhost = species === "cursed-ghost";

  return (
    <svg
      viewBox="0 0 20 20"
      shapeRendering="crispEdges"
      className={className}
      style={{
        imageRendering: "pixelated",
        transform: flip ? "scaleX(-1)" : undefined,
        filter: "drop-shadow(0 2px 3px rgba(10, 8, 30, 0.72))",
      }}
      role="img"
      aria-label={`Sleeping pixel ${species}`}
    >
      {/* Floating pixel dream cloud pillow underneath */}
      <g opacity="0.92">
        <rect x="3" y="15" width="14" height="3" fill="#ffffff" />
        <rect x="5" y="14" width="10" height="1" fill="#ffffff" />
        <rect x="4" y="17" width="12" height="1" fill="#dbeafe" />
        <rect x="2" y="16" width="1" height="1" fill="#e0f2fe" />
        <rect x="17" y="16" width="1" height="1" fill="#e0f2fe" />
      </g>

      {/* Stage 3+ tiny pixel wings */}
      {stage >= 3 && species !== "cozy-frog" && (
        <g>
          <rect x="1" y="9" width="2" height="3" fill={p.accent} />
          <rect x="17" y="9" width="2" height="3" fill={p.accent} />
          <rect x="1" y="8" width="1" height="1" fill={p.ink} />
          <rect x="18" y="8" width="1" height="1" fill={p.ink} />
        </g>
      )}

      {/* Species pixel top features (ears / horns / sprout / flame / wisps) */}
      {species === "mint-dragon" && (
        <g>
          <rect x="5" y="4" width="2" height="2" fill={stage >= 2 ? p.accent : p.body} />
          <rect x="13" y="4" width="2" height="2" fill={stage >= 2 ? p.accent : p.body} />
          <rect x="5" y="3" width="2" height="1" fill={p.ink} />
          <rect x="13" y="3" width="2" height="1" fill={p.ink} />
        </g>
      )}
      {species === "spicy-imp" && (
        <g>
          <rect x="5" y="4" width="2" height="2" fill="#dc2626" />
          <rect x="13" y="4" width="2" height="2" fill="#dc2626" />
          <rect x="9" y="3" width="2" height="3" fill="#fde047" />
          <rect x="10" y="2" width="1" height="1" fill="#ff7849" />
        </g>
      )}
      {species === "cyber-cat" && (
        <g>
          <rect x="4" y="3" width="3" height="3" fill={p.ink} />
          <rect x="5" y="4" width="2" height="2" fill={p.accent} />
          <rect x="13" y="3" width="3" height="3" fill={p.ink} />
          <rect x="13" y="4" width="2" height="2" fill={p.accent} />
        </g>
      )}
      {species === "cozy-frog" && (
        <g>
          <rect x="5" y="4" width="3" height="2" fill={p.body} />
          <rect x="12" y="4" width="3" height="2" fill={p.body} />
          <rect x="9" y="3" width="2" height="2" fill="#4ade80" />
          <rect x="11" y="2" width="2" height="1" fill="#4ade80" />
        </g>
      )}
      {species === "cursed-ghost" && (
        <g>
          <rect x="2" y="6" width="2" height="2" fill="#5eead4" />
          <rect x="16" y="7" width="2" height="2" fill="#5eead4" />
        </g>
      )}

      {/* Pixel Monster Outline */}
      <rect x="5" y="5" width="10" height="1" fill={p.ink} />
      <rect x="4" y="6" width="12" height="1" fill={p.ink} />
      <rect x="3" y="7" width="14" height="7" fill={p.ink} />
      <rect x="4" y="14" width="12" height="1" fill={p.ink} />

      {/* Pixel Monster Body Fill */}
      <rect x="5" y="6" width="10" height="1" fill={p.body} />
      <rect x="4" y="7" width="12" height="5" fill={p.body} />
      <rect x="4" y="12" width="12" height="2" fill={p.shade} />

      {/* Ghost scalloped bottom hem */}
      {isGhost && (
        <g>
          <rect x="5" y="14" width="2" height="1" fill={p.shade} />
          <rect x="9" y="14" width="2" height="1" fill={p.shade} />
          <rect x="13" y="14" width="2" height="1" fill={p.shade} />
        </g>
      )}

      {/* Belly cushion */}
      <rect x="7" y="12" width="6" height="2" fill={p.belly} />

      {/* Gloss pixel */}
      <rect x="5" y="7" width="2" height="1" fill="#ffffff" opacity="0.85" />

      {/* Peaceful closed sleeping eyes (-  -) */}
      <rect x="6" y="10" width="2" height="1" fill={p.ink} />
      <rect x="12" y="10" width="2" height="1" fill={p.ink} />

      {/* Tiny cute sleepy "o" mouth */}
      <rect x="9" y="11" width="2" height="1" fill={p.ink} />

      {/* Rosy pixel cheeks */}
      <rect x="5" y="11" width="1" height="1" fill={p.cheek} />
      <rect x="14" y="11" width="1" height="1" fill={p.cheek} />

      {/* Floating pixel Zzz (top right) */}
      <g className="anim-zzz">
        <rect x="15" y="2" width="3" height="1" fill="#fde047" />
        <rect x="16" y="3" width="1" height="1" fill="#fde047" />
        <rect x="15" y="4" width="3" height="1" fill="#fde047" />
      </g>
    </svg>
  );
}
