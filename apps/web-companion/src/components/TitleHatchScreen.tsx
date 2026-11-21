import { SPECIES_CATALOG, type GameView, type SpeciesId } from "@memeagotchi/game-core";
import { MemeMonster, StarterEgg } from "@memeagotchi/monster-ui";
import { useState } from "react";

function StatPipBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 text-[var(--dim)] font-semibold">{label}</span>
      <div className="flex gap-1 flex-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className="h-2.5 flex-1 rounded-sm border border-[#141026]"
            style={{
              background: i <= value ? color : "rgba(255,255,255,0.1)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function TitleHatchScreen({
  view,
  handheldUrl,
  hatching,
  onContinue,
  onHatch,
  onToggleClock,
  onToggleSound,
}: {
  view: GameView;
  handheldUrl: string;
  hatching: boolean;
  onContinue: () => void;
  onHatch: (species: SpeciesId, name: string) => void;
  onToggleClock: () => void;
  onToggleSound: () => void;
}) {
  const [subView, setSubView] = useState<"title" | "picker">(view.hatched ? "title" : "picker");
  const [selectedSpecies, setSelectedSpecies] = useState<SpeciesId>(view.monster.species ?? "mint-dragon");
  const [previewStage, setPreviewStage] = useState<1 | 2 | 3>(1);
  const [customName, setCustomName] = useState("");

  const sp = SPECIES_CATALOG.find((s) => s.id === selectedSpecies) ?? SPECIES_CATALOG[0]!;
  const m = view.monster;

  return (
    <div className="min-h-screen bg-[var(--bg)] app-texture text-[var(--text)] px-4 py-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-2xl space-y-5">
        {/* Title Hero Header */}
        <header className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface2)] border border-[var(--border)] text-[11px] font-bold text-[var(--accent)]">
            <span>📟 1.69" 280×240 IPS EDITION</span>
            <span>·</span>
            <span>5 PLAYABLE STARTERS</span>
          </div>
          <h1 className="font-pixel text-3xl sm:text-4xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#7be6d8] via-[#fde047] to-[#f472b6]">
            MEMEAGOTCHI
          </h1>
          <p className="text-sm text-[var(--dim)] max-w-md mx-auto">
            Raise a meme-powered pocket monster across the Web Companion and the 280×240 ESP32-S3 Handheld.
          </p>
        </header>

        {subView === "title" && view.hatched ? (
          <section className="rounded-[2rem] panel border-2 border-[var(--border)] p-5 sm:p-6 space-y-5">
            {/* Active Pet Showcase */}
            <div
              className="rounded-3xl p-4 border-2 border-[#282b47]/20 flex flex-col sm:flex-row items-center gap-4"
              style={{
                background: "linear-gradient(155deg, #dff8ff 0%, #eefcf9 55%, #f4edff 100%)",
              }}
            >
              <div className="w-36 h-36 shrink-0 anim-bob">
                <MemeMonster
                  species={m.species}
                  displayStage={m.displayStage}
                  actualStage={m.stage}
                  mood={m.isRoasted ? "roasted" : m.isSleeping ? "sleeping" : "excited"}
                  equipped={view.equippedItems}
                />
              </div>
              <div className="text-center sm:text-left text-[#282b47] space-y-1 flex-1 min-w-0">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#282b47] text-[#7be6d8]">
                  <span>{m.speciesDef.name}</span>
                  <span>·</span>
                  <span>Stage {m.stage} {m.stageName}</span>
                </div>
                <h2 className="font-pixel text-2xl truncate">{m.name}</h2>
                <p className="text-xs font-semibold text-[#282b47]/75">
                  ⭐ {m.xp.toLocaleString()} XP · 💧 {m.drip} Drip · 🔥 {m.careStreak.count}d Care Streak
                </p>
                <p className="text-xs text-[#282b47]/70">
                  Signature X Move: <b>{m.speciesDef.specialMove.name}</b>
                </p>
              </div>
            </div>

            {/* Primary Title Actions */}
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={onContinue}
                className="sm:col-span-2 py-3.5 px-5 rounded-2xl bg-gradient-to-r from-[#7be6d8] to-[#5eead4] text-[#141026] font-pixel text-base shadow-lg hover:brightness-105"
              >
                ▶ CONTINUE WITH {m.name.toUpperCase()}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedSpecies(m.species);
                  setCustomName("");
                  setSubView("picker");
                }}
                className="py-3 px-4 rounded-2xl bg-[var(--surface2)] border-2 border-[var(--accent2)]/60 text-white font-bold text-sm hover:border-[var(--accent2)]"
              >
                🥚 New Starter Pet
              </button>
              <a
                href={handheldUrl}
                target="_blank"
                rel="noreferrer"
                className="py-3 px-4 rounded-2xl bg-[#ffd23f] text-[#141026] font-bold text-sm text-center hover:brightness-105"
              >
                📟 Launch 280×240 Handheld ↗
              </a>
            </div>

            {/* Quick Settings Row */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs">
              <button
                type="button"
                onClick={onToggleClock}
                className="px-3 py-1.5 rounded-full bg-[var(--bg)]/60 border border-[var(--border)] font-bold hover:border-[var(--accent)]"
              >
                ⏱ Speed: {view.settings.clock === 60 ? "Demo 60×" : "Real-Time 1×"}
              </button>
              <button
                type="button"
                onClick={onToggleSound}
                className="px-3 py-1.5 rounded-full bg-[var(--bg)]/60 border border-[var(--border)] font-bold hover:border-[var(--accent)]"
              >
                {view.settings.soundOn ? "🔊 Sound: ON" : "🔇 Sound: OFF"}
              </button>
            </div>
          </section>
        ) : (
          <section className="rounded-[2rem] panel border-2 border-[var(--border)] p-4 sm:p-6 space-y-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-pixel text-lg text-[var(--accent)]">CHOOSE YOUR STARTER</h2>
                <p className="text-xs text-[var(--dim)]">
                  Each species has unique stat curves, voice banter, and an exclusive <b>X</b> SNES Special Move!
                </p>
              </div>
              {view.hatched && (
                <button
                  type="button"
                  onClick={() => setSubView("title")}
                  className="px-3 py-1.5 rounded-xl bg-[var(--bg)]/60 border border-[var(--border)] text-xs font-bold shrink-0"
                >
                  ← Back
                </button>
              )}
            </div>

            {/* 5 Starter Egg Selector Strip */}
            <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Starter species">
              {SPECIES_CATALOG.map((item) => {
                const active = item.id === selectedSpecies;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      setSelectedSpecies(item.id);
                      setPreviewStage(1);
                    }}
                    className={`rounded-2xl p-2 border-2 flex flex-col items-center gap-1 transition-all ${
                      active
                        ? "bg-[var(--bg)]/80 shadow-lg scale-[1.03]"
                        : "bg-[var(--bg)]/35 border-[var(--border)] opacity-75 hover:opacity-100"
                    }`}
                    style={active ? { borderColor: item.accentColor } : undefined}
                  >
                    <StarterEgg species={item.id} size={48} wobble={active} />
                    <span className="text-[11px] font-bold leading-tight text-center">{item.name}</span>
                    <span className="text-[10px] text-[var(--dim)]">{item.defaultPetName}</span>
                  </button>
                );
              })}
            </div>

            {/* Selected Starter Spotlight Card */}
            <div className="rounded-3xl bg-[var(--bg)]/65 border-2 p-4 sm:p-5 grid sm:grid-cols-[190px_1fr] gap-4 items-center" style={{ borderColor: sp.accentColor }}>
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-44 h-44 rounded-2xl p-2 flex items-center justify-center relative border-2 border-[#282b47]/20"
                  style={{
                    background: `radial-gradient(circle at 50% 35%, #ffffff 0%, ${sp.eggColors[0]} 68%, ${sp.eggColors[1]} 100%)`,
                  }}
                >
                  <div className="w-36 h-36 anim-bob">
                    <MemeMonster species={sp.id} displayStage={previewStage} actualStage={previewStage} mood="excited" />
                  </div>
                </div>
                <div className="flex gap-1 text-[10px] font-bold">
                  {([1, 2, 3] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setPreviewStage(st)}
                      className={`px-2 py-0.5 rounded-full border ${
                        previewStage === st
                          ? "bg-[var(--accent)] text-[#141026] border-[var(--accent)]"
                          : "bg-[var(--surface)] border-[var(--border)] text-[var(--dim)]"
                      }`}
                    >
                      {st === 1 ? "Baby" : st === 2 ? "Teen" : "Adult"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 min-w-0">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-pixel text-xl" style={{ color: sp.accentColor }}>
                      {sp.name}
                    </h3>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 font-semibold text-white">
                      {sp.title}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--dim)] mt-1">{sp.tagline}</p>
                </div>

                {/* Stat bars */}
                <div className="space-y-1.5">
                  <StatPipBar label="Speed" value={sp.statBars.speed} color="#38bdf8" />
                  <StatPipBar label="Stamina" value={sp.statBars.stamina} color="#4ade80" />
                  <StatPipBar label="Spice" value={sp.statBars.spice} color="#fb7185" />
                  <StatPipBar label="Luck" value={sp.statBars.luck} color="#fde047" />
                </div>

                {/* Perk & Tradeoff */}
                <div className="space-y-1 text-xs">
                  <p className="text-emerald-300 font-semibold">✦ {sp.perkSummary}</p>
                  <p className="text-amber-300/90">⚖️ {sp.tradeoffSummary}</p>
                </div>

                {/* Signature X Special */}
                <div className="rounded-xl bg-[var(--surface2)] border border-[var(--border)] px-3 py-2">
                  <p className="text-[11px] font-pixel" style={{ color: sp.accentColor }}>
                    X SPECIAL · {sp.specialMove.name.toUpperCase()}
                  </p>
                  <p className="text-xs text-[var(--dim)] mt-0.5">{sp.specialMove.description}</p>
                </div>
              </div>
            </div>

            {/* Name + Hatch Form */}
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                onHatch(sp.id, customName.trim() || sp.defaultPetName);
              }}
            >
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  aria-label="Starter pet name"
                  maxLength={24}
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder={`Name your ${sp.name} (default: ${sp.defaultPetName})…`}
                  className="flex-1 bg-[var(--bg)]/70 border-2 border-[var(--border)] rounded-2xl px-4 py-3 text-sm focus:border-[var(--accent)] outline-none"
                />
                <button
                  type="submit"
                  disabled={hatching}
                  className="px-6 py-3 rounded-2xl font-pixel text-sm text-[#141026] shadow-lg disabled:opacity-50 shrink-0"
                  style={{ background: `linear-gradient(90deg, ${sp.accentColor}, #fde047)` }}
                >
                  {hatching ? "HATCHING…" : `🥚 HATCH ${(customName.trim() || sp.defaultPetName).toUpperCase()}!`}
                </button>
              </div>
              {view.hatched && (
                <p className="text-[11px] text-amber-300/85 text-center">
                  Note: MemeAgotchi uses 1 active pet slot (matching the pocket hardware). Hatching replaces {m.name}.
                </p>
              )}
            </form>

            {/* Footer mode switch */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[var(--border)]/60 text-xs">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onToggleClock}
                  className="px-2.5 py-1 rounded-full bg-[var(--bg)]/60 border border-[var(--border)] font-bold"
                >
                  ⏱ {view.settings.clock === 60 ? "Demo 60×" : "Real-Time 1×"}
                </button>
                <button
                  type="button"
                  onClick={onToggleSound}
                  className="px-2.5 py-1 rounded-full bg-[var(--bg)]/60 border border-[var(--border)] font-bold"
                >
                  {view.settings.soundOn ? "🔊 Sound On" : "🔇 Muted"}
                </button>
              </div>
              <a
                href={handheldUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[#ffd23f] font-bold hover:underline"
              >
                📟 Switch to 280×240 Handheld Sim ↗
              </a>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
