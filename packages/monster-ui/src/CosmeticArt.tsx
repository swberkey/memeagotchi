import type { CosmeticSlot } from "@memeagotchi/game-core";
import { useId } from "react";

export interface EquippedDisplayItem {
  slot: CosmeticSlot;
  assetId: string;
  emoji: string;
  name: string;
}

const INK = "#282b47";

/**
 * Studio-quality vector artwork for every Drip Shop cosmetic,
 * styled to match the mint/lavender character sheet (thick #282b47 outlines,
 * soft cel shading, crisp specular glints).
 * Drawn in a normalized 0..100 x 0..100 coordinate box centered at (50, 50).
 */
export function CosmeticArtwork({ assetId }: { assetId: string }) {
  const uid = useId().replace(/:/g, "");
  switch (assetId) {
    case "chef-hat":
      return (
        <g>
          {/* Puffy toque top matching character-sheet-v1.jpg */}
          <path
            d="M22,56 C10,54 8,32 23,28 C25,13 42,10 50,18 C58,10 75,13 77,28 C92,32 90,54 78,56 Z"
            fill="#ffffff"
            stroke={INK}
            strokeWidth="4.2"
            strokeLinejoin="round"
          />
          <path d="M38,24 C36,34 37,43 39,50" fill="none" stroke="#cbd5e1" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M62,24 C64,34 63,43 61,50" fill="none" stroke="#cbd5e1" strokeWidth="3.2" strokeLinecap="round" />
          {/* Band */}
          <path
            d="M23,54 H77 L75,76 Q50,82 25,76 Z"
            fill="#f1f5f9"
            stroke={INK}
            strokeWidth="4.2"
            strokeLinejoin="round"
          />
          <path d="M27,66 Q50,71 73,66" fill="none" stroke="#cbd5e1" strokeWidth="2.8" strokeLinecap="round" />
        </g>
      );

    case "party-hat": {
      const clipId = `party-cone-${uid}`;
      return (
        <g>
          {/* Striped festive cone matching character-sheet-v1.jpg */}
          <defs>
            <clipPath id={clipId}>
              <path d="M50,18 L20,82 Q50,90 80,82 Z" />
            </clipPath>
          </defs>
          <g clipPath={`url(#${clipId})`}>
            <rect x="16" y="18" width="68" height="72" fill="#f472b6" />
            <path d="M16,42 L84,30 L84,44 L16,56 Z" fill="#38bdf8" />
            <path d="M16,58 L84,46 L84,60 L16,72 Z" fill="#fde047" />
            <path d="M16,74 L84,62 L84,78 L16,90 Z" fill="#a855f7" />
          </g>
          <path
            d="M50,18 L20,82 Q50,90 80,82 Z"
            fill="none"
            stroke={INK}
            strokeWidth="4.2"
            strokeLinejoin="round"
          />
          {/* Pom-pom */}
          <circle cx="50" cy="14" r="9.5" fill="#c084fc" stroke={INK} strokeWidth="3.8" />
          <circle cx="47" cy="11" r="2.8" fill="#ffffff" opacity="0.85" />
        </g>
      );
    }

    case "wizard-hat":
      return (
        <g>
          {/* Curved starry wizard hat matching character-sheet-v1.jpg */}
          <ellipse cx="50" cy="70" rx="44" ry="13" fill="#6d4ccf" stroke={INK} strokeWidth="4.2" />
          <ellipse cx="50" cy="68" rx="34" ry="8" fill="#8b6cf0" />
          <path
            d="M23,67 C28,44 40,24 58,12 C62,10 68,14 63,22 C58,31 66,46 77,67 Q50,74 23,67 Z"
            fill="#8b6cf0"
            stroke={INK}
            strokeWidth="4.2"
            strokeLinejoin="round"
          />
          {/* Hat band */}
          <path d="M25,62 Q50,69 75,62" fill="none" stroke="#fde047" strokeWidth="5.5" strokeLinecap="round" />
          {/* Gold stars */}
          <polygon points="52,32 54,37 59,39 54,41 52,46 50,41 45,39 50,37" fill="#fde047" />
          <circle cx="39" cy="52" r="2.8" fill="#fde047" />
          <circle cx="64" cy="50" r="2.4" fill="#fde047" />
        </g>
      );

    case "cap-red":
      return (
        <g>
          {/* Backwards snapback cap */}
          <path
            d="M22,62 C22,30 78,30 78,62 Q50,68 22,62 Z"
            fill="#ef4444"
            stroke={INK}
            strokeWidth="4.2"
            strokeLinejoin="round"
          />
          <path d="M30,44 C38,34 62,34 70,44" fill="none" stroke="#fca5a5" strokeWidth="3.5" strokeLinecap="round" opacity="0.7" />
          <circle cx="50" cy="32" r="4.5" fill="#fbbf24" stroke={INK} strokeWidth="3" />
          {/* Backwards brim sticking out right */}
          <path
            d="M72,56 Q92,56 94,65 Q82,70 68,64 Z"
            fill="#b91c1c"
            stroke={INK}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          {/* Front snapback arch */}
          <path d="M38,63 A12,9 0 0 1 62,63" fill="#1e293b" stroke={INK} strokeWidth="3" />
        </g>
      );

    case "crown":
      return (
        <g>
          {/* Royal golden crown with ruby & aqua gems */}
          <path
            d="M18,74 L14,34 L36,50 L50,24 L64,50 L86,34 L82,74 Q50,82 18,74 Z"
            fill="#facc15"
            stroke={INK}
            strokeWidth="4.2"
            strokeLinejoin="round"
          />
          <path d="M22,68 Q50,74 78,68" fill="none" stroke="#d97706" strokeWidth="4" strokeLinecap="round" />
          <circle cx="50" cy="56" r="6" fill="#ec4899" stroke={INK} strokeWidth="2.8" />
          <circle cx="30" cy="59" r="4.2" fill="#38bdf8" stroke={INK} strokeWidth="2.5" />
          <circle cx="70" cy="59" r="4.2" fill="#38bdf8" stroke={INK} strokeWidth="2.5" />
          <circle cx="50" cy="22" r="4.5" fill="#fef08a" stroke={INK} strokeWidth="2.8" />
        </g>
      );

    case "shades":
      return (
        <g>
          {/* Crisp 8-bit Deal-With-It pixel sunglasses matching character-sheet-v1.jpg */}
          <rect x="4" y="34" width="92" height="8" fill={INK} />
          <rect x="10" y="42" width="34" height="16" fill={INK} />
          <rect x="16" y="58" width="22" height="6" fill={INK} />
          <rect x="56" y="42" width="34" height="16" fill={INK} />
          <rect x="62" y="58" width="22" height="6" fill={INK} />
          {/* Pixel specular glints */}
          <rect x="14" y="42" width="6" height="6" fill="#ffffff" />
          <rect x="20" y="48" width="6" height="6" fill="#ffffff" />
          <rect x="26" y="54" width="6" height="6" fill="#ffffff" />
          <rect x="60" y="42" width="6" height="6" fill="#ffffff" />
          <rect x="66" y="48" width="6" height="6" fill="#ffffff" />
          <rect x="72" y="54" width="6" height="6" fill="#ffffff" />
        </g>
      );

    case "star-glasses":
      return (
        <g>
          {/* Oversized golden star shades */}
          <line x1="40" y1="50" x2="60" y2="50" stroke={INK} strokeWidth="5.5" />
          <polygon
            points="27,26 33,40 48,41 36,51 40,66 27,57 14,66 18,51 6,41 21,40"
            fill="#facc15"
            stroke={INK}
            strokeWidth="3.8"
            strokeLinejoin="round"
          />
          <polygon
            points="73,26 79,40 94,41 82,51 86,66 73,57 60,66 64,51 52,41 67,40"
            fill="#facc15"
            stroke={INK}
            strokeWidth="3.8"
            strokeLinejoin="round"
          />
          <circle cx="24" cy="45" r="3.5" fill="#ffffff" opacity="0.85" />
          <circle cx="70" cy="45" r="3.5" fill="#ffffff" opacity="0.85" />
        </g>
      );

    case "wizard-robe":
      return (
        <g>
          {/* Starry wizard cloak/capelet matching character-sheet-v1.jpg */}
          <path
            d="M24,22 Q50,32 76,22 L90,76 Q66,86 52,72 L50,52 L48,72 Q34,86 10,76 Z"
            fill="#8b6cf0"
            stroke={INK}
            strokeWidth="4.2"
            strokeLinejoin="round"
          />
          {/* Collar + gold clasp */}
          <path d="M24,22 Q50,36 76,22" fill="none" stroke="#c4b5fd" strokeWidth="5" strokeLinecap="round" />
          <circle cx="50" cy="31" r="6" fill="#fde047" stroke={INK} strokeWidth="3" />
          {/* Stars */}
          <polygon points="30,52 32,57 37,59 32,61 30,66 28,61 23,59 28,57" fill="#fde047" />
          <polygon points="70,52 72,57 77,59 72,61 70,66 68,61 63,59 68,57" fill="#fde047" />
          <circle cx="22" cy="68" r="2.5" fill="#fde047" />
          <circle cx="78" cy="68" r="2.5" fill="#fde047" />
        </g>
      );

    case "chain":
      return (
        <g>
          {/* Chunky gold Cuban link chain + diamond meme medallion */}
          <path
            d="M16,28 Q50,74 84,28"
            fill="none"
            stroke={INK}
            strokeWidth="12"
            strokeLinecap="round"
          />
          <path
            d="M16,28 Q50,74 84,28"
            fill="none"
            stroke="#facc15"
            strokeWidth="6.5"
            strokeDasharray="6 4"
            strokeLinecap="round"
          />
          <polygon
            points="50,48 61,60 50,74 39,60"
            fill="#fef08a"
            stroke={INK}
            strokeWidth="3.6"
            strokeLinejoin="round"
          />
          <polygon points="50,53 55,60 50,67 45,60" fill="#38bdf8" />
        </g>
      );

    case "cape":
      return (
        <g>
          {/* Heroic billowing cape */}
          <path
            d="M24,20 Q50,28 76,20 L92,84 Q50,94 8,84 Z"
            fill="#ef4444"
            stroke={INK}
            strokeWidth="4.2"
            strokeLinejoin="round"
          />
          <path d="M24,24 Q50,32 76,24" fill="none" stroke="#facc15" strokeWidth="6" strokeLinecap="round" />
          <path d="M28,40 L20,76" fill="none" stroke="#b91c1c" strokeWidth="3.5" strokeLinecap="round" opacity="0.65" />
          <path d="M72,40 L80,76" fill="none" stroke="#b91c1c" strokeWidth="3.5" strokeLinecap="round" opacity="0.65" />
        </g>
      );

    case "flame-sticker":
      return (
        <g>
          {/* Die-cut white vinyl border */}
          <path
            d="M50,14 C64,28 78,42 74,64 C71,79 61,86 50,86 C39,86 29,79 26,64 C22,46 34,34 40,26 C40,36 44,38 45,30 C46,23 48,18 50,14 Z"
            fill="#ffffff"
            stroke="#ffffff"
            strokeWidth="10"
            strokeLinejoin="round"
          />
          <path
            d="M50,14 C64,28 78,42 74,64 C71,79 61,86 50,86 C39,86 29,79 26,64 C22,46 34,34 40,26 C40,36 44,38 45,30 C46,23 48,18 50,14 Z"
            fill="#fb923c"
            stroke={INK}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path
            d="M50,42 C58,52 63,60 60,71 C58,78 54,82 50,82 C46,82 42,78 40,71 C38,60 44,50 50,42 Z"
            fill="#fde047"
          />
        </g>
      );

    case "sparkle-sticker":
      return (
        <g>
          <polygon
            points="44,16 52,38 74,46 52,54 44,76 36,54 14,46 36,38"
            fill="#ffffff"
            stroke="#ffffff"
            strokeWidth="10"
            strokeLinejoin="round"
          />
          <polygon
            points="44,16 52,38 74,46 52,54 44,76 36,54 14,46 36,38"
            fill="#fde047"
            stroke={INK}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <polygon
            points="74,58 78,68 88,72 78,76 74,86 70,76 60,72 70,68"
            fill="#67e8f9"
            stroke={INK}
            strokeWidth="3.2"
            strokeLinejoin="round"
          />
        </g>
      );

    default:
      return null;
  }
}

export function CosmeticBadge({ assetId, size = 44 }: { assetId: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden className="block shrink-0">
      <CosmeticArtwork assetId={assetId} />
    </svg>
  );
}
