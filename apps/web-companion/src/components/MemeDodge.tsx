import { useCallback, useEffect, useRef, useState } from "react";

interface FallingItem {
  id: number;
  x: number;
  y: number;
  label: string;
}

const HAZARD_LABELS = ["BLECH", "MID", "RATIO", "CRINGE", "SPICY 🌶️"] as const;

export function MemeDodge({
  dogeSpeed,
  susSense,
  onDone,
}: {
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

  const posRef = useRef(50);
  const itemsRef = useRef<FallingItem[]>([]);
  const scoreRef = useRef(0);
  const finishedRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  const finish = useCallback((finalScore: number) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setRunning(false);
    setNextWarningX(null);
    onDoneRef.current(finalScore);
  }, []);

  // Keyboard controls (ArrowLeft / ArrowRight / A / D)
  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        setPos((p) => Math.max(8, p - 12));
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        e.preventDefault();
        setPos((p) => Math.min(92, p + 12));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running]);

  // Synchronous ref-driven physics + full unmount cleanup (immune to React 19 StrictMode batching)
  useEffect(() => {
    if (!running) return;
    let idCounter = 1;
    let queuedX = 10 + Math.random() * 80;
    if (susSense) setNextWarningX(queuedX);

    const spawnIv = setInterval(() => {
      if (finishedRef.current) return;
      const spawnX = queuedX;
      queuedX = 10 + Math.random() * 80;
      if (susSense) setNextWarningX(queuedX);
      const label = HAZARD_LABELS[Math.floor(Math.random() * HAZARD_LABELS.length)] ?? "BLECH";
      const next = [...itemsRef.current.slice(-10), { id: idCounter++, x: spawnX, y: 0, label }];
      itemsRef.current = next;
      setItems(next);
    }, 680);

    const physicsIv = setInterval(() => {
      if (finishedRef.current) return;
      let collided = false;
      let dodgedDelta = 0;
      const next: FallingItem[] = [];

      for (const it of itemsRef.current) {
        const ny = it.y + 4.2;
        if (ny >= 84) {
          if (Math.abs(it.x - posRef.current) < 12) {
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
        finish(scoreRef.current);
      }
    }, 85);

    const timerIv = setInterval(() => {
      if (finishedRef.current) return;
      setTimeLeft((prev) => {
        if (prev <= 1) {
          finish(scoreRef.current);
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
    setPos(50);
    setScore(0);
    setItems([]);
    setTimeLeft(durationSec);
    setRunning(true);
  };

  return (
    <div>
      <div
        className="relative h-[260px] rounded-2xl overflow-hidden border-4 border-[var(--border)] select-none"
        style={{ background: "linear-gradient(#1e1b4b, #0f172a)" }}
        role="img"
        aria-label="Meme Dodge game field"
      >
        {susSense && running && nextWarningX != null && (
          <div
            className="absolute top-0 bottom-0 w-8 -translate-x-1/2 bg-red-500/15 border-x border-dashed border-red-400/50 pointer-events-none"
            style={{ left: `${nextWarningX}%` }}
            title="Imposter Sense: next hazard lane"
          />
        )}
        {items.map((it) => (
          <div
            key={it.id}
            className="absolute -translate-x-1/2 px-2 py-0.5 rounded bg-red-500 text-white text-[11px] font-bold shadow"
            style={{ left: `${it.x}%`, top: `${it.y}%` }}
          >
            {it.label}
          </div>
        ))}
        <div
          className="absolute text-4xl transition-all duration-75"
          style={{ left: `${pos}%`, bottom: 8, transform: "translateX(-50%)" }}
        >
          👾
        </div>
        <div className="absolute top-2 left-2 text-white text-xs font-bold bg-black/50 px-2 py-1 rounded-lg">
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
          onClick={() => setPos((p) => Math.max(8, p - 12))}
        >
          ◀️
        </button>
        {!running && (
          <button
            type="button"
            aria-label="Start Meme Dodge"
            className="flex-1 py-3 rounded-xl bg-[var(--accent)] text-black font-bold"
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
          onClick={() => setPos((p) => Math.min(92, p + 12))}
        >
          ▶️
        </button>
      </div>
      <p className="text-xs text-[var(--dim)] mt-2">
        Dodge falling bad labels (arrow keys / A-D or buttons). Each dodge = +1 score.
        {susSense ? " Imposter Sense active: red lane previews the next drop!" : ""}
      </p>
    </div>
  );
}
