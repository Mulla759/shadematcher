"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, List, Search, SlidersHorizontal, X } from "lucide-react";
import {
  EMPTY_FILTERS,
  SOURCE_LABEL,
  SOURCE_SHORT_LABEL,
  activeFilters,
  clearFilter,
  ownCatalogueItems,
  type GalleryFilters,
  type GalleryItem,
  type GallerySource,
} from "@/lib/gallery";
import { GalleryCard } from "./GalleryCard";
import { FilterSheet } from "./FilterSheet";
import { ItemSheet } from "./ItemSheet";
import { ListSheet } from "./ListSheet";
import { useGallery } from "./useGallery";
import {
  buildJson,
  buildMarkdown,
  copyText,
  downloadFile,
  exportFilename,
  readList,
  readNotes,
  addToList,
  clearList,
  clearNote,
  removeFromList,
  saveNote,
  sortedList,
  storageAvailable,
  type ExportRow,
  type FabricNote,
  type Notes,
  type SeasonalList,
} from "./notes";

const SOURCES: Array<GallerySource | "all"> = ["all", "scraped", "own", "atlas"];

/**
 * The fabric gallery.
 *
 * Every card is a real row from the published catalogue index, plus the
 * project's own colours. The gallery adds three things the reading app does
 * not have: the whole collection at once, filters that only use fields the
 * data really has, and somewhere to write down what the cloth feels like.
 */
export function GalleryStudio() {
  const [filters, setFilters] = useState<GalleryFilters>(EMPTY_FILTERS);
  const [notes, setNotes] = useState<Notes>({});
  const [list, setList] = useState<SeasonalList>({});
  const [sheet, setSheet] = useState<"filters" | "item" | "list" | null>(null);
  const [openItem, setOpenItem] = useState<GalleryItem | null>(null);
  const [copied, setCopied] = useState(false);
  const [storageOk, setStorageOk] = useState(true);

  const gallery = useGallery(filters);
  const itemMap = useRef(new Map<string, GalleryItem>());
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Read the device-local notes once, on the client.
  useEffect(() => {
    setNotes(readNotes());
    setList(readList());
    setStorageOk(storageAvailable());
  }, []);

  // Remember every colour the worker has handed over, so the seasonal list can
  // still name a fabric after the filters have moved on.
  useEffect(() => {
    for (const item of gallery.items) itemMap.current.set(item.id, item);
  }, [gallery.items]);

  const loadMore = gallery.loadMore;
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !gallery.hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore, gallery.hasMore, gallery.items.length]);

  const active = useMemo(() => activeFilters(filters), [filters]);
  const ownCount = useMemo(() => ownCatalogueItems().length, []);
  /** The shops behind the scrape, without Auriga's own two collections. */
  const shopCount = useMemo(
    () =>
      Object.keys(gallery.collectionFacets.store).filter(
        (store) => store !== "Auriga" && store !== "Auriga Atlas",
      ).length,
    [gallery.collectionFacets.store],
  );

  const listRows = useMemo<ExportRow[]>(() => {
    return sortedList(list).map(({ id, entry }) => {
      const item = itemMap.current.get(id);
      return {
        id,
        name: item?.name ?? id,
        title: item?.title ?? id,
        hex: item?.hex ?? "#cccccc",
        family: item?.family ?? "",
        fabric: item?.fabric ?? "",
        siteLabel: item?.siteLabel ?? "",
        url: item?.url ?? "",
        note: notes[id],
        season: entry.season,
      };
    });
  }, [list, notes]);

  const openDetail = useCallback((item: GalleryItem) => {
    setOpenItem(item);
    setSheet("item");
  }, []);

  const toggleKeep = useCallback(
    (item: GalleryItem) => {
      const current = readList();
      if (current[item.id]) {
        removeFromList(item.id);
        setList(readList());
        return;
      }
      addToList(item.id, "Spring");
      setList(readList());
    },
    [],
  );

  const saveItemNote = useCallback((id: string, note: FabricNote) => {
    saveNote(id, note);
    setNotes(readNotes());
  }, []);

  const clearItemNote = useCallback((id: string) => {
    clearNote(id);
    setNotes(readNotes());
  }, []);

  const setSeason = useCallback((id: string, season: string) => {
    addToList(id, season);
    setList(readList());
  }, []);

  const removeFromSeasonalList = useCallback((id: string) => {
    removeFromList(id);
    setList(readList());
  }, []);

  const clearSeasonalList = useCallback(() => {
    clearList();
    setList(readList());
  }, []);

  const exportRows = useCallback(() => {
    const stamp = new Date();
    return {
      markdown: buildMarkdown(listRows, stamp),
      json: buildJson(listRows, stamp),
      filename: exportFilename(stamp),
    };
  }, [listRows]);

  const copyList = useCallback(async () => {
    const { markdown } = exportRows();
    const ok = await copyText(markdown);
    setCopied(ok);
    window.setTimeout(() => setCopied(false), 2200);
  }, [exportRows]);

  const downloadMarkdown = useCallback(() => {
    const { markdown, filename } = exportRows();
    downloadFile(`${filename}md`, markdown, "text/markdown");
  }, [exportRows]);

  const downloadJson = useCallback(() => {
    const { json, filename } = exportRows();
    downloadFile(`${filename}json`, json, "application/json");
  }, [exportRows]);

  const total = gallery.total;
  const showing = gallery.items.length;

  /**
   * An empty grid is usually one filter that cannot apply, not a broken page.
   * Say which one, and offer to remove exactly that.
   */
  const emptyReason = useMemo(() => {
    const traitFilter =
      filters.weight !== "all" || filters.opacity !== "all" || filters.season !== "all";
    const ownSource = filters.source === "own" || filters.source === "atlas";
    const dimensionFilter =
      traitFilter ||
      filters.family !== "all" ||
      filters.fabric !== "all" ||
      filters.store !== "all";

    if (ownSource && traitFilter) {
      return {
        title: "Those traits only exist on the scraped textiles.",
        body: "Auriga's own colours carry no weight, opacity or season, because no shop has stated them.",
        action: "Clear the trait filters",
        clear: {
          ...filters,
          weight: "all",
          opacity: "all",
          season: "all",
        },
      };
    }

    if (filters.query && !dimensionFilter) {
      return {
        title: "Nothing matches that search.",
        body: `No colourway in the collection contains “${filters.query}”.`,
        action: "Clear the search",
        clear: { ...filters, query: "" },
      };
    }

    return {
      title: "Nothing matches those filters.",
      body: "Try a wider fabric type or shop, or clear the filters and start again.",
      action: "Clear filters",
      clear: {
        ...EMPTY_FILTERS,
        query: filters.query,
        source: filters.source,
      },
    };
  }, [filters]);

  return (
    <div className="gal-app">
      <a className="gal-skip" href="#gallery-grid">
        Skip to the gallery
      </a>

      <header className="gal-topbar">
        <a className="gal-topbar-back" href="/read">
          <ArrowLeft size={15} strokeWidth={1.9} aria-hidden="true" />
          <span>Shade Matcher</span>
        </a>
        <span className="gal-topbar-brand">Fabric gallery</span>
        <button
          type="button"
          className="gal-topbar-list"
          onClick={() => setSheet("list")}
          aria-label={`Seasonal list, ${Object.keys(list).length} fabrics`}
        >
          <List size={15} strokeWidth={1.9} aria-hidden="true" />
          <span>List</span>
          {Object.keys(list).length > 0 ? (
            <span className="gal-topbar-count">{Object.keys(list).length}</span>
          ) : null}
        </button>
      </header>

      <main className="gal-main">
        <section className="gal-hero">
          <h1 className="gal-hero-title">The collected fabrics</h1>
          <p className="gal-hero-meta">
            {gallery.status === "ready"
              ? `${gallery.collectionTotal.toLocaleString()} colourways`
              : "Loading the collection…"}
            {gallery.status === "ready"
              ? ` · ${shopCount} shops · ${ownCount} Auriga colours`
              : null}
          </p>
          <p className="gal-warning">
            Every colour here is a <strong>digital approximation</strong> measured
            from a scraped product photograph — not an accurate physical swatch.
            Check the cloth in person before you buy.
          </p>
        </section>

        <div className="gal-controls">
          <div className="gal-controls-row">
            <span className="gal-search">
              <Search size={15} strokeWidth={1.8} aria-hidden="true" />
              <input
                type="search"
                value={filters.query}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, query: event.target.value }))
                }
                placeholder="Search colour, fabric or shop"
                aria-label="Search the collection"
                spellCheck={false}
                enterKeyHint="search"
              />
              {filters.query ? (
                <button
                  type="button"
                  className="gal-search-clear"
                  onClick={() =>
                    setFilters((current) => ({ ...current, query: "" }))
                  }
                  aria-label="Clear the search"
                >
                  <X size={14} strokeWidth={2} aria-hidden="true" />
                </button>
              ) : null}
            </span>
            <button
              type="button"
              className="gal-filter-button"
              onClick={() => setSheet("filters")}
              aria-label={`Filters${
                active.length ? `, ${active.length} active` : ""
              }`}
            >
              <SlidersHorizontal size={15} strokeWidth={1.9} aria-hidden="true" />
              <span>Filters</span>
              {active.length > 0 ? (
                <span className="gal-filter-count">{active.length}</span>
              ) : null}
            </button>
          </div>

          <div className="gal-sources" role="group" aria-label="Which collection">
            {SOURCES.map((source) => (
              <button
                key={source}
                type="button"
                className={`gal-source${filters.source === source ? " is-on" : ""}`}
                onClick={() =>
                  setFilters((current) => ({ ...current, source }))
                }
                aria-pressed={filters.source === source}
              >
                {source === "all" ? "Everything" : SOURCE_SHORT_LABEL[source]}
              </button>
            ))}
          </div>

          {active.length > 0 ? (
            <div className="gal-chips">
              {active.map((filter) => (
                <button
                  key={`${filter.key}-${filter.value}`}
                  type="button"
                  className="gal-chip"
                  onClick={() => setFilters((current) => clearFilter(current, filter.key))}
                >
                  <span>{filter.label}</span>
                  <X size={12} strokeWidth={2.2} aria-hidden="true" />
                </button>
              ))}
              <button
                type="button"
                className="gal-chip gal-chip--clear"
                onClick={() =>
                  setFilters((current) => ({
                    ...EMPTY_FILTERS,
                    query: current.query,
                    source: current.source,
                  }))
                }
              >
                Clear all
              </button>
            </div>
          ) : null}
        </div>

        <div className="gal-status" role="status" aria-live="polite">
          {gallery.status === "error" ? (
            <span className="gal-status-error">
              The collection did not load. Refresh to try again.
            </span>
          ) : gallery.status === "loading" ? (
            <span>Loading the collection…</span>
          ) : (
            <span>
              Showing {showing.toLocaleString()} of {total.toLocaleString()}
            </span>
          )}
        </div>

        {gallery.status === "ready" && total === 0 ? (
          <div className="gal-empty-state">
            <p className="gal-empty-title">{emptyReason.title}</p>
            <p>{emptyReason.body}</p>
            <button
              type="button"
              className="gal-btn gal-btn--outline"
              onClick={() => setFilters(emptyReason.clear)}
            >
              {emptyReason.action}
            </button>
          </div>
        ) : null}

        <div className="gal-grid" id="gallery-grid">
          {gallery.items.map((item) => (
            <GalleryCard
              key={item.id}
              item={item}
              kept={Boolean(list[item.id])}
              noted={Boolean(notes[item.id])}
              onOpen={openDetail}
              onToggleKeep={toggleKeep}
            />
          ))}
        </div>

        <div ref={sentinelRef} className="gal-sentinel" aria-hidden="true" />

        {gallery.hasMore ? (
          <div className="gal-more">
            <button
              type="button"
              className="gal-btn gal-btn--outline"
              onClick={loadMore}
              disabled={gallery.loadingMore}
            >
              {gallery.loadingMore
                ? "Loading…"
                : `Show more (${(total - showing).toLocaleString()} left)`}
            </button>
          </div>
        ) : showing > 0 ? (
          <p className="gal-end">
            That is the whole collection. {total.toLocaleString()} colourways.
          </p>
        ) : null}
      </main>

      <FilterSheet
        open={sheet === "filters"}
        onClose={() => setSheet(null)}
        filters={filters}
        facets={gallery.facets}
        resultCount={gallery.total}
        total={gallery.collectionTotal}
        traitCoverage={gallery.traitCoverage}
        onChange={setFilters}
      />

      <ItemSheet
        open={sheet === "item"}
        item={openItem}
        note={openItem ? notes[openItem.id] : undefined}
        listEntry={openItem ? list[openItem.id] : undefined}
        onClose={() => setSheet(null)}
        onSaveNote={saveItemNote}
        onClearNote={clearItemNote}
        onSetSeason={setSeason}
        onRemoveFromList={removeFromSeasonalList}
      />

      <ListSheet
        open={sheet === "list"}
        onClose={() => setSheet(null)}
        rows={listRows}
        onRemove={removeFromSeasonalList}
        onClearAll={clearSeasonalList}
        onCopy={copyList}
        onDownloadMarkdown={downloadMarkdown}
        onDownloadJson={downloadJson}
        copied={copied}
        storageOk={storageOk}
      />
    </div>
  );
}
