import { MemeMonster, type EquippedDisplayItem } from "@memeagotchi/monster-ui";
import { useCallback, useEffect, useRef, useState } from "react";

interface FallingItem {
  id: number;
  x: number;
  y: number;
  label: string;
}

const HAZARD_LABELS = ["BLECH", "MID", "RATIO", "CRINGE", "SPICY 🌶️"] as const;

export function MemeDodge({
  displayStage,
  actualStage,
  equipped,
  dogeSpeed,
  susSense,
  onDone,
}: {
  displayStage: number;
  actualStage: number;
  equipped: EquippedDisplayItem[];
  dogeSpeed: boolean;
  susSense: boolean;
  onDone: (score: number) => void;
}) {
  const durationSec = dogeSpeed ? 39 : 30;
  const [pos, setPos] = useState(50);
  const [items, setItems] = useState<FallingItem[]>([]);
  const [nextWarningX, setNextWarningX] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(durationSec);
  const [running, setRunning] = useState(false);
  const [hitFlash, setHitFlash] = useState(false);

  const posRef = useRef(50);
  const itemsRef = useRef<FallingItem[]>([]);
  const scoreRef = useRef(0);
  const finishedRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  const finish = useCallback((finalScore: number, wasHit: boolean) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setRunning(false);
    setNextWarningX(null);
    if (wasHit) {
      setHitFlash(true);
      setTimeout(() => setHitFlash(false), 350);
    }
    onDoneRef.current(finalScore);
  }, []);

  // Keyboard controls (ArrowLeft / ArrowRight / A / D)
  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        setPos((p) => Math.max(10, p - 12));
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        e.preventDefault();
        setPos((p) => Math.min(90, p + 12));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running]);

  // Synchronous ref-driven physics + full unmount cleanup (immune to React 19 StrictMode batching)
  useEffect(() => {
    if (!running) return;
    let idCounter = 1;
    let queuedX = 12 + Math.random() * 76;
    if (susSense) setNextWarningX(queuedX);

    const spawnIv = setInterval(() => {
      if (finishedRef.current) return;
      const spawnX = queuedX;
      queuedX = 12 + Math.random() * 76;
      if (susSense) setNextWarningX(queuedX);
      const label = HAZARD_LABELS[Math.floor(Math.random() * HAZARD_LABELS.length)] ?? "BLECH";
      const next = [...itemsRef.current.slice(-10), { id: idCounter++, x: spawnX, y: 0, label }];
      itemsRef.current = next;
      setItems(next);
    }, 660);

    const physicsIv = setInterval(() => {
      if (finishedRef.current) return;
      let collided = false;
      let dodgedDelta = 0;
      const next: FallingItem[] = [];

      for (const it of itemsRef.current) {
        const ny = it.y + 4.2;
        if (ny >= 80) {
          if (Math.abs(it.x - posRef.current) < 13) {
            collided = true;
          } else {
            dodgedDelta += 1;
          }
        } else {
          next.push({ ...it, y: ny });
        }
      }

      itemsRef.current = next;
      setItems(next);

      if (dodgedDelta > 0) {
        scoreRef.current += dodgedDelta;
        setScore(scoreRef.current);
      }
      if (collided) {
        finish(scoreRef.current, true);
      }
    }, 85);

    const timerIv = setInterval(() => {
      if (finishedRef.current) return;
      setTimeLeft((prev) => {
        if (prev <= 1) {
          finish(scoreRef.current, false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(spawnIv);
      clearInterval(physicsIv);
      clearInterval(timerIv);
    };
  }, [running, susSense, finish]);

  const start = () => {
    finishedRef.current = false;
    scoreRef.current = 0;
    posRef.current = 50;
    itemsRef.current = [];
    setHitFlash(false);
    setPos(50);
    setScore(0);
    setItems([]);
    setTimeLeft(durationSec);
    setRunning(true);
  };

  return (
    <div>
      <div
        className={`relative h-[268px] rounded-2xl overflow-hidden border-4 select-none transition-colors ${
          hitFlash ? "border-red-400" : "border-[var(--border)]"
        }`}
        style={{ background: "linear-gradient(180deg, #1b1742 0%, #0f172a 82%, #1d3a3a 100%)" }}
        role="img"
        aria-label="Meme Dodge game field"
      >
        {/* Subtle star dots */}
        <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1.2px)", backgroundSize: "28px 28px" }} />

        {susSense && running && nextWarningX != null && (
          <div
            className="absolute top-0 bottom-0 w-9 -translate-x-1/2 bg-red-500/15 border-x border-dashed border-red-400/50 pointer-events-none"
            style={{ left: `${nextWarningX}%` }}
            title="Imposter Sense: next hazard lane"
          />
        )}

        {items.map((it) => (
          <div
            key={it.id}
            className="absolute -translate-x-1/2 px-2.5 py-0.5 rounded-md bg-rose-500 border border-rose-200/40 text-white text-[11px] font-bold shadow-md"
            style={{ left: `${it.x}%`, top: `${it.y}%` }}
          >
            {it.label}
          </div>
        ))}

        {/* Player's ACTUAL dressed MemeMonster avatar! */}
        <div
          className="absolute w-16 h-16 transition-all duration-75 pointer-events-none"
          style={{ left: `${pos}%`, bottom: 4, transform: "translateX(-50%)" }}
        >
          <MemeMonster
            displayStage={displayStage}
            actualStage={actualStage}
            mood={hitFlash ? "sick" : running ? "excited" : "happy"}
            equipped={equipped}
          />
        </div>

        <div className="absolute top-2 left-2 text-white text-xs font-bold bg-black/55 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-white/10">
          ⏱ {timeLeft}s · Dodged: {score}
          {dogeSpeed ? " · 🐕 Much Speed" : ""}
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          type="button"
          aria-label="Move left"
          className="flex-1 py-3 rounded-xl bg-[var(--surface2)] border border-[var(--border)] text-2xl disabled:opacity-40"
          disabled={!running}
          onClick={() => setPos((p) => Math.max(10, p - 12))}
        >
          ◀️
        </button>
        {!running && (
          <button
            type="button"
            aria-label="Start Meme Dodge"
            className="flex-1 py-3 rounded-xl bg-[var(--accent)] text-[#141026] font-bold"
            onClick={start}
          >
            ▶ Start ({durationSec}s)
          </button>
        )}
        <button
          type="button"
          aria-label="Move right"
          className="flex-1 py-3 rounded-xl bg-[var(--surface2)] border border-[var(--border)] text-2xl disabled:opacity-40"
          disabled={!running}
          onClick={() => setPos((p) => Math.min(90, p + 12))}
        >
          ▶️
        </button>
      </div>
      <p className="text-xs text-[var(--dim)] mt-2">
        Move with arrow keys / A-D or buttons. Dodge falling bad labels to earn XP &amp; Drip!
        {susSense ? " Imposter Sense active: red lane previews the next drop!" : ""}
      </p>
    </div>
  );
}
