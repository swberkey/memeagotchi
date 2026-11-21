import { useEffect, useRef, useState } from "react";
import { uploadMemeBlob } from "../api";

const CANVAS_W = 640;
const CANVAS_H = 480;
const STICKERS = ["", "🔥", "💀", "👑", "🌶️", "💎", "🚀", "😭", "✨"] as const;
type Corner = "tr" | "tl" | "br" | "bl";
type TextSize = "sm" | "md" | "lg";

function drawCaptionBlock(
  ctx: CanvasRenderingContext2D,
  rawText: string,
  yAnchor: number,
  fromBottom: boolean,
  fontPx: number,
) {
  const clean = rawText.trim().toUpperCase();
  if (!clean) return;
  ctx.font = `900 ${fontPx}px Impact, "Arial Black", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(5, Math.round(fontPx * 0.16));
  ctx.strokeStyle = "#080614";
  ctx.fillStyle = "#ffffff";

  const maxW = CANVAS_W - 44;
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const cand = line ? `${line} ${w}` : w;
    if (ctx.measureText(cand).width <= maxW || !line) {
      line = cand;
    } else {
      lines.push(line);
      line = w;
      if (lines.length === 2) break;
    }
  }
  if (line && lines.length < 2) lines.push(line);

  const lineH = fontPx * 1.12;
  lines.forEach((ln, idx) => {
    const y = fromBottom
      ? yAnchor - (lines.length - 1 - idx) * lineH
      : yAnchor + idx * lineH;
    ctx.strokeText(ln, CANVAS_W / 2, y);
    ctx.fillText(ln, CANVAS_W / 2, y);
  });
}

export function MemeCaptionStudio({
  sourceUrl,
  onApply,
  onClose,
}: {
  sourceUrl: string;
  onApply: (uploadedUrl: string, suggestedCaption: string) => void;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const [topText, setTopText] = useState("");
  const [bottomText, setBottomText] = useState("");
  const [textSize, setTextSize] = useState<TextSize>("md");
  const [fitMode, setFitMode] = useState<"contain" | "cover">("contain");
  const [sticker, setSticker] = useState<(typeof STICKERS)[number]>("");
  const [corner, setCorner] = useState<Corner>("tr");
  const [saving, setSaving] = useState(false);

  // Load source image cleanly
  useEffect(() => {
    setLoaded(false);
    setLoadErr("");
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      setLoaded(true);
    };
    img.onerror = () => {
      setLoadErr("Could not load image into Meme Studio.");
    };
    img.src = sourceUrl;
  }, [sourceUrl]);

  // Redraw 640x480 4:3 preview canvas on every edit
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !loaded || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#0e0b20";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const iw = img.naturalWidth || CANVAS_W;
    const ih = img.naturalHeight || CANVAS_H;

    if (fitMode === "contain") {
      // Soft blurred ambient fill behind fit-all uncropped meme
      const coverScale = Math.max(CANVAS_W / iw, CANVAS_H / ih) * 1.08;
      const cw = iw * coverScale;
      const ch = ih * coverScale;
      ctx.save();
      ctx.filter = "blur(14px) brightness(0.45)";
      ctx.drawImage(img, (CANVAS_W - cw) / 2, (CANVAS_H - ch) / 2, cw, ch);
      ctx.restore();

      // Uncropped fit-everything foreground
      const fitScale = Math.min(CANVAS_W / iw, CANVAS_H / ih);
      const fw = iw * fitScale;
      const fh = ih * fitScale;
      ctx.drawImage(img, (CANVAS_W - fw) / 2, (CANVAS_H - fh) / 2, fw, fh);
    } else {
      const coverScale = Math.max(CANVAS_W / iw, CANVAS_H / ih);
      const cw = iw * coverScale;
      const ch = ih * coverScale;
      ctx.drawImage(img, (CANVAS_W - cw) / 2, (CANVAS_H - ch) / 2, cw, ch);
    }

    // Optional sticker stamp
    if (sticker) {
      ctx.save();
      ctx.font = "64px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const sx = corner === "tl" || corner === "bl" ? 58 : CANVAS_W - 58;
      const sy = corner === "tl" || corner === "tr" ? 66 : CANVAS_H - 66;
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 10;
      ctx.fillText(sticker, sx, sy);
      ctx.restore();
    }

    const fontPx = textSize === "sm" ? 36 : textSize === "lg" ? 56 : 46;
    drawCaptionBlock(ctx, topText, 44, false, fontPx);
    drawCaptionBlock(ctx, bottomText, CANVAS_H - 44, true, fontPx);
  }, [loaded, topText, bottomText, textSize, fitMode, sticker, corner]);

  const handleRender = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    setLoadErr("");
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Canvas export failed."))),
          "image/jpeg",
          0.92,
        );
      });
      const url = await uploadMemeBlob(blob, "image/jpeg");
      const combinedCaption = [topText.trim(), bottomText.trim()].filter(Boolean).join(" / ");
      onApply(url, combinedCaption);
    } catch (err) {
      setLoadErr(err instanceof Error ? err.message : "Failed to save captioned meme.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#fde047]/45 bg-[#120e29] p-3.5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-pixel text-xs text-[#fde047]">✨ MEME CAPTION STUDIO (4:3 HANDHELD READY)</p>
          <p className="text-[11px] text-[var(--dim)]">
            Add classic top/bottom Impact text &amp; stickers — renders cleanly for Web &amp; 320×240 Handheld!
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-white/15 bg-white/8 px-2.5 py-1 text-[11px] font-bold text-white/80 hover:text-white"
        >
          ✕ Close
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/15 bg-black">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          aria-label="Live meme caption studio preview"
          className="block w-full aspect-[4/3]"
        />
      </div>

      {loadErr && <p className="text-xs font-bold text-rose-300">⚠️ {loadErr}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          aria-label="Top meme caption"
          value={topText}
          onChange={(e) => setTopText(e.target.value)}
          maxLength={60}
          placeholder="TOP TEXT (e.g. WHEN THE MEME)"
          className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs font-bold uppercase tracking-wide"
        />
        <input
          aria-label="Bottom meme caption"
          value={bottomText}
          onChange={(e) => setBottomText(e.target.value)}
          maxLength={60}
          placeholder="BOTTOM TEXT (e.g. HITS 100 POWER)"
          className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs font-bold uppercase tracking-wide"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-1">
          <span className="text-[var(--dim)] font-bold">Size:</span>
          {(["sm", "md", "lg"] as const).map((sz) => (
            <button
              key={sz}
              type="button"
              onClick={() => setTextSize(sz)}
              className={`rounded-lg px-2 py-1 font-bold uppercase border ${
                textSize === sz
                  ? "border-[#fde047] bg-[#fde047] text-[#141026]"
                  : "border-white/12 bg-white/5 text-[var(--dim)]"
              }`}
            >
              {sz}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[var(--dim)] font-bold">Fit:</span>
          {(
            [
              ["contain", "Fit All"],
              ["cover", "Fill"],
            ] as const
          ).map(([id, lbl]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFitMode(id)}
              className={`rounded-lg px-2 py-1 font-bold border ${
                fitMode === id
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[#141026]"
                  : "border-white/12 bg-white/5 text-[var(--dim)]"
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[var(--dim)] font-bold">Stamp:</span>
          {STICKERS.map((st) => (
            <button
              key={st || "none"}
              type="button"
              onClick={() => setSticker(st)}
              className={`rounded-lg px-2 py-1 border font-bold ${
                sticker === st
                  ? "border-[#fde047] bg-[#fde047]/20 text-white"
                  : "border-white/10 bg-white/5 text-[var(--dim)]"
              }`}
            >
              {st || "None"}
            </button>
          ))}
        </div>
        {sticker && (
          <div className="flex items-center gap-1">
            {(["tl", "tr", "bl", "br"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCorner(c)}
                className={`rounded px-1.5 py-0.5 uppercase font-mono text-[10px] font-bold border ${
                  corner === c ? "border-[#7be6d8] text-[#7be6d8]" : "border-white/10 text-[var(--dim)]"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={!loaded || saving}
        onClick={() => void handleRender()}
        className="w-full rounded-xl bg-gradient-to-r from-[#fde047] to-[#7be6d8] py-2.5 text-xs font-extrabold text-[#141026] disabled:opacity-40"
      >
        {saving ? "Rendering & Uploading…" : "✨ Apply Captioned Meme to Post"}
      </button>
    </div>
  );
}
