import type { FabricColour, FabricFamily, FabricFinish } from "./catalog";
import { hexToLab } from "./color";
import type { Verdict } from "./match";

export interface LibraryGradient {
  stops: string[];
  angle: number;
  deltaE: number;
}

export interface LibraryShade {
  id: string;
  name: string;
  title: string;
  hex: string;
  family: FabricFamily;
  finish: FabricFinish;
  site: string;
  siteLabel: string;
  category: string;
  fabric: string;
  price: string;
  image: string;
  url: string;
  palette: string;
  gradient: LibraryGradient | null;
}

export interface LibraryIndex {
  generatedAt: string;
  source: string;
  note: string;
  count: number;
  families: Record<string, number>;
  stores: Record<string, number>;
  categories: Record<string, number>;
  rows: LibraryShade[];
}

export type CatalogueSort = "match" | "light" | "dark" | "hue" | "name";

export interface LibraryMatch extends LibraryShade {
  score: number;
  verdict: Verdict;
  friendlyReason: string;
  reasons: string[];
  deltaE: number;
  lightnessGap: number;
  chromaRatio: number;
}

export const FACE_FRAMING_CATEGORIES = new Set([
  "scarves",
  "fabric",
  "lace",
  "jersey",
  "chiffon",
  "satin",
  "crepe",
  "linen",
  "mikado",
  "poplin",
  "scuba",
  "suiting",
  "twill",
  "velvet",
  "vinyl",
  "knit",
  "embroidered",
  "underscarves",
  "neck-and-chest-cover",
  "arm-covers",
]);

export function isFaceFramingCategory(category: string): boolean {
  return FACE_FRAMING_CATEGORIES.has(category);
}

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

/** The search index uses the same serialisable shape as a FabricColour. */
export function libraryToFabric(row: LibraryShade): FabricColour {
  return {
    id: row.id,
    name: row.name,
    hex: row.hex,
    lab: hexToLab(row.hex),
    family: row.family,
    finish: row.finish,
    note: `${FAMILY_NOTES[row.family]} Scraped from ${row.siteLabel}.`,
    tags: ["scraped", row.site, row.category, row.fabric, row.family.toLowerCase()],
  };
}
