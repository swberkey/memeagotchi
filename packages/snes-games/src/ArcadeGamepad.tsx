import { useEffect, useState, type PointerEvent } from "react";
import type { GamepadButton, GamepadController } from "./types.ts";

export function ArcadeGamepad({
  controller,
  specialLabel = "Special",
  actionLabel = "Action",
  menuLabel = "Pause / Menu",
  onMenuHold,
  compact = false,
}: {
  controller: GamepadController;
  specialLabel?: string;
  actionLabel?: string;
  menuLabel?: string;
  onMenuHold?: () => void;
  compact?: boolean;
}) {
  const [pressed, setPressed] = useState<Readonly<Record<GamepadButton, boolean>>>(() => ({
    ...controller.pressed,
  }));

  useEffect(() => controller.subscribeState(setPressed), [controller]);

  const bindBtn = (btn: GamepadButton) => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      controller.press(btn);
    },
    onPointerUp: (e: PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      controller.release(btn);
    },
    onPointerCancel: () => controller.release(btn),
    onLostPointerCapture: () => controller.release(btn),
  });

  const dSize = compact ? "w-9 h-9 text-xs" : "w-10 h-10 text-sm";

  const dpadStyle = (active: boolean) => ({
    background: active
      ? "linear-gradient(180deg, #99f6e4 0%, #2dd4bf 100%)"
      : "linear-gradient(180deg, #3c385c 0%, #26233d 100%)",
    color: active ? "#141026" : "#f1eeff",
    borderColor: "#0c0a1a",
    boxShadow: active
      ? "0 0 12px rgba(123,230,216,0.6), inset 0 1px 0 rgba(255,255,255,0.5)"
      : "inset 0 1px 0 rgba(255,255,255,0.16), 0 2px 4px rgba(0,0,0,0.4)",
    transform: active ? "translateY(1px)" : undefined,
  });

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-[26px] border px-5 py-3.5 select-none touch-none"
      style={{
        background: "linear-gradient(160deg, rgba(45, 38, 82, 0.92) 0%, rgba(22, 18, 46, 0.96) 100%)",
        borderColor: "rgba(196, 181, 253, 0.28)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), 0 14px 32px rgba(6,4,20,0.55)",
      }}
      aria-label="MemeAgotchi D-Pad and O X Menu Controls"
    >
      {/* Left 4-Way Tactile D-Pad in Recessed Well */}
      <div
        className="rounded-full p-2 shrink-0"
        style={{
          background: "radial-gradient(circle at 50% 50%, #121024 0%, #1c1833 100%)",
          boxShadow: "inset 0 3px 8px rgba(0,0,0,0.7), 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        <div className="grid grid-cols-3 grid-rows-3 gap-[2px]" role="group" aria-label="D-Pad">
          <div />
          <button
            type="button"
            aria-label="D-Pad Up"
            {...bindBtn("up")}
            style={dpadStyle(pressed.up)}
            className={`${dSize} rounded-t-xl border font-bold flex items-center justify-center`}
          >
            ▲
          </button>
          <div />
          <button
            type="button"
            aria-label="D-Pad Left"
            {...bindBtn("left")}
            style={dpadStyle(pressed.left)}
            className={`${dSize} rounded-l-xl border font-bold flex items-center justify-center`}
          >
            ◄
          </button>
          <div
            className={`${dSize} flex items-center justify-center`}
            style={{ background: "#232038" }}
          >
            <span
              className="w-3 h-3 rounded-full"
              style={{
                background: "radial-gradient(circle at 35% 35%, #373257, #121024)",
                boxShadow: "inset 0 1px 2px rgba(0,0,0,0.8)",
              }}
            />
          </div>
          <button
            type="button"
            aria-label="D-Pad Right"
            {...bindBtn("right")}
            style={dpadStyle(pressed.right)}
            className={`${dSize} rounded-r-xl border font-bold flex items-center justify-center`}
          >
            ►
          </button>
          <div />
          <button
            type="button"
            aria-label="D-Pad Down"
            {...bindBtn("down")}
            style={dpadStyle(pressed.down)}
            className={`${dSize} rounded-b-xl border font-bold flex items-center justify-center`}
          >
            ▼
          </button>
          <div />
        </div>
      </div>

      {/* Center Menu (--) Pill */}
      <div className="flex flex-col items-center gap-1.5">
        <button
          type="button"
          aria-label="Menu Pause Button"
          {...bindBtn("menu")}
          onDoubleClick={() => onMenuHold?.()}
          style={{
            background: pressed.menu
              ? "linear-gradient(180deg, #fef08a 0%, #facc15 100%)"
              : "linear-gradient(180deg, #433e68 0%, #2b2748 100%)",
            color: pressed.menu ? "#141026" : "#f1eeff",
            borderBottom: "4px solid #121024",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22), 0 4px 10px rgba(0,0,0,0.4)",
            transform: pressed.menu ? "translateY(1px)" : undefined,
          }}
          className="px-5 py-1.5 rounded-full font-mono text-xs font-extrabold tracking-widest"
        >
          --
        </button>
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#bcb2dc" }}>
          {menuLabel}
        </span>
      </div>

      {/* Right X (Special) & O (Action) Candy-Glass Arcade Buttons */}
      <div className="flex items-center gap-3.5 shrink-0">
        <div className="flex flex-col items-center gap-1 mt-5">
          <button
            type="button"
            aria-label={`X Button — ${specialLabel}`}
            {...bindBtn("x")}
            style={{
              background: pressed.x
                ? "linear-gradient(180deg, #f9a8d4 0%, #ec4899 100%)"
                : "linear-gradient(180deg, #d8b4fe 0%, #9333ea 60%, #6b21a8 100%)",
              color: pressed.x ? "#141026" : "#ffffff",
              borderBottom: "5px solid #3b0764",
              boxShadow: pressed.x
                ? "0 0 18px rgba(244,114,182,0.75), inset 0 2px 2px rgba(255,255,255,0.5)"
                : "0 6px 14px rgba(107,33,168,0.45), inset 0 2px 3px rgba(255,255,255,0.4)",
              transform: pressed.x ? "translateY(2px)" : undefined,
            }}
            className="w-12 h-12 rounded-full font-black text-lg flex items-center justify-center"
          >
            X
          </button>
          <span
            className="text-[10px] font-bold max-w-[78px] truncate text-center"
            style={{ color: "#d8b4fe" }}
          >
            {specialLabel}
          </span>
        </div>

        <div className="flex flex-col items-center gap-1 -mt-5">
          <button
            type="button"
            aria-label="O Action Button"
            {...bindBtn("o")}
            style={{
              background: pressed.o
                ? "linear-gradient(180deg, #fef08a 0%, #facc15 100%)"
                : "linear-gradient(180deg, #99f6e4 0%, #2dd4bf 58%, #0d9488 100%)",
              color: "#141026",
              borderBottom: "5px solid #115e59",
              boxShadow: pressed.o
                ? "0 0 18px rgba(253,224,71,0.75), inset 0 2px 2px rgba(255,255,255,0.6)"
                : "0 6px 16px rgba(20,184,166,0.45), inset 0 2px 3px rgba(255,255,255,0.5)",
              transform: pressed.o ? "translateY(2px)" : undefined,
            }}
            className="w-14 h-14 rounded-full font-black text-xl flex items-center justify-center"
          >
            O
          </button>
          <span className="text-[10px] font-bold" style={{ color: "#7be6d8" }}>
            {actionLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
