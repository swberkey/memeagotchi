import { useEffect, useState, type PointerEvent } from "react";
import type { GamepadButton, GamepadController } from "./types.ts";

export function ArcadeGamepad({
  controller,
  specialLabel = "Special",
  onMenuHold,
  compact = false,
}: {
  controller: GamepadController;
  specialLabel?: string;
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
    background: active ? "#7be6d8" : "#34314a",
    color: active ? "#141026" : "#ffffff",
    borderColor: "#090814",
    transform: active ? "translateY(1px)" : undefined,
  });

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 select-none touch-none shadow-lg"
      style={{
        background: "linear-gradient(180deg, #25223b 0%, #17142b 100%)",
        borderColor: "#3f336d",
      }}
      aria-label="MemeAgotchi D-Pad and O X Menu Controls"
    >
      {/* Left 4-Way Tactile D-Pad */}
      <div className="grid grid-cols-3 grid-rows-3 gap-[2px] shrink-0" role="group" aria-label="D-Pad">
        <div />
        <button
          type="button"
          aria-label="D-Pad Up"
          {...bindBtn("up")}
          style={dpadStyle(pressed.up)}
          className={`${dSize} rounded-t-lg border-2 font-bold flex items-center justify-center shadow`}
        >
          ▲
        </button>
        <div />
        <button
          type="button"
          aria-label="D-Pad Left"
          {...bindBtn("left")}
          style={dpadStyle(pressed.left)}
          className={`${dSize} rounded-l-lg border-2 font-bold flex items-center justify-center shadow`}
        >
          ◄
        </button>
        <div
          className={`${dSize} flex items-center justify-center`}
          style={{ background: "#27243a", border: "1px solid rgba(9,8,20,0.6)" }}
        >
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#141026" }} />
        </div>
        <button
          type="button"
          aria-label="D-Pad Right"
          {...bindBtn("right")}
          style={dpadStyle(pressed.right)}
          className={`${dSize} rounded-r-lg border-2 font-bold flex items-center justify-center shadow`}
        >
          ►
        </button>
        <div />
        <button
          type="button"
          aria-label="D-Pad Down"
          {...bindBtn("down")}
          style={dpadStyle(pressed.down)}
          className={`${dSize} rounded-b-lg border-2 font-bold flex items-center justify-center shadow`}
        >
          ▼
        </button>
        <div />
      </div>

      {/* Center Menu (--) Pill */}
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          aria-label="Menu Pause Button"
          {...bindBtn("menu")}
          onDoubleClick={() => onMenuHold?.()}
          style={{
            background: pressed.menu ? "#fde047" : "#383454",
            color: pressed.menu ? "#141026" : "#e5e1ff",
            borderBottom: "4px solid #111022",
            transform: pressed.menu ? "translateY(1px)" : undefined,
          }}
          className="px-4 py-1.5 rounded-full font-mono text-xs font-extrabold tracking-widest shadow"
        >
          --
        </button>
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#bcb2dc" }}>
          Pause / Menu
        </span>
      </div>

      {/* Right X (Special) & O (Action) Arcade Buttons */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex flex-col items-center gap-1 mt-4">
          <button
            type="button"
            aria-label={`X Button — ${specialLabel}`}
            {...bindBtn("x")}
            style={{
              background: pressed.x
                ? "#f472b6"
                : "linear-gradient(180deg, #c084fc 0%, #7c3aed 100%)",
              color: pressed.x ? "#141026" : "#ffffff",
              borderBottom: "5px solid #4c1d95",
              transform: pressed.x ? "translateY(2px)" : undefined,
            }}
            className="w-12 h-12 rounded-full font-black text-lg shadow-lg flex items-center justify-center"
          >
            X
          </button>
          <span
            className="text-[10px] font-bold max-w-[74px] truncate text-center"
            style={{ color: "#c4b5fd" }}
          >
            {specialLabel}
          </span>
        </div>

        <div className="flex flex-col items-center gap-1 -mt-4">
          <button
            type="button"
            aria-label="O Action Button"
            {...bindBtn("o")}
            style={{
              background: pressed.o
                ? "#fde047"
                : "linear-gradient(180deg, #7be6d8 0%, #14b8a6 100%)",
              color: "#141026",
              borderBottom: "5px solid #0f766e",
              transform: pressed.o ? "translateY(2px)" : undefined,
            }}
            className="w-14 h-14 rounded-full font-black text-xl shadow-lg flex items-center justify-center"
          >
            O
          </button>
          <span className="text-[10px] font-bold" style={{ color: "#7be6d8" }}>
            Action
          </span>
        </div>
      </div>
    </div>
  );
}
