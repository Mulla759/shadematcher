import { FABRICS, FOUNDATIONS, type FabricColour, type FoundationShade } from "./catalog";
import { hexToLab, type Lab } from "./color";
import type { LibraryGradient, LibraryShade, LibraryTraits } from "./library";

/**
 * The fabric gallery.
 *
 * Three kinds of colour live here and the gallery never mixes them up:
 *
 *  - `scraped` — a textile colourway measured from a store's product photo.
 *    The hex is a digital approximation of a photo, never a physical swatch.
 *  - `own` — Auriga's own fabric colours (`FABRICS`). Digital definitions.
 *  - `atlas` — the Auriga Atlas foundation shades (`FOUNDATIONS`). Generated
 *    reference points, not retail product data and not cloth.
 *
 * Everything the gallery shows about a colour comes from the scraped index or
 * from the project's own catalogue. Nothing is invented here.
 */

export type GallerySource = "scraped" | "own" | "atlas";

export interface GalleryItem {
  id: string;
  source: GallerySource;
  name: string;
  title: string;
  hex: string;
  /** CIELAB, derived from the measured hex unless the catalogue measured it. */
  lab: Lab;
  family: string;
  /** The retailer's finer colour wording, e.g. "taupe". */
  colorFamily?: string;
  /** The family the measured hex falls into, e.g. "brown". */
  measuredFamily?: string;
  /** How the shop labelled the colour: tags, variant, title or the measurement. */
  familySource?: string;
  finish: string;
  fabric: string;
  category: string;
  site: string;
  siteLabel: string;
  price: string;
  url: string;
  /** Store CDN thumbnail. */
  remoteThumb?: string;
  /** Store CDN original. */
  remote?: string;
  /** Measured palette, darkest to lightest. */
  palette: string[];
  gradient: LibraryGradient | null;
  /** Capture condition: the flatness score of the photo the colour was read from. */
  flatness?: number;
  photoCount?: number;
  /** Store-stated weight, opacity and season. */
  traits?: LibraryTraits;
  /** One line saying what this colour is and is not. */
  origin: string;
  originDetail: string;
}

/** The wording used on every card, so no colour is presented as physical. */
export const ORIGIN = {
  scraped:
    "Digital approximation measured from a scraped product photo — not an accurate physical swatch.",
  own: "Auriga's own colour definition — a digital value, not a physical swatch.",
  atlas:
    "Generated reference shade from the Auriga Atlas — a digital value, not cloth or a physical swatch.",
} as const;

export const SOURCE_LABEL: Record<GallerySource, string> = {
  scraped: "Scraped textiles",
  own: "Auriga colours",
  atlas: "Auriga Atlas",
};

/** The same sources, short enough to sit in a row on a 375px phone. */
export const SOURCE_SHORT_LABEL: Record<GallerySource, string> = {
  scraped: "Scraped",
  own: "Auriga",
  atlas: "Atlas",
};

/** Turns a scraped index row into a gallery item. */
export function scrapedToItem(row: LibraryShade): GalleryItem {
  return {
    id: row.id,
    source: "scraped",
    name: row.name,
    title: row.title,
    hex: row.hex,
    lab: hexToLab(row.hex),
    family: row.family,
    colorFamily: row.colorFamily,
    measuredFamily: row.measuredFamily,
    familySource: row.familySource,
    finish: row.finish,
    fabric: row.fabric,
    category: row.category,
    site: row.site,
    siteLabel: row.siteLabel,
    price: row.price,
    url: row.url,
    remoteThumb: row.remoteThumb,
    remote: row.remote,
    palette: row.palette ? row.palette.split(/\s+/).filter(Boolean) : [],
    gradient: row.gradient,
    flatness: row.flatness,
    photoCount: row.photoCount,
    traits: row.traits,
    origin: "Scraped product photo",
    originDetail: ORIGIN.scraped,
  };
}

/** Auriga's own fabric colours. No image, no source link: these are definitions. */
export function ownToItem(fabric: FabricColour): GalleryItem {
  return {
    id: `own-${fabric.id}`,
    source: "own",
    name: fabric.name,
    title: fabric.name,
    hex: fabric.hex,
    lab: fabric.lab,
    family: fabric.family,
    finish: fabric.finish,
    fabric: "own catalogue",
    category: "own catalogue",
    site: "auriga",
    siteLabel: "Auriga",
    price: "",
    url: "",
    palette: [],
    gradient: null,
    origin: "Auriga own catalogue",
    originDetail: ORIGIN.own,
  };
}

/** The Auriga Atlas foundation shades. Generated reference points. */
export function atlasToItem(shade: FoundationShade): GalleryItem {
  return {
    id: `atlas-${shade.id}`,
    source: "atlas",
    name: shade.name,
    title: `${shade.brand} ${shade.code}`,
    hex: shade.hex,
    lab: shade.lab,
    // A foundation is not sorted by colour family, so the undertone is the
    // family here — named as an undertone so it is never confused with the
    // retailer's colour families.
    family: `${shade.undertone[0].toUpperCase()}${shade.undertone.slice(1)} undertone`,
    colorFamily: `${shade.depth} depth · ${shade.coverage} coverage`,
    finish: shade.finish,
    fabric: "foundation",
    category: "foundation",
    site: "auriga-atlas",
    siteLabel: "Auriga Atlas",
    price: "",
    url: "",
    palette: [],
    gradient: null,
    origin: "Auriga Atlas (generated)",
    originDetail: ORIGIN.atlas,
  };
}

/** The project's own colours, next to the scraped textile index. */
export function ownCatalogueItems(): GalleryItem[] {
  return [...FABRICS.map(ownToItem), ...FOUNDATIONS.map(atlasToItem)];
}

/* ------------------------------------------------------------------ filters */

export interface GalleryFilters {
  source: GallerySource | "all";
  query: string;
  family: string;
  fabric: string;
  weight: string;
  opacity: string;
  season: string;
  store: string;
}

export const EMPTY_FILTERS: GalleryFilters = {
  source: "all",
  query: "",
  family: "all",
  fabric: "all",
  weight: "all",
  opacity: "all",
  season: "all",
  store: "all",
};

/** Every filter dimension the gallery can offer, in the order they are shown. */
export const FILTER_DIMENSIONS = [
  "family",
  "fabric",
  "weight",
  "opacity",
  "season",
  "store",
] as const;

export type FilterDimension = (typeof FILTER_DIMENSIONS)[number];

export const FILTER_LABEL: Record<FilterDimension, string> = {
  family: "Colour family",
  fabric: "Fabric type",
  weight: "Weight",
  opacity: "Opacity",
  season: "Season",
  store: "Shop",
};

export interface GalleryFacets {
  family: Record<string, number>;
  fabric: Record<string, number>;
  weight: Record<string, number>;
  opacity: Record<string, number>;
  season: Record<string, number>;
  store: Record<string, number>;
}

/** The value a row offers for one dimension. */
function valueFor(item: GalleryItem, dimension: FilterDimension): string[] {
  switch (dimension) {
    case "family":
      return [item.family];
    case "fabric":
      return [item.fabric];
    case "weight":
      return item.traits?.weight ?? [];
    case "opacity":
      return item.traits?.opacity ?? [];
    case "season":
      return item.traits?.season ?? [];
    case "store":
      return [item.siteLabel];
  }
}

/** Free-text search across the fields a buyer would actually type. */
export function matchesQuery(item: GalleryItem, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    item.name,
    item.title,
    item.family,
    item.colorFamily,
    item.measuredFamily,
    item.fabric,
    item.category,
    item.siteLabel,
    item.hex,
    item.palette.join(" "),
    item.traits?.weight?.join(" "),
    item.traits?.opacity?.join(" "),
    item.traits?.season?.join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return needle.split(/\s+/).every((term) => haystack.includes(term));
}

/** Applies every filter except the one named, which is what facet counts need. */
function matchesExcept(
  item: GalleryItem,
  filters: GalleryFilters,
  skip: FilterDimension | null,
): boolean {
  if (filters.source !== "all" && item.source !== filters.source) return false;
  if (!matchesQuery(item, filters.query)) return false;
  for (const dimension of FILTER_DIMENSIONS) {
    if (dimension === skip) continue;
    const wanted = filters[dimension];
    if (wanted === "all") continue;
    if (!valueFor(item, dimension).includes(wanted)) return false;
  }
  return true;
}

export function applyFilters(
  items: GalleryItem[],
  filters: GalleryFilters,
): GalleryItem[] {
  return items.filter((item) => matchesExcept(item, filters, null));
}

/**
 * Counts for each value of each dimension, ignoring that dimension's own
 * filter — so a shop never shows "0" for the only colour family it has.
 */
export function countFacets(
  items: GalleryItem[],
  filters: GalleryFilters,
): GalleryFacets {
  const facets: GalleryFacets = {
    family: {},
    fabric: {},
    weight: {},
    opacity: {},
    season: {},
    store: {},
  };
  for (const dimension of FILTER_DIMENSIONS) {
    const counts = facets[dimension];
    for (const item of items) {
      if (!matchesExcept(item, filters, dimension)) continue;
      for (const value of valueFor(item, dimension)) {
        counts[value] = (counts[value] || 0) + 1;
      }
    }
  }
  return facets;
}

/** The active filters, as label/value pairs, for the chips under the search. */
export interface ActiveFilter {
  key: "source" | FilterDimension;
  value: string;
  label: string;
}

export function activeFilters(filters: GalleryFilters): ActiveFilter[] {
  const active: ActiveFilter[] = [];
  if (filters.source !== "all") {
    active.push({
      key: "source",
      value: filters.source,
      label: SOURCE_LABEL[filters.source],
    });
  }
  for (const dimension of FILTER_DIMENSIONS) {
    const value = filters[dimension];
    if (value === "all") continue;
    active.push({
      key: dimension,
      value,
      label: `${FILTER_LABEL[dimension]}: ${value}`,
    });
  }
  return active;
}

/** Removes one filter, leaving the rest alone. */
export function clearFilter(
  filters: GalleryFilters,
  key: ActiveFilter["key"],
): GalleryFilters {
  if (key === "source") return { ...filters, source: "all" };
  return { ...filters, [key]: "all" };
}
