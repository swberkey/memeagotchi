import { useEffect, useRef, useState } from "react";

const MATCH_PAIRS = [
  ["😂", "tasty"],
  ["🌶️", "spicy"],
  ["🤢", "blech"],
  ["📈", "stonks"],
  ["🐸", "classic"],
  ["💀", "bruh"],
] as const;

interface Card {
  key: string;
  pair: number;
  face: string;
}

function buildShuffledDeck(): Card[] {
  const cards: Card[] = MATCH_PAIRS.flatMap(([emoji, label], i) => [
    { key: `${i}-a`, pair: i, face: emoji },
    { key: `${i}-b`, pair: i, face: label },
  ]);
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j]!, cards[i]!];
  }
  return cards;
}

export function LabelMatch({
  susSense,
  onDone,
}: {
  susSense: boolean;
  onDone: (score: number) => void;
}) {
  const [deck, setDeck] = useState<Card[]>(() => buildShuffledDeck());
  const [flipped, setFlipped] = useState<string[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [completed, setCompleted] = useState(false);

  const flipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // Clean up any pending flip timeout on unmount (fixes memory/state leak)
  useEffect(() => {
    return () => {
      if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
    };
  }, []);

  const reset = () => {
    if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
    setDeck(buildShuffledDeck());
    setFlipped([]);
    setMatched([]);
    setMoves(0);
    setStartedAt(Date.now());
    setCompleted(false);
  };

  const flip = (card: Card) => {
    if (completed || flipped.includes(card.key) || matched.includes(card.pair) || flipped.length >= 2) {
      return;
    }
    const nextFlipped = [...flipped, card.key];
    setFlipped(nextFlipped);

    if (nextFlipped.length === 2) {
      const nextMoves = moves + 1;
      setMoves(nextMoves);
      const pairCards = deck.filter((d) => nextFlipped.includes(d.key));
      const a = pairCards[0];
      const b = pairCards[1];

      flipTimerRef.current = setTimeout(() => {
        if (a && b && a.pair === b.pair) {
          const nextMatched = [...matched, a.pair];
          setMatched(nextMatched);
          if (nextMatched.length === MATCH_PAIRS.length) {
            setCompleted(true);
            const elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
            const score = Math.max(5, Math.min(35, 90 - elapsedSec - nextMoves));
            onDoneRef.current(score);
          }
        }
        setFlipped([]);
      }, 550);
    }
  };

  // Imposter Sense (`sus`) reveals which pair #0 cards are as a subtle cyan outline
  const hintPair = susSense ? MATCH_PAIRS.findIndex((_, i) => !matched.includes(i)) : -1;

  return (
    <div>
      <div className="grid grid-cols-4 gap-2">
        {deck.map((c) => {
          const open = flipped.includes(c.key) || matched.includes(c.pair);
          const isSusHint = !open && susSense && c.pair === hintPair;
          return (
            <button
              type="button"
              key={c.key}
              aria-label={open ? `Card ${c.face}` : "Face-down card"}
              onClick={() => flip(c)}
              className={`h-16 rounded-xl border-2 text-sm font-bold transition-colors ${
                open
                  ? "bg-[var(--viewport)] text-black border-[var(--accent)]"
                  : isSusHint
                    ? "bg-[var(--surface2)] border-cyan-400"
                    : "bg-[var(--surface2)] border-[var(--border)]"
              }`}
            >
              {open ? c.face : "❓"}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-2 mt-2">
        <p className="text-xs text-[var(--dim)]">
          Matched: {matched.length}/{MATCH_PAIRS.length} · Moves: {moves}
          {susSense ? " · 👁️ Sus Sense highlighting next pair" : ""}
        </p>
        {completed && (
          <button
            type="button"
            onClick={reset}
            className="px-3 py-1 rounded-lg bg-[var(--accent)] text-black font-bold text-xs"
          >
            Play Again
          </button>
        )}
      </div>
    </div>
  );
}
