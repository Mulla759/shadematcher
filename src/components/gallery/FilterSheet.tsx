"use client";

import {
  FILTER_DIMENSIONS,
  FILTER_LABEL,
  type FilterDimension,
  type GalleryFacets,
  type GalleryFilters,
} from "@/lib/gallery";
import { BottomSheet } from "./BottomSheet";

interface FilterSheetProps {
  open: boolean;
  onClose: () => void;
  filters: GalleryFilters;
  facets: GalleryFacets;
  resultCount: number;
  total: number;
  traitCoverage?: { weight: number; opacity: number; season: number };
  onChange: (filters: GalleryFilters) => void;
}

/**
 * The filter sheet.
 *
 * Every option here comes from the scraped index: the colour families, fabric
 * types and shops the catalogue actually holds. Weight, opacity and season only
 * exist where a shop said something, so those sections show how many rows
 * carry them rather than pretending the data is complete.
 */
export function FilterSheet({
  open,
  onClose,
  filters,
  facets,
  resultCount,
  total,
  traitCoverage,
  onChange,
}: FilterSheetProps) {
  const setDimension = (dimension: FilterDimension, value: string) => {
    onChange({
      ...filters,
      [dimension]: filters[dimension] === value ? "all" : value,
    });
  };

  const coverage: Partial<Record<FilterDimension, string>> = {
    weight: traitCoverage
      ? `${traitCoverage.weight.toLocaleString()} of ${total.toLocaleString()} rows carry a weight the shop stated.`
      : undefined,
    opacity: traitCoverage
      ? `${traitCoverage.opacity.toLocaleString()} of ${total.toLocaleString()} rows carry an opacity the shop stated.`
      : undefined,
    season: traitCoverage
      ? `${traitCoverage.season.toLocaleString()} of ${total.toLocaleString()} rows carry a season the shop stated.`
      : undefined,
  };

  const activeCount = FILTER_DIMENSIONS.filter(
    (dimension) => filters[dimension] !== "all",
  ).length;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Filters"
      subtitle={`${resultCount.toLocaleString()} of ${total.toLocaleString()} colourways match`}
      footer={
        <>
          <button
            type="button"
            className="gal-btn gal-btn--ghost"
            onClick={() =>
              onChange({
                ...filters,
                family: "all",
                fabric: "all",
                weight: "all",
                opacity: "all",
                season: "all",
                store: "all",
              })
            }
            disabled={activeCount === 0}
          >
            Clear filters
          </button>
          <button type="button" className="gal-btn gal-btn--solid" onClick={onClose}>
            Show {resultCount.toLocaleString()}
          </button>
        </>
      }
    >
      {FILTER_DIMENSIONS.map((dimension) => {
        const counts = facets[dimension] ?? {};
        const values = Object.entries(counts).sort(
          (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
        );
        const selected = filters[dimension];
        return (
          <section key={dimension} className="gal-filter-group">
            <div className="gal-filter-head">
              <h3>{FILTER_LABEL[dimension]}</h3>
              {selected !== "all" ? (
                <button
                  type="button"
                  className="gal-text-button"
                  onClick={() => onChange({ ...filters, [dimension]: "all" })}
                >
                  Clear
                </button>
              ) : null}
            </div>
            {coverage[dimension] ? (
              <p className="gal-filter-note">{coverage[dimension]}</p>
            ) : null}
            {values.length === 0 ? (
              <p className="gal-filter-note">Nothing in the collection matches yet.</p>
            ) : (
              <div className="gal-pills">
                {values.map(([value, count]) => {
                  const isOn = selected === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      className={`gal-pill${isOn ? " is-on" : ""}`}
                      onClick={() => setDimension(dimension, value)}
                      aria-pressed={isOn}
                    >
                      <span>{value}</span>
                      <span className="gal-pill-count">{count.toLocaleString()}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </BottomSheet>
  );
}
