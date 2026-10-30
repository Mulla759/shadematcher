"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GalleryFacets, GalleryFilters, GalleryItem } from "@/lib/gallery";
import type { LibraryMeasurement } from "@/lib/library";

/**
 * Drives the gallery's search worker.
 *
 * The worker holds the whole index and does the filtering; this hook keeps the
 * pages it has already handed back so scrolling never re-fetches. Filters are
 * serialised into a key so a new object with the same values does not restart
 * the search.
 */

export const GALLERY_PAGE_SIZE = 48;

type WorkerMessage =
  | {
      type: "ready";
      count: number;
      facets: GalleryFacets;
      measurement?: LibraryMeasurement;
      traitCoverage?: { weight: number; opacity: number; season: number };
      generatedAt: string;
    }
  | {
      type: "results";
      requestId: number;
      items: GalleryItem[];
      total: number;
      facets: GalleryFacets;
      offset: number;
    }
  | { type: "error"; message: string };

export interface GalleryState {
  status: "loading" | "ready" | "error";
  items: GalleryItem[];
  total: number;
  /** Every colourway in the collection, before any filter is applied. */
  collectionTotal: number;
  /** Facet counts for the whole collection, before any filter is applied. */
  collectionFacets: GalleryFacets;
  facets: GalleryFacets;
  measurement?: LibraryMeasurement;
  traitCoverage?: { weight: number; opacity: number; season: number };
  error: string | null;
  hasMore: boolean;
  loadingMore: boolean;
}

const EMPTY_FACETS: GalleryFacets = {
  family: {},
  fabric: {},
  weight: {},
  opacity: {},
  season: {},
  store: {},
};

export function useGallery(filters: GalleryFilters) {
  const workerRef = useRef<Worker | null>(null);
  const requestRef = useRef(0);
  const offsetRef = useRef(0);
  /** True while a page is in flight, so one page is never requested twice. */
  const loadingRef = useRef(false);
  const [state, setState] = useState<GalleryState>({
    status: "loading",
    items: [],
    total: 0,
    collectionTotal: 0,
    collectionFacets: EMPTY_FACETS,
    facets: EMPTY_FACETS,
    error: null,
    hasMore: false,
    loadingMore: false,
  });

  const filterKey = JSON.stringify(filters);

  useEffect(() => {
    const worker = new Worker(new URL("./gallery.worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;
    setState((current) => ({ ...current, status: "loading", error: null }));

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (message.type === "ready") {
        setState((current) => ({
          ...current,
          status: "ready",
          collectionTotal: message.count,
          collectionFacets: message.facets,
          facets: message.facets,
          measurement: message.measurement,
          traitCoverage: message.traitCoverage,
        }));
        return;
      }
      if (message.type === "results") {
        // A response from a superseded search is dropped: the filters changed
        // while it was in flight.
        if (message.requestId !== requestRef.current) return;
        loadingRef.current = false;
        setState((current) => ({
          ...current,
          status: "ready",
          items:
            message.offset === 0
              ? message.items
              : [...current.items, ...message.items],
          total: message.total,
          facets: message.facets,
          hasMore: message.offset + message.items.length < message.total,
          loadingMore: false,
          error: null,
        }));
        return;
      }
      loadingRef.current = false;
      setState((current) => ({
        ...current,
        status: "error",
        loadingMore: false,
        error: message.message,
      }));
    };

    worker.onerror = (event) => {
      loadingRef.current = false;
      setState((current) => ({
        ...current,
        status: "error",
        loadingMore: false,
        error: event.message || "The gallery worker failed.",
      }));
    };

    worker.postMessage({ type: "init", url: "/catalog/shades.json" });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  // Every filter change starts a fresh search from the first page.
  useEffect(() => {
    if (state.status !== "ready") return;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    offsetRef.current = 0;
    loadingRef.current = false;
    setState((current) => ({
      ...current,
      items: [],
      loadingMore: false,
      hasMore: false,
    }));
    workerRef.current?.postMessage({
      type: "search",
      requestId,
      filters: JSON.parse(filterKey) as GalleryFilters,
      offset: 0,
      limit: GALLERY_PAGE_SIZE,
    });
    // `filterKey` is the serialised filter set; `state.status` gates the first run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, state.status]);

  /**
   * Fetches the next page.
   *
   * The request keeps the current search id, so a page is never dropped from
   * the list, and a ref guard stops two taps asking for the same offset.
   */
  const loadMore = useCallback(() => {
    if (loadingRef.current || !state.hasMore || state.status !== "ready") return;
    loadingRef.current = true;
    const requestId = requestRef.current;
    const offset = offsetRef.current;
    setState((current) => ({ ...current, loadingMore: true }));
    workerRef.current?.postMessage({
      type: "search",
      requestId,
      filters: JSON.parse(filterKey) as GalleryFilters,
      offset,
      limit: GALLERY_PAGE_SIZE,
    });
  }, [filterKey, state.hasMore, state.status]);

  // Track how far the pages have got, so the next request continues the list.
  useEffect(() => {
    offsetRef.current = state.items.length;
  }, [state.items.length]);

  return { ...state, loadMore };
}
