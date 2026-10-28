import { hexToLab, hueAngle } from "@/lib/color";
import {
  isFaceFramingCategory,
  libraryToFabric,
  type CatalogueSort,
  type LibraryIndex,
  type LibraryMatch,
  type LibraryShade,
} from "@/lib/library";
import { recommendFabrics, type FabricMatch } from "@/lib/match";
import type { SkinProfile } from "@/lib/skin";

type InitMessage = {
  type: "init";
  url: string;
};

type SearchMessage = {
  type: "search";
  requestId: number;
  skin: SkinProfile;
  query: string;
  family: string;
  site: string;
  category: string;
  sort: CatalogueSort;
  limit: number;
};

type Message = InitMessage | SearchMessage;

type ReadyMessage = {
  type: "ready";
  count: number;
  families: Record<string, number>;
  stores: Record<string, number>;
  categories: Record<string, number>;
};

type ResultsMessage = {
  type: "results";
  requestId: number;
  results: LibraryMatch[];
  total: number;
  catalog: number;
};

type ErrorMessage = {
  type: "error";
  message: string;
};

type WorkerContext = {
  onmessage: ((event: MessageEvent<Message>) => void) | null;
  postMessage: (message: ReadyMessage | ResultsMessage | ErrorMessage) => void;
};

const context = self as unknown as WorkerContext;

let rows: Array<{ row: LibraryShade; match: ReturnType<typeof libraryToFabric> }> = [];
let rowById = new Map<string, LibraryShade>();
let families: Record<string, number> = {};
let stores: Record<string, number> = {};
let categories: Record<string, number> = {};

function friendlyReason(match: FabricMatch): string {
  const contrast =
    match.lightnessGap < 12
      ? "Close to your skin in depth, for a soft, blended look."
      : match.lightnessGap <= 35
        ? "Enough contrast to make your face stand out without overpowering it."
        : "A bold contrast against your skin — dramatic and less subtle.";
  const warmth =
    match.temperature === "warm"
      ? " A warm shade that echoes the warmth in your skin."
      : match.temperature === "cool"
        ? " A cool shade that balances your skin."
        : " A neutral shade that lets your face lead.";
  return `${contrast}${warmth}`;
}

function matchesQuery(row: LibraryShade, query: string): boolean {
  if (!query) return true;
  const haystack = [
    row.name,
    row.title,
    row.siteLabel,
    row.site,
    row.category,
    row.fabric,
    row.family,
    row.hex,
    row.palette,
  ]
    .join(" ")
    .toLowerCase();
  return query
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

function search(message: SearchMessage) {
  if (rows.length === 0) {
    context.postMessage({ type: "error", message: "Catalogue is still loading." });
    return;
  }

  const query = message.query.trim().toLowerCase();
  const filtered = rows.filter(({ row }) => {
    if (message.family !== "all" && row.family !== message.family) return false;
    if (message.site !== "all" && row.siteLabel !== message.site) return false;
    if (message.category === "face" && !isFaceFramingCategory(row.category)) return false;
    if (
      message.category !== "all" &&
      message.category !== "face" &&
      row.category !== message.category
    ) {
      return false;
    }
    return matchesQuery(row, query);
  });

  const ranked = recommendFabrics(message.skin, {
    fabrics: filtered.map((entry) => entry.match),
    limit: message.limit,
    category: "hijab",
  }).best;

  const results: LibraryMatch[] = ranked.flatMap((match) => {
    const row = rowById.get(match.colour.id);
    if (!row) return [];
    return [
      {
        ...row,
        score: match.score,
        verdict: match.verdict,
        friendlyReason: friendlyReason(match),
        reasons: match.reasons.slice(0, 3),
        deltaE: match.deltaE,
        lightnessGap: match.lightnessGap,
        chromaRatio: match.chromaRatio,
      },
    ];
  });

  if (message.sort === "light") {
    results.sort((a, b) => hexToLab(b.hex).l - hexToLab(a.hex).l || b.score - a.score);
  } else if (message.sort === "dark") {
    results.sort((a, b) => hexToLab(a.hex).l - hexToLab(b.hex).l || b.score - a.score);
  } else if (message.sort === "hue") {
    results.sort((a, b) => {
      const ah = hueAngle(hexToLab(a.hex));
      const bh = hueAngle(hexToLab(b.hex));
      return ah - bh || b.score - a.score;
    });
  } else if (message.sort === "name") {
    results.sort((a, b) => a.name.localeCompare(b.name) || b.score - a.score);
  }

  context.postMessage({
    type: "results",
    requestId: message.requestId,
    results,
    total: filtered.length,
    catalog: rows.length,
  });
}

context.onmessage = async (event) => {
  const message = event.data;

  if (message.type === "init") {
    try {
      const response = await fetch(message.url);
      if (!response.ok) throw new Error(`Catalogue request failed (${response.status}).`);
      const index = (await response.json()) as LibraryIndex;
      families = index.families;
      stores = index.stores;
      categories = index.categories ?? {};
      rows = index.rows.map((row) => ({ row, match: libraryToFabric(row) }));
      rowById = new Map(rows.map((entry) => [entry.row.id, entry.row]));
      context.postMessage({
        type: "ready",
        count: rows.length,
        families,
        stores,
        categories,
      });
    } catch (cause) {
      context.postMessage({
        type: "error",
        message: cause instanceof Error ? cause.message : "Could not load the catalogue.",
      });
    }
    return;
  }

  try {
    search(message);
  } catch (cause) {
    context.postMessage({
      type: "error",
      message: cause instanceof Error ? cause.message : "Catalogue search failed.",
    });
  }
};
