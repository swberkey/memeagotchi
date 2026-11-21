import { useEffect, useMemo, useRef } from "react";
import { snesSfx } from "../sound.ts";
import {
  createGamepadController,
  SCREEN_H,
  SCREEN_W,
  type GamepadButton,
  type SnesArcadeCanvasProps,
} from "../types.ts";
import {
  computeEmberQuestScore,
  getEmberSnapshot,
  readEmberFile,
  writeEmberFile,
  type EmberSnapshot,
} from "./emberValeStorage.ts";
import type { EmberValeWasmModule } from "./emberValeWasm.d.ts";

// Bitmask matching core/ember_vale.h
const EV_BTN_UP = 1 << 0;
const EV_BTN_DOWN = 1 << 1;
const EV_BTN_LEFT = 1 << 2;
const EV_BTN_RIGHT = 1 << 3;
const EV_BTN_X = 1 << 4; // sword / talk / open / confirm
const EV_BTN_O = 1 << 5; // use item / back
const EV_BTN_START = 1 << 6; // inventory / map / save & exit

type EmberPhase = "loading" | "running" | "saved" | "error";

function mapEmberKey(code: string, key: string): GamepadButton | null {
  if (code === "ArrowUp" || code === "KeyW") return "up";
  if (code === "ArrowDown" || code === "KeyS") return "down";
  if (code === "ArrowLeft" || code === "KeyA") return "left";
  if (code === "ArrowRight" || code === "KeyD") return "right";
  // In Ember Vale: X = Sword/Talk/Confirm, O = Item/Back, Start (--) = Inventory/Save Menu
  if (code === "KeyX" || code === "KeyJ" || code === "Space" || code === "ShiftLeft" || code === "ShiftRight") {
    return "x";
  }
  if (code === "KeyZ" || code === "KeyK" || key === "o" || key === "O") {
    return "o";
  }
  if (code === "Enter" || code === "Escape" || code === "KeyP") {
    return "menu";
  }
  return null;
}

function controllerToBitmask(pressed: Readonly<Record<GamepadButton, boolean>>): number {
  let b = 0;
  if (pressed.up) b |= EV_BTN_UP;
  if (pressed.down) b |= EV_BTN_DOWN;
  if (pressed.left) b |= EV_BTN_LEFT;
  if (pressed.right) b |= EV_BTN_RIGHT;
  if (pressed.x) b |= EV_BTN_X;
  if (pressed.o) b |= EV_BTN_O;
  if (pressed.menu) b |= EV_BTN_START;
  return b;
}

function pollHardwareGamepads(): number {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return 0;
  let pad = 0;
  const gps = navigator.getGamepads();
  for (let i = 0; i < gps.length; i++) {
    const g = gps[i];
    if (!g) continue;
    const bt = (n: number) => Boolean(g.buttons[n]?.pressed);
    if (bt(12) || (g.axes[1] ?? 0) < -0.5) pad |= EV_BTN_UP;
    if (bt(13) || (g.axes[1] ?? 0) > 0.5) pad |= EV_BTN_DOWN;
    if (bt(14) || (g.axes[0] ?? 0) < -0.5) pad |= EV_BTN_LEFT;
    if (bt(15) || (g.axes[0] ?? 0) > 0.5) pad |= EV_BTN_RIGHT;
    if (bt(0)) pad |= EV_BTN_X;
    if (bt(1) || bt(2)) pad |= EV_BTN_O;
    if (bt(9)) pad |= EV_BTN_START;
  }
  return pad;
}

export function EmberValeCanvas({
  soundOn,
  bestScore = 0,
  controller: externalController,
  captureKeyboard = true,
  resultBanner,
  onComplete,
  onExit,
  className = "",
}: SnesArcadeCanvasProps) {
  const internalController = useMemo(() => createGamepadController(), []);
  const controller = externalController ?? internalController;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wasmRef = useRef<EmberValeWasmModule | null>(null);
  const phaseRef = useRef<EmberPhase>("loading");
  const errorMsgRef = useRef("");
  const startSnapRef = useRef<EmberSnapshot>(getEmberSnapshot());
  const savedSnapRef = useRef<EmberSnapshot>(getEmberSnapshot());
  const savedScoreRef = useRef<{ score: number; sessionCoins: number }>({ score: 0, sessionCoins: 0 });
  const tickRef = useRef(0);

  const propsRef = useRef({ soundOn, bestScore, resultBanner, onComplete, onExit });
  propsRef.current = { soundOn, bestScore, resultBanner, onComplete, onExit };

  const relaunchEmber = () => {
    const mod = wasmRef.current;
    if (!mod) return;
    startSnapRef.current = getEmberSnapshot();
    mod._web_init();
    phaseRef.current = "running";
    snesSfx.start(propsRef.current.soundOn);
  };

  // Load C99/WASM Ember Vale core lazily once on mount
  useEffect(() => {
    let disposed = false;
    phaseRef.current = "loading";
    startSnapRef.current = getEmberSnapshot();

    void import("./emberValeWasm.js")
      .then((m) => m.default({ saveWrite: writeEmberFile, saveRead: readEmberFile }))
      .then((mod) => {
        if (disposed) return;
        wasmRef.current = mod;
        mod._web_init();
        phaseRef.current = "running";
      })
      .catch((err: unknown) => {
        if (disposed) return;
        errorMsgRef.current = err instanceof Error ? err.message : "Failed to initialize Ember Vale WASM";
        phaseRef.current = "error";
      });

    const autoSave = () => {
      if (wasmRef.current && phaseRef.current === "running") {
        try {
          wasmRef.current._web_save();
        } catch {
          /* ignore */
        }
      }
    };
    const onVis = () => {
      if (document.hidden) autoSave();
    };
    window.addEventListener("pagehide", autoSave);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      disposed = true;
      autoSave();
      window.removeEventListener("pagehide", autoSave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // Handle button edges on the post-Save & Exit summary screen
  useEffect(() => {
    return controller.subscribeEdge((btn) => {
      if (phaseRef.current === "saved") {
        if (btn === "x" || btn === "o") {
          relaunchEmber();
        } else if (btn === "menu") {
          propsRef.current.onExit?.();
        }
      } else if (phaseRef.current === "error") {
        if (btn === "x" || btn === "o" || btn === "menu") {
          propsRef.current.onExit?.();
        }
      }
    });
  }, [controller]);

  // Keyboard bindings tailored for Ember Vale
  useEffect(() => {
    if (!captureKeyboard) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const btn = mapEmberKey(e.code, e.key);
      if (!btn) return;
      e.preventDefault();
      if (!e.repeat) controller.press(btn);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const btn = mapEmberKey(e.code, e.key);
      if (!btn) return;
      controller.release(btn);
    };
    const onBlur = () => controller.releaseAll();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      controller.releaseAll();
    };
  }, [captureKeyboard, controller]);

  // Fixed 60 Hz step + 320x240 RGBA blit loop
  useEffect(() => {
    let rafId = 0;
    let acc = 0;
    let lastTs = 0;
    const TICK = 1000 / 60;
    let imgData: ImageData | null = null;

    const frame = (ts: number) => {
      rafId = requestAnimationFrame(frame);
      if (!lastTs) lastTs = ts;
      const elapsed = Math.min(ts - lastTs, 100);
      lastTs = ts;
      tickRef.current += elapsed / 1000;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx) return;

      const phase = phaseRef.current;
      const mod = wasmRef.current;

      if (phase === "running" && mod) {
        acc += elapsed;
        let b = controllerToBitmask(controller.pressed) | pollHardwareGamepads();
        // Cancel opposing D-Pad directions cleanly (exact same rule as page.html)
        if ((b & (EV_BTN_LEFT | EV_BTN_RIGHT)) === (EV_BTN_LEFT | EV_BTN_RIGHT)) {
          b &= ~(EV_BTN_LEFT | EV_BTN_RIGHT);
        }
        if ((b & (EV_BTN_UP | EV_BTN_DOWN)) === (EV_BTN_UP | EV_BTN_DOWN)) {
          b &= ~(EV_BTN_UP | EV_BTN_DOWN);
        }

        let steps = 0;
        let exited = false;
        while (acc >= TICK && steps < 4) {
          acc -= TICK;
          steps++;
          if (mod._web_step(b) === 1) {
            exited = true;
            break;
          }
        }

        if (exited) {
          const endSnap = getEmberSnapshot();
          const startSnap = startSnapRef.current;
          const played =
            endSnap.status.playSeconds > startSnap.status.playSeconds ||
            endSnap.wallet.lifetimeCoins > startSnap.wallet.lifetimeCoins ||
            endSnap.status.crystals > startSnap.status.crystals ||
            endSnap.status.hearts > startSnap.status.hearts;

          if (!played) {
            // Player chose EXIT straight from Ember Vale title screen without playing
            propsRef.current.onExit?.();
            return;
          }

          const { score, maxCombo } = computeEmberQuestScore(endSnap);
          const sessionCoins = Math.max(0, endSnap.wallet.lifetimeCoins - startSnap.wallet.lifetimeCoins);
          savedSnapRef.current = endSnap;
          savedScoreRef.current = { score, sessionCoins };
          phaseRef.current = "saved";
          snesSfx.finish(propsRef.current.soundOn, true);
          propsRef.current.onComplete({ game: "ember", score, maxCombo });
          return;
        }

        if (steps > 0) {
          if (!imgData) imgData = ctx.createImageData(SCREEN_W, SCREEN_H);
          const ptr = mod._web_render() >> 2;
          imgData.data.set(new Uint8Array(mod.HEAPU32.buffer, ptr * 4, SCREEN_W * SCREEN_H * 4));
          ctx.putImageData(imgData, 0, 0);
        }
      } else if (phase === "loading") {
        renderEmberLoading(ctx, tickRef.current);
      } else if (phase === "saved") {
        renderEmberSaved(
          ctx,
          savedSnapRef.current,
          savedScoreRef.current.score,
          savedScoreRef.current.sessionCoins,
          propsRef.current.bestScore,
          propsRef.current.resultBanner,
        );
      } else if (phase === "error") {
        renderEmberError(ctx, errorMsgRef.current);
      }
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [controller]);

  const handleClick = () => {
    if (phaseRef.current === "saved") {
      relaunchEmber();
    } else if (phaseRef.current === "error") {
      propsRef.current.onExit?.();
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={SCREEN_W}
      height={SCREEN_H}
      onClick={handleClick}
      aria-label="Ember Vale 320 by 240 action-adventure RPG canvas"
      className={`block w-full aspect-[4/3] bg-[#0e0b1a] select-none cursor-pointer ${className}`}
      style={{ imageRendering: "pixelated" }}
    />
  );
}

function renderEmberLoading(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = "#15131c";
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.strokeStyle = "#f2a03d";
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 48, SCREEN_W - 40, 144);
  ctx.textAlign = "center";
  ctx.fillStyle = "#f2a03d";
  ctx.font = "bold 16px monospace";
  ctx.fillText("EMBER VALE", SCREEN_W / 2, 92);
  ctx.fillStyle = "#7fc27a";
  ctx.font = "bold 9px monospace";
  ctx.fillText("320×240 ESP32-S3 C99/WASM CORE", SCREEN_W / 2, 114);
  const dots = ".".repeat((Math.floor(t * 4) % 3) + 1);
  ctx.fillStyle = "#eae4f2";
  ctx.font = "bold 10px monospace";
  ctx.fillText(`LOADING CARTRIDGE${dots}`, SCREEN_W / 2, 148);
  ctx.fillStyle = "#a69cb6";
  ctx.font = "8px monospace";
  ctx.fillText("X: SWORD/OK · O: ITEM/BACK · --: MENU/SAVE", SCREEN_W / 2, 174);
  ctx.textAlign = "left";
}

function renderEmberSaved(
  ctx: CanvasRenderingContext2D,
  snap: EmberSnapshot,
  score: number,
  sessionCoins: number,
  bestScore: number,
  resultBanner?: string,
) {
  const grad = ctx.createLinearGradient(0, 0, 0, SCREEN_H);
  grad.addColorStop(0, "#241938");
  grad.addColorStop(1, "#110d1e");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  ctx.textAlign = "center";
  ctx.fillStyle = "#f2a03d";
  ctx.font = "bold 14px monospace";
  ctx.fillText("ADVENTURE SAVED!", SCREEN_W / 2, 30);

  ctx.fillStyle = "rgba(12, 10, 24, 0.85)";
  ctx.fillRect(18, 44, SCREEN_W - 36, 128);
  ctx.strokeStyle = "#f2a03d";
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 44, SCREEN_W - 36, 128);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 12px monospace";
  ctx.fillText(`QUEST SCORE: ${score}`, SCREEN_W / 2, 68);

  ctx.fillStyle = "#7be6d8";
  ctx.font = "bold 9.5px monospace";
  ctx.fillText(
    `HEARTS ${snap.status.hearts}/9 · CRYSTALS ${snap.status.crystals}/2`,
    SCREEN_W / 2,
    90,
  );

  ctx.fillStyle = "#fde047";
  ctx.font = "bold 9.5px monospace";
  ctx.fillText(
    `WALLET: ${snap.wallet.coins} COINS (+${sessionCoins} THIS RUN)`,
    SCREEN_W / 2,
    110,
  );

  const items: string[] = [];
  if (snap.status.items.boomerang) items.push("BOOMERANG");
  if (snap.status.items.bombs) items.push("BOMBS");
  if (snap.status.items.bow) items.push("BOW");
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "bold 8.5px monospace";
  ctx.fillText(
    items.length ? `GEAR: ${items.join(" · ")}` : "TIP: FIND THE BOOMERANG IN PEBBLE CAVE!",
    SCREEN_W / 2,
    130,
  );

  if (score >= bestScore && score > 0) {
    ctx.fillStyle = "#f472b6";
    ctx.font = "bold 9px monospace";
    ctx.fillText("★ NEW PERSONAL BEST! ★", SCREEN_W / 2, 152);
  } else {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 9px monospace";
    ctx.fillText(`BEST QUEST SCORE: ${bestScore}`, SCREEN_W / 2, 152);
  }

  if (resultBanner) {
    const clean = resultBanner
      .replace(/^[^\w+]+/, "")
      .replace(/complete!\s*Score\s*\d+:\s*/i, "")
      .trim();
    ctx.fillStyle = "#7fc27a";
    ctx.font = "bold 8px monospace";
    ctx.fillText(clean.slice(0, 44), SCREEN_W / 2, 192);
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 9.5px monospace";
  ctx.fillText("X / O : RESUME   ·   -- : EXIT TO ARCADE", SCREEN_W / 2, 222);
  ctx.textAlign = "left";
}

function renderEmberError(ctx: CanvasRenderingContext2D, msg: string) {
  ctx.fillStyle = "#1a0e18";
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#fb7185";
  ctx.font = "bold 12px monospace";
  ctx.fillText("CARTRIDGE LOAD ERROR", SCREEN_W / 2, 95);
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "9px monospace";
  ctx.fillText(msg.slice(0, 42), SCREEN_W / 2, 122);
  ctx.fillStyle = "#fde047";
  ctx.fillText("PRESS O OR X TO RETURN", SCREEN_W / 2, 158);
  ctx.textAlign = "left";
}
