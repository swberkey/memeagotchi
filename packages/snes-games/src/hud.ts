import { SPECIES_BY_ID, type MilestonePowers, type SpeciesId } from "@memeagotchi/game-core";
import { SCREEN_W } from "./types.ts";

export function drawPixelHudBar(
  ctx: CanvasRenderingContext2D,
  opts: {
    hearts: number;
    maxHearts: number;
    score: number;
    combo: number;
    timeLeftSec: number;
    species: SpeciesId;
    specialReadyPct: number; // 0..1
    specialActive: boolean;
    secondWindReady: boolean;
    milestonePowers: MilestonePowers;
    extraTag?: string;
  },
) {
  const sp = SPECIES_BY_ID[opts.species];

  // Top translucent SNES bar
  ctx.fillStyle = "rgba(12, 11, 36, 0.88)";
  ctx.fillRect(0, 0, SCREEN_W, 24);
  ctx.fillStyle = "#5b4bb7";
  ctx.fillRect(0, 23, SCREEN_W, 1.5);

  // Hearts
  for (let i = 0; i < opts.maxHearts; i++) {
    const hx = 6 + i * 11;
    const filled = i < opts.hearts;
    ctx.fillStyle = filled ? "#fb7185" : "rgba(255,255,255,0.18)";
    ctx.fillRect(hx + 1, 5, 3, 3);
    ctx.fillRect(hx + 5, 5, 3, 3);
    ctx.fillRect(hx, 7, 9, 4);
    ctx.fillRect(hx + 2, 11, 5, 2);
    ctx.fillRect(hx + 4, 13, 1, 1);
  }

  // Second Wind mini shield next to hearts
  if (opts.secondWindReady) {
    const sx = 6 + opts.maxHearts * 11 + 2;
    ctx.fillStyle = "#fde047";
    ctx.fillRect(sx, 5, 7, 7);
    ctx.fillStyle = "#0a0a24";
    ctx.fillRect(sx + 2, 7, 3, 3);
  }

  // Score + Combo center-left
  ctx.font = "bold 9px monospace";
  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`SCR ${opts.score}`, 118, 4);
  if (opts.combo >= 2) {
    ctx.fillStyle = "#fde047";
    ctx.fillText(`×${opts.combo} COMBO`, 118, 13);
  } else if (opts.milestonePowers.memeOverdrive) {
    ctx.fillStyle = "#f472b6";
    ctx.fillText("OVERDRIVE ×1.5", 118, 13);
  } else if (opts.extraTag) {
    ctx.fillStyle = "#7be6d8";
    ctx.fillText(opts.extraTag, 118, 13);
  }

  // Special X meter (right side)
  const barX = 178;
  const barW = 54;
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fillRect(barX, 13, barW, 6);
  ctx.fillStyle = opts.specialActive
    ? "#fde047"
    : opts.specialReadyPct >= 1
      ? sp.accentColor
      : "#7c5fd4";
  ctx.fillRect(barX, 13, Math.round(barW * Math.min(1, Math.max(0, opts.specialReadyPct))), 6);
  ctx.strokeStyle = "#0a0a24";
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, 13, barW, 6);

  ctx.textAlign = "left";
  ctx.fillStyle = opts.specialReadyPct >= 1 ? "#fde047" : "#cbd5e1";
  ctx.font = "bold 7.5px monospace";
  ctx.fillText(opts.specialActive ? "X ACTIVE!" : opts.specialReadyPct >= 1 ? "X READY!" : "X CHG", barX, 4);

  // Timer far right
  ctx.textAlign = "right";
  ctx.font = "bold 10px monospace";
  ctx.fillStyle = opts.timeLeftSec <= 8 ? "#fb7185" : "#7be6d8";
  ctx.fillText(`${Math.max(0, Math.ceil(opts.timeLeftSec))}s`, SCREEN_W - 6, 7);
  ctx.textAlign = "left";
}
