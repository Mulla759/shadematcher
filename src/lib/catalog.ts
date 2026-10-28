import type { DepthKey, PaletteColour, Season, Undertone } from "./skin";
import { SEASONS } from "./skin";
import { deltaE2000, hexToLab, labToHex, type Lab } from "./color";

export type FabricFamily =
  | "Neutral"
  | "Red"
  | "Pink"
  | "Orange"
  | "Yellow"
  | "Green"
  | "Blue"
  | "Purple"
  | "Metallic";

export type FabricFinish = "Matte" | "Satin" | "Crinkle" | "Modal" | "Chiffon";

export interface FabricColour {
  id: string;
  name: string;
  hex: string;
  lab: Lab;
  family: FabricFamily;
  finish: FabricFinish;
  note: string;
  tags: string[];
}

export interface FoundationShade {
  id: string;
  brand: string;
  code: string;
  name: string;
  hex: string;
  lab: Lab;
  depth: DepthKey;
  undertone: Undertone;
  finish: "Matte" | "Satin" | "Radiant";
  coverage: "Sheer" | "Medium" | "Full";
}

type FabricSeed = [id: string, name: string, hex: string, family: FabricFamily, finish: FabricFinish];

const FAMILY_NOTES: Record<FabricFamily, string> = {
  Neutral: "A quiet ground that lets the face lead.",
  Red: "A warm signal colour with real presence at the face.",
  Pink: "Softer reds that read as skin-adjacent or deliberately romantic.",
  Orange: "Spice and earth: the warmest end of the wheel.",
  Yellow: "Light-giving colour; small shifts in depth change everything.",
  Green: "The widest family — from cool emerald to dusty olive.",
  Blue: "Cool, clarifying and often the easiest contrast for warm skin.",
  Purple: "Dusk tones that flatter cool and olive complexions.",
  Metallic: "Reflective surfaces read lighter and pick up surrounding colour.",
};

const TAG_BY_FAMILY: Record<FabricFamily, string[]> = {
  Neutral: ["core", "everyday"],
  Red: ["statement", "warm"],
  Pink: ["romantic", "soft"],
  Orange: ["earth", "warm"],
  Yellow: ["bright", "warm"],
  Green: ["versatile", "earth"],
  Blue: ["cool", "clarifying"],
  Purple: ["jewel", "cool"],
  Metallic: ["occasion", "reflective"],
};

const FABRIC_SEEDS: FabricSeed[] = [
  ["f01", "Chalk", "#F7F3EA", "Neutral", "Chiffon"],
  ["f02", "Bone", "#EDE6D8", "Neutral", "Matte"],
  ["f03", "Parchment", "#E6D6BE", "Neutral", "Crinkle"],
  ["f04", "Oat", "#D6C2A4", "Neutral", "Modal"],
  ["f05", "Sand", "#C4A984", "Neutral", "Satin"],
  ["f06", "Camel", "#B08A5E", "Neutral", "Matte"],
  ["f07", "Taupe", "#9B8874", "Neutral", "Modal"],
  ["f08", "Ash greige", "#8C8177", "Neutral", "Crinkle"],
  ["f09", "Slate", "#5E6266", "Neutral", "Satin"],
  ["f10", "Charcoal", "#3B3936", "Neutral", "Matte"],
  ["f11", "Ink", "#22262B", "Neutral", "Chiffon"],
  ["f12", "Mushroom", "#A79A8B", "Neutral", "Matte"],

  ["f13", "Pomegranate", "#7C2433", "Red", "Satin"],
  ["f14", "Oxblood", "#5C1F2A", "Red", "Matte"],
  ["f15", "Brick", "#9B4A3A", "Red", "Crinkle"],
  ["f16", "Terracotta", "#B5654A", "Red", "Modal"],
  ["f17", "Coral", "#D87562", "Red", "Chiffon"],
  ["f18", "Rosewood", "#8A4D57", "Red", "Satin"],
  ["f19", "Cherry", "#A61E32", "Red", "Matte"],
  ["f20", "Rust", "#A34E2A", "Red", "Crinkle"],

  ["f21", "Dusty rose", "#C99A98", "Pink", "Chiffon"],
  ["f22", "Blush", "#E3B7AE", "Pink", "Modal"],
  ["f23", "Mauve", "#A9848E", "Pink", "Satin"],
  ["f24", "Fuchsia", "#B0306A", "Pink", "Matte"],
  ["f25", "Peony", "#D98A9E", "Pink", "Chiffon"],
  ["f26", "Plum rose", "#7E4A5E", "Pink", "Crinkle"],
  ["f27", "Shell", "#EBCFC4", "Pink", "Matte"],

  ["f28", "Saffron", "#C8892B", "Orange", "Satin"],
  ["f29", "Amber", "#B9772A", "Orange", "Crinkle"],
  ["f30", "Marigold", "#D59A2F", "Orange", "Modal"],
  ["f31", "Copper", "#A6613B", "Orange", "Satin"],
  ["f32", "Chestnut", "#6F4432", "Orange", "Matte"],
  ["f33", "Cocoa", "#4E3328", "Orange", "Modal"],
  ["f34", "Espresso", "#35241E", "Orange", "Matte"],
  ["f35", "Toffee", "#8A623F", "Orange", "Crinkle"],

  ["f36", "Butter", "#E8CE8E", "Yellow", "Chiffon"],
  ["f37", "Ochre", "#C29A3E", "Yellow", "Matte"],
  ["f38", "Citrine", "#D4B44A", "Yellow", "Satin"],
  ["f39", "Chartreuse", "#A9B24A", "Yellow", "Modal"],
  ["f40", "Straw", "#DCC98D", "Yellow", "Crinkle"],

  ["f41", "Sage", "#9AA48C", "Green", "Matte"],
  ["f42", "Olive", "#77784D", "Green", "Crinkle"],
  ["f43", "Moss", "#5F6B45", "Green", "Modal"],
  ["f44", "Fern", "#4E6B4E", "Green", "Satin"],
  ["f45", "Emerald", "#1F6B53", "Green", "Satin"],
  ["f46", "Jade", "#4E8C74", "Green", "Chiffon"],
  ["f47", "Eucalyptus", "#7E9B8C", "Green", "Matte"],
  ["f48", "Bottle", "#214A3C", "Green", "Crinkle"],
  ["f49", "Pistachio", "#B8C49A", "Green", "Modal"],
  ["f50", "Sea glass", "#9BBFB2", "Green", "Chiffon"],

  ["f51", "Powder", "#A9C1CE", "Blue", "Chiffon"],
  ["f52", "Sky", "#86AFC4", "Blue", "Modal"],
  ["f53", "Denim", "#5B7895", "Blue", "Matte"],
  ["f54", "Cobalt", "#2F5C96", "Blue", "Satin"],
  ["f55", "Navy", "#23324C", "Blue", "Matte"],
  ["f56", "Midnight", "#191F33", "Blue", "Crinkle"],
  ["f57", "Teal", "#2E6F73", "Blue", "Satin"],
  ["f58", "Petrol", "#275B66", "Blue", "Crinkle"],
  ["f59", "Ice", "#C9D9DE", "Blue", "Chiffon"],
  ["f60", "Indigo", "#343C6B", "Blue", "Matte"],

  ["f61", "Lavender", "#B6A8C9", "Purple", "Chiffon"],
  ["f62", "Lilac", "#C9BBD5", "Purple", "Modal"],
  ["f63", "Orchid", "#A06B9A", "Purple", "Satin"],
  ["f64", "Violet", "#6C4C86", "Purple", "Matte"],
  ["f65", "Aubergine", "#4A2B44", "Purple", "Crinkle"],
  ["f66", "Wine", "#5E2C3F", "Purple", "Satin"],
  ["f67", "Fig", "#6B4256", "Purple", "Modal"],
  ["f68", "Amethyst", "#7D5B92", "Purple", "Chiffon"],

  ["f69", "Champagne", "#D8C3A0", "Metallic", "Satin"],
  ["f70", "Bronze", "#9A7143", "Metallic", "Satin"],
  ["f71", "Pewter", "#8E9295", "Metallic", "Satin"],
  ["f72", "Gold thread", "#C9A45C", "Metallic", "Satin"],
];

export const FABRICS: FabricColour[] = FABRIC_SEEDS.map(
  ([id, name, hex, family, finish]) => ({
    id,
    name,
    hex,
    lab: hexToLab(hex),
    family,
    finish,
    note: FAMILY_NOTES[family],
    tags: TAG_BY_FAMILY[family],
  }),
);

const DEPTH_ROWS: Array<{ name: string; l: number; a: number; b: number; depth: DepthKey }> = [
  { name: "Chalk", l: 88, a: 9.5, b: 14, depth: "veryLight" },
  { name: "Alabaster", l: 82, a: 10.5, b: 15.5, depth: "veryLight" },
  { name: "Ivory", l: 76, a: 11.5, b: 17, depth: "light" },
  { name: "Oat", l: 70, a: 12.5, b: 18, depth: "light" },
  { name: "Dune", l: 64, a: 13.5, b: 19, depth: "lightMedium" },
  { name: "Sable", l: 58, a: 14, b: 19.5, depth: "lightMedium" },
  { name: "Amber", l: 52, a: 14, b: 19, depth: "medium" },
  { name: "Clay", l: 46, a: 13.5, b: 18, depth: "medium" },
  { name: "Umber", l: 40, a: 13, b: 17, depth: "tan" },
  { name: "Cocoa", l: 34, a: 12, b: 15.5, depth: "tan" },
  { name: "Espresso", l: 28, a: 11, b: 14, depth: "deep" },
  { name: "Onyx", l: 22, a: 9.5, b: 12, depth: "deep" },
];

const UNDERTONE_ROWS: Array<{
  code: string;
  name: string;
  undertone: Undertone;
  da: number;
  db: number;
}> = [
  { code: "C", name: "Cool", undertone: "cool", da: 2.8, db: -3.2 },
  { code: "N", name: "Neutral", undertone: "neutral", da: 0.2, db: 0.2 },
  { code: "W", name: "Warm", undertone: "warm", da: -0.4, db: 3.6 },
  { code: "O", name: "Olive", undertone: "olive", da: -2.4, db: 0.6 },
  { code: "R", name: "Rose", undertone: "cool", da: 3.6, db: 0.4 },
];

const FINISHES: FoundationShade["finish"][] = ["Satin", "Matte", "Radiant"];

export const FOUNDATIONS: FoundationShade[] = DEPTH_ROWS.flatMap((row, rowIndex) =>
  UNDERTONE_ROWS.map((tone, toneIndex) => {
    const lab: Lab = {
      l: row.l + (toneIndex === 0 ? 0.4 : toneIndex === 4 ? 0.2 : 0),
      a: Math.max(4, row.a + tone.da),
      b: Math.max(4, row.b + tone.db),
    };
    const index = rowIndex * UNDERTONE_ROWS.length + toneIndex + 1;
    return {
      id: `aur-${String(index).padStart(3, "0")}`,
      brand: "Auriga Atlas",
      code: `AUR-${String(index).padStart(3, "0")}`,
      name: `${row.name} ${tone.name}`,
      hex: labToHex(lab),
      lab,
      depth: row.depth,
      undertone: tone.undertone,
      finish: FINISHES[index % FINISHES.length],
      coverage: row.depth === "veryLight" || row.depth === "light" ? "Sheer" : row.depth === "deep" || row.depth === "tan" ? "Full" : "Medium",
    } satisfies FoundationShade;
  }),
);

export const CATALOG_META = {
  name: "Auriga Atlas",
  version: "0.1.0",
  fabricCount: FABRICS.length,
  foundationCount: FOUNDATIONS.length,
  note: "Foundation swatches are generated reference points, not retail product data. Fabric recommendations use the scraped textile catalogue when its generated index is present; the demo fabric set is the fallback.",
};

export interface Catalog {
  fabrics: FabricColour[];
  foundations: FoundationShade[];
  seasons: Season[];
}

export const CATALOG: Catalog = {
  fabrics: FABRICS,
  foundations: FOUNDATIONS,
  seasons: Object.values(SEASONS),
};

export function findFabric(idOrName: string): FabricColour | undefined {
  const needle = idOrName.trim().toLowerCase();
  return FABRICS.find(
    (fabric) =>
      fabric.id.toLowerCase() === needle || fabric.name.toLowerCase() === needle,
  );
}

export function nearestFabrics(lab: Lab, limit = 5, fabrics = FABRICS) {
  return [...fabrics]
    .map((fabric) => ({
      fabric,
      deltaE: deltaE2000(lab, fabric.lab, 1.5, 1, 1),
    }))
    .sort((a, b) => a.deltaE - b.deltaE)
    .slice(0, limit);
}

export function paletteFor(season: Season): PaletteColour[] {
  return season.palette;
}
