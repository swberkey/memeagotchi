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

const LANE_BUTTONS: readonly GamepadButton[] = ["left", "down", "up", "right", "o"];
const LANE_GLYPHS = ["◄", "▼", "▲", "►", "O"];
const LANE_COLORS = ["#38bdf8", "#a855f7", "#4ade80", "#f472b6", "#fde047"];

const HIGHWAY_X = 138;
const LANE_W = 35;
const HIT_Y = 204;
const SONG_DURATION_SEC = 42;
const BEAT_INTERVAL = 60 / 116; // ~0.517s per beat (116 BPM)

interface BeatNote {
  id: number;
  lane: number; // 0..4
  hitTime: number;
  judged: boolean;
}

interface JudgePopup {
  text: string;
  color: string;
  life: number;
}

function buildChart(): BeatNote[] {
  const notes: BeatNote[] = [];
  let seq = 1;
  // Catchy patterned 16-bit rhythm track (~62 notes over 42s)
  const patterns: readonly number[][] = [
    [0, 2, 3, 4],
    [1, 2, 3, 2, 4],
    [0, 1, 2, 3, 4, 2],
    [4, 0, 3, 1, 2, 4],
  ];
  let t = 1.8;
  let bar = 0;
  while (t < SONG_DURATION_SEC - 1.5) {
    const pat = patterns[bar % patterns.length]!;
    for (let i = 0; i < pat.length; i++) {
      if (t >= SONG_DURATION_SEC - 1.5) break;
      const lane = pat[i]!;
      notes.push({ id: seq++, lane, hitTime: t, judged: false });
      const step = bar >= 6 && i % 2 === 1 ? BEAT_INTERVAL * 0.75 : BEAT_INTERVAL;
      t += step;
    }
    bar += 1;
  }
  return notes;
}

export function createBeatEngine(cfg: SnesGameConfig): SnesEngineInstance {
  const sp = SPECIES_BY_ID[cfg.species];
  const specialId = sp.specialMove.id;
  const specialCooldownBase = cfg.milestonePowers.turboCharge ? 6.2 : 9.5;
  const overdriveMul = cfg.milestonePowers.memeOverdrive ? 1.5 : 1.0;

  const perfectWindow = cfg.buffs.dogeSpeed ? 0.13 : 0.105;
  const goodWindow = cfg.buffs.dogeSpeed ? 0.23 : 0.19;

  const notes = buildChart();
  let timeSec = 0;
  let lastPulseStep = -1;

  let hearts = 5;
  let secondWindReady = cfg.milestonePowers.secondWind;
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let dancePose = 0;
  let danceTimer = 0;
  const laneFlash = [0, 0, 0, 0, 0];

  let specialCd = 0;
  let bubbleGuardCharges = 0;
  let fireEncoreTimer = 0;
  let glitchFlashTimer = 0;
  let zenSlowTimer = 0;
  let phantomGrooveTimer = 0;

  let popup: JudgePopup | null = null;

  const setPopup = (text: string, color: string) => {
    popup = { text, color, life: 0.75 };
  };

  const awardHit = (lane: number, quality: "PERFECT" | "GOOD") => {
    combo += 1;
    maxCombo = Math.max(maxCombo, combo);
    const base = quality === "PERFECT" ? 30 : 18;
    const comboMul = 1 + Math.min(1.5, combo * 0.08);
    const grooveMul = phantomGrooveTimer > 0 ? 1.8 : 1.0;
    score += Math.round(base * comboMul * overdriveMul * grooveMul);
    if (combo > 0 && combo % 10 === 0 && hearts < 5) {
      hearts += 1;
    }
    dancePose = (dancePose + 1) % 4;
    danceTimer = 0.28;
    laneFlash[lane] = 0.2;
    snesSfx.beatHit(cfg.soundOn, lane, quality === "PERFECT");
    setPopup(quality === "PERFECT" ? "PERFECT!" : "GOOD!", quality === "PERFECT" ? "#fde047" : "#7be6d8");
  };

  const registerMiss = () => {
    if (bubbleGuardCharges > 0) {
      bubbleGuardCharges -= 1;
      snesSfx.shieldBreak(cfg.soundOn);
      setPopup("BUBBLE SAVE!", "#7be6d8");
      return false;
    }
    if (secondWindReady) {
      secondWindReady = false;
      snesSfx.shieldBreak(cfg.soundOn);
      setPopup("2ND WIND!", "#fde047");
      return false;
    }
    hearts -= 1;
    combo = 0;
    snesSfx.beatMiss(cfg.soundOn);
    setPopup("MISS!", "#fb7185");
    return hearts <= 0;
  };

  const triggerSpecial = () => {
    if (specialCd > 0) return;
    specialCd = specialCooldownBase;
    snesSfx.special(cfg.soundOn);

    if (specialId === "bubble-shield") {
      bubbleGuardCharges = 2;
      setPopup("BUBBLE GUARD ×2", "#7be6d8");
    } else if (specialId === "fire-dash") {
      fireEncoreTimer = 2.8;
      setPopup("FIRE ENCORE!", "#ff7849");
    } else if (specialId === "glitch-blink") {
      glitchFlashTimer = 0.7;
      let cleared = 0;
      for (const n of notes) {
        if (!n.judged && n.hitTime - timeSec >= -0.15 && n.hitTime - timeSec <= 1.35) {
          n.judged = true;
          awardHit(n.lane, "PERFECT");
          cleared += 1;
        }
      }
      score += Math.round(60 * overdriveMul);
      setPopup(cleared > 0 ? `GLITCH ×${cleared}!` : "GLITCH BURST!", "#38bdf8");
    } else if (specialId === "zen-slow") {
      zenSlowTimer = 5.0;
      setPopup("ZEN FLOW!", "#86efac");
    } else if (specialId === "phantom-phase") {
      phantomGrooveTimer = 4.6;
      setPopup("GHOST GROOVE ×2!", "#d8b4fe");
    }
  };

  return {
    onButtonPress(btn: GamepadButton) {
      if (btn === "x") {
        triggerSpecial();
        return;
      }
      const lane = LANE_BUTTONS.indexOf(btn);
      if (lane < 0) return;
      laneFlash[lane] = 0.16;

      // Find nearest unjudged note in this lane
      let best: BeatNote | null = null;
      let bestDiff = Infinity;
      for (const n of notes) {
        if (n.judged || n.lane !== lane) continue;
        const diff = Math.abs(n.hitTime - timeSec);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = n;
        }
      }
      if (best && bestDiff <= goodWindow) {
        best.judged = true;
        const quality = bestDiff <= perfectWindow || phantomGrooveTimer > 0 ? "PERFECT" : "GOOD";
        awardHit(lane, quality);
      } else {
        // Empty tap doesn't kill immediately if no note is near, just drops combo gently
        if (best && bestDiff < 0.42) {
          best.judged = true;
          registerMiss();
        }
      }
    },

    update(dt: number): SnesGameResult | null {
      timeSec += dt;
      specialCd = Math.max(0, specialCd - dt);
      danceTimer = Math.max(0, danceTimer - dt);
      fireEncoreTimer = Math.max(0, fireEncoreTimer - dt);
      glitchFlashTimer = Math.max(0, glitchFlashTimer - dt);
      zenSlowTimer = Math.max(0, zenSlowTimer - dt);
      phantomGrooveTimer = Math.max(0, phantomGrooveTimer - dt);
      if (popup) {
        popup.life -= dt;
        if (popup.life <= 0) popup = null;
      }
      for (let i = 0; i < laneFlash.length; i++) {
        laneFlash[i] = Math.max(0, laneFlash[i]! - dt);
      }

      // Chiptune bass beat pulse
      const step = Math.floor(timeSec / BEAT_INTERVAL);
      if (step > lastPulseStep && timeSec < SONG_DURATION_SEC) {
        lastPulseStep = step;
        snesSfx.beatPulse(cfg.soundOn, step);
      }

      // Auto-PERFECT notes during Fire Encore, and expire missed notes
      for (const n of notes) {
        if (n.judged) continue;
        if (fireEncoreTimer > 0 && Math.abs(n.hitTime - timeSec) <= 0.08) {
          n.judged = true;
          awardHit(n.lane, "PERFECT");
          continue;
        }
        if (timeSec - n.hitTime > goodWindow) {
          n.judged = true;
          if (registerMiss()) {
            return { score, maxCombo, cleared: false, headline: "LOST THE BEAT!" };
          }
        }
      }

      if (timeSec >= SONG_DURATION_SEC) {
        const bonus = Math.round(90 * overdriveMul);
        score += bonus;
        return { score, maxCombo, cleared: true, headline: `ENCORE CLEAR! +${bonus}` };
      }
      return null;
    },

    render(ctx: CanvasRenderingContext2D) {
      // Concert stage background
      const bg = ctx.createLinearGradient(0, 24, 0, SCREEN_H);
      bg.addColorStop(0, "#1c1244");
      bg.addColorStop(0.55, "#2b195e");
      bg.addColorStop(1, "#120c2c");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

      // Left concert stage panel (0..132 on 320x240)
      const beatPulse = Math.abs(Math.sin((timeSec / BEAT_INTERVAL) * Math.PI));
      ctx.fillStyle = `rgba(123, 230, 216, ${0.09 + beatPulse * 0.09})`;
      ctx.beginPath();
      ctx.moveTo(67, 24);
      ctx.lineTo(12, 215);
      ctx.lineTo(122, 215);
      ctx.closePath();
      ctx.fill();

      // Equalizer bars behind dancing monster
      for (let i = 0; i < 7; i++) {
        const h = 14 + Math.abs(Math.sin(timeSec * 5 + i * 1.1)) * (28 + Math.min(20, combo * 2));
        ctx.fillStyle = i % 2 === 0 ? sp.accentColor : sp.secondaryColor;
        ctx.globalAlpha = 0.38;
        ctx.fillRect(10 + i * 17, 194 - h, 12, h);
      }
      ctx.globalAlpha = 1;

      // Stage floor
      ctx.fillStyle = "#3f2e82";
      ctx.fillRect(4, 194, 128, 40);
      ctx.fillStyle = "#fde047";
      ctx.fillRect(4, 194, 128, 2);

      // Dancing species hero!
      const hopY = danceTimer > 0 ? -Math.sin((danceTimer / 0.28) * Math.PI) * 14 : -beatPulse * 4;
      const swayX = danceTimer > 0 ? (dancePose % 2 === 0 ? -6 : 6) : 0;
      drawSpeciesHero(ctx, 68 + swayX, 158 + hopY, 23, {
        species: cfg.species,
        stage: cfg.stage,
        equippedIds: cfg.equippedIds,
        facing: dancePose % 2 === 0 ? 1 : -1,
        excited: combo >= 4 || danceTimer > 0,
        bubbleShield: bubbleGuardCharges > 0,
        fireDash: fireEncoreTimer > 0,
        glitchBlink: glitchFlashTimer > 0,
        zenSlow: zenSlowTimer > 0,
        phantomPhase: phantomGrooveTimer > 0,
        secondWindReady,
        timeSec,
      });

      // Judgment popup on stage
      if (popup) {
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "center";
        ctx.fillStyle = "#0a0a24";
        ctx.fillText(popup.text, 69, 86);
        ctx.fillStyle = popup.color;
        ctx.fillText(popup.text, 68, 85);
        ctx.textAlign = "left";
      }

      // Fever multiplier pill on stage
      if (combo >= 5) {
        ctx.fillStyle = "#f472b6";
        ctx.fillRect(24, 42, 88, 16);
        ctx.strokeStyle = "#0a0a24";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(24, 42, 88, 16);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`FEVER ×${combo}`, 68, 53);
        ctx.textAlign = "left";
      }

      // Right 5-lane rhythm highway (114..270)
      ctx.fillStyle = "rgba(8, 8, 28, 0.85)";
      ctx.fillRect(HIGHWAY_X, 24, LANE_W * 5, SCREEN_H - 24);

      // Find next upcoming note for Sus Sense highlight
      const nextNote = cfg.buffs.susSense
        ? notes.find((n) => !n.judged && n.hitTime >= timeSec - 0.05)
        : undefined;

      for (let i = 0; i < 5; i++) {
        const lx = HIGHWAY_X + i * LANE_W;
        if (nextNote && nextNote.lane === i) {
          ctx.fillStyle = "rgba(253, 224, 71, 0.14)";
          ctx.fillRect(lx + 1, 26, LANE_W - 2, SCREEN_H - 28);
        }
        if (laneFlash[i]! > 0) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
          ctx.fillRect(lx + 1, 26, LANE_W - 2, SCREEN_H - 28);
        }
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(lx, 24);
        ctx.lineTo(lx, SCREEN_H);
        ctx.stroke();

        // Hit receptor circle
        const cx = lx + LANE_W / 2;
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.beginPath();
        ctx.arc(cx, HIT_Y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = LANE_COLORS[i]!;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(LANE_GLYPHS[i]!, cx, HIT_Y + 0.5);
      }

      // Hit line glow
      ctx.fillStyle = "rgba(253,224,71,0.3)";
      ctx.fillRect(HIGHWAY_X, HIT_Y - 1, LANE_W * 5, 2);

      // Incoming notes
      const scrollPxPerSec = zenSlowTimer > 0 ? 78 : 122;
      for (const n of notes) {
        if (n.judged) continue;
        const dtNote = n.hitTime - timeSec;
        const ny = HIT_Y - dtNote * scrollPxPerSec;
        if (ny < 26 || ny > SCREEN_H + 10) continue;
        const cx = HIGHWAY_X + n.lane * LANE_W + LANE_W / 2;
        ctx.fillStyle = LANE_COLORS[n.lane]!;
        ctx.beginPath();
        ctx.arc(cx, ny, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#0a0a24";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#0a0a24";
        ctx.font = "bold 9.5px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(LANE_GLYPHS[n.lane]!, cx, ny + 0.5);
      }
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";

      drawPixelHudBar(ctx, {
        hearts,
        maxHearts: 5,
        score,
        combo,
        timeLeftSec: SONG_DURATION_SEC - timeSec,
        species: cfg.species,
        specialReadyPct: 1 - specialCd / specialCooldownBase,
        specialActive:
          bubbleGuardCharges > 0 ||
          fireEncoreTimer > 0 ||
          glitchFlashTimer > 0 ||
          zenSlowTimer > 0 ||
          phantomGrooveTimer > 0,
        secondWindReady,
        milestonePowers: cfg.milestonePowers,
        extraTag: "VIBE BEAT",
      });
    },
  };
}
