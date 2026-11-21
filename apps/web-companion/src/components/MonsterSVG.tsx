import type { Mood, SpeciesId } from "@memeagotchi/game-core";
import { MemeMonster, type EquippedDisplayItem } from "@memeagotchi/monster-ui";
import { useState } from "react";

export type { EquippedDisplayItem };

const HEART_OFFSETS = ["-34px", "0px", "34px", "-18px", "22px"];

export function MonsterSVG({
  species = "mint-dragon",
  name = "your pet",
  displayStage,
  actualStage,
  mood,
  sleeping,
  roasted,
  equipped,
  onPet,
}: {
  species?: SpeciesId;
  name?: string;
  displayStage: number;
  actualStage: number;
  mood: Mood;
  sleeping: boolean;
  roasted: boolean;
  equipped: EquippedDisplayItem[];
  onPet?: () => void;
}) {
  const [petBurstId, setPetBurstId] = useState(0);

  const handlePet = () => {
    if (!onPet) return;
    setPetBurstId((n) => n + 1);
    onPet();
  };

  const visualMood: Mood = roasted ? "roasted" : sleeping ? "sleeping" : mood;

  return (
    <div
      onClick={handlePet}
      role={onPet ? "button" : undefined}
      tabIndex={onPet ? 0 : undefined}
      onKeyDown={
        onPet
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handlePet();
              }
            }
          : undefined
      }
      title={onPet ? `Tap to pet ${name}!` : undefined}
      className={`relative mx-auto w-[216px] h-[206px] select-none ${onPet ? "cursor-pointer" : ""}`}
    >
      <div
        key={petBurstId > 0 ? `pop-${petBurstId}` : "idle"}
        className={`h-full w-full ${
          petBurstId > 0 ? "anim-pet-pop" : sleeping ? "" : "anim-bob"
        }`}
      >
        <MemeMonster
          species={species}
          displayStage={displayStage}
          actualStage={actualStage}
          mood={visualMood}
          equipped={equipped}
        />
      </div>

      {/* Floating heart/sparkle burst when player taps their monster */}
      {petBurstId > 0 && (
        <div key={petBurstId} className="pointer-events-none absolute inset-0" aria-hidden>
          {HEART_OFFSETS.map((dx, i) => (
            <span
              key={i}
              className="anim-heart-float absolute text-lg"
              style={{
                left: "50%",
                top: "36%",
                animationDelay: `${i * 0.05}s`,
                ["--dx" as string]: dx,
              }}
            >
              {i % 2 === 0 ? "💖" : "✨"}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
