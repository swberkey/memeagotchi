let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!sharedCtx) sharedCtx = new AC();
  if (sharedCtx.state === "suspended") {
    void sharedCtx.resume();
  }
  return sharedCtx;
}

function tone(
  soundOn: boolean,
  freq: number,
  dur: number,
  type: OscillatorType = "square",
  gainLevel = 0.045,
  delay = 0,
  endFreq?: number,
) {
  if (!soundOn) return;
  try {
    const ac = getCtx();
    if (!ac) return;
    const t0 = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), t0 + dur);
    }
    g.gain.setValueAtTime(gainLevel, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch {
    /* audio unavailable */
  }
}

const LANE_FREQS = [523.25, 587.33, 659.25, 783.99, 1046.5]; // C5 D5 E5 G5 C6
const BASS_LINE = [130.81, 130.81, 164.81, 196.0, 174.61, 174.61, 146.83, 196.0];

export const snesSfx = {
  start(on: boolean) {
    tone(on, 523.25, 0.07, "square", 0.04, 0);
    tone(on, 659.25, 0.07, "square", 0.04, 0.07);
    tone(on, 783.99, 0.09, "square", 0.045, 0.14);
    tone(on, 1046.5, 0.14, "triangle", 0.06, 0.22);
  },
  jump(on: boolean, doubleJump = false) {
    tone(on, doubleJump ? 520 : 360, 0.11, "square", 0.038, 0, doubleJump ? 980 : 720);
  },
  shoot(on: boolean) {
    tone(on, 880, 0.065, "square", 0.03, 0, 320);
  },
  pickup(on: boolean, combo = 1) {
    const base = Math.min(1200, 620 + combo * 28);
    tone(on, base, 0.055, "triangle", 0.055, 0);
    tone(on, base * 1.25, 0.075, "triangle", 0.055, 0.045);
  },
  stomp(on: boolean) {
    tone(on, 240, 0.08, "square", 0.05, 0, 620);
    tone(on, 780, 0.06, "triangle", 0.05, 0.06);
  },
  special(on: boolean) {
    tone(on, 440, 0.08, "sawtooth", 0.04, 0, 880);
    tone(on, 660, 0.1, "square", 0.04, 0.06, 1320);
    tone(on, 990, 0.14, "triangle", 0.055, 0.13);
  },
  shieldBreak(on: boolean) {
    tone(on, 740, 0.12, "triangle", 0.055, 0, 260);
    tone(on, 520, 0.14, "square", 0.035, 0.06, 180);
  },
  hit(on: boolean) {
    tone(on, 220, 0.16, "sawtooth", 0.05, 0, 85);
  },
  pause(on: boolean) {
    tone(on, 587.33, 0.05, "square", 0.035, 0);
    tone(on, 440, 0.07, "square", 0.035, 0.06);
  },
  beatHit(on: boolean, lane: number, perfect: boolean) {
    const f = LANE_FREQS[lane % LANE_FREQS.length] ?? 523.25;
    tone(on, f, perfect ? 0.12 : 0.08, "triangle", perfect ? 0.06 : 0.04, 0);
    if (perfect) tone(on, f * 1.5, 0.08, "square", 0.025, 0.03);
  },
  beatMiss(on: boolean) {
    tone(on, 145, 0.12, "sawtooth", 0.04, 0, 105);
  },
  beatPulse(on: boolean, step: number) {
    const f = BASS_LINE[step % BASS_LINE.length] ?? 130.81;
    tone(on, f, 0.09, "triangle", 0.032, 0, f * 0.92);
    if (step % 2 === 0) {
      tone(on, 95, 0.04, "sine", 0.04, 0, 48);
    }
  },
  finish(on: boolean, cleared: boolean) {
    if (cleared) {
      tone(on, 523.25, 0.08, "square", 0.04, 0);
      tone(on, 659.25, 0.08, "square", 0.04, 0.09);
      tone(on, 783.99, 0.08, "square", 0.04, 0.18);
      tone(on, 1046.5, 0.22, "triangle", 0.06, 0.27);
    } else {
      tone(on, 392, 0.12, "sawtooth", 0.04, 0);
      tone(on, 329.63, 0.12, "sawtooth", 0.04, 0.13);
      tone(on, 261.63, 0.24, "sawtooth", 0.045, 0.26);
    }
  },
};
