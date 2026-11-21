import type { SpeciesId } from "@memeagotchi/game-core";

const INK = "#1b1d36";

interface SpriteColors {
  body: string;
  shade: string;
  belly: string;
  accent: string;
  cheek: string;
}

const COLORS: Record<SpeciesId, SpriteColors> = {
  "mint-dragon": { body: "#82e8dc", shade: "#b7b0ef", belly: "#d8cefb", accent: "#b498f0", cheek: "#f9a8d4" },
  "spicy-imp": { body: "#ff7246", shade: "#e03e36", belly: "#fef08a", accent: "#fde047", cheek: "#fb7185" },
  "cyber-cat": { body: "#62dcff", shade: "#9f94f7", belly: "#d8c7ff", accent: "#e879f9", cheek: "#f472b6" },
  "cozy-frog": { body: "#94c98b", shade: "#6ea86d", belly: "#f3f5d0", accent: "#4ade80", cheek: "#fca5a5" },
  "cursed-ghost": { body: "#f0eaff", shade: "#b8a4ea", belly: "#ffffff", accent: "#5eead4", cheek: "#f0abfc" },
};

export interface HeroRenderOptions {
  species: SpeciesId;
  stage: number;
  equippedIds: readonly string[];
  facing?: 1 | -1;
  ducking?: boolean;
  excited?: boolean;
  hurtFlash?: boolean;
  bubbleShield?: boolean;
  fireDash?: boolean;
  glitchBlink?: boolean;
  zenSlow?: boolean;
  phantomPhase?: boolean;
  secondWindReady?: boolean;
  timeSec: number;
}

export function drawSpeciesHero(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  opts: HeroRenderOptions,
) {
  const c = COLORS[opts.species];
  const facing = opts.facing ?? 1;
  const equipped = new Set(opts.equippedIds);
  const pulse = Math.sin(opts.timeSec * 8) * 0.05;

  ctx.save();
  ctx.translate(x, y);

  if (opts.hurtFlash && Math.floor(opts.timeSec * 20) % 2 === 0) {
    ctx.globalAlpha = 0.45;
  } else if (opts.phantomPhase) {
    ctx.globalAlpha = 0.58;
  }

  // Stage 5 Eldritch Halo
  if (opts.stage >= 5) {
    ctx.save();
    ctx.strokeStyle = "#f472b6";
    ctx.lineWidth = 1.6;
    ctx.setLineDash([4, 3]);
    ctx.rotate(opts.timeSec * 1.4);
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Second Wind golden ring indicator
  if (opts.secondWindReady) {
    ctx.save();
    ctx.strokeStyle = "rgba(253,224,71,0.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Special move active VFX behind
  if (opts.fireDash) {
    ctx.fillStyle = "rgba(255, 115, 29, 0.78)";
    ctx.beginPath();
    ctx.ellipse(-facing * r * 0.7, 0, r * 1.3, r * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fde047";
    ctx.beginPath();
    ctx.ellipse(-facing * r * 0.5, 0, r * 0.85, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (opts.glitchBlink) {
    ctx.fillStyle = "rgba(56, 189, 248, 0.45)";
    ctx.beginPath();
    ctx.arc(-6 * facing, -1, r * 0.92, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(232, 121, 249, 0.45)";
    ctx.beginPath();
    ctx.arc(4 * facing, 1, r * 0.92, 0, Math.PI * 2);
    ctx.fill();
  }
  if (opts.zenSlow) {
    ctx.strokeStyle = "#86efac";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r * (1.35 + pulse), 0, Math.PI * 2);
    ctx.stroke();
  }

  // Cape cosmetic behind body
  if (equipped.has("cape")) {
    ctx.fillStyle = "#ef4444";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-facing * r * 0.3, -r * 0.2);
    ctx.lineTo(-facing * r * 1.35, r * 0.78);
    ctx.lineTo(facing * r * 0.2, r * 0.65);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  const scaleX = opts.ducking ? 1.18 : 1;
  const scaleY = opts.ducking ? 0.72 : 1;
  ctx.scale(scaleX, scaleY);

  // Species wings / horns / ears behind body
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;

  if (opts.species === "mint-dragon") {
    if (opts.stage >= 3) {
      // Lavender bat wings
      ctx.fillStyle = c.accent;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * r * 0.8, 0);
        ctx.lineTo(side * r * 1.45, -r * 0.45);
        ctx.lineTo(side * r * 1.35, r * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
    if (opts.stage === 1) {
      // Antennae
      ctx.fillStyle = c.body;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(side * r * 0.28, -r * 1.15, r * 0.16, r * 0.28, side * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    } else {
      // Horns
      ctx.fillStyle = c.accent;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * r * 0.32, -r * 0.85);
        ctx.lineTo(side * r * 0.68, -r * 1.38);
        ctx.lineTo(side * r * 0.7, -r * 0.62);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
  } else if (opts.species === "spicy-imp") {
    // Flame crest + curved crimson horns
    ctx.fillStyle = "#dc2626";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * r * 0.25, -r * 0.8);
      ctx.lineTo(side * r * 0.72, -r * 1.45);
      ctx.lineTo(side * r * 0.72, -r * 0.58);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = "#fde047";
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.48);
    ctx.lineTo(r * 0.26, -r * 0.84);
    ctx.lineTo(-r * 0.26, -r * 0.84);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (opts.species === "cyber-cat") {
    // Pointed cat ears with neon inner triangles
    for (const side of [-1, 1]) {
      ctx.fillStyle = c.body;
      ctx.beginPath();
      ctx.moveTo(side * r * 0.25, -r * 0.78);
      ctx.lineTo(side * r * 0.78, -r * 1.45);
      ctx.lineTo(side * r * 0.86, -r * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#e879f9";
      ctx.beginPath();
      ctx.moveTo(side * r * 0.4, -r * 0.78);
      ctx.lineTo(side * r * 0.7, -r * 1.2);
      ctx.lineTo(side * r * 0.74, -r * 0.62);
      ctx.closePath();
      ctx.fill();
    }
  } else if (opts.species === "cozy-frog") {
    // Big round frog eye domes + sprout leaf
    ctx.fillStyle = c.body;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * r * 0.48, -r * 0.8, r * 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = "#4ade80";
    ctx.beginPath();
    ctx.ellipse(r * 0.24, -r * 1.24, r * 0.34, r * 0.16, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (opts.species === "cursed-ghost") {
    // Floating teal wisps
    ctx.fillStyle = "#5eead4";
    const bob = Math.sin(opts.timeSec * 6) * 2;
    ctx.beginPath();
    ctx.arc(-r * 1.15, -r * 0.3 + bob, r * 0.22, 0, Math.PI * 2);
    ctx.arc(r * 1.15, -r * 0.15 - bob, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }

  // Main gummy body
  const grad = ctx.createLinearGradient(0, -r, 0, r);
  grad.addColorStop(0, c.body);
  grad.addColorStop(1, c.shade);
  ctx.fillStyle = grad;
  ctx.beginPath();
  if (opts.species === "cursed-ghost") {
    ctx.arc(0, -r * 0.1, r * 0.95, Math.PI, 0);
    ctx.lineTo(r * 0.95, r * 0.85);
    ctx.lineTo(r * 0.45, r * 0.62);
    ctx.lineTo(0, r * 0.9);
    ctx.lineTo(-r * 0.45, r * 0.62);
    ctx.lineTo(-r * 0.95, r * 0.85);
    ctx.closePath();
  } else {
    ctx.ellipse(0, 0, r, r * 0.94, 0, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.stroke();

  // Belly patch
  ctx.fillStyle = c.belly;
  ctx.globalAlpha *= 0.72;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.42, r * 0.56, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = opts.phantomPhase ? 0.58 : 1;

  // Wizard robe body overlay
  if (equipped.has("wizard-robe")) {
    ctx.fillStyle = "#7c5fd4";
    ctx.beginPath();
    ctx.arc(0, r * 0.45, r * 0.72, 0, Math.PI);
    ctx.fill();
    ctx.stroke();
  }

  // Gloss shine
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.4, -r * 0.42, r * 0.22, r * 0.11, -0.5, 0, Math.PI * 2);
  ctx.fill();

  // Face (shifted subtly toward facing direction)
  const fx = facing * r * 0.12;
  const eyeY = -r * 0.12;
  const eyeDX = r * 0.34;

  // Cheeks
  ctx.fillStyle = c.cheek;
  ctx.beginPath();
  ctx.ellipse(fx - eyeDX - r * 0.14, eyeY + r * 0.22, r * 0.15, r * 0.09, 0, 0, Math.PI * 2);
  ctx.ellipse(fx + eyeDX + r * 0.14, eyeY + r * 0.22, r * 0.15, r * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes (or shades!)
  if (equipped.has("shades")) {
    ctx.fillStyle = "#141628";
    ctx.fillRect(fx - r * 0.68, eyeY - r * 0.2, r * 1.36, r * 0.32);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(fx - r * 0.52, eyeY - r * 0.12, r * 0.18, r * 0.12);
    ctx.fillRect(fx + r * 0.2, eyeY - r * 0.12, r * 0.18, r * 0.12);
  } else {
    for (const side of [-1, 1]) {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(fx + side * eyeDX, eyeY, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = opts.excited ? "#fde047" : "#ffffff";
      ctx.beginPath();
      ctx.arc(fx + side * eyeDX - r * 0.05, eyeY - r * 0.06, r * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }
    if (equipped.has("star-glasses")) {
      ctx.strokeStyle = "#fde047";
      ctx.lineWidth = 1.6;
      ctx.strokeRect(fx - eyeDX - r * 0.2, eyeY - r * 0.18, r * 0.4, r * 0.36);
      ctx.strokeRect(fx + eyeDX - r * 0.2, eyeY - r * 0.18, r * 0.4, r * 0.36);
    }
  }

  // Happy mouth
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(fx, eyeY + r * 0.22, r * 0.16, 0.15, Math.PI - 0.15);
  ctx.stroke();

  // Head cosmetics
  if (equipped.has("crown")) {
    ctx.fillStyle = "#fde047";
    ctx.beginPath();
    ctx.moveTo(-r * 0.42, -r * 0.85);
    ctx.lineTo(-r * 0.48, -r * 1.38);
    ctx.lineTo(-r * 0.14, -r * 1.08);
    ctx.lineTo(0, -r * 1.48);
    ctx.lineTo(r * 0.14, -r * 1.08);
    ctx.lineTo(r * 0.48, -r * 1.38);
    ctx.lineTo(r * 0.42, -r * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (equipped.has("chef-hat")) {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(-r * 0.32, -r * 1.15, r * 0.32, 0, Math.PI * 2);
    ctx.arc(0, -r * 1.3, r * 0.36, 0, Math.PI * 2);
    ctx.arc(r * 0.32, -r * 1.15, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(-r * 0.45, -r * 1.02, r * 0.9, r * 0.26);
    ctx.strokeRect(-r * 0.45, -r * 1.02, r * 0.9, r * 0.26);
  } else if (equipped.has("party-hat")) {
    ctx.fillStyle = "#f472b6";
    ctx.beginPath();
    ctx.moveTo(-r * 0.42, -r * 0.84);
    ctx.lineTo(0, -r * 1.62);
    ctx.lineTo(r * 0.42, -r * 0.84);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fde047";
    ctx.beginPath();
    ctx.arc(0, -r * 1.66, r * 0.15, 0, Math.PI * 2);
    ctx.fill();
  } else if (equipped.has("wizard-hat")) {
    ctx.fillStyle = "#7c5fd4";
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.85, r * 0.72, r * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.42, -r * 0.88);
    ctx.lineTo(r * 0.08, -r * 1.65);
    ctx.lineTo(r * 0.42, -r * 0.88);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (equipped.has("cap-red")) {
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(0, -r * 0.78, r * 0.56, Math.PI, 0);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(-facing * r * 0.82, -r * 0.86, r * 0.48, r * 0.18);
  }

  // Bubble shield overlay in front
  if (opts.bubbleShield) {
    ctx.strokeStyle = "#7be6d8";
    ctx.fillStyle = "rgba(123, 230, 216, 0.22)";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.beginPath();
    ctx.arc(-r * 0.5, -r * 0.55, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
