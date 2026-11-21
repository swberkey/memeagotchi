import type { MilestonePowers, MiniGameId, SpeciesId } from "@memeagotchi/game-core";

export const SCREEN_W = 280;
export const SCREEN_H = 240;

export type GamepadButton = "up" | "down" | "left" | "right" | "o" | "x" | "menu";

export interface GamepadController {
  readonly pressed: Record<GamepadButton, boolean>;
  press(btn: GamepadButton): void;
  release(btn: GamepadButton): void;
  releaseAll(): void;
  subscribeEdge(listener: (btn: GamepadButton) => void): () => void;
  subscribeState(listener: (pressed: Readonly<Record<GamepadButton, boolean>>) => void): () => void;
}

export function createGamepadController(): GamepadController {
  const pressed: Record<GamepadButton, boolean> = {
    up: false,
    down: false,
    left: false,
    right: false,
    o: false,
    x: false,
    menu: false,
  };
  const edgeListeners = new Set<(btn: GamepadButton) => void>();
  const stateListeners = new Set<(p: Readonly<Record<GamepadButton, boolean>>) => void>();

  const emitState = () => {
    const snap = { ...pressed };
    for (const fn of stateListeners) fn(snap);
  };

  return {
    pressed,
    press(btn) {
      if (pressed[btn]) return;
      pressed[btn] = true;
      for (const fn of edgeListeners) fn(btn);
      emitState();
    },
    release(btn) {
      if (!pressed[btn]) return;
      pressed[btn] = false;
      emitState();
    },
    releaseAll() {
      let changed = false;
      (Object.keys(pressed) as GamepadButton[]).forEach((k) => {
        if (pressed[k]) {
          pressed[k] = false;
          changed = true;
        }
      });
      if (changed) emitState();
    },
    subscribeEdge(listener) {
      edgeListeners.add(listener);
      return () => edgeListeners.delete(listener);
    },
    subscribeState(listener) {
      stateListeners.add(listener);
      return () => stateListeners.delete(listener);
    },
  };
}

export interface SnesGameBuffs {
  dogeSpeed: boolean;
  susSense: boolean;
  chadStrength: boolean;
}

export interface SnesGameConfig {
  species: SpeciesId;
  stage: number;
  equippedIds: readonly string[];
  soundOn: boolean;
  milestonePowers: MilestonePowers;
  buffs: SnesGameBuffs;
}

export interface SnesGameResult {
  score: number;
  maxCombo: number;
  cleared: boolean;
  headline: string;
}

export interface SnesEngineInstance {
  onButtonPress(btn: GamepadButton): void;
  update(dt: number, pressed: Readonly<Record<GamepadButton, boolean>>): SnesGameResult | null;
  render(ctx: CanvasRenderingContext2D): void;
}

export interface SnesArcadeCanvasProps {
  game: MiniGameId;
  species: SpeciesId;
  stage: number;
  equippedIds: readonly string[];
  soundOn: boolean;
  milestonePowers: MilestonePowers;
  buffs: SnesGameBuffs;
  bestScore?: number;
  controller?: GamepadController;
  captureKeyboard?: boolean;
  resultBanner?: string;
  onComplete: (result: { game: MiniGameId; score: number; maxCombo: number }) => void;
  onExit?: () => void;
  className?: string;
}
