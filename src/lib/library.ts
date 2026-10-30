import type { FabricColour, FabricFamily, FabricFinish } from "./catalog";
import { hexToLab } from "./color";
import type { Verdict } from "./match";

export interface LibraryGradient {
  stops: string[];
  angle: number;
  deltaE: number;
}

/**
 * Weight, opacity and season as the *retailer* states them.
 *
 * These are not measurements. They are wording read out of the shop's own tags
 * and product title, so most rows carry none, and `*From` records where the
 * wording came from.
 */
export interface LibraryTraits {
  weight?: string[];
  weightFrom?: "tags" | "title";
  opacity?: string[];
  opacityFrom?: "tags" | "title";
  season?: string[];
  seasonFrom?: "tags" | "title" | "tags+title";
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
  /** The store's own image URL. The photo is fetched from them, never mirrored. */
  remote?: string;
  /** Store CDN URL with resize parameters, for small swatches. */
  remoteThumb?: string;
  url: string;
  palette: string;
  gradient: LibraryGradient | null;
  /* --- Additive fields. Absent on older indexes; nothing depends on them. --- */
  /** The retailer's finer colour wording, e.g. "taupe" or "sand". */
  colorFamily?: string;
  /** The family the measured hex falls into, e.g. "brown". */
  measuredFamily?: string;
  /** How the shop labelled the colour: tags, variant, title or the measurement. */
  familySource?: "tags" | "variant" | "title" | "measured";
  /** Capture condition: the flatness score of the photo the colour was read from. */
  flatness?: number;
  /** How many photos the scrape took of this product. */
  photoCount?: number;
  /** Store-stated weight, opacity and season. */
  traits?: LibraryTraits;
}

/**
 * How every colour in the index was read. Published with the index so no
 * consumer has to guess whether a hex is a measurement or a display value.
 */
export interface LibraryMeasurement {
  method: string;
  source: string;
  lab: string;
  flatness: string;
  label: string;
  traits: string;
  warning: string;
}

export interface LibraryIndex {
  generatedAt: string;
  source: string;
  note: string;
  count: number;
  families: Record<string, number>;
  stores: Record<string, number>;
  categories: Record<string, number>;
  /** How many rows carry each store-stated trait. */
  traitCoverage?: { weight: number; opacity: number; season: number };
  measurement?: LibraryMeasurement;
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
