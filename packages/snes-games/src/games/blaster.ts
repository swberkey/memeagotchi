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

const ARENA_TOP = 30;
const ARENA_BOTTOM = SCREEN_H - 10;
const ARENA_LEFT = 10;
const ARENA_RIGHT = SCREEN_W - 10;
const PLAYER_R = 11;

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fromEnemy: boolean;
  color: string;
  r: number;
}

interface ArenaEnemy {
  id: number;
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  speed: number;
  kind: "troll" | "shooter" | "boss";
  label: string;
  color: string;
  fireTimer: number;
  hauntCooldown: number;
}

interface SpawnTelegraph {
  x: number;
  y: number;
  timer: number;
  kind: "troll" | "shooter" | "boss";
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

export function createBlasterEngine(cfg: SnesGameConfig): SnesEngineInstance {
  const sp = SPECIES_BY_ID[cfg.species];
  const specialId = sp.specialMove.id;
  const durationSec = cfg.buffs.dogeSpeed ? 58 : 45;
  const specialCooldownBase = cfg.milestonePowers.turboCharge ? 5.8 : 9.0;
  const overdriveMul = cfg.milestonePowers.memeOverdrive ? 1.5 : 1.0;

  let timeSec = 0;
  let px = SCREEN_W / 2;
  let py = (ARENA_TOP + ARENA_BOTTOM) / 2;
  let aimX = 1;
  let aimY = 0;
  let fireCd = 0;

  let hearts = 3;
  let secondWindReady = cfg.milestonePowers.secondWind;
  let invulnTimer = 0;
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let wave = 1;
  let nextWaveAt = 12;

  let specialCd = 0;
  let bubbleShieldTimer = 0;
  let fireDashTimer = 0;
  let glitchBlinkTimer = 0;
  let zenSlowTimer = 0;
  let phantomPhaseTimer = 0;

  let spawnTimer = 0.6;
  let enemySeq = 1;

  const bullets: Bullet[] = [];
  const enemies: ArenaEnemy[] = [];
  const telegraphs: SpawnTelegraph[] = [];
  const particles: Particle[] = [];

  const addScore = (base: number, x: number, y: number, text?: string) => {
    const comboMul = 1 + Math.min(1.5, combo * 0.1);
    const pts = Math.round(base * comboMul * overdriveMul);
    score += pts;
    particles.push({
      x,
      y,
      vx: 0,
      vy: -24,
      life: 0.65,
      maxLife: 0.65,
      color: "#fde047",
      text: text ?? `+${pts}`,
    });
  };

  const burst = (x: number, y: number, color: string, count = 9) => {
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const spd = 30 + Math.random() * 75;
      particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.4 + Math.random() * 0.25,
        maxLife: 0.65,
        color,
      });
    }
  };

  const spawnEnemyAt = (x: number, y: number, kind: "troll" | "shooter" | "boss") => {
    if (kind === "boss") {
      enemies.push({
        id: enemySeq++,
        x,
        y,
        r: 17,
        hp: 10 + wave * 2,
        maxHp: 10 + wave * 2,
        speed: 32,
        kind: "boss",
        label: "BOSS",
        color: "#f43f5e",
        fireTimer: 1.4,
        hauntCooldown: 0,
      });
    } else if (kind === "shooter") {
      enemies.push({
        id: enemySeq++,
        x,
        y,
        r: 10,
        hp: 2,
        maxHp: 2,
        speed: 34,
        kind: "shooter",
        label: "SPICY",
        color: "#f97316",
        fireTimer: 1.5,
        hauntCooldown: 0,
      });
    } else {
      enemies.push({
        id: enemySeq++,
        x,
        y,
        r: 10,
        hp: 1,
        maxHp: 1,
        speed: 48 + Math.min(28, wave * 5),
        kind: "troll",
        label: Math.random() < 0.5 ? "TROLL" : "RATIO",
        color: "#a855f7",
        fireTimer: 99,
        hauntCooldown: 0,
      });
    }
  };

  const queueSpawn = (kind: "troll" | "shooter" | "boss") => {
    const edge = Math.floor(Math.random() * 4);
    let sx = ARENA_LEFT + 14;
    let sy = ARENA_TOP + 14;
    if (edge === 0) {
      sx = ARENA_LEFT + 16 + Math.random() * (ARENA_RIGHT - ARENA_LEFT - 32);
      sy = ARENA_TOP + 14;
    } else if (edge === 1) {
      sx = ARENA_LEFT + 16 + Math.random() * (ARENA_RIGHT - ARENA_LEFT - 32);
      sy = ARENA_BOTTOM - 14;
    } else if (edge === 2) {
      sx = ARENA_LEFT + 14;
      sy = ARENA_TOP + 16 + Math.random() * (ARENA_BOTTOM - ARENA_TOP - 32);
    } else {
      sx = ARENA_RIGHT - 14;
      sy = ARENA_TOP + 16 + Math.random() * (ARENA_BOTTOM - ARENA_TOP - 32);
    }
    if (cfg.buffs.susSense || kind === "boss") {
      telegraphs.push({ x: sx, y: sy, timer: 0.75, kind });
    } else {
      spawnEnemyAt(sx, sy, kind);
    }
  };

  const firePlayerOrb = () => {
    const spd = 230;
    bullets.push({
      x: px + aimX * (PLAYER_R + 3),
      y: py + aimY * (PLAYER_R + 3),
      vx: aimX * spd,
      vy: aimY * spd,
      fromEnemy: false,
      color: sp.accentColor,
      r: 3.8,
    });
    snesSfx.shoot(cfg.soundOn);
  };

  const triggerSpecial = () => {
    if (specialCd > 0) return;
    specialCd = specialCooldownBase;
    snesSfx.special(cfg.soundOn);

    if (specialId === "bubble-shield") {
      bubbleShieldTimer = 6.0;
      burst(px, py, "#7be6d8", 14);
      // Knockback ring
      for (const e of enemies) {
        const dx = e.x - px;
        const dy = e.y - py;
        const d = Math.max(1, Math.hypot(dx, dy));
        if (d < 85) {
          e.x = Math.max(ARENA_LEFT + e.r, Math.min(ARENA_RIGHT - e.r, e.x + (dx / d) * 44));
          e.y = Math.max(ARENA_TOP + e.r, Math.min(ARENA_BOTTOM - e.r, e.y + (dy / d) * 44));
        }
      }
    } else if (specialId === "fire-dash") {
      fireDashTimer = 1.0;
      invulnTimer = Math.max(invulnTimer, 1.15);
      // Ring of fireballs
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 * i) / 8;
        bullets.push({ x: px, y: py, vx: Math.cos(a) * 195, vy: Math.sin(a) * 195, fromEnemy: false, color: "#ff7849", r: 5 });
      }
      burst(px, py, "#ff7849", 14);
    } else if (specialId === "glitch-blink") {
      glitchBlinkTimer = 0.65;
      invulnTimer = Math.max(invulnTimer, 0.9);
      px = Math.max(ARENA_LEFT + 16, Math.min(ARENA_RIGHT - 16, px + aimX * 52));
      py = Math.max(ARENA_TOP + 16, Math.min(ARENA_BOTTOM - 16, py + aimY * 52));
      for (let i = 0; i < 12; i++) {
        const a = (Math.PI * 2 * i) / 12;
        bullets.push({ x: px, y: py, vx: Math.cos(a) * 215, vy: Math.sin(a) * 215, fromEnemy: false, color: "#38bdf8", r: 4.2 });
      }
      burst(px, py, "#e879f9", 14);
    } else if (specialId === "zen-slow") {
      zenSlowTimer = 4.6;
      burst(px, py, "#86efac", 14);
    } else if (specialId === "phantom-phase") {
      phantomPhaseTimer = 3.4;
      burst(px, py, "#d8b4fe", 14);
    }
  };

  const takeDamage = () => {
    if (invulnTimer > 0 || fireDashTimer > 0 || phantomPhaseTimer > 0) return false;
    if (bubbleShieldTimer > 0) {
      bubbleShieldTimer = 0;
      invulnTimer = 1.1;
      snesSfx.shieldBreak(cfg.soundOn);
      burst(px, py, "#7be6d8", 14);
      particles.push({ x: px, y: py - 14, vx: 0, vy: -20, life: 0.8, maxLife: 0.8, color: "#7be6d8", text: "BLOCKED!" });
      return false;
    }
    if (secondWindReady && hearts <= 1) {
      secondWindReady = false;
      invulnTimer = 1.8;
      snesSfx.shieldBreak(cfg.soundOn);
      burst(px, py, "#fde047", 18);
      particles.push({ x: px, y: py - 14, vx: 0, vy: -24, life: 1.0, maxLife: 1.0, color: "#fde047", text: "2ND WIND!" });
      for (let i = bullets.length - 1; i >= 0; i--) {
        if (bullets[i]!.fromEnemy) bullets.splice(i, 1);
      }
      return false;
    }
    hearts -= 1;
    combo = 0;
    invulnTimer = 1.25;
    snesSfx.hit(cfg.soundOn);
    burst(px, py, "#fb7185", 12);
    return hearts <= 0;
  };

  const damageEnemy = (idx: number, dmg: number, tag?: string) => {
    const e = enemies[idx]!;
    e.hp -= dmg;
    burst(e.x, e.y, e.color, 5);
    if (e.hp <= 0) {
      combo += 1;
      maxCombo = Math.max(maxCombo, combo);
      const pts = e.kind === "boss" ? 150 : e.kind === "shooter" ? 32 : 20;
      addScore(pts, e.x, e.y, tag ?? (e.kind === "boss" ? "BOSS KO!" : undefined));
      if (e.kind === "boss" && hearts < 3) hearts += 1;
      snesSfx.stomp(cfg.soundOn);
      burst(e.x, e.y, "#fde047", e.kind === "boss" ? 20 : 10);
      enemies.splice(idx, 1);
    } else {
      snesSfx.pickup(cfg.soundOn, 1);
    }
  };

  return {
    onButtonPress(btn: GamepadButton) {
      if (btn === "o" && fireCd <= 0) {
        firePlayerOrb();
        fireCd = cfg.buffs.dogeSpeed ? 0.14 : 0.19;
      } else if (btn === "x") {
        triggerSpecial();
      }
    },

    update(dt: number, pressed: Readonly<Record<GamepadButton, boolean>>): SnesGameResult | null {
      timeSec += dt;
      const slowMul = zenSlowTimer > 0 ? 0.38 : 1.0;

      specialCd = Math.max(0, specialCd - dt);
      fireCd = Math.max(0, fireCd - dt);
      invulnTimer = Math.max(0, invulnTimer - dt);
      bubbleShieldTimer = Math.max(0, bubbleShieldTimer - dt);
      fireDashTimer = Math.max(0, fireDashTimer - dt);
      glitchBlinkTimer = Math.max(0, glitchBlinkTimer - dt);
      zenSlowTimer = Math.max(0, zenSlowTimer - dt);
      phantomPhaseTimer = Math.max(0, phantomPhaseTimer - dt);

      // 8-way player movement
      let mx = 0;
      let my = 0;
      if (pressed.left) mx -= 1;
      if (pressed.right) mx += 1;
      if (pressed.up) my -= 1;
      if (pressed.down) my += 1;
      if (mx !== 0 || my !== 0) {
        const len = Math.hypot(mx, my);
        mx /= len;
        my /= len;
        aimX = mx;
        aimY = my;
        const spd = (cfg.buffs.dogeSpeed ? 124 : 102) * (fireDashTimer > 0 ? 1.55 : 1);
        px = Math.max(ARENA_LEFT + PLAYER_R, Math.min(ARENA_RIGHT - PLAYER_R, px + mx * spd * dt));
        py = Math.max(ARENA_TOP + PLAYER_R, Math.min(ARENA_BOTTOM - PLAYER_R, py + my * spd * dt));
      }

      // Hold O for rapid fire
      if (pressed.o && fireCd <= 0) {
        firePlayerOrb();
        fireCd = cfg.buffs.dogeSpeed ? 0.15 : 0.2;
      }

      // Wave escalation + mini-boss every 12s
      if (timeSec >= nextWaveAt) {
        wave += 1;
        nextWaveAt += 13;
        particles.push({
          x: SCREEN_W / 2,
          y: 66,
          vx: 0,
          vy: -12,
          life: 1.2,
          maxLife: 1.2,
          color: "#fde047",
          text: `WAVE ${wave}!`,
        });
        if (wave % 2 === 0) {
          queueSpawn("boss");
        }
      }

      // Regular enemy spawns
      spawnTimer -= dt * slowMul;
      if (spawnTimer <= 0 && enemies.length < 9) {
        spawnTimer = Math.max(0.65, 1.55 - wave * 0.16);
        const kind = wave >= 2 && Math.random() < 0.34 ? "shooter" : "troll";
        queueSpawn(kind);
      }

      // Telegraphs resolve into spawns
      for (let i = telegraphs.length - 1; i >= 0; i--) {
        telegraphs[i]!.timer -= dt;
        if (telegraphs[i]!.timer <= 0) {
          const t = telegraphs[i]!;
          spawnEnemyAt(t.x, t.y, t.kind);
          telegraphs.splice(i, 1);
        }
      }

      // Update bullets
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i]!;
        const bMul = b.fromEnemy ? slowMul : 1;
        b.x += b.vx * bMul * dt;
        b.y += b.vy * bMul * dt;
        if (b.x < ARENA_LEFT - 6 || b.x > ARENA_RIGHT + 6 || b.y < ARENA_TOP - 6 || b.y > ARENA_BOTTOM + 6) {
          bullets.splice(i, 1);
          continue;
        }
        if (b.fromEnemy) {
          if (Math.hypot(b.x - px, b.y - py) < PLAYER_R + b.r - 2) {
            bullets.splice(i, 1);
            if (takeDamage()) {
              return { score, maxCombo, cleared: false, headline: "TROLLED!" };
            }
          }
        } else {
          let hit = false;
          for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j]!;
            if (Math.hypot(b.x - e.x, b.y - e.y) < e.r + b.r) {
              damageEnemy(j, 1);
              hit = true;
              break;
            }
          }
          if (hit) bullets.splice(i, 1);
        }
      }

      // Update enemies
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i]!;
        e.hauntCooldown = Math.max(0, e.hauntCooldown - dt);
        const dx = px - e.x;
        const dy = py - e.y;
        const dist = Math.max(1, Math.hypot(dx, dy));
        e.x += (dx / dist) * e.speed * slowMul * dt;
        e.y += (dy / dist) * e.speed * slowMul * dt;

        // Shooter / Boss attacks
        if (e.kind === "shooter" || e.kind === "boss") {
          e.fireTimer -= dt * slowMul;
          if (e.fireTimer <= 0) {
            e.fireTimer = e.kind === "boss" ? 1.35 : 2.1;
            const bSpd = e.kind === "boss" ? 96 : 84;
            if (e.kind === "boss") {
              const baseAng = Math.atan2(dy, dx);
              for (const off of [-0.35, 0, 0.35]) {
                bullets.push({
                  x: e.x,
                  y: e.y,
                  vx: Math.cos(baseAng + off) * bSpd,
                  vy: Math.sin(baseAng + off) * bSpd,
                  fromEnemy: true,
                  color: "#fb7185",
                  r: 3.6,
                });
              }
            } else {
              bullets.push({
                x: e.x,
                y: e.y,
                vx: (dx / dist) * bSpd,
                vy: (dy / dist) * bSpd,
                fromEnemy: true,
                color: "#fb923c",
                r: 3.2,
              });
            }
          }
        }

        // Player contact
        if (dist < PLAYER_R + e.r - 2) {
          if (fireDashTimer > 0) {
            damageEnemy(i, 3, "ROAST!");
            continue;
          }
          if (phantomPhaseTimer > 0) {
            if (e.hauntCooldown <= 0) {
              e.hauntCooldown = 0.6;
              damageEnemy(i, 2, "HAUNT!");
            }
            continue;
          }
          if (takeDamage()) {
            return { score, maxCombo, cleared: false, headline: "OVERRUN!" };
          }
        }
      }

      // Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i]!;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.life -= dt;
        if (pt.life <= 0) particles.splice(i, 1);
      }

      if (timeSec >= durationSec) {
        const bonus = Math.round(110 * overdriveMul);
        score += bonus;
        return { score, maxCombo, cleared: true, headline: `ARENA CLEARED! +${bonus}` };
      }
      return null;
    },

    render(ctx: CanvasRenderingContext2D) {
      // Cyber arena floor
      ctx.fillStyle = zenSlowTimer > 0 ? "#0c2233" : "#151232";
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

      // Retro grid lines
      ctx.strokeStyle = "rgba(123, 230, 216, 0.11)";
      ctx.lineWidth = 1;
      for (let gx = ARENA_LEFT; gx <= ARENA_RIGHT; gx += 20) {
        ctx.beginPath();
        ctx.moveTo(gx, ARENA_TOP);
        ctx.lineTo(gx, ARENA_BOTTOM);
        ctx.stroke();
      }
      for (let gy = ARENA_TOP; gy <= ARENA_BOTTOM; gy += 20) {
        ctx.beginPath();
        ctx.moveTo(ARENA_LEFT, gy);
        ctx.lineTo(ARENA_RIGHT, gy);
        ctx.stroke();
      }

      // Arena neon border
      ctx.strokeStyle = "#7c5fd4";
      ctx.lineWidth = 2.5;
      ctx.strokeRect(ARENA_LEFT, ARENA_TOP, ARENA_RIGHT - ARENA_LEFT, ARENA_BOTTOM - ARENA_TOP);

      // Spawn telegraphs
      for (const t of telegraphs) {
        ctx.strokeStyle = t.kind === "boss" ? "#fb7185" : "#fde047";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 6 + t.timer * 10, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Aim reticle
      ctx.fillStyle = sp.accentColor;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(px + aimX * 19, py + aimY * 19, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Bullets
      for (const b of bullets) {
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(b.x - 1, b.y - 1, b.r * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Enemies
      for (const e of enemies) {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(0, 0, e.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#0a0a24";
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // Angry pixel eyes
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(-e.r * 0.45, -3, 3.5, 3.5);
        ctx.fillRect(e.r * 0.15, -3, 3.5, 3.5);
        ctx.fillStyle = "#0a0a24";
        ctx.fillRect(-e.r * 0.35, -2, 1.8, 2);
        ctx.fillRect(e.r * 0.25, -2, 1.8, 2);

        if (e.kind === "boss") {
          // Boss HP bar
          ctx.fillStyle = "#0a0a24";
          ctx.fillRect(-16, -e.r - 7, 32, 4);
          ctx.fillStyle = "#fde047";
          ctx.fillRect(-15, -e.r - 6, Math.round(30 * (e.hp / e.maxHp)), 2);
        }
        ctx.restore();
      }

      // Hero
      drawSpeciesHero(ctx, px, py, PLAYER_R, {
        species: cfg.species,
        stage: cfg.stage,
        equippedIds: cfg.equippedIds,
        facing: aimX < -0.1 ? -1 : 1,
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

      // Particles
      for (const pt of particles) {
        ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
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
        extraTag: `WAVE ${wave}`,
      });
    },
  };
}
