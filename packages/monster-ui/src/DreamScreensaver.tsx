import type { SpeciesId } from "@memeagotchi/game-core";
import { useEffect, useRef, useState } from "react";
import { PixelSleepingSprite } from "./PixelSleepingSprite.tsx";

export interface DreamSlide {
  id: string | number;
  title: string;
  emoji: string;
  bg: string;
  src?: string | null;
}

/**
 * Meme Dreaming Sleep Screensaver:
 * - Cycles full-screen through the memes the monster has fed on (dreamSlides)
 * - Glides a crisp 1/8-size pixel sleeping monster sprite around the screen with
 *   thought-bubble dream motes so it looks like the monster is dreaming of the memes.
 * - Supports simulated Light / Sound / Motion wake-from-standby indicator for handheld carry mode.
 */
export function DreamScreensaver({
  species,
  stage,
  petName,
  energy,
  slides,
  fromFedHistory,
  manualIndex,
  sensorBadge,
  standby = false,
  wakeHint = "PRESS O OR -- TO WAKE",
  onWakeFromStandby,
  className = "",
}: {
  species: SpeciesId;
  stage: number;
  petName: string;
  energy: number;
  slides: readonly DreamSlide[];
  fromFedHistory: boolean;
  manualIndex?: number;
  sensorBadge?: string | null;
  standby?: boolean;
  wakeHint?: string;
  onWakeFromStandby?: (trigger: "motion") => void;
  className?: string;
}) {
  const [autoIdx, setAutoIdx] = useState(0);
  const slideCount = Math.max(1, slides.length);
  const activeIdx = ((manualIndex ?? autoIdx) % slideCount + slideCount) % slideCount;
  const activeSlide = slides[activeIdx];

  // Auto-advance dreamed memes every 4.5s
  useEffect(() => {
    if (standby || slides.length <= 1) return;
    const iv = setInterval(() => {
      setAutoIdx((n) => (n + 1) % slides.length);
    }, 4500);
    return () => clearInterval(iv);
  }, [standby, slides.length]);

  // Smooth 60fps 1/8-size pixel sprite gliding physics (percent coordinates 0..100)
  const [spritePos, setSpritePos] = useState({ x: 16, y: 26, flip: false, bobY: 0 });
  const physRef = useRef({
    x: 16,
    y: 26,
    vx: 11.5, // % width per sec
    vy: 8.2, // % height per sec
    t: 0,
  });

  useEffect(() => {
    if (standby) return;
    let rafId = 0;
    let lastTs = performance.now();

    const step = (ts: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (ts - lastTs) / 1000));
      lastTs = ts;
      const p = physRef.current;
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Soft inner bounds for an exact 1/8-size (12.5%) sprite so it stays cleanly inside the rounded screen
      if (p.x < 4) {
        p.x = 4;
        p.vx = Math.abs(p.vx);
      } else if (p.x > 83.5) {
        p.x = 83.5;
        p.vx = -Math.abs(p.vx);
      }
      if (p.y < 14) {
        p.y = 14;
        p.vy = Math.abs(p.vy);
      } else if (p.y > 70) {
        p.y = 70;
        p.vy = -Math.abs(p.vy);
      }

      const bobY = Math.sin(p.t * 3.2) * 2.2;
      setSpritePos({ x: p.x, y: p.y + bobY, flip: p.vx < 0, bobY });
      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [standby]);

  if (standby) {
    return (
      <div
        onClick={() => onWakeFromStandby?.("motion")}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onWakeFromStandby?.("motion");
        }}
        className={`relative flex h-full w-full flex-col items-center justify-center bg-[#060612] text-center px-4 cursor-pointer select-none ${className}`}
        aria-label="Low power standby screen — tap or trigger Light, Sound, or Motion sensor to wake Dream Screensaver"
      >
        <div className="w-9 h-9 opacity-45 mb-2">
          <PixelSleepingSprite species={species} stage={stage} className="w-full h-full" />
        </div>
        <p className="font-mono text-[11px] font-bold tracking-wider text-slate-400">
          DISPLAY STANDBY · {petName.toUpperCase()} SLEEPING
        </p>
        <p className="font-mono text-[9.5px] text-teal-300/75 mt-1">
          SENSORS ARMED: ☀️ LIGHT · 🎙️ SOUND · 📳 MOTION
        </p>
        <p className="font-mono text-[9px] text-slate-500 mt-2">
          Tap screen or trigger a sensor below to wake Dream Saver
        </p>
      </div>
    );
  }

  return (
    <div
      className={`relative h-full w-full overflow-hidden bg-[#0a0a24] select-none ${className}`}
      aria-label={`${petName} sleeping dream screensaver`}
    >
      {/* Background: Full-screen fit-everything slideshow of fed memes (ambient blur fill + crisp object-contain) */}
      {activeSlide ? (
        activeSlide.src ? (
          <div key={activeSlide.id} className="absolute inset-0 overflow-hidden bg-[#0a0a24]">
            <img
              src={activeSlide.src}
              alt=""
              aria-hidden
              className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-md"
              draggable={false}
            />
            <img
              src={activeSlide.src}
              alt={`Dreaming of ${activeSlide.title}`}
              className="relative z-[1] h-full w-full object-contain transition-opacity duration-700"
              draggable={false}
            />
          </div>
        ) : (
          <div
            key={activeSlide.id}
            className="absolute inset-0 flex items-center justify-center text-6xl"
            style={{ background: activeSlide.bg }}
          >
            {activeSlide.emoji}
          </div>
        )
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, #10143d 0%, #231d59 60%, #151133 100%)" }}
        />
      )}

      {/* Dreamy soft twilight vignette frame so meme stays bright & legible while feeling like a dream */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 48%, rgba(16,14,44,0.04) 48%, rgba(12,10,36,0.62) 100%)",
        }}
        aria-hidden
      />

      {/* Top translucent dream status & sensor wake pills */}
      <div className="pointer-events-none absolute inset-x-2 top-1.5 z-10 flex items-center justify-between gap-1.5">
        <span
          className="rounded-full px-2 py-0.5 font-mono text-[9.5px] font-bold text-white shadow"
          style={{ background: "rgba(12, 10, 36, 0.78)", border: "1px solid rgba(123,230,216,0.45)" }}
        >
          💭 {petName} · ⚡{energy}%
        </span>

        {sensorBadge ? (
          <span
            className="rounded-full px-2 py-0.5 font-mono text-[9px] font-bold shadow"
            style={{ background: "rgba(253, 224, 71, 0.92)", color: "#141026" }}
          >
            {sensorBadge}
          </span>
        ) : (
          <span
            className="rounded-full px-2 py-0.5 font-mono text-[8.5px] font-bold"
            style={{ background: "rgba(12, 10, 36, 0.72)", color: "#c4b5fd" }}
          >
            {fromFedHistory ? `FED MEMES (${activeIdx + 1}/${slideCount})` : "DREAM PREVIEW"}
          </span>
        )}
      </div>

      {/* 1/8-size gliding pixel sleeping monster sprite + dream thought dots */}
      <div
        className="pointer-events-none absolute z-20"
        style={{
          left: `${spritePos.x}%`,
          top: `${spritePos.y}%`,
          width: "12.5%",
          aspectRatio: "1 / 1",
          willChange: "left, top",
        }}
        aria-hidden
      >
        {/* Tiny dream-bubble trail linking sprite to the background meme */}
        <span
          className="absolute -top-2.5 right-0 block h-1.5 w-1.5 rounded-full bg-white/85 shadow"
          style={{ transform: "translate(35%, -35%)" }}
        />
        <span
          className="absolute -top-4 right-0 block h-2 w-2 rounded-full bg-white/65 shadow"
          style={{ transform: "translate(85%, -65%)" }}
        />
        <PixelSleepingSprite species={species} stage={stage} flip={spritePos.flip} className="h-full w-full" />
      </div>

      {/* Bottom slim dream caption & wake hint */}
      <div
        className="pointer-events-none absolute inset-x-2 bottom-1.5 z-10 flex items-center justify-between gap-2 rounded-lg px-2 py-1"
        style={{
          background: "rgba(12, 10, 36, 0.78)",
          border: "1px solid rgba(255,255,255,0.16)",
        }}
      >
        <span className="truncate font-mono text-[9.5px] font-bold text-[#fde047]">
          {fromFedHistory
            ? `💤 Dreaming: ${activeSlide?.title ?? "Memes"}`
            : `💤 Feed a meme to dream of it! (${activeSlide?.title ?? "Starter"})`}
        </span>
        <span className="shrink-0 font-mono text-[8.5px] font-bold text-[#7be6d8]">
          {wakeHint}
        </span>
      </div>
    </div>
  );
}
