#!/usr/bin/env node
/**
 * Build the client/server search index for the scraped textile catalogue.
 *
 * Source: library/catalog.json (7,441 colourways, 15 stores)
 * Output: public/catalog/shades.json (one row per textile photo)
 *
 * The filter mirrors scripts/build-print-flow.mjs so the searchable catalogue
 * matches the gallery: textiles only, no accessories/gifts/beauty, and one row
 * per actual product photo.
 */

import fs from "node:fs/promises";
import fss from "node:fs";
import path from "node:path";
import { compactTraits, deriveTraits } from "./traits.mjs";

const ROOT = path.resolve("library");
const OUT = path.resolve("public/catalog");

const TEXTILE_CATEGORIES = new Set([
  "scarves",
  "apparel",
  "fabric",
  "unclassified",
  "lace",
  "jersey",
  "mikado",
  "suiting",
  "crepe",
  "chiffon",
  "linen",
  "satin",
  "velvet",
  "twill",
  "knit",
  "organza",
  "poplin",
  "scuba",
  "vinyl",
  "children-and-young-adult",
  "co-ords",
  "jumpsuit",
  "hoodies",
  "modest-activewear",
  "underscarves",
  "arm-covers",
  "neck-and-chest-cover",
  "embroidered",
]);

const EXCLUDE_TITLE =
  /gift|bag\b|box|scrunchie|magnet|pin\b|card|perfume|nail|qur|book|machine|needle|scissors|chalk|curtain|table ?cloth|towel|blanket|pillow|rug|apron|mask|glove|sock|shoe|jewel|necklace|bracelet|earring|ring|watch|tote|pouch|wallet|belt|hat|cap|hanger|organizer|delicates|sticker|poster|stationery|toy|incense|miswak|kajal|lip|deodor|shampoo|toothpaste|sunscreen|vitamin|supplement|cream|body ?wash|soap|card game|hajj|umrah|phone case|sunglass|headband|bonnet|scrunch/i;

const SITE_LABELS = {
  velascarves: "Vela Scarves",
  voilechic: "Voile Chic",
  culturehijab: "Culture Hijab",
  lalahijabs: "Lala Hijabs",
  modishhijab: "Modish Hijab",
  trymodest: "Try Modest",
  uniquehijabs: "Unique Hijabs",
  nouremporium: "Nour Emporium",
  kabayarefashion: "Kabayare Fashion",
  fabricwholesaledirect: "Fabric Wholesale Direct",
  zelouffabrics: "Zelouf Fabrics",
  denverfabrics: "Denver Fabrics",
  cielonfabric: "Cielon Fabric",
  longancraft: "Longan Craft",
  oneyard: "One Yard",
};

const normalizeHex = (value) => {
  const hex = String(value || "").trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(hex) ? hex : null;
};

/**
 * Reads a product's meta.json once.
 *
 * meta.json carries the capture conditions for the measured colour: how flat
 * the photo was (`images[].flatness`, the lower the flatter) and how the shop
 * labelled the colour (`color.family_source` — tags, variant, title or the
 * measurement itself). Both are published with the row so the gallery can
 * show how a colour was read instead of presenting it as ground truth.
 */
const metaCache = new Map();
const metaFor = (folder) => {
  if (!folder) return null;
  if (metaCache.has(folder)) return metaCache.get(folder);
  let meta = null;
  try {
    meta = JSON.parse(fss.readFileSync(path.join(ROOT, folder, "meta.json"), "utf8"));
  } catch {
    meta = null;
  }
  metaCache.set(folder, meta);
  return meta;
};

const catalog = JSON.parse(await fs.readFile(path.join(ROOT, "catalog.json"), "utf8"));
const source = (catalog.colours || []).filter((row) => {
  if (!row.swatch_image) return false;
  if (!TEXTILE_CATEGORIES.has(row.category)) return false;
  if (EXCLUDE_TITLE.test(row.title || "")) return false;
  if (!normalizeHex(row.hex)) return false;
  return fss.existsSync(path.join(ROOT, row.swatch_image));
});

const seen = new Set();
const rows = [];
for (const row of source) {
  if (seen.has(row.swatch_image)) continue;
  seen.add(row.swatch_image);
  const hex = normalizeHex(row.hex);
  const meta = metaFor(row.folder);
  const photo = (meta?.images ?? []).find((image) => image.file === row.swatch_image);
  const traits = compactTraits(
    deriveTraits({ tags: row.tags, title: row.title }),
  );
  const entry = {
    id: `cat-${String(rows.length + 1).padStart(4, "0")}`,
    name: row.color_label || row.title,
    title: row.title,
    hex,
    family: row.family || "Neutral",
    finish: row.finish || "Matte",
    site: row.site,
    siteLabel: SITE_LABELS[row.site] || row.site_label || row.site,
    category: row.category,
    fabric: row.fabric || "unclassified",
    price: row.price || "",
    image: row.swatch_image,
    url: row.product_url || "",
    palette: row.palette || "",
    gradient: row.is_gradient
      ? {
          stops: String(row.gradient_stops || "").split(" -> ").filter(Boolean),
          angle: Number(row.gradient_angle) || 0,
          deltaE: Number(row.gradient_delta) || 0,
        }
      : null,
  };

  // Additive, optional fields. Every one of them is extra context for the
  // gallery; the search index keeps working if they are all absent.
  if (row.color_family) entry.colorFamily = row.color_family;
  if (row.measured_family) entry.measuredFamily = row.measured_family;
  if (meta?.color?.family_source) entry.familySource = meta.color.family_source;
  if (typeof photo?.flatness === "number") entry.flatness = photo.flatness;
  if (row.images) entry.photoCount = row.images;
  if (traits) entry.traits = traits;

  rows.push(entry);
}

rows.sort(
  (a, b) =>
    a.site.localeCompare(b.site) ||
    a.category.localeCompare(b.category) ||
    a.family.localeCompare(b.family) ||
    a.name.localeCompare(b.name) ||
    a.hex.localeCompare(b.hex),
);

const families = rows.reduce((acc, row) => {
  acc[row.family] = (acc[row.family] || 0) + 1;
  return acc;
}, {});
const stores = rows.reduce((acc, row) => {
  acc[row.siteLabel] = (acc[row.siteLabel] || 0) + 1;
  return acc;
}, {});
const categories = rows.reduce((acc, row) => {
  acc[row.category] = (acc[row.category] || 0) + 1;
  return acc;
}, {});

/** How many rows carry each store-stated trait, so the gallery can be honest about coverage. */
const traitCoverage = { weight: 0, opacity: 0, season: 0 };
for (const row of rows) {
  if (row.traits?.weight?.length) traitCoverage.weight += 1;
  if (row.traits?.opacity?.length) traitCoverage.opacity += 1;
  if (row.traits?.season?.length) traitCoverage.season += 1;
}

await fs.mkdir(OUT, { recursive: true });
await fs.writeFile(
  path.join(OUT, "shades.json"),
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: "library/catalog.json",
    note: "Measured dominant shade from each scraped textile product photo. Internal colour research; photography belongs to each store.",
    /**
     * How the colour was read, published with the rows so nothing here is
     * mistaken for a physical swatch. `lab` is derived from the measured hex
     * at read time; it is not an independent measurement.
     */
    measurement: {
      method:
        "Median dominant colour of the flattest product photo, with studio-white and shadow pixels removed.",
      source: "Scraped store product photography.",
      lab: "CIELAB is derived from the measured hex at read time, not measured independently.",
      flatness:
        "Per-photo flatness score from the scrape: the lower the number, the flatter the photo the colour was read from.",
      label:
        "`family` is the retailer's own colour family; `colorFamily` is their finer wording; `measuredFamily` is the family the measured hex falls into.",
      traits:
        "`traits` are store-stated wording read from the retailer's tags and product title (weight, opacity, season). They are not measurements and most rows carry none.",
      warning:
        "Every colour here is a digital approximation measured from a scraped image, not an accurate physical swatch.",
    },
    count: rows.length,
    families,
    stores,
    categories,
    traitCoverage,
    rows,
  }),
);

console.log(`Wrote ${rows.length.toLocaleString()} textile colourways to public/catalog/shades.json`);
console.log(`Stores: ${Object.keys(stores).length} · Families: ${Object.keys(families).length}`);
console.log(
  `Store-stated traits: weight ${traitCoverage.weight} · opacity ${traitCoverage.opacity} · season ${traitCoverage.season}`,
);
