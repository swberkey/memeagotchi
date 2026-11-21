import { SPECIES_BY_ID, type SpeciesId } from "@memeagotchi/game-core";
import { useId } from "react";

const INK = "#282b47";

export function StarterEgg({
  species,
  size = 64,
  wobble = false,
}: {
  species: SpeciesId;
  size?: number;
  wobble?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const sp = SPECIES_BY_ID[species];
  const [c1, c2, c3] = sp.eggColors;
  const gradId = `egg-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={wobble ? "anim-bob" : ""}
      role="img"
      aria-label={`${sp.name} starter egg`}
    >
      <defs>
        <linearGradient id={gradId} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor={c1} />
          <stop offset="58%" stopColor={c2} />
          <stop offset="100%" stopColor={c3} />
        </linearGradient>
      </defs>
      {/* Egg silhouette */}
      <path
        d="M50,12 C72,12 84,42 84,64 C84,82 70,92 50,92 C30,92 16,82 16,64 C16,42 28,12 50,12 Z"
        fill={`url(#${gradId})`}
        stroke={INK}
        strokeWidth="4.2"
      />
      {/* Species emblem pattern on shell */}
      {species === "mint-dragon" && (
        <g fill="#ffffff" opacity="0.55">
          <circle cx="36" cy="54" r="7" />
          <circle cx="62" cy="66" r="9" />
          <circle cx="52" cy="40" r="5" />
        </g>
      )}
      {species === "spicy-imp" && (
        <path d="M50,36 C60,48 64,60 50,70 C36,60 40,48 50,36 Z" fill="#fde047" stroke={INK} strokeWidth="2.8" />
      )}
      {species === "cyber-cat" && (
        <g fill="#e879f9" opacity="0.8">
          <rect x="30" y="48" width="10" height="10" />
          <rect x="45" y="58" width="10" height="10" />
          <rect x="60" y="48" width="10" height="10" />
        </g>
      )}
      {species === "cozy-frog" && (
        <path d="M50,44 C38,34 30,44 38,54 C44,60 50,56 50,56 C50,56 56,60 62,54 C70,44 62,34 50,44 Z" fill="#22c55e" stroke={INK} strokeWidth="2.6" />
      )}
      {species === "cursed-ghost" && (
        <g fill="#5eead4" stroke="#0f766e" strokeWidth="2.2">
          <circle cx="40" cy="54" r="5" />
          <circle cx="60" cy="54" r="5" />
          <path d="M40,68 q5,-4 10,0 t10,0" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
      {/* Specular shine */}
      <path d="M32,34 C35,24 43,20 49,21" fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" opacity="0.78" />
    </svg>
  );
}
