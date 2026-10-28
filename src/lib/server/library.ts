import { FABRICS, type FabricColour } from "../catalog";
import { isFaceFramingCategory, libraryToFabric, type LibraryIndex } from "../library";
import shades from "../../../public/catalog/shades.json";

export interface LibraryData {
  fabrics: FabricColour[];
  faceFabrics: FabricColour[];
  categories: Record<string, FabricColour[]>;
  count: number;
  faceCount: number;
  stores: number;
  source: string;
}

let cached: Promise<LibraryData> | null = null;

/**
 * The index is imported (not read from disk) so it is bundled into the server
 * function. Reading `public/catalog/shades.json` at runtime works locally but
 * silently falls back to the demo catalogue on serverless hosts, where the
 * `public/` folder is served as static files and is not part of the function.
 */
async function load(): Promise<LibraryData> {
  try {
    const index = shades as unknown as LibraryIndex;
    if (!index.rows?.length) throw new Error("empty catalogue index");
    const mapped = index.rows.map((row) => ({
      row,
      fabric: libraryToFabric(row),
    }));
    const fabrics = mapped.map((entry) => entry.fabric);
    const faceFabrics = mapped
      .filter((entry) => isFaceFramingCategory(entry.row.category))
      .map((entry) => entry.fabric);
    const categories: Record<string, FabricColour[]> = {};
    for (const entry of mapped) {
      (categories[entry.row.category] ??= []).push(entry.fabric);
    }
    return {
      fabrics,
      faceFabrics,
      categories,
      count: index.count,
      faceCount: faceFabrics.length,
      stores: Object.keys(index.stores).length,
      source: "scraped textile catalogue",
    };
  } catch {
    // Keep the API usable if the generated index has not been built yet.
    return {
      fabrics: FABRICS,
      faceFabrics: FABRICS,
      categories: { demo: FABRICS },
      count: FABRICS.length,
      faceCount: FABRICS.length,
      stores: 0,
      source: "demo fabric catalogue (fallback)",
    };
  }
}

export function getLibrary(): Promise<LibraryData> {
  if (!cached) cached = load();
  return cached;
}
