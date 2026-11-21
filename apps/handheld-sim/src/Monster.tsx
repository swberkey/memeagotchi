import type { Mood, SpeciesId } from "@memeagotchi/game-core";
import { MemeMonster, type EquippedDisplayItem } from "@memeagotchi/monster-ui";

export type EquippedItem = EquippedDisplayItem;

/**
 * Handheld 320x240 (4:3) landscape monster renderer — delegates directly to the unified
 * @memeagotchi/monster-ui 5-species × 5-stage + 12-cosmetic character kit
 * so Companion and Handheld stay 100% cohesive.
 */
export function Monster({
  species = "mint-dragon",
  stage,
  actualStage,
  mood,
  equipped,
}: {
  species?: SpeciesId;
  stage: number;
  actualStage?: number;
  mood: Mood;
  equipped: EquippedItem[];
}) {
  return (
    <MemeMonster
      species={species}
      displayStage={stage}
      actualStage={actualStage ?? stage}
      mood={mood}
      equipped={equipped}
      className="h-full w-full"
    />
  );
}
