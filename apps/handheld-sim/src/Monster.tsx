import type { Mood } from "@memeagotchi/game-core";
import { MemeMonster, type EquippedDisplayItem } from "@memeagotchi/monster-ui";

export type EquippedItem = EquippedDisplayItem;

/**
 * Handheld 192x192 monster renderer — delegates directly to the unified
 * @memeagotchi/monster-ui mint/lavender 5-stage + 12-cosmetic character kit
 * so Companion and Handheld look 100% cohesive.
 */
export function Monster({
  stage,
  actualStage,
  mood,
  equipped,
}: {
  stage: number;
  actualStage?: number;
  mood: Mood;
  equipped: EquippedItem[];
}) {
  return (
    <MemeMonster
      displayStage={stage}
      actualStage={actualStage ?? stage}
      mood={mood}
      equipped={equipped}
      className="h-full w-full"
    />
  );
}
