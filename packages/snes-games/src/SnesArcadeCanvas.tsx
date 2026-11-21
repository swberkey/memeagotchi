import { MINI_GAMES_CATALOG, SPECIES_BY_ID } from "@memeagotchi/game-core";
import { useEffect, useMemo, useRef } from "react";
import { createBeatEngine } from "./games/beat.ts";
import { createBlasterEngine } from "./games/blaster.ts";
import { createRunnerEngine } from "./games/runner.ts";
import { snesSfx } from "./sound.ts";
import { drawSpeciesHero } from "./spriteDraw.ts";
import {
  createGamepadController,
  SCREEN_H,
  SCREEN_W,
  type GamepadButton,
  type SnesArcadeCanvasProps,
  type SnesEngineInstance,
  type SnesGameResult,
} from "./types.ts";

type Phase = "ready" | "playing" | "paused" | "results";

function mapKeyToButton(code: string, key: string): GamepadButton | null {
  if (code === "ArrowUp" || code === "KeyW") return "up";
  if (code === "ArrowDown" || code === "KeyS") return "down";
  if (code === "ArrowLeft" || code === "KeyA") return "left";
  if (code === "ArrowRight" || code === "KeyD") return "right";
  if (code === "Space" || code === "Enter" || code === "KeyZ" || key === "o" || key === "O") return "o";
  if (code === "KeyX" || code === "ShiftLeft" || code === "ShiftRight") return "x";
  if (code === "Escape" || code === "KeyP") return "menu";
  return null;
}

export function SnesArcadeCanvas({
  game,
  species,
  stage,
  equippedIds,
  soundOn,
  milestonePowers,
  buffs,
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
  const phaseRef = useRef<Phase>("ready");
  const engineRef = useRef<SnesEngineInstance | null>(null);
  const resultRef = useRef<SnesGameResult | null>(null);
  const idleTimeRef = useRef(0);

  const propsRef = useRef({
    game,
    species,
    stage,
    equippedIds,
    soundOn,
    milestonePowers,
    buffs,
    bestScore,
    resultBanner,
    onComplete,
    onExit,
  });
  propsRef.current = {
    game,
    species,
    stage,
    equippedIds,
    soundOn,
    milestonePowers,
    buffs,
    bestScore,
    resultBanner,
    onComplete,
    onExit,
  };

  // Reset to ready whenever selected game changes
  useEffect(() => {
    phaseRef.current = "ready";
    engineRef.current = null;
    resultRef.current = null;
  }, [game]);

  const startRun = () => {
    const p = propsRef.current;
    const cfg = {
      species: p.species,
      stage: p.stage,
      equippedIds: p.equippedIds,
      soundOn: p.soundOn,
      milestonePowers: p.milestonePowers,
      buffs: p.buffs,
    };
    engineRef.current =
      p.game === "runner"
        ? createRunnerEngine(cfg)
        : p.game === "blaster"
          ? createBlasterEngine(cfg)
          : createBeatEngine(cfg);
    resultRef.current = null;
    phaseRef.current = "playing";
    snesSfx.start(p.soundOn);
  };

  // Subscribe to button edges from controller
  useEffect(() => {
    return controller.subscribeEdge((btn) => {
      const p = propsRef.current;
      const phase = phaseRef.current;
      if (phase === "ready") {
        if (btn === "o") startRun();
        else if (btn === "x" || btn === "menu") p.onExit?.();
        return;
      }
      if (phase === "paused") {
        if (btn === "o" || btn === "menu") {
          phaseRef.current = "playing";
          snesSfx.pause(p.soundOn);
        } else if (btn === "x") {
          phaseRef.current = "ready";
          engineRef.current = null;
          p.onExit?.();
        }
        return;
      }
      if (phase === "results") {
        if (btn === "o") startRun();
        else if (btn === "x" || btn === "menu") p.onExit?.();
        return;
      }
      // Playing
      if (btn === "menu") {
        phaseRef.current = "paused";
        snesSfx.pause(p.soundOn);
        return;
      }
      engineRef.current?.onButtonPress(btn);
    });
  }, [controller]);

  // Optional keyboard capture
  useEffect(() => {
    if (!captureKeyboard) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const btn = mapKeyToButton(e.code, e.key);
      if (!btn) return;
      e.preventDefault();
      if (!e.repeat) controller.press(btn);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const btn = mapKeyToButton(e.code, e.key);
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

  // 60fps RAF loop
  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();

    const frame = (ts: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (ts - lastTs) / 1000));
      lastTs = ts;
      idleTimeRef.current += dt;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (ctx) {
        const p = propsRef.current;
        const phase = phaseRef.current;

        if (phase === "playing" && engineRef.current) {
          const outcome = engineRef.current.update(dt, controller.pressed);
          engineRef.current.render(ctx);
          if (outcome) {
            resultRef.current = outcome;
            phaseRef.current = "results";
            snesSfx.finish(p.soundOn, outcome.cleared);
            p.onComplete({ game: p.game, score: outcome.score, maxCombo: outcome.maxCombo });
          }
        } else if (phase === "paused" && engineRef.current) {
          engineRef.current.render(ctx);
          ctx.fillStyle = "rgba(10, 10, 36, 0.78)";
          ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
          ctx.fillStyle = "#23237a";
          ctx.fillRect(SCREEN_W / 2 - 96, 74, 192, 92);
          ctx.strokeStyle = "#fde047";
          ctx.lineWidth = 2.5;
          ctx.strokeRect(SCREEN_W / 2 - 96, 74, 192, 92);
          ctx.textAlign = "center";
          ctx.fillStyle = "#fde047";
          ctx.font = "bold 14px monospace";
          ctx.fillText("PAUSED", SCREEN_W / 2, 104);
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 9px monospace";
          ctx.fillText("O / -- : RESUME", SCREEN_W / 2, 128);
          ctx.fillStyle = "#cbd5e1";
          ctx.fillText("X : EXIT TO ARCADE", SCREEN_W / 2, 146);
          ctx.textAlign = "left";
        } else if (phase === "ready") {
          renderReadyScreen(ctx, p, idleTimeRef.current);
        } else if (phase === "results" && resultRef.current) {
          renderResultsScreen(ctx, p, resultRef.current, idleTimeRef.current);
        }
      }
      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [controller]);

  const handleCanvasClick = () => {
    if (phaseRef.current === "ready" || phaseRef.current === "results") {
      startRun();
    } else if (phaseRef.current === "paused") {
      phaseRef.current = "playing";
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={SCREEN_W}
      height={SCREEN_H}
      onClick={handleCanvasClick}
      aria-label={`SNES ${game} 320 by 240 canvas`}
      className={`block w-full aspect-[4/3] bg-[#0a0a24] select-none cursor-pointer ${className}`}
      style={{ imageRendering: "auto" }}
    />
  );
}

function renderReadyScreen(
  ctx: CanvasRenderingContext2D,
  p: {
    game: SnesArcadeCanvasProps["game"];
    species: SnesArcadeCanvasProps["species"];
    stage: number;
    equippedIds: readonly string[];
    milestonePowers: SnesArcadeCanvasProps["milestonePowers"];
    bestScore: number;
  },
  t: number,
) {
  const def = MINI_GAMES_CATALOG.find((g) => g.id === p.game) ?? MINI_GAMES_CATALOG[0]!;
  const sp = SPECIES_BY_ID[p.species];

  // Rich SNES gradient backdrop
  const grad = ctx.createLinearGradient(0, 0, 0, SCREEN_H);
  grad.addColorStop(0, "#1d1a5e");
  grad.addColorStop(0.55, "#2c227a");
  grad.addColorStop(1, "#121036");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  // Twinkling background dots
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  for (let i = 0; i < 14; i++) {
    const sx = (i * 47 + 13) % SCREEN_W;
    const sy = (i * 29 + 11) % 190;
    const sz = Math.sin(t * 3 + i) > 0.3 ? 2 : 1;
    ctx.fillRect(sx, sy, sz, sz);
  }

  // Gold top title banner
  ctx.fillStyle = "#ffd23f";
  ctx.fillRect(14, 12, SCREEN_W - 28, 28);
  ctx.strokeStyle = "#0a0a24";
  ctx.lineWidth = 2.5;
  ctx.strokeRect(14, 12, SCREEN_W - 28, 28);
  ctx.textAlign = "center";
  ctx.fillStyle = "#1d1136";
  ctx.font = "bold 13px monospace";
  ctx.fillText(def.name.toUpperCase(), SCREEN_W / 2, 30);

  // Genre subtitle
  ctx.fillStyle = "#7be6d8";
  ctx.font = "bold 8.5px monospace";
  ctx.fillText(def.genre.toUpperCase(), SCREEN_W / 2, 53);

  // Bouncing hero preview
  const bob = Math.sin(t * 5) * 4;
  drawSpeciesHero(ctx, SCREEN_W / 2, 102 + bob, 22, {
    species: p.species,
    stage: p.stage,
    equippedIds: p.equippedIds,
    facing: 1,
    excited: true,
    secondWindReady: p.milestonePowers.secondWind,
    timeSec: t,
  });

  // Species Special Card
  ctx.fillStyle = "rgba(10, 10, 36, 0.72)";
  ctx.fillRect(18, 138, SCREEN_W - 36, 34);
  ctx.strokeStyle = sp.accentColor;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(18, 138, SCREEN_W - 36, 34);
  ctx.fillStyle = sp.accentColor;
  ctx.font = "bold 8.5px monospace";
  ctx.fillText(`X SPECIAL: ${sp.specialMove.name.toUpperCase()}`, SCREEN_W / 2, 151);
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "8px monospace";
  ctx.fillText(
    p.game === "runner"
      ? "D-PAD MOVE/DUCK · O JUMP · X SPECIAL"
      : p.game === "blaster"
        ? "D-PAD AIM/MOVE · O FIRE · X SPECIAL"
        : "HIT ◄ ▼ ▲ ► O ON BEAT · X SPECIAL",
    SCREEN_W / 2,
    164,
  );

  // Active Milestone Badges + Personal Best
  const badges: string[] = [];
  if (p.milestonePowers.turboCharge) badges.push("TURBO-X");
  if (p.milestonePowers.secondWind) badges.push("2ND-WIND");
  if (p.milestonePowers.memeOverdrive) badges.push("OVERDRIVE x1.5");
  ctx.fillStyle = "#fde047";
  ctx.font = "bold 8px monospace";
  const metaLine =
    badges.length > 0
      ? `POWERS: ${badges.join(" · ")}`
      : `BEST SCORE: ${p.bestScore}`;
  ctx.fillText(metaLine, SCREEN_W / 2, 187);
  if (badges.length > 0) {
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText(`BEST SCORE: ${p.bestScore}`, SCREEN_W / 2, 199);
  }

  // Blinking press O prompt
  if (Math.floor(t * 2.4) % 2 === 0) {
    ctx.fillStyle = "#7be6d8";
    ctx.font = "bold 11px monospace";
    ctx.fillText("▶ PRESS O TO START ◀", SCREEN_W / 2, 222);
  }
  ctx.textAlign = "left";
}

function renderResultsScreen(
  ctx: CanvasRenderingContext2D,
  p: {
    species: SnesArcadeCanvasProps["species"];
    stage: number;
    equippedIds: readonly string[];
    bestScore: number;
    resultBanner?: string;
  },
  res: SnesGameResult,
  t: number,
) {
  const grad = ctx.createLinearGradient(0, 0, 0, SCREEN_H);
  grad.addColorStop(0, res.cleared ? "#163557" : "#3a163d");
  grad.addColorStop(1, "#0d0d2b");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  ctx.textAlign = "center";
  ctx.fillStyle = res.cleared ? "#fde047" : "#fb7185";
  ctx.font = "bold 14px monospace";
  ctx.fillText(res.headline, SCREEN_W / 2, 30);

  drawSpeciesHero(ctx, SCREEN_W / 2, 76 + Math.sin(t * 6) * 3, 19, {
    species: p.species,
    stage: p.stage,
    equippedIds: p.equippedIds,
    excited: res.cleared,
    timeSec: t,
  });

  // Score Box
  ctx.fillStyle = "rgba(10, 10, 36, 0.8)";
  ctx.fillRect(22, 110, SCREEN_W - 44, 72);
  ctx.strokeStyle = "#7be6d8";
  ctx.lineWidth = 2;
  ctx.strokeRect(22, 110, SCREEN_W - 44, 72);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 12px monospace";
  ctx.fillText(`SCORE: ${res.score}`, SCREEN_W / 2, 130);

  ctx.fillStyle = "#fde047";
  ctx.font = "bold 9.5px monospace";
  ctx.fillText(`MAX COMBO: ×${res.maxCombo}`, SCREEN_W / 2, 148);

  if (res.score > 0 && res.score >= p.bestScore) {
    ctx.fillStyle = "#f472b6";
    ctx.fillText("★ NEW PERSONAL BEST! ★", SCREEN_W / 2, 165);
  } else {
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`BEST: ${p.bestScore}`, SCREEN_W / 2, 165);
  }

  if (p.resultBanner) {
    // Strip leading emoji/prefix for crisp 320px pixel canvas readability and wrap cleanly across up to 2 lines
    const clean = p.resultBanner
      .replace(/^[^\w+]+/, "")
      .replace(/complete!\s*Score\s*\d+:\s*/i, "")
      .trim();
    const words = clean.split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const candidate = cur ? `${cur} ${w}` : w;
      if (candidate.length <= 42) {
        cur = candidate;
      } else {
        if (cur) lines.push(cur);
        cur = w;
        if (lines.length === 1) break;
      }
    }
    if (cur && lines.length < 2) lines.push(cur);
    ctx.fillStyle = "#7be6d8";
    ctx.font = "bold 8px monospace";
    lines.forEach((ln, idx) => {
      const clipped = ln.length > 44 ? `${ln.slice(0, 43)}…` : ln;
      ctx.fillText(clipped, SCREEN_W / 2, 195 + idx * 10);
    });
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 9.5px monospace";
  ctx.fillText("O : PLAY AGAIN   ·   X : EXIT", SCREEN_W / 2, 224);
  ctx.textAlign = "left";
}
