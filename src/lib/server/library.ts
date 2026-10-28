import { readFile } from "node:fs/promises";
import path from "node:path";
import { FABRICS, type FabricColour } from "../catalog";
import { isFaceFramingCategory, libraryToFabric, type LibraryIndex } from "../library";

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

async function load(): Promise<LibraryData> {
  try {
    const file = path.join(process.cwd(), "public", "catalog", "shades.json");
    const index = JSON.parse(await readFile(file, "utf8")) as LibraryIndex;
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
