let audioCtx: AudioContext | null = null;

function playTone(enabled: boolean, freq: number, dur = 0.06, delay = 0, type: OscillatorType = "triangle") {
  if (!enabled) return;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    audioCtx ??= new AC();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    const t0 = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.04, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch {
    /* audio unavailable */
  }
}

export const sfx = {
  ok: (on: boolean) => {
    playTone(on, 660, 0.055, 0, "triangle");
    playTone(on, 990, 0.08, 0.06, "triangle");
  },
  bad: (on: boolean) => {
    playTone(on, 185, 0.14, 0, "sawtooth");
  },
  pet: (on: boolean) => {
    playTone(on, 587, 0.05, 0, "sine");
    playTone(on, 880, 0.07, 0.05, "sine");
    playTone(on, 1175, 0.09, 0.1, "sine");
  },
  sparkle: (on: boolean) => {
    playTone(on, 784, 0.06, 0, "triangle");
    playTone(on, 1046, 0.06, 0.06, "triangle");
    playTone(on, 1318, 0.12, 0.12, "triangle");
  },
  tap: (on: boolean) => {
    playTone(on, 740, 0.035, 0, "square");
  },
};
