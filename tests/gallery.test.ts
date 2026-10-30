import { describe, expect, it } from "vitest";
import { compactTraits, deriveTraits, traitsFromText } from "../scripts/traits.mjs";
import {
  EMPTY_FILTERS,
  activeFilters,
  applyFilters,
  clearFilter,
  countFacets,
  matchesQuery,
  ownCatalogueItems,
  type GalleryFilters,
  type GalleryItem,
} from "@/lib/gallery";

describe("store-stated traits", () => {
  it("reads weight, opacity and season out of the shop's tags", () => {
    const traits = deriveTraits({
      tags: "lightweight chiffon sheer summer",
      title: "Classic Dress",
    });
    expect(traits.weight).toEqual(["lightweight"]);
    expect(traits.opacity).toEqual(["sheer"]);
    expect(traits.season).toEqual(["summer"]);
    expect(traits.weightFrom).toBe("tags");
  });

  it("keeps the gram weight the shop published", () => {
    const traits = deriveTraits({
      tags: "",
      title: "Lightweight (40 GSM) Non-Woven Fusible Interfacing",
    });
    expect(traits.weight).toEqual(["lightweight", "40 gsm"]);
    expect(traits.weightFrom).toBe("title");
  });

  it("trusts the product specification over a conflicting tag", () => {
    const traits = deriveTraits({
      tags: "characteristic:Lightweight content:Polyester",
      title: "Medium Weight (95 GSM) Non-Woven Fusible Interfacing",
    });
    expect(traits.weight).toEqual(["medium weight", "95 gsm"]);
    expect(traits.weightFrom).toBe("title");
  });

  it("prefers the more specific opacity word", () => {
    expect(traitsFromText("Semi-Sheer Printed Rayon").opacity).toEqual(["semi-sheer"]);
    expect(traitsFromText("Semi-Sheer Printed Rayon").opacity).not.toContain("sheer");
  });

  it("reads fall and autumn as the same season", () => {
    expect(traitsFromText("fall collection").season).toEqual(["autumn"]);
    expect(traitsFromText("autumn").season).toEqual(["autumn"]);
  });

  it("takes a season from either the tags or the title", () => {
    const traits = deriveTraits({ tags: "summer spring", title: "Winter Coat" });
    // Seasons come back in calendar order, whatever order the shop wrote them.
    expect(traits.season).toEqual(["spring", "summer", "winter"]);
    expect(traits.seasonFrom).toBe("tags+title");
  });

  it("invents nothing when the shop said nothing", () => {
    const traits = deriveTraits({ tags: "cotton blue", title: "Dress" });
    expect(traits.weight).toBeUndefined();
    expect(traits.opacity).toBeUndefined();
    expect(traits.season).toBeUndefined();
  });

  it("drops empty dimensions from the published shape", () => {
    expect(compactTraits({ weight: [], opacity: [], season: [] })).toBeUndefined();
    expect(
      compactTraits({
        weight: ["lightweight"],
        weightFrom: "tags",
        opacity: [],
        season: [],
        from: null,
      } as never),
    ).toEqual({ weight: ["lightweight"], weightFrom: "tags" });
  });
});

describe("the gallery's own colours", () => {
  const own = ownCatalogueItems();

  it("carries every colour in the project's own catalogue", () => {
    expect(own.length).toBe(132);
    expect(own.filter((item) => item.source === "own")).toHaveLength(72);
    expect(own.filter((item) => item.source === "atlas")).toHaveLength(60);
  });

  it("gives every colour a hex, a LAB value and an honest origin", () => {
    for (const item of own) {
      expect(item.hex).toMatch(/^#[0-9a-f]{6}$/i);
      expect(Number.isFinite(item.lab.l)).toBe(true);
      expect(item.originDetail.toLowerCase()).toContain("not");
    }
  });

  it("gives every colour a unique id", () => {
    const ids = new Set(own.map((item) => item.id));
    expect(ids.size).toBe(own.length);
  });
});

/** A small stand-in for a scraped row, so the filter tests stay readable. */
const row = (over: Partial<GalleryItem> & { id: string }): GalleryItem => ({
  source: "scraped",
  name: "Sample",
  title: "Sample",
  hex: "#b9a389",
  lab: { l: 68, a: 4, b: 16 },
  family: "Neutral",
  finish: "Matte",
  fabric: "chiffon",
  category: "scarves",
  site: "shop",
  siteLabel: "A Shop",
  price: "10.00",
  url: "https://example.com",
  palette: [],
  gradient: null,
  origin: "Scraped product photo",
  originDetail: "Digital approximation.",
  ...over,
});

describe("gallery filters", () => {
  const items: GalleryItem[] = [
    row({ id: "a", family: "Blue", fabric: "chiffon", traits: { season: ["summer"], seasonFrom: "tags" } }),
    row({ id: "b", family: "Neutral", fabric: "modal", traits: { season: ["winter"], seasonFrom: "tags" } }),
    row({ id: "c", family: "Blue", fabric: "chiffon" }),
  ];

  const filters = (over: Partial<GalleryFilters>): GalleryFilters => ({
    ...EMPTY_FILTERS,
    ...over,
  });

  it("returns everything when no filter is on", () => {
    expect(applyFilters(items, EMPTY_FILTERS)).toHaveLength(3);
  });

  it("filters by colour family", () => {
    expect(applyFilters(items, filters({ family: "Blue" })).map((i) => i.id)).toEqual(["a", "c"]);
  });

  it("filters by fabric type", () => {
    expect(applyFilters(items, filters({ fabric: "modal" })).map((i) => i.id)).toEqual(["b"]);
  });

  it("filters by a store-stated season only where the shop said one", () => {
    expect(applyFilters(items, filters({ season: "summer" })).map((i) => i.id)).toEqual(["a"]);
  });

  it("combines filters", () => {
    expect(
      applyFilters(items, filters({ family: "Blue", fabric: "chiffon", season: "summer" })).map((i) => i.id),
    ).toEqual(["a"]);
  });

  it("searches across the fields a buyer would type", () => {
    expect(matchesQuery(items[0], "chiffon")).toBe(true);
    expect(matchesQuery(items[0], "blue")).toBe(true);
    expect(matchesQuery(items[0], "#b9a389")).toBe(true);
    expect(matchesQuery(items[0], "silk")).toBe(false);
    expect(matchesQuery(items[0], "")).toBe(true);
  });

  it("counts each dimension without counting its own filter out", () => {
    const facets = countFacets(items, filters({ family: "Blue" }));
    // The Blue filter does not remove Blue from its own count…
    expect(facets.family.Blue).toBe(2);
    // …but it does narrow the fabric counts.
    expect(facets.fabric.chiffon).toBe(2);
    expect(facets.fabric.modal).toBeUndefined();
  });

  it("lists the filters that are on, and can clear one at a time", () => {
    const active = activeFilters(filters({ family: "Blue", season: "summer" }));
    expect(active.map((entry) => entry.key)).toEqual(["family", "season"]);
    expect(clearFilter(filters({ family: "Blue", season: "summer" }), "season").season).toBe("all");
    expect(clearFilter(filters({ family: "Blue" }), "family").family).toBe("all");
  });

  it("clears the source filter under its own key", () => {
    const active = activeFilters(filters({ source: "own" }));
    expect(active[0]).toEqual({ key: "source", value: "own", label: "Auriga colours" });
    expect(clearFilter(filters({ source: "own" }), "source").source).toBe("all");
  });
});
