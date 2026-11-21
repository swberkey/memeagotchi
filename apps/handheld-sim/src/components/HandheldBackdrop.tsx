import type { BackdropThemeId } from "./handheldModels";

/**
 * 5 Distinct Full-Screen Background Scene Templates — one crafted to match each
 * of the 5 MemeAgotchi pocket handheld models (Dragon, Kitty, Flower, Cyber Bot, Atomic Purple).
 */
export function HandheldBackdrop({ themeId }: { themeId: BackdropThemeId }) {
  if (themeId === "dragon-glade") {
    return (
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden transition-all duration-500"
        style={{
          background:
            "radial-gradient(circle at 22% 18%, rgba(251, 146, 60, 0.24) 0%, transparent 45%), radial-gradient(circle at 80% 75%, rgba(16, 185, 129, 0.24) 0%, transparent 50%), linear-gradient(165deg, #071f17 0%, #0d3325 46%, #132c1d 76%, #0b1812 100%)",
        }}
      >
        <svg className="h-full w-full opacity-55" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="dg-ray" x1="0" y1="0" x2="0.4" y2="1">
              <stop offset="0%" stopColor="#fde68a" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Sunbeams filtering through emerald forest canopy */}
          <polygon points="120,0 310,0 520,800 220,800" fill="url(#dg-ray)" />
          <polygon points="620,0 780,0 980,800 740,800" fill="url(#dg-ray)" />
          {/* Layered forest hills & foliage silhouettes */}
          <path d="M0 640 Q180 540 380 610 T820 590 T1200 630 L1200 800 L0 800 Z" fill="#082419" opacity="0.85" />
          <path d="M0 710 Q240 640 520 700 T1000 675 T1200 715 L1200 800 L0 800 Z" fill="#051710" />
          {/* Top leafy boughs */}
          <circle cx="80" cy="40" r="140" fill="#0a2e1f" opacity="0.8" />
          <circle cx="240" cy="10" r="110" fill="#12422c" opacity="0.7" />
          <circle cx="1090" cy="50" r="155" fill="#0a2e1f" opacity="0.82" />
          <circle cx="940" cy="20" r="110" fill="#134730" opacity="0.65" />
          {/* Subtle glowing dragon embers / fireflies */}
          {[
            [180, 210, 4, "#fb923c"],
            [290, 440, 3, "#fde047"],
            [960, 240, 4.5, "#fb923c"],
            [1060, 480, 3, "#6ee7b7"],
            [140, 560, 3.5, "#fde047"],
            [860, 610, 4, "#fb923c"],
            [420, 140, 2.5, "#6ee7b7"],
            [780, 150, 3, "#fde047"],
          ].map(([cx, cy, r, fill], idx) => (
            <circle key={idx} cx={cx as number} cy={cy as number} r={r as number} fill={fill as string} opacity="0.8" />
          ))}
        </svg>
      </div>
    );
  }

  if (themeId === "kitty-loft") {
    return (
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden transition-all duration-500"
        style={{
          background:
            "radial-gradient(circle at 20% 15%, rgba(254, 240, 138, 0.36) 0%, transparent 48%), radial-gradient(circle at 82% 22%, rgba(125, 211, 252, 0.34) 0%, transparent 48%), linear-gradient(170deg, #1b3b54 0%, #2b5c7d 42%, #3f6f8f 68%, #28465d 100%)",
        }}
      >
        <svg className="h-full w-full opacity-55" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
          {/* Soft pastel sunlit window panes */}
          <g opacity="0.22" fill="#fffbeb">
            <rect x="65" y="75" width="160" height="220" rx="18" />
            <rect x="240" y="75" width="160" height="220" rx="18" />
          </g>
          {/* Warm cream wooden floor / tabletop horizon */}
          <rect x="0" y="610" width="1200" height="190" fill="#5e4938" opacity="0.48" />
          <line x1="0" y1="610" x2="1200" y2="610" stroke="#fde68a" strokeOpacity="0.35" strokeWidth="3" />
          {/* Soft floating clouds & kawaii paw-print motifs */}
          <g fill="#fef9c3" opacity="0.24">
            <circle cx="980" cy="145" r="46" />
            <circle cx="1028" cy="155" r="36" />
            <circle cx="934" cy="160" r="32" />
            <circle cx="210" cy="520" r="22" />
            <circle cx="188" cy="492" r="9" />
            <circle cx="210" cy="484" r="9" />
            <circle cx="232" cy="492" r="9" />
            <circle cx="1020" cy="470" r="24" />
            <circle cx="996" cy="440" r="9.5" />
            <circle cx="1020" cy="432" r="9.5" />
            <circle cx="1044" cy="440" r="9.5" />
          </g>
          {/* Cozy pastel sparkle stars */}
          {[
            [150, 370],
            [330, 190],
            [860, 260],
            [1090, 320],
            [930, 560],
          ].map(([x, y], i) => (
            <path
              key={i}
              d={`M ${x} ${y! - 11} L ${x! + 3} ${y! - 3} L ${x! + 11} ${y} L ${x! + 3} ${y! + 3} L ${x} ${y! + 11} L ${x! - 3} ${y! + 3} L ${x! - 11} ${y} L ${x! - 3} ${y! - 3} Z`}
              fill="#fef08a"
              opacity="0.55"
            />
          ))}
        </svg>
      </div>
    );
  }

  if (themeId === "botanical-garden") {
    return (
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden transition-all duration-500"
        style={{
          background:
            "radial-gradient(circle at 50% 10%, rgba(251, 182, 206, 0.28) 0%, transparent 48%), radial-gradient(circle at 18% 76%, rgba(52, 211, 153, 0.26) 0%, transparent 50%), linear-gradient(165deg, #163729 0%, #1d4d37 42%, #3a233b 78%, #1c1424 100%)",
        }}
      >
        <svg className="h-full w-full opacity-55" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
          {/* Greenhouse glass arch mullions */}
          <g stroke="#d1fae5" strokeOpacity="0.16" strokeWidth="3" fill="none">
            <path d="M120 800 L120 260 Q120 60 360 60 L840 60 Q1080 60 1080 260 L1080 800" />
            <line x1="360" y1="60" x2="360" y2="800" />
            <line x1="840" y1="60" x2="840" y2="800" />
            <line x1="120" y1="280" x2="1080" y2="280" />
          </g>
          {/* Lush botanical fern leaves in corners */}
          <g fill="#22c55e" opacity="0.25">
            <ellipse cx="90" cy="690" rx="140" ry="48" transform="rotate(-28 90 690)" />
            <ellipse cx="180" cy="750" rx="150" ry="42" transform="rotate(-10 180 750)" />
            <ellipse cx="1110" cy="690" rx="145" ry="48" transform="rotate(26 1110 690)" />
            <ellipse cx="1020" cy="755" rx="150" ry="42" transform="rotate(12 1020 755)" />
            <ellipse cx="80" cy="120" rx="120" ry="34" transform="rotate(22 80 120)" />
            <ellipse cx="1120" cy="130" rx="120" ry="34" transform="rotate(-22 1120 130)" />
          </g>
          {/* Floating rose/cherry blossom petals */}
          {[
            [180, 210, 24],
            [290, 420, -35],
            [930, 195, 42],
            [1040, 390, -22],
            [240, 590, 15],
            [970, 560, -40],
            [790, 140, 30],
            [420, 145, -18],
          ].map(([x, y, rot], i) => (
            <ellipse
              key={i}
              cx={x}
              cy={y}
              rx="11"
              ry="6"
              transform={`rotate(${rot} ${x} ${y})`}
              fill={i % 2 === 0 ? "#f472b6" : "#fbcfe8"}
              opacity="0.65"
            />
          ))}
        </svg>
      </div>
    );
  }

  if (themeId === "robotics-lab") {
    return (
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden transition-all duration-500"
        style={{
          background:
            "radial-gradient(circle at 50% 34%, rgba(6, 182, 212, 0.22) 0%, transparent 52%), linear-gradient(170deg, #0b121c 0%, #111c2a 50%, #0a141f 100%)",
        }}
      >
        <svg className="h-full w-full opacity-55" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id="cyber-grid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#22d3ee" strokeOpacity="0.14" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="1200" height="800" fill="url(#cyber-grid)" />
          {/* Holographic radar rings & telemetry ticks */}
          <g stroke="#22d3ee" fill="none" strokeOpacity="0.24">
            <circle cx="600" cy="360" r="250" strokeWidth="1.5" strokeDasharray="8 6" />
            <circle cx="600" cy="360" r="340" strokeWidth="1" strokeDasharray="3 10" />
            <line x1="60" y1="360" x2="260" y2="360" strokeWidth="1.5" />
            <line x1="940" y1="360" x2="1140" y2="360" strokeWidth="1.5" />
          </g>
          {/* Circuit traces on left & right wings */}
          <g stroke="#38bdf8" strokeOpacity="0.28" strokeWidth="2" fill="none">
            <path d="M 40 160 H 190 L 230 200 H 300" />
            <path d="M 40 620 H 160 L 210 570 H 280" />
            <path d="M 1160 180 H 1010 L 970 220 H 900" />
            <path d="M 1160 610 H 1030 L 980 560 H 910" />
          </g>
          {[
            [300, 200],
            [280, 570],
            [900, 220],
            [910, 560],
          ].map(([cx, cy], idx) => (
            <circle key={idx} cx={cx} cy={cy} r="5" fill="#22d3ee" opacity="0.55" />
          ))}
        </svg>
      </div>
    );
  }

  // retro-workbench (Atomic Purple — warm timber maker workbench + tungsten lamp + retro violet arcade glow)
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden transition-all duration-500"
      style={{
        background:
          "radial-gradient(circle at 50% 24%, rgba(167, 139, 250, 0.28) 0%, transparent 48%), radial-gradient(circle at 20% 80%, rgba(217, 119, 6, 0.24) 0%, transparent 50%), linear-gradient(175deg, #1b1328 0%, #2a1c30 42%, #38251c 74%, #241712 100%)",
      }}
    >
      <svg className="h-full w-full opacity-50" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
        {/* Warm wooden maker workbench horizontal planks */}
        <g stroke="#f59e0b" strokeOpacity="0.14" strokeWidth="2">
          <line x1="0" y1="520" x2="1200" y2="520" />
          <line x1="0" y1="595" x2="1200" y2="595" />
          <line x1="0" y1="675" x2="1200" y2="675" />
          <line x1="0" y1="750" x2="1200" y2="750" />
        </g>
        {/* Subtle retro perspective synth lines at top */}
        <g stroke="#c084fc" strokeOpacity="0.14" strokeWidth="1.5" fill="none">
          <line x1="0" y1="140" x2="1200" y2="140" />
          <line x1="0" y1="220" x2="1200" y2="220" />
          <line x1="0" y1="320" x2="1200" y2="320" />
          <line x1="600" y1="0" x2="120" y2="520" />
          <line x1="600" y1="0" x2="360" y2="520" />
          <line x1="600" y1="0" x2="840" y2="520" />
          <line x1="600" y1="0" x2="1080" y2="520" />
        </g>
        {/* Subtle electronics bench silhouettes (coiled USB cable + driver tips) */}
        <g stroke="#0f0a12" strokeOpacity="0.4" fill="none" strokeWidth="7">
          <ellipse cx="145" cy="110" rx="95" ry="42" />
          <ellipse cx="155" cy="120" rx="82" ry="34" />
        </g>
        <g opacity="0.32" stroke="#facc15" strokeWidth="2">
          <line x1="1030" y1="160" x2="1170" y2="205" />
          <line x1="1060" y1="195" x2="1180" y2="232" />
        </g>
      </svg>
    </div>
  );
}
