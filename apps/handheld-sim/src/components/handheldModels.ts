export type HandheldModelId = "dragon" | "cat" | "flower" | "mech" | "atomic";
export type BackdropThemeId =
  | "dragon-glade"
  | "kitty-loft"
  | "botanical-garden"
  | "robotics-lab"
  | "retro-workbench";

export interface HandheldModelDef {
  readonly id: HandheldModelId;
  readonly name: string;
  readonly shortName: string;
  readonly emoji: string;
  readonly swatch: string;
  readonly swatchAccent: string;
  readonly defaultBackdrop: BackdropThemeId;
  readonly subtitle: string;
  readonly menuLabelColor: string;
  readonly bezelTextColor: string;
  readonly dpadBg: string;
  readonly dpadBorder: string;
  readonly dpadIconColor: string;
  readonly dpadCenterBg: string;
  readonly dpadActiveBg: string;
  readonly xBg: string;
  readonly xBorder: string;
  readonly xText: string;
  readonly oBg: string;
  readonly oBorder: string;
  readonly oText: string;
  readonly menuBg: string;
  readonly menuBorder: string;
  readonly menuText: string;
  readonly lanyardPrimary: string;
  readonly lanyardSecondary: string;
  readonly lanyardAccent: string;
}

export interface BackdropThemeDef {
  readonly id: BackdropThemeId;
  readonly modelId: HandheldModelId;
  readonly name: string;
  readonly shortName: string;
  readonly emoji: string;
  readonly swatch: string;
  readonly description: string;
  readonly isLightTopBar: boolean;
}

export const HANDHELD_MODELS: readonly HandheldModelDef[] = [
  {
    id: "dragon",
    name: "Dragon Scale",
    shortName: "Dragon",
    emoji: "🐉",
    swatch: "#1b4e38",
    swatchAccent: "#ea6f17",
    defaultBackdrop: "dragon-glade",
    subtitle: "Forest Green & Ember Orange · Sculpted Horns & Scales",
    menuLabelColor: "#0e291d",
    bezelTextColor: "#ffd4a3",
    dpadBg: "linear-gradient(180deg, #fb8c2d 0%, #e1620e 65%, #be4a05 100%)",
    dpadBorder: "#8c3303",
    dpadIconColor: "#5e2102",
    dpadCenterBg: "#de600e",
    dpadActiveBg: "linear-gradient(180deg, #fde047 0%, #f59e0b 100%)",
    xBg: "radial-gradient(circle at 35% 30%, #ffa24c 0%, #ea6a12 65%, #b84805 100%)",
    xBorder: "#7a2c02",
    xText: "#5a1e00",
    oBg: "radial-gradient(circle at 35% 30%, #ffa24c 0%, #ea6a12 65%, #b84805 100%)",
    oBorder: "#7a2c02",
    oText: "#5a1e00",
    menuBg: "linear-gradient(180deg, #225c42 0%, #153c2b 100%)",
    menuBorder: "#0d261b",
    menuText: "#8ed4b0",
    lanyardPrimary: "#1d9148",
    lanyardSecondary: "#125c2e",
    lanyardAccent: "#4ade80",
  },
  {
    id: "cat",
    name: "Cozy Kitty",
    shortName: "Kitty",
    emoji: "🐱",
    swatch: "#7db8dd",
    swatchAccent: "#f8de72",
    defaultBackdrop: "kitty-loft",
    subtitle: "Sky Blue & Butter Yellow · Rounded Ears & Wave Trim",
    menuLabelColor: "#2d607d",
    bezelTextColor: "#1e4b66",
    dpadBg: "linear-gradient(180deg, #ffeb8a 0%, #f4d35e 65%, #dfb73b 100%)",
    dpadBorder: "#b58f22",
    dpadIconColor: "#8a6810",
    dpadCenterBg: "#f2cf58",
    dpadActiveBg: "linear-gradient(180deg, #ffffff 0%, #fde047 100%)",
    xBg: "radial-gradient(circle at 35% 30%, #fff2a8 0%, #f5d35e 65%, #d6ad30 100%)",
    xBorder: "#a8831c",
    xText: "#7a5b0c",
    oBg: "radial-gradient(circle at 35% 30%, #fff2a8 0%, #f5d35e 65%, #d6ad30 100%)",
    oBorder: "#a8831c",
    oText: "#7a5b0c",
    menuBg: "linear-gradient(180deg, #ffeb8a 0%, #e5be44 100%)",
    menuBorder: "#ad891e",
    menuText: "#70530b",
    lanyardPrimary: "#5ea4d4",
    lanyardSecondary: "#3d7aa6",
    lanyardAccent: "#bae6fd",
  },
  {
    id: "flower",
    name: "Bloom Petal",
    shortName: "Flower",
    emoji: "🌸",
    swatch: "#e9579e",
    swatchAccent: "#36b65b",
    defaultBackdrop: "botanical-garden",
    subtitle: "Bubblegum Pink & Leaf Green · Scalloped Petal Shell",
    menuLabelColor: "#851c52",
    bezelTextColor: "#d6ffe2",
    dpadBg: "linear-gradient(180deg, #ff85c0 0%, #ec539b 65%, #c7357b 100%)",
    dpadBorder: "#8c1e54",
    dpadIconColor: "#751444",
    dpadCenterBg: "#e9529a",
    dpadActiveBg: "linear-gradient(180deg, #ffd1e8 0%, #ff79b9 100%)",
    xBg: "radial-gradient(circle at 35% 30%, #ff93c7 0%, #ea529a 65%, #bd3175 100%)",
    xBorder: "#8a1b51",
    xText: "#6e103e",
    oBg: "radial-gradient(circle at 35% 30%, #ff93c7 0%, #ea529a 65%, #bd3175 100%)",
    oBorder: "#8a1b51",
    oText: "#6e103e",
    menuBg: "linear-gradient(180deg, #ff87c1 0%, #d9438b 100%)",
    menuBorder: "#8c1e54",
    menuText: "#6e103e",
    lanyardPrimary: "#eb65a4",
    lanyardSecondary: "#38b35a",
    lanyardAccent: "#fef08a",
  },
  {
    id: "mech",
    name: "Cyber Bot",
    shortName: "Cyber Bot",
    emoji: "🤖",
    swatch: "#7b848c",
    swatchAccent: "#1cb0c2",
    defaultBackdrop: "robotics-lab",
    subtitle: "Armored Gunmetal & Cyan Teal · Twin Antennae & Rivets",
    menuLabelColor: "#2d343a",
    bezelTextColor: "#aef5ff",
    dpadBg: "linear-gradient(180deg, #747d86 0%, #586068 65%, #41484f 100%)",
    dpadBorder: "#272c31",
    dpadIconColor: "#242a30",
    dpadCenterBg: "#576068",
    dpadActiveBg: "linear-gradient(180deg, #5eead4 0%, #06b6d4 100%)",
    xBg: "radial-gradient(circle at 35% 30%, #7d868f 0%, #586068 65%, #3c4248 100%)",
    xBorder: "#23282d",
    xText: "#1f2428",
    oBg: "radial-gradient(circle at 35% 30%, #7d868f 0%, #586068 65%, #3c4248 100%)",
    oBorder: "#23282d",
    oText: "#1f2428",
    menuBg: "linear-gradient(180deg, #68717a 0%, #4b525a 100%)",
    menuBorder: "#252a2f",
    menuText: "#cbd5e1",
    lanyardPrimary: "#475569",
    lanyardSecondary: "#1cb0c2",
    lanyardAccent: "#ea580c",
  },
  {
    id: "atomic",
    name: "Atomic Purple",
    shortName: "Atomic",
    emoji: "👾",
    swatch: "#6c47ab",
    swatchAccent: "#dc2626",
    defaultBackdrop: "retro-workbench",
    subtitle: "Clear Smoke-Violet · Exposed PCB & Classic Retro Buttons",
    menuLabelColor: "#d8c7ff",
    bezelTextColor: "#d8c7ff",
    dpadBg: "linear-gradient(180deg, #322d40 0%, #1c1926 65%, #0e0c14 100%)",
    dpadBorder: "#07060a",
    dpadIconColor: "#8b83a8",
    dpadCenterBg: "#1a1724",
    dpadActiveBg: "linear-gradient(180deg, #a78bfa 0%, #7c3aed 100%)",
    xBg: "radial-gradient(circle at 35% 30%, #ff5c6c 0%, #dc2626 65%, #991b1b 100%)",
    xBorder: "#5c0f15",
    xText: "#ffe4e6",
    oBg: "radial-gradient(circle at 35% 30%, #60a5fa 0%, #2563eb 65%, #1d4ed8 100%)",
    oBorder: "#172554",
    oText: "#dbeafe",
    menuBg: "linear-gradient(180deg, #2e2842 0%, #191529 100%)",
    menuBorder: "#0b0814",
    menuText: "#c4b5fd",
    lanyardPrimary: "#24222c",
    lanyardSecondary: "#0e0d12",
    lanyardAccent: "#524c66",
  },
] as const;

export const BACKDROP_THEMES: readonly BackdropThemeDef[] = [
  {
    id: "dragon-glade",
    modelId: "dragon",
    name: "Emerald Dragon Glade",
    shortName: "Glade",
    emoji: "🌲",
    swatch: "linear-gradient(135deg, #103b2a, #ea6f17)",
    description: "Sunlit emerald woodland canopy, carved moss runes & drifting embers",
    isLightTopBar: false,
  },
  {
    id: "kitty-loft",
    modelId: "cat",
    name: "Sunlit Kitty Loft",
    shortName: "Kitty Loft",
    emoji: "☀️",
    swatch: "linear-gradient(135deg, #8cc8e8, #fde68a)",
    description: "Warm pastel sky & sunlit bedroom window glow with cozy paw prints",
    isLightTopBar: false,
  },
  {
    id: "botanical-garden",
    modelId: "flower",
    name: "Botanical Glasshouse",
    shortName: "Garden",
    emoji: "🌺",
    swatch: "linear-gradient(135deg, #228848, #f472b6)",
    description: "Sun-dappled conservatory vines, blooming petals & spring morning light",
    isLightTopBar: false,
  },
  {
    id: "robotics-lab",
    modelId: "mech",
    name: "Cyber Robotics Lab",
    shortName: "Cyber Lab",
    emoji: "⚙️",
    swatch: "linear-gradient(135deg, #1e293b, #06b6d4)",
    description: "Dark steel blueprint workbench with holographic cyan telemetry rings",
    isLightTopBar: false,
  },
  {
    id: "retro-workbench",
    modelId: "atomic",
    name: "90s Maker Workbench",
    shortName: "Workbench",
    emoji: "🪵",
    swatch: "linear-gradient(135deg, #6b4423, #7c3aed)",
    description: "Warm timber electronics workbench with tungsten glow & violet synth haze",
    isLightTopBar: false,
  },
] as const;

export function getHandheldModel(id: string | null | undefined): HandheldModelDef {
  return HANDHELD_MODELS.find((m) => m.id === id) ?? HANDHELD_MODELS[0]!;
}

export function getBackdropTheme(id: string | null | undefined): BackdropThemeDef {
  return BACKDROP_THEMES.find((b) => b.id === id) ?? BACKDROP_THEMES[0]!;
}
