import type { MemeImageKey } from "@memeagotchi/game-core";
import distracted from "./assets/memes/distracted.jpg";
import thisisfine from "./assets/memes/thisisfine.jpg";
import stonks from "./assets/memes/stonks.jpg";
import npc from "./assets/memes/npc.jpg";
import doge from "./assets/memes/doge.jpg";
import pepe from "./assets/memes/pepe.jpg";
import disaster from "./assets/memes/disaster.jpg";
import buttons from "./assets/memes/buttons.jpg";
import success from "./assets/memes/success.jpg";

export const MEME_IMAGES: Record<string, string> = {
  distracted,
  thisisfine,
  stonks,
  npc,
  doge,
  pepe,
  disaster,
  buttons,
  success,
};

export const MEME_TEMPLATES: readonly { key: MemeImageKey; name: string; emoji: string }[] = [
  { key: "distracted", name: "Distracted BF", emoji: "👀" },
  { key: "thisisfine", name: "This Is Fine", emoji: "🔥" },
  { key: "stonks", name: "Stonks", emoji: "📈" },
  { key: "npc", name: "NPC Wojak", emoji: "😐" },
  { key: "doge", name: "Doge", emoji: "🐕" },
  { key: "pepe", name: "Pepe", emoji: "🐸" },
  { key: "disaster", name: "Disaster Girl", emoji: "😏" },
  { key: "buttons", name: "Two Buttons", emoji: "😅" },
  { key: "success", name: "Success Kid", emoji: "✊" },
] as const;

export function resolveMemeImage(meme: { imageKey: string | null; imageUrl: string | null }): string | null {
  if (meme.imageUrl) return meme.imageUrl;
  if (meme.imageKey && MEME_IMAGES[meme.imageKey]) return MEME_IMAGES[meme.imageKey]!;
  return null;
}
