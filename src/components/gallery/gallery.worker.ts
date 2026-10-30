import {
  applyFilters,
  countFacets,
  ownCatalogueItems,
  scrapedToItem,
  type GalleryFacets,
  type GalleryFilters,
  type GalleryItem,
} from "@/lib/gallery";
import type { LibraryIndex } from "@/lib/library";

/**
 * The gallery's search worker.
 *
 * The scraped index is ~4.6 MB of JSON with 5,498 rows. It is fetched once,
 * kept here, and filtered off the main thread so scrolling a phone stays
 * smooth while filters change.
 *
 * The work only ever reads the published index. It never writes, and it never
 * invents a row.
 */

type InitMessage = {
  type: "init";
  url: string;
};

type SearchMessage = {
  type: "search";
  requestId: number;
  filters: GalleryFilters;
  offset: number;
  limit: number;
};

type Message = InitMessage | SearchMessage;

type ReadyMessage = {
  type: "ready";
  count: number;
  facets: GalleryFacets;
  measurement: LibraryIndex["measurement"];
  traitCoverage: LibraryIndex["traitCoverage"];
  generatedAt: string;
};

type ResultsMessage = {
  type: "results";
  requestId: number;
  items: GalleryItem[];
  total: number;
  facets: GalleryFacets;
  offset: number;
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

let items: GalleryItem[] = [];
let measurement: LibraryIndex["measurement"];
let traitCoverage: LibraryIndex["traitCoverage"];
let generatedAt = "";

function search(message: SearchMessage) {
  if (items.length === 0) {
    context.postMessage({ type: "error", message: "The collection is still loading." });
    return;
  }

  const { filters, offset, limit } = message;
  const filtered = applyFilters(items, filters);
  const page = filtered.slice(offset, offset + limit);

  context.postMessage({
    type: "results",
    requestId: message.requestId,
    items: page,
    total: filtered.length,
    facets: countFacets(items, filters),
    offset,
  });
}

context.onmessage = async (event) => {
  const message = event.data;

  if (message.type === "init") {
    try {
      // Revalidate rather than trust the cache: the index is rebuilt when the
      // catalogue is re-scraped, and a stale copy would miss its new fields.
      const response = await fetch(message.url, { cache: "no-cache" });
      if (!response.ok) {
        throw new Error(`Catalogue request failed (${response.status}).`);
      }
      const index = (await response.json()) as LibraryIndex;
      const scraped = (index.rows ?? []).map(scrapedToItem);
      // The project's own colours join the scraped textiles in the same
      // gallery, tagged by source so they are never confused with stock.
      items = [...scraped, ...ownCatalogueItems()];
      measurement = index.measurement;
      traitCoverage = index.traitCoverage;
      generatedAt = index.generatedAt;

      context.postMessage({
        type: "ready",
        count: items.length,
        facets: countFacets(items, {
          source: "all",
          query: "",
          family: "all",
          fabric: "all",
          weight: "all",
          opacity: "all",
          season: "all",
          store: "all",
        }),
        measurement,
        traitCoverage,
        generatedAt,
      });
    } catch (cause) {
      context.postMessage({
        type: "error",
        message:
          cause instanceof Error ? cause.message : "Could not load the collection.",
      });
    }
    return;
  }

  try {
    search(message);
  } catch (cause) {
    context.postMessage({
      type: "error",
      message: cause instanceof Error ? cause.message : "Gallery search failed.",
    });
  }
};
