"use client";

import { useEffect, useRef, useState } from "react";
import type { CatalogueSort, LibraryMatch } from "@/lib/library";
import type { SkinProfile } from "@/lib/skin";

interface CatalogueState {
  status: "idle" | "loading" | "ready" | "error";
  count: number;
  families: Record<string, number>;
  stores: Record<string, number>;
  categories: Record<string, number>;
  results: LibraryMatch[];
  total: number;
  searching: boolean;
  error: string | null;
}

interface UseCatalogueOptions {
  skin: SkinProfile | null;
  query: string;
  family: string;
  site: string;
  category: string;
  sort: CatalogueSort;
  limit?: number;
}

type WorkerMessage =
  | {
      type: "ready";
      count: number;
      families: Record<string, number>;
      stores: Record<string, number>;
      categories: Record<string, number>;
    }
  | {
      type: "results";
      requestId: number;
      results: LibraryMatch[];
      total: number;
      catalog: number;
    }
  | { type: "error"; message: string };

export function useCatalogue({
  skin,
  query,
  family,
  site,
  category,
  sort,
  limit = 36,
}: UseCatalogueOptions): CatalogueState {
  const workerRef = useRef<Worker | null>(null);
  const requestRef = useRef(0);
  const [state, setState] = useState<CatalogueState>({
    status: "idle",
    count: 0,
    families: {},
    stores: {},
    categories: {},
    results: [],
    total: 0,
    searching: false,
    error: null,
  });

  useEffect(() => {
    const worker = new Worker(new URL("./catalogue.worker.ts", import.meta.url), {
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
          count: message.count,
          families: message.families,
          stores: message.stores,
          categories: message.categories,
          error: null,
        }));
        return;
      }
      if (message.type === "results") {
        if (message.requestId !== requestRef.current) return;
        setState((current) => ({
          ...current,
          results: message.results,
          total: message.total,
          count: message.catalog,
          searching: false,
          error: null,
        }));
        return;
      }
      setState((current) => ({
        ...current,
        status: "error",
        searching: false,
        error: message.message,
      }));
    };

    worker.onerror = (event) => {
      setState((current) => ({
        ...current,
        status: "error",
        searching: false,
        error: event.message || "Catalogue worker failed.",
      }));
    };

    worker.postMessage({ type: "init", url: "/catalog/shades.json" });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!skin || state.status !== "ready") return;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setState((current) => ({ ...current, searching: true }));
    const timer = window.setTimeout(() => {
      workerRef.current?.postMessage({
        type: "search",
        requestId,
        skin,
        query,
        family,
        site,
        category,
        sort,
        limit,
      });
    }, 140);

    return () => window.clearTimeout(timer);
  }, [skin, query, family, site, category, sort, limit, state.status]);

  return state;
}
