import { SPECIES_BY_ID } from "@memeagotchi/game-core";
import { drawPixelHudBar } from "../hud.ts";
import { snesSfx } from "../sound.ts";
import { drawSpeciesHero } from "../spriteDraw.ts";
import {
  SCREEN_H,
  SCREEN_W,
  type GamepadButton,
  type SnesEngineInstance,
  type SnesGameConfig,
  type SnesGameResult,
} from "../types.ts";

const GROUND_Y = 204;
const PLAYER_R = 13;
const GRAVITY = 720;
const JUMP_VY = -285;
const DOUBLE_JUMP_VY = -245;

interface Platform {
  x: number;
  y: number;
  w: number;
}

interface RunnerEnemy {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  kind: "ground" | "flyer";
  label: string;
  color: string;
  haunted: boolean;
}

interface Pickup {
  x: number;
  y: number;
  kind: "tasty" | "drip" | "star";
  bobOffset: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  text?: string;
}

const GROUND_LABELS = ["BLECH", "RATIO", "CRINGE"];

export function createRunnerEngine(cfg: SnesGameConfig): SnesEngineInstance {
  const sp = SPECIES_BY_ID[cfg.species];
  const specialId = sp.specialMove.id;
  const durationSec = cfg.buffs.dogeSpeed ? 58 : 45;
  const specialCooldownBase = cfg.milestonePowers.turboCharge ? 5.8 : 9.0;
  const overdriveMul = cfg.milestonePowers.memeOverdrive ? 1.5 : 1.0;

  let timeSec = 0;
  let scrollX = 0;
  let px = 64;
  let py = GROUND_Y - PLAYER_R;
  let vy = 0;
  let jumpsLeft = 2;
  let onGround = true;
  let ducking = false;
  let dropThroughTimer = 0;

  let hearts = 3;
  let secondWindReady = cfg.milestonePowers.secondWind;
  let invulnTimer = 0;
  let score = 0;
  let combo = 0;
  let maxCombo = 0;

  let specialCd = 0;
  let bubbleShieldTimer = 0;
  let fireDashTimer = 0;
  let glitchBlinkTimer = 0;
  let zenSlowTimer = 0;
  let phantomPhaseTimer = 0;

  let nextEnemyIn = 1.0;
  let nextPickupIn = 0.7;
  let nextPlatformIn = 1.4;
  let enemySeq = 1;
  let susWarningY: number | null = null;
  let susWarningTimer = 0;

  const platforms: Platform[] = [
    { x: 185, y: 152, w: 68 },
    { x: 295, y: 122, w: 62 },
  ];
  const enemies: RunnerEnemy[] = [];
  const pickups: Pickup[] = [];
  const particles: Particle[] = [];

  const addScore = (base: number, x: number, y: number, label?: string) => {
    const comboMul = 1 + Math.min(1.5, combo * 0.12);
    const pts = Math.round(base * comboMul * overdriveMul);
    score += pts;
    particles.push({
      x,
      y,
      vx: 0,
      vy: -28,
      life: 0.7,
      maxLife: 0.7,
      color: "#fde047",
      text: label ?? `+${pts}`,
    });
  };

  const burst = (x: number, y: number, color: string, count = 8) => {
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const spd = 35 + Math.random() * 75;
      particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 20,
        life: 0.45 + Math.random() * 0.2,
        maxLife: 0.65,
        color,
      });
    }
  };

  const triggerSpecial = () => {
    if (specialCd > 0) return;
    specialCd = specialCooldownBase;
    snesSfx.special(cfg.soundOn);

    if (specialId === "bubble-shield") {
      bubbleShieldTimer = 6.0;
      burst(px, py, "#7be6d8", 12);
    } else if (specialId === "fire-dash") {
      fireDashTimer = 1.05;
      invulnTimer = Math.max(invulnTimer, 1.2);
      burst(px, py, "#ff7849", 14);
    } else if (specialId === "glitch-blink") {
      glitchBlinkTimer = 0.65;
      invulnTimer = Math.max(invulnTimer, 0.9);
      px = Math.min(220, px + 50);
      vy = Math.min(vy, -90);
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i]!;
        if (Math.abs(e.x - px) < 95) {
          combo += 1;
          maxCombo = Math.max(maxCombo, combo);
          addScore(30, e.x, e.y, "GLITCH!");
          burst(e.x, e.y, "#38bdf8", 10);
          enemies.splice(i, 1);
        }
      }
    } else if (specialId === "zen-slow") {
      zenSlowTimer = 4.6;
      burst(px, py, "#86efac", 12);
    } else if (specialId === "phantom-phase") {
      phantomPhaseTimer = 3.4;
      burst(px, py, "#d8b4fe", 12);
    }
  };

  const takeDamage = () => {
    if (invulnTimer > 0 || fireDashTimer > 0 || phantomPhaseTimer > 0) return false;
    if (bubbleShieldTimer > 0) {
      bubbleShieldTimer = 0;
      invulnTimer = 1.1;
      snesSfx.shieldBreak(cfg.soundOn);
      burst(px, py, "#7be6d8", 14);
      particles.push({ x: px, y: py - 14, vx: 0, vy: -24, life: 0.8, maxLife: 0.8, color: "#7be6d8", text: "BLOCKED!" });
      return false;
    }
    if (secondWindReady && hearts <= 1) {
      secondWindReady = false;
      invulnTimer = 1.8;
      snesSfx.shieldBreak(cfg.soundOn);
      burst(px, py, "#fde047", 18);
      particles.push({ x: px, y: py - 16, vx: 0, vy: -26, life: 1.0, maxLife: 1.0, color: "#fde047", text: "2ND WIND!" });
      enemies.splice(0, enemies.length);
      return false;
    }
    hearts -= 1;
    combo = 0;
    invulnTimer = 1.3;
    snesSfx.hit(cfg.soundOn);
    burst(px, py, "#fb7185", 12);
    return hearts <= 0;
  };

  return {
    onButtonPress(btn: GamepadButton) {
      if (btn === "o" || btn === "up") {
        if (jumpsLeft > 0) {
          const isDouble = !onGround;
          vy = isDouble ? DOUBLE_JUMP_VY : JUMP_VY;
          jumpsLeft -= 1;
          onGround = false;
          snesSfx.jump(cfg.soundOn, isDouble);
          burst(px, py + PLAYER_R, "#ffffff", 5);
        }
      } else if (btn === "down" && !onGround) {
        dropThroughTimer = 0.22;
        vy = Math.max(vy, 230);
      } else if (btn === "down" && onGround && py < GROUND_Y - PLAYER_R - 4) {
        dropThroughTimer = 0.22;
        onGround = false;
        vy = 60;
      } else if (btn === "x") {
        triggerSpecial();
      }
    },

    update(dt: number, pressed: Readonly<Record<GamepadButton, boolean>>): SnesGameResult | null {
      timeSec += dt;
      const slowMul = zenSlowTimer > 0 ? 0.45 : 1.0;
      const worldSpeed = (108 + Math.min(72, timeSec * 1.65)) * slowMul * (fireDashTimer > 0 ? 1.55 : 1);
      scrollX += worldSpeed * dt;

      specialCd = Math.max(0, specialCd - dt);
      invulnTimer = Math.max(0, invulnTimer - dt);
      dropThroughTimer = Math.max(0, dropThroughTimer - dt);
      bubbleShieldTimer = Math.max(0, bubbleShieldTimer - dt);
      fireDashTimer = Math.max(0, fireDashTimer - dt);
      glitchBlinkTimer = Math.max(0, glitchBlinkTimer - dt);
      zenSlowTimer = Math.max(0, zenSlowTimer - dt);
      phantomPhaseTimer = Math.max(0, phantomPhaseTimer - dt);
      susWarningTimer = Math.max(0, susWarningTimer - dt);

      // Horizontal movement across 320px runway
      const moveSpeed = cfg.buffs.dogeSpeed ? 148 : 124;
      if (pressed.left) px -= moveSpeed * dt;
      if (pressed.right) px += moveSpeed * dt;
      px = Math.max(22, Math.min(220, px));
      ducking = pressed.down && onGround;

      // Vertical physics + one-way platforms
      const prevBottom = py + PLAYER_R;
      vy += GRAVITY * dt;
      py += vy * dt;
      onGround = false;

      if (vy >= 0 && dropThroughTimer <= 0) {
        for (const p of platforms) {
          if (px + 8 > p.x && px - 8 < p.x + p.w) {
            if (prevBottom <= p.y + 4 && py + PLAYER_R >= p.y) {
              py = p.y - PLAYER_R;
              vy = 0;
              onGround = true;
              jumpsLeft = 2;
              break;
            }
          }
        }
      }

      if (py + PLAYER_R >= GROUND_Y) {
        py = GROUND_Y - PLAYER_R;
        vy = 0;
        onGround = true;
        jumpsLeft = 2;
      }

      // Platforms scroll & spawn
      for (let i = platforms.length - 1; i >= 0; i--) {
        platforms[i]!.x -= worldSpeed * dt;
        if (platforms[i]!.x + platforms[i]!.w < -20) platforms.splice(i, 1);
      }
      nextPlatformIn -= dt * slowMul;
      if (nextPlatformIn <= 0) {
        nextPlatformIn = 1.55 + Math.random() * 1.1;
        const tiers = [154, 124, 98];
        const y = tiers[Math.floor(Math.random() * tiers.length)]!;
        const w = 54 + Math.floor(Math.random() * 34);
        platforms.push({ x: SCREEN_W + 12, y, w });
        if (Math.random() < 0.72) {
          pickups.push({
            x: SCREEN_W + 12 + w / 2,
            y: y - 16,
            kind: Math.random() < 0.35 ? "drip" : "tasty",
            bobOffset: Math.random() * 6,
          });
        }
      }

      // Spawn pickups
      nextPickupIn -= dt * slowMul;
      if (nextPickupIn <= 0) {
        nextPickupIn = 0.85 + Math.random() * 0.9;
        const roll = Math.random();
        pickups.push({
          x: SCREEN_W + 14,
          y: roll < 0.45 ? GROUND_Y - 18 : roll < 0.8 ? 142 : 102,
          kind: roll < 0.15 ? "star" : roll < 0.45 ? "drip" : "tasty",
          bobOffset: Math.random() * Math.PI * 2,
        });
      }

      // Spawn enemies
      nextEnemyIn -= dt * slowMul;
      if (nextEnemyIn <= 0) {
        const pace = Math.max(0.68, 1.55 - timeSec * 0.017);
        nextEnemyIn = pace + Math.random() * 0.55;
        const flyer = Math.random() < 0.36;
        const y = flyer ? (Math.random() < 0.5 ? 168 : 132) : GROUND_Y - 11;
        if (cfg.buffs.susSense) {
          susWarningY = y;
          susWarningTimer = 0.55;
        }
        enemies.push({
          id: enemySeq++,
          x: SCREEN_W + 24,
          y,
          w: flyer ? 26 : 30,
          h: flyer ? 16 : 20,
          vx: flyer ? worldSpeed * 1.24 : worldSpeed * 1.05,
          kind: flyer ? "flyer" : "ground",
          label: flyer ? "MID" : GROUND_LABELS[Math.floor(Math.random() * GROUND_LABELS.length)]!,
          color: flyer ? "#a855f7" : "#ef4444",
          haunted: false,
        });
      }

      // Update pickups
      const hitH = ducking ? PLAYER_R * 0.65 : PLAYER_R;
      for (let i = pickups.length - 1; i >= 0; i--) {
        const pk = pickups[i]!;
        pk.x -= worldSpeed * dt;
        // Zen Slow gently magnetizes nearby pickups!
        if (zenSlowTimer > 0) {
          const dx = px - pk.x;
          const dy = py - pk.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 75 && dist > 1) {
            pk.x += (dx / dist) * 115 * dt;
            pk.y += (dy / dist) * 115 * dt;
          }
        }
        if (Math.hypot(pk.x - px, pk.y - py) < PLAYER_R + 8) {
          combo += 1;
          maxCombo = Math.max(maxCombo, combo);
          const pts = pk.kind === "star" ? 35 : pk.kind === "drip" ? 22 : 14;
          addScore(pts, pk.x, pk.y);
          snesSfx.pickup(cfg.soundOn, combo);
          burst(pk.x, pk.y, pk.kind === "drip" ? "#fde047" : "#7be6d8", 6);
          pickups.splice(i, 1);
          continue;
        }
        if (pk.x < -16) pickups.splice(i, 1);
      }

      // Update enemies + collisions
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i]!;
        e.x -= (e.vx * slowMul) * dt;
        if (e.x < -40) {
          enemies.splice(i, 1);
          continue;
        }
        const overlapX = Math.abs(e.x - px) < e.w / 2 + PLAYER_R - 4;
        const overlapY = Math.abs(e.y - (py + (ducking ? 4 : 0))) < e.h / 2 + hitH - 3;

        if (overlapX && overlapY) {
          if (fireDashTimer > 0) {
            combo += 1;
            maxCombo = Math.max(maxCombo, combo);
            addScore(25, e.x, e.y, "ROAST!");
            snesSfx.stomp(cfg.soundOn);
            burst(e.x, e.y, "#ff7849", 10);
            enemies.splice(i, 1);
            continue;
          }
          if (phantomPhaseTimer > 0) {
            if (!e.haunted) {
              e.haunted = true;
              combo += 1;
              maxCombo = Math.max(maxCombo, combo);
              addScore(25, e.x, e.y, "BOO!");
              snesSfx.pickup(cfg.soundOn, combo);
              burst(e.x, e.y, "#d8b4fe", 8);
            }
            continue;
          }
          // Mario-style stomp from above!
          if (vy > 30 && py + PLAYER_R - 8 < e.y) {
            vy = -225;
            jumpsLeft = Math.max(jumpsLeft, 1);
            combo += 1;
            maxCombo = Math.max(maxCombo, combo);
            addScore(24, e.x, e.y, "STOMP!");
            snesSfx.stomp(cfg.soundOn);
            burst(e.x, e.y, "#fde047", 10);
            enemies.splice(i, 1);
            continue;
          }
          const dead = takeDamage();
          enemies.splice(i, 1);
          if (dead) {
            return { score, maxCombo, cleared: false, headline: "KNOCKED OUT!" };
          }
        }
      }

      // Passive distance points
      if (Math.floor((timeSec - dt) * 2) !== Math.floor(timeSec * 2)) {
        score += Math.round(2 * overdriveMul);
      }

      // Update particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i]!;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.life -= dt;
        if (pt.life <= 0) particles.splice(i, 1);
      }

      if (timeSec >= durationSec) {
        const clearBonus = Math.round(100 * overdriveMul);
        score += clearBonus;
        return { score, maxCombo, cleared: true, headline: "STAGE CLEAR! +100" };
      }
      return null;
    },

    render(ctx: CanvasRenderingContext2D) {
      // Sky gradient (SNES 16-bit sunset-day)
      const sky = ctx.createLinearGradient(0, 24, 0, GROUND_Y);
      sky.addColorStop(0, zenSlowTimer > 0 ? "#123042" : "#3a8df0");
      sky.addColorStop(0.55, zenSlowTimer > 0 ? "#205966" : "#8fd5ff");
      sky.addColorStop(1, "#e8fbff");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

      // Parallax clouds
      ctx.fillStyle = "rgba(255,255,255,0.82)";
      for (let i = 0; i < 4; i++) {
        const cx = (((i * 88) - scrollX * 0.18) % (SCREEN_W + 64) + SCREEN_W + 64) % (SCREEN_W + 64) - 32;
        const cy = 44 + (i % 2) * 22;
        ctx.fillRect(cx, cy, 34, 9);
        ctx.fillRect(cx + 8, cy - 6, 18, 7);
      }

      // Parallax pixel hills
      ctx.fillStyle = "#5cb870";
      for (let i = 0; i < 4; i++) {
        const hx = (((i * 96) - scrollX * 0.35) % (SCREEN_W + 96) + SCREEN_W + 96) % (SCREEN_W + 96) - 48;
        ctx.beginPath();
        ctx.arc(hx + 40, GROUND_Y + 6, 44, Math.PI, 0);
        ctx.fill();
      }

      // Ground checkerboard SNES tile strip
      ctx.fillStyle = "#2d8a3e";
      ctx.fillRect(0, GROUND_Y, SCREEN_W, SCREEN_H - GROUND_Y);
      ctx.fillStyle = "#62d96b";
      ctx.fillRect(0, GROUND_Y, SCREEN_W, 5);
      const tileOff = Math.floor(scrollX) % 16;
      ctx.fillStyle = "#246e32";
      for (let gx = -tileOff; gx < SCREEN_W; gx += 16) {
        ctx.fillRect(gx, GROUND_Y + 6, 8, 12);
        ctx.fillRect(gx + 8, GROUND_Y + 18, 8, 14);
      }
      ctx.fillStyle = "#141026";
      ctx.fillRect(0, GROUND_Y, SCREEN_W, 2);

      // Floating meme platforms
      for (const p of platforms) {
        ctx.fillStyle = "#ffe066";
        ctx.fillRect(p.x, p.y, p.w, 9);
        ctx.fillStyle = "#ff9f1c";
        ctx.fillRect(p.x, p.y + 6, p.w, 3);
        ctx.strokeStyle = "#141026";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(p.x, p.y, p.w, 9);
      }

      // Pickups
      for (const pk of pickups) {
        const by = pk.y + Math.sin(timeSec * 6 + pk.bobOffset) * 2.5;
        if (pk.kind === "tasty") {
          ctx.fillStyle = "#34d399";
          ctx.beginPath();
          ctx.arc(pk.x, by, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#064e3b";
          ctx.lineWidth = 1.4;
          ctx.stroke();
        } else if (pk.kind === "drip") {
          ctx.fillStyle = "#fde047";
          ctx.beginPath();
          ctx.arc(pk.x, by, 6.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#78350f";
          ctx.lineWidth = 1.4;
          ctx.stroke();
          ctx.fillStyle = "#fffbeb";
          ctx.fillRect(pk.x - 1.5, by - 3, 3, 6);
        } else {
          ctx.fillStyle = "#f472b6";
          ctx.beginPath();
          ctx.arc(pk.x, by, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(pk.x - 2, by - 2, 4, 4);
        }
      }

      // Enemies
      for (const e of enemies) {
        ctx.save();
        ctx.translate(e.x, e.y);
        if (e.haunted) ctx.globalAlpha = 0.45;
        ctx.fillStyle = e.color;
        ctx.fillRect(-e.w / 2, -e.h / 2, e.w, e.h);
        ctx.strokeStyle = "#141026";
        ctx.lineWidth = 1.8;
        ctx.strokeRect(-e.w / 2, -e.h / 2, e.w, e.h);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 7.5px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(e.label, 0, 1);
        ctx.restore();
      }

      // Sus Sense right-edge warning
      if (cfg.buffs.susSense && susWarningTimer > 0 && susWarningY !== null) {
        ctx.fillStyle = "#fde047";
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "right";
        ctx.fillText("<!>", SCREEN_W - 4, susWarningY);
        ctx.textAlign = "left";
      }

      // Hero
      drawSpeciesHero(ctx, px, py + (ducking ? 4 : 0), PLAYER_R, {
        species: cfg.species,
        stage: cfg.stage,
        equippedIds: cfg.equippedIds,
        facing: 1,
        ducking,
        excited: combo >= 5,
        hurtFlash: invulnTimer > 0,
        bubbleShield: bubbleShieldTimer > 0,
        fireDash: fireDashTimer > 0,
        glitchBlink: glitchBlinkTimer > 0,
        zenSlow: zenSlowTimer > 0,
        phantomPhase: phantomPhaseTimer > 0,
        secondWindReady,
        timeSec,
      });

      // Particles & floating combat text
      for (const pt of particles) {
        const a = Math.max(0, pt.life / pt.maxLife);
        ctx.globalAlpha = a;
        if (pt.text) {
          ctx.font = "bold 8.5px monospace";
          ctx.textAlign = "center";
          ctx.fillStyle = "#0a0a24";
          ctx.fillText(pt.text, pt.x + 1, pt.y + 1);
          ctx.fillStyle = pt.color;
          ctx.fillText(pt.text, pt.x, pt.y);
          ctx.textAlign = "left";
        } else {
          ctx.fillStyle = pt.color;
          ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
        }
      }
      ctx.globalAlpha = 1;

      // HUD
      drawPixelHudBar(ctx, {
        hearts,
        maxHearts: 3,
        score,
        combo,
        timeLeftSec: durationSec - timeSec,
        species: cfg.species,
        specialReadyPct: 1 - specialCd / specialCooldownBase,
        specialActive:
          bubbleShieldTimer > 0 ||
          fireDashTimer > 0 ||
          glitchBlinkTimer > 0 ||
          zenSlowTimer > 0 ||
          phantomPhaseTimer > 0,
        secondWindReady,
        milestonePowers: cfg.milestonePowers,
        extraTag: "RUNNER DX",
      });
    },
  };
}
