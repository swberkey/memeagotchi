import type { GamepadButton } from "@memeagotchi/snes-games";
import type { PointerEvent, ReactNode } from "react";
import type { HandheldModelDef } from "./handheldModels";

export interface HandheldDeviceFrameProps {
  model: HandheldModelDef;
  screen: ReactNode;
  hwPressed: Readonly<Record<GamepadButton, boolean>>;
  bindHw: (btn: GamepadButton) => {
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => void;
    onPointerUp: (e: PointerEvent<HTMLButtonElement>) => void;
    onPointerCancel: () => void;
    onContextMenu: (e: React.MouseEvent) => void;
  };
  ledColor: string;
  statusTag: string;
  xSubLabel: string;
  oSubLabel: string;
  menuSubLabel: string;
  pttActive: boolean;
}

/**
 * Vertical Pocket Handheld Frame faithfully modeled after the 5 physical MemeAgotchi shells:
 *  1) Dragon Scale (Forest Green + Fiery Orange horns/bezel/buttons)
 *  2) Cozy Kitty (Sky Blue + Butter Yellow ears/wave trim/buttons)
 *  3) Bloom Petal (Scalloped Bubblegum Pink + Leaf Green outer rim & bezel)
 *  4) Cyber Bot (Armored Gunmetal Gray + Cyan Teal bezel/side grips + Twin Antennae)
 *  5) Atomic Purple (Translucent Smoke-Violet with exposed internal PCB + Retro Buttons)
 *
 * Exact button placement from the physical hardware reference:
 *  - Upper half: 320x240 (4:3) color IPS LCD inside themed bezel
 *  - Lower-left: 4-way tactile cross D-Pad
 *  - Lower-right: Diagonally stepped X (lower-left) and O (upper-right)
 *  - Bottom center: Recessed `--` pill with embossed MENU label underneath
 *  - Bottom-left lug: Braided matching wrist lanyard loop
 */
export function HandheldDeviceFrame({
  model,
  screen,
  hwPressed,
  bindHw,
  ledColor,
  statusTag,
  xSubLabel,
  oSubLabel,
  menuSubLabel,
  pttActive,
}: HandheldDeviceFrameProps) {
  const isDragon = model.id === "dragon";
  const isCat = model.id === "cat";
  const isFlower = model.id === "flower";
  const isMech = model.id === "mech";
  const isAtomic = model.id === "atomic";

  const dpadBtnStyle = (active: boolean) => ({
    background: active ? model.dpadActiveBg : model.dpadBg,
    color: active ? "#141026" : model.dpadIconColor,
    borderColor: model.dpadBorder,
    boxShadow: active
      ? "0 0 12px rgba(253,224,71,0.65), inset 0 1px 1px rgba(255,255,255,0.6)"
      : "inset 0 2px 1px rgba(255,255,255,0.28), 0 3px 5px rgba(0,0,0,0.35)",
    transform: active ? "translateY(1px)" : undefined,
    minHeight: "34px",
  });

  const roundFaceStyle = (active: boolean, bg: string, border: string, color: string) => ({
    background: active ? "radial-gradient(circle at 35% 30%, #fef08a 0%, #facc15 100%)" : bg,
    color: active ? "#141026" : color,
    border: `2px solid ${border}`,
    boxShadow: active
      ? "0 0 16px rgba(253,224,71,0.75), inset 0 2px 2px rgba(255,255,255,0.7)"
      : "inset 0 2px 3px rgba(255,255,255,0.42), inset 0 -3px 4px rgba(0,0,0,0.28), 0 5px 10px rgba(0,0,0,0.38)",
    transform: active ? "translateY(2px) scale(0.97)" : undefined,
    minHeight: "48px",
  });

  // Shell outer body style per model
  const bodyStyle: React.CSSProperties = isDragon
    ? {
        background: "linear-gradient(165deg, #256447 0%, #194833 55%, #103222 100%)",
        borderRadius: "44px 44px 54px 54px",
        border: "5px solid #e26711",
        boxShadow:
          "0 30px 70px rgba(0,0,0,0.68), inset 0 3px 3px rgba(255,255,255,0.18), inset 0 -8px 18px rgba(0,0,0,0.38)",
      }
    : isCat
      ? {
          background: "linear-gradient(170deg, #98cde9 0%, #7bb7db 54%, #619ec4 100%)",
          borderRadius: "54px 54px 66px 66px",
          border: "4px solid #68a4ca",
          boxShadow:
            "0 30px 70px rgba(0,0,0,0.58), inset 0 4px 6px rgba(255,255,255,0.48), inset 0 -8px 18px rgba(23,66,96,0.28)",
        }
      : isFlower
        ? {
            background: "linear-gradient(168deg, #f76db1 0%, #e64d97 56%, #cb347d 100%)",
            borderRadius: "64px 64px 58px 58px",
            border: "6px solid #35b95b",
            boxShadow:
              "0 30px 70px rgba(0,0,0,0.62), 0 0 0 2px #1f8a3e, inset 0 4px 6px rgba(255,255,255,0.38), inset 0 -8px 18px rgba(112,18,62,0.32)",
          }
        : isMech
          ? {
              background: "linear-gradient(165deg, #959fa8 0%, #78828b 52%, #5c656d 100%)",
              borderRadius: "28px 28px 32px 32px",
              border: "4px solid #485057",
              boxShadow:
                "0 30px 70px rgba(0,0,0,0.68), inset 0 2px 3px rgba(255,255,255,0.42), inset 0 -8px 18px rgba(0,0,0,0.36)",
            }
          : {
              // Atomic Purple translucent polycarbonate
              background:
                "linear-gradient(158deg, rgba(143, 99, 212, 0.78) 0%, rgba(101, 63, 168, 0.84) 55%, rgba(65, 38, 118, 0.9) 100%)",
              borderRadius: "24px 24px 28px 28px",
              border: "3px solid rgba(216, 196, 255, 0.52)",
              boxShadow:
                "0 30px 70px rgba(0,0,0,0.72), inset 0 2px 6px rgba(255,255,255,0.42), inset 0 -6px 16px rgba(28,12,56,0.55)",
              backdropFilter: "blur(6px)",
            };

  // Screen bezel frame style per model
  const bezelStyle: React.CSSProperties = isDragon
    ? {
        background: "linear-gradient(180deg, #f27b1d 0%, #cf5409 100%)",
        borderRadius: "20px",
        padding: "10px",
        border: "2px solid #8a3504",
        boxShadow: "inset 0 2px 3px rgba(255,255,255,0.35), 0 4px 12px rgba(0,0,0,0.45)",
      }
    : isCat
      ? {
          background: "linear-gradient(180deg, #f9e17b 0%, #ebd05c 100%)",
          borderRadius: "24px 24px 20px 20px",
          padding: "11px",
          border: "2px solid #d4b038",
          boxShadow: "inset 0 2px 4px rgba(255,255,255,0.55), 0 3px 10px rgba(34,76,108,0.22)",
        }
      : isFlower
        ? {
            background: "linear-gradient(180deg, #42c968 0%, #2aa14b 100%)",
            borderRadius: "22px",
            padding: "10px",
            border: "2px solid #1c7c37",
            boxShadow: "inset 0 2px 3px rgba(255,255,255,0.38), 0 4px 10px rgba(105,16,58,0.3)",
          }
        : isMech
          ? {
              background: "linear-gradient(180deg, #22bacb 0%, #148b99 100%)",
              borderRadius: "16px",
              padding: "10px",
              border: "2px solid #0d5c66",
              boxShadow: "inset 0 2px 2px rgba(255,255,255,0.32), 0 4px 12px rgba(0,0,0,0.4)",
            }
          : {
              background: "linear-gradient(160deg, #1b1728 0%, #090710 100%)",
              borderRadius: "14px",
              padding: "10px",
              border: "2px solid rgba(196,181,253,0.28)",
              boxShadow: "inset 0 2px 10px rgba(0,0,0,0.9), 0 4px 14px rgba(0,0,0,0.5)",
            };

  return (
    <div className="relative mx-auto w-full max-w-[436px] select-none pt-10 pb-12">
      {/* === TOP SCULPTED MODEL CROWN (Horns / Cat Ears / Flower Petals / Mech Antennae) === */}
      {isDragon && (
        <svg
          aria-hidden
          viewBox="0 0 440 86"
          className="pointer-events-none absolute left-0 right-0 top-0 z-10 mx-auto w-full drop-shadow-[0_6px_8px_rgba(0,0,0,0.45)]"
        >
          {/* Left & right spiky dragon ear fins */}
          <path d="M18 82 L2 46 L38 56 L22 30 L64 48 L74 82 Z" fill="#1e563d" stroke="#0e2c1f" strokeWidth="2.5" />
          <path d="M422 82 L438 46 L402 56 L418 30 L376 48 L366 82 Z" fill="#1e563d" stroke="#0e2c1f" strokeWidth="2.5" />
          {/* Curved fiery orange ribbed dragon horns */}
          <path
            d="M84 62 Q68 22 92 4 Q102 22 118 54 Z"
            fill="url(#drg-horn)"
            stroke="#9a3806"
            strokeWidth="2.5"
          />
          <path
            d="M356 62 Q372 22 348 4 Q338 22 322 54 Z"
            fill="url(#drg-horn)"
            stroke="#9a3806"
            strokeWidth="2.5"
          />
          <path d="M84 42 Q96 37 107 41 M85 28 Q94 25 101 28" stroke="#9a3806" strokeWidth="2" fill="none" />
          <path d="M356 42 Q344 37 333 41 M355 28 Q346 25 339 28" stroke="#9a3806" strokeWidth="2" fill="none" />
          {/* Sculpted central dragon brow & crest ridges */}
          <path
            d="M72 78 Q128 38 175 44 L220 26 L265 44 Q312 38 368 78 Z"
            fill="#236045"
            stroke="#103123"
            strokeWidth="2.5"
          />
          <path d="M196 42 L220 32 L244 42 L220 64 Z" fill="#16402e" />
          <defs>
            <linearGradient id="drg-horn" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffab4c" />
              <stop offset="60%" stopColor="#ea6a12" />
              <stop offset="100%" stopColor="#bd4706" />
            </linearGradient>
          </defs>
        </svg>
      )}

      {isCat && (
        <svg
          aria-hidden
          viewBox="0 0 440 76"
          className="pointer-events-none absolute left-0 right-0 top-1 z-10 mx-auto w-full drop-shadow-[0_4px_6px_rgba(0,0,0,0.28)]"
        >
          {/* Left rounded sky-blue cat ear + butter-yellow inner triangle */}
          <path
            d="M46 74 Q36 16 74 10 Q114 8 148 56 Z"
            fill="#88c2e3"
            stroke="#63a0c6"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <path d="M64 62 Q60 28 80 24 Q102 22 122 52 Z" fill="#f9df75" />
          {/* Right rounded sky-blue cat ear + butter-yellow inner triangle */}
          <path
            d="M394 74 Q404 16 366 10 Q326 8 292 56 Z"
            fill="#88c2e3"
            stroke="#63a0c6"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <path d="M376 62 Q380 28 360 24 Q338 22 318 52 Z" fill="#f9df75" />
        </svg>
      )}

      {isFlower && (
        <svg
          aria-hidden
          viewBox="0 0 440 72"
          className="pointer-events-none absolute left-0 right-0 top-1 z-0 mx-auto w-full"
        >
          {/* Scalloped top 3 flower petals with vibrant leaf-green outer rim */}
          <circle cx="110" cy="64" r="56" fill="#f569ae" stroke="#35b95b" strokeWidth="7" />
          <circle cx="330" cy="64" r="56" fill="#f569ae" stroke="#35b95b" strokeWidth="7" />
          <circle cx="220" cy="54" r="58" fill="#f76db1" stroke="#35b95b" strokeWidth="7" />
        </svg>
      )}

      {isMech && (
        <svg
          aria-hidden
          viewBox="0 0 440 74"
          className="pointer-events-none absolute left-0 right-0 top-0 z-10 mx-auto w-full drop-shadow-[0_4px_6px_rgba(0,0,0,0.45)]"
        >
          {/* Twin angled ribbed robot antennae */}
          <g transform="rotate(-26 76 58)">
            <rect x="64" y="6" width="24" height="54" rx="10" fill="#77818a" stroke="#3e464d" strokeWidth="2.5" />
            <line x1="65" y1="20" x2="87" y2="20" stroke="#454e56" strokeWidth="3" />
            <line x1="65" y1="32" x2="87" y2="32" stroke="#454e56" strokeWidth="3" />
            <line x1="65" y1="44" x2="87" y2="44" stroke="#454e56" strokeWidth="3" />
          </g>
          <g transform="rotate(26 364 58)">
            <rect x="352" y="6" width="24" height="54" rx="10" fill="#77818a" stroke="#3e464d" strokeWidth="2.5" />
            <line x1="353" y1="20" x2="375" y2="20" stroke="#454e56" strokeWidth="3" />
            <line x1="353" y1="32" x2="375" y2="32" stroke="#454e56" strokeWidth="3" />
            <line x1="353" y1="44" x2="375" y2="44" stroke="#454e56" strokeWidth="3" />
          </g>
        </svg>
      )}

      {/* === SIDE SCULPTED DETAILS (Flower side lobes / Dragon orange ribs / Mech cyan grips) === */}
      {isFlower && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute -left-3.5 top-[34%] z-0 h-28 w-10 rounded-full border-[5px] border-[#35b95b] bg-[#ec549e]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-3.5 top-[34%] z-0 h-28 w-10 rounded-full border-[5px] border-[#35b95b] bg-[#ec549e]"
          />
        </>
      )}

      {isMech && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute -left-2 top-[28%] z-20 flex h-24 w-3.5 flex-col justify-evenly rounded-l-lg border-2 border-[#0e5f69] bg-[#1db3c4] py-1"
          >
            <span className="mx-auto h-0.5 w-2 bg-[#0b4b53]" />
            <span className="mx-auto h-0.5 w-2 bg-[#0b4b53]" />
            <span className="mx-auto h-0.5 w-2 bg-[#0b4b53]" />
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute -right-2 top-[28%] z-20 flex h-24 w-3.5 flex-col justify-evenly rounded-r-lg border-2 border-[#0e5f69] bg-[#1db3c4] py-1"
          >
            <span className="mx-auto h-0.5 w-2 bg-[#0b4b53]" />
            <span className="mx-auto h-0.5 w-2 bg-[#0b4b53]" />
            <span className="mx-auto h-0.5 w-2 bg-[#0b4b53]" />
          </div>
        </>
      )}

      {/* === MAIN VERTICAL POCKET HANDHELD BODY === */}
      <div
        className="relative z-10 overflow-hidden px-5 pb-6 pt-5 transition-all duration-300 sm:px-6"
        style={bodyStyle}
      >
        {/* Atomic Purple exposed internal PCB circuit layer */}
        {isAtomic && (
          <svg
            aria-hidden
            viewBox="0 0 420 560"
            className="pointer-events-none absolute inset-0 h-full w-full opacity-45"
            preserveAspectRatio="none"
          >
            {/* Dark internal PCB board outline */}
            <rect x="20" y="22" width="380" height="516" rx="14" fill="#1e1238" stroke="#8b5cf6" strokeOpacity="0.4" />
            {/* Gold / copper circuit traces */}
            <g stroke="#d8b4fe" strokeOpacity="0.38" strokeWidth="1.6" fill="none">
              <path d="M40 360 H 110 L 135 385 V 480" />
              <path d="M55 375 H 98 L 120 398 V 490" />
              <path d="M380 355 H 310 L 285 380 V 475" />
              <path d="M210 325 V 440 H 255" />
              <path d="M180 325 V 410 H 145" />
            </g>
            {/* Exposed central ESP32-S3 MCU chip silhouette */}
            <rect x="172" y="368" width="76" height="62" rx="6" fill="#0d0818" stroke="#a78bfa" strokeOpacity="0.45" />
            <text x="210" y="403" textAnchor="middle" fill="#c4b5fd" fontSize="9" fontFamily="monospace" opacity="0.7">
              ESP32-S3
            </text>
            {/* Internal screw bosses in the 4 corners */}
            {[
              [34, 34],
              [386, 34],
              [34, 526],
              [386, 526],
            ].map(([cx, cy], idx) => (
              <g key={idx}>
                <circle cx={cx} cy={cy} r="9" fill="#2d1a52" stroke="#c4b5fd" strokeOpacity="0.45" strokeWidth="1.5" />
                <circle cx={cx} cy={cy} r="3.5" fill="#0c0618" />
              </g>
            ))}
          </svg>
        )}

        {/* Cozy Kitty sweeping butter-yellow bottom chin cradle */}
        {isCat && (
          <svg
            aria-hidden
            viewBox="0 0 420 90"
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-20 w-full"
            preserveAspectRatio="none"
          >
            <path
              d="M0 10 Q40 62 120 72 L300 72 Q380 62 420 10 L420 90 L0 90 Z"
              fill="#f8de72"
              opacity="0.95"
            />
          </svg>
        )}

        {/* Cyber Bot corner industrial hex rivets */}
        {isMech && (
          <>
            {[
              "left-3 top-3",
              "right-3 top-3",
              "left-3 bottom-3",
              "right-3 bottom-3",
            ].map((pos) => (
              <span
                key={pos}
                aria-hidden
                className={`pointer-events-none absolute ${pos} flex h-4 w-4 items-center justify-center rounded-full border border-[#3a4249] bg-[#555e66] shadow-inner`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#2a3036]" />
              </span>
            ))}
          </>
        )}

        {/* Dragon orange sculpted side bumper accents */}
        {isDragon && (
          <>
            <span
              aria-hidden
              className="pointer-events-none absolute left-0 top-[46%] h-24 w-2 rounded-r-full bg-[#e26711]"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute right-0 top-[46%] h-24 w-2 rounded-l-full bg-[#e26711]"
            />
          </>
        )}

        {/* === TOP STATUS / MICRO-LED BAR === */}
        <div className="relative z-10 mb-2 flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full transition-colors"
              style={{
                background: pttActive ? "#fb7185" : ledColor,
                boxShadow: `0 0 9px ${pttActive ? "#fb7185" : ledColor}`,
              }}
              aria-hidden
            />
            <span
              className="font-game truncate text-[9px] tracking-wider"
              style={{ color: model.bezelTextColor }}
            >
              MEMEAGOTCHI-320
            </span>
          </div>
          <span
            className="font-mono text-[9.5px] font-bold opacity-90 whitespace-nowrap"
            style={{ color: model.bezelTextColor }}
          >
            {statusTag}
          </span>
        </div>

        {/* === UPPER HALF: 320x240 (4:3) COLOR IPS DISPLAY === */}
        <div className="relative z-10" style={bezelStyle}>
          <div
            className="relative w-full aspect-[4/3] overflow-hidden rounded-[12px] border border-black/80"
            style={{ background: "#0b0920" }}
          >
            {screen}
          </div>
        </div>

        {/* === MID-BODY SCULPTED EMBOSSING (Matching each physical model) === */}
        <div className="relative z-10 flex h-6 items-center justify-center">
          {isDragon && (
            <svg aria-hidden viewBox="0 0 90 24" className="h-5 w-20 opacity-75">
              <path d="M45 2 L53 10 L45 18 L37 10 Z" fill="#123827" stroke="#2d7a57" strokeWidth="1" />
              <path d="M31 6 L38 13 L31 20 L24 13 Z" fill="#123827" stroke="#2d7a57" strokeWidth="1" />
              <path d="M59 6 L66 13 L59 20 L52 13 Z" fill="#123827" stroke="#2d7a57" strokeWidth="1" />
            </svg>
          )}
          {isFlower && (
            <div className="h-2.5 w-14 rounded-b-full border-b-2 border-[#b02b6b]/45" aria-hidden />
          )}
          {isMech && (
            <div className="flex w-full items-center gap-2 px-1" aria-hidden>
              <span className="h-[2px] flex-1 bg-[#444c54]" />
              <span className="font-mono text-[8px] font-black tracking-[0.2em] text-[#353d44]">MK-320</span>
              <span className="h-[2px] flex-1 bg-[#444c54]" />
            </div>
          )}
        </div>

        {/* === LOWER HALF: EXACT PHOTO BUTTON LAYOUT (D-Pad Left · X/O Stepped Right · MENU Bottom Center) === */}
        <div className="relative z-10 mt-1 grid grid-cols-2 items-center gap-2 px-2 sm:px-3">
          {/* LOWER-LEFT: 4-Way Cross D-Pad */}
          <div className="flex flex-col items-center justify-self-start">
            <div
              className="rounded-2xl p-1.5"
              style={{
                background: isAtomic ? "rgba(10, 6, 22, 0.35)" : "rgba(0, 0, 0, 0.14)",
                boxShadow: "inset 0 2px 5px rgba(0,0,0,0.3)",
              }}
            >
              <div className="grid grid-cols-3 grid-rows-3" role="group" aria-label="4-Way D-Pad">
                <div />
                <button
                  type="button"
                  aria-label="D-Pad Up"
                  {...bindHw("up")}
                  style={dpadBtnStyle(hwPressed.up)}
                  className="flex h-[34px] w-[34px] items-center justify-center rounded-t-lg border-x border-t text-[11px] font-black"
                >
                  ▲
                </button>
                <div />
                <button
                  type="button"
                  aria-label="D-Pad Left"
                  {...bindHw("left")}
                  style={dpadBtnStyle(hwPressed.left)}
                  className="flex h-[34px] w-[34px] items-center justify-center rounded-l-lg border-y border-l text-[11px] font-black"
                >
                  ◄
                </button>
                <div
                  className="flex h-[34px] w-[34px] items-center justify-center"
                  style={{ background: model.dpadCenterBg }}
                >
                  <span className="h-3.5 w-3.5 rounded-full bg-black/25 shadow-inner" />
                </div>
                <button
                  type="button"
                  aria-label="D-Pad Right"
                  {...bindHw("right")}
                  style={dpadBtnStyle(hwPressed.right)}
                  className="flex h-[34px] w-[34px] items-center justify-center rounded-r-lg border-y border-r text-[11px] font-black"
                >
                  ►
                </button>
                <div />
                <button
                  type="button"
                  aria-label="D-Pad Down"
                  {...bindHw("down")}
                  style={dpadBtnStyle(hwPressed.down)}
                  className="flex h-[34px] w-[34px] items-center justify-center rounded-b-lg border-x border-b text-[11px] font-black"
                >
                  ▼
                </button>
                <div />
              </div>
            </div>
          </div>

          {/* LOWER-RIGHT: Diagonally Stepped X (Lower-Left) & O (Upper-Right) — Matches Photo Exactly */}
          <div className="flex items-center justify-self-end pr-1">
            {isAtomic ? (
              /* Atomic Purple classic 4-button retro red/blue diamond (photo model #5) */
              <div className="grid grid-cols-3 grid-rows-3 items-center justify-items-center gap-0.5">
                <div />
                <button
                  type="button"
                  aria-label={`O Action Top Button — ${oSubLabel}`}
                  {...bindHw("o")}
                  style={{ ...roundFaceStyle(hwPressed.o, model.oBg, model.oBorder, model.oText), minHeight: "36px" }}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-black"
                >
                  O
                </button>
                <div />
                <button
                  type="button"
                  aria-label={`X Button — ${xSubLabel}`}
                  {...bindHw("x")}
                  style={{ ...roundFaceStyle(hwPressed.x, model.xBg, model.xBorder, model.xText), minHeight: "36px" }}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-black"
                >
                  X
                </button>
                <div />
                <button
                  type="button"
                  aria-label={`X Secondary Button — ${xSubLabel}`}
                  {...bindHw("x")}
                  style={{ ...roundFaceStyle(hwPressed.x, model.xBg, model.xBorder, model.xText), minHeight: "36px" }}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-black"
                >
                  X
                </button>
                <div />
                <button
                  type="button"
                  aria-label={`O Action Button — ${oSubLabel}`}
                  {...bindHw("o")}
                  style={{ ...roundFaceStyle(hwPressed.o, model.oBg, model.oBorder, model.oText), minHeight: "36px" }}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-black"
                >
                  O
                </button>
                <div />
              </div>
            ) : (
              /* Signature 2-button diagonal layout from Dragon, Kitty, Flower, and Cyber Bot */
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center gap-1 pt-7">
                  <button
                    type="button"
                    aria-label={`X Button: ${xSubLabel}`}
                    {...bindHw("x")}
                    style={roundFaceStyle(hwPressed.x, model.xBg, model.xBorder, model.xText)}
                    className="flex h-12 w-12 items-center justify-center rounded-full text-base font-black"
                  >
                    X
                  </button>
                  <span
                    className="font-mono text-[8.5px] font-extrabold tracking-tight"
                    style={{ color: model.menuLabelColor }}
                  >
                    {xSubLabel}
                  </span>
                </div>

                <div className="flex flex-col items-center gap-1 -mt-7">
                  <button
                    type="button"
                    aria-label={`O Button: ${oSubLabel}`}
                    {...bindHw("o")}
                    style={roundFaceStyle(hwPressed.o, model.oBg, model.oBorder, model.oText)}
                    className="flex h-12 w-12 items-center justify-center rounded-full text-base font-black"
                  >
                    O
                  </button>
                  <span
                    className="font-mono text-[8.5px] font-extrabold tracking-tight"
                    style={{ color: model.menuLabelColor }}
                  >
                    {oSubLabel}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* === BOTTOM CENTER: EMBOSSED `--` MENU PILL (EXACT PHOTO LOCATION) === */}
        <div className="relative z-10 mt-3 flex flex-col items-center gap-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={`Menu Button (${menuSubLabel})`}
              {...bindHw("menu")}
              style={{
                background: hwPressed.menu || pttActive
                  ? "linear-gradient(180deg, #fef08a 0%, #facc15 100%)"
                  : model.menuBg,
                color: hwPressed.menu || pttActive ? "#141026" : model.menuText,
                border: `2px solid ${model.menuBorder}`,
                boxShadow: hwPressed.menu
                  ? "0 0 12px rgba(253,224,71,0.7)"
                  : "inset 0 1px 1px rgba(255,255,255,0.28), 0 3px 5px rgba(0,0,0,0.32)",
                transform: hwPressed.menu ? "translateY(1px)" : undefined,
                minHeight: "18px",
                height: "18px",
                width: "46px",
              }}
              className="flex items-center justify-center rounded-full font-mono text-[10px] font-black leading-none tracking-widest"
            >
              --
            </button>
          </div>
          <span
            className="font-mono text-[9px] font-extrabold tracking-[0.2em] uppercase"
            style={{ color: model.menuLabelColor }}
          >
            {menuSubLabel}
          </span>
        </div>
      </div>

      {/* === BOTTOM-LEFT BRAIDED WRIST LANYARD STRAP (Matching Each Physical Model!) === */}
      <svg
        aria-hidden
        viewBox="0 0 260 66"
        className="pointer-events-none absolute -bottom-1 left-4 z-0 h-16 w-64 drop-shadow-[0_6px_8px_rgba(0,0,0,0.5)]"
      >
        {/* Metallic lanyard ferrule crimp */}
        <rect x="26" y="14" width="16" height="10" rx="3" transform="rotate(24 34 19)" fill="#cbd5e1" stroke="#475569" strokeWidth="1.5" />
        {/* Thin anchor cord into bottom-left corner lug */}
        <path d="M22 2 L32 16" stroke={model.lanyardSecondary} strokeWidth="3.5" strokeLinecap="round" />
        {/* Braided strap loop */}
        <path
          d="M40 22 C 95 56, 210 66, 240 44 C 260 28, 224 14, 155 24 C 102 32, 68 28, 42 18"
          fill="none"
          stroke={model.lanyardPrimary}
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M40 22 C 95 56, 210 66, 240 44 C 260 28, 224 14, 155 24 C 102 32, 68 28, 42 18"
          fill="none"
          stroke={model.lanyardSecondary}
          strokeWidth="10"
          strokeDasharray="6 8"
          strokeLinecap="round"
        />
        <path
          d="M40 22 C 95 56, 210 66, 240 44 C 260 28, 224 14, 155 24 C 102 32, 68 28, 42 18"
          fill="none"
          stroke={model.lanyardAccent}
          strokeWidth="3"
          strokeDasharray="3 11"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
