#!/usr/bin/env node
/**
 * Turns the scraped per-site manifests into deliverables:
 *
 *   library/catalog.json          flat, one row per product colour
 *   library/colors.csv            same data for spreadsheets
 *   library/gallery.html          self-contained browsable swatch gallery
 *   src/lib/library.generated.ts  FabricColour[] the MVP can import
 *
 * Run after scripts/scrape-library.mjs.
 */

import fs from "node:fs/promises";
import fss from "node:fs";
import path from "node:path";

const ROOT = path.resolve("library");
const SRC = path.resolve("src/lib");

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
};

const FAMILY_MAP = {
  black: "Neutral",
  white: "Neutral",
  cream: "Neutral",
  beige: "Neutral",
  tan: "Neutral",
  taupe: "Neutral",
  gray: "Neutral",
  brown: "Orange",
  red: "Red",
  pink: "Pink",
  orange: "Orange",
  yellow: "Yellow",
  green: "Green",
  blue: "Blue",
  purple: "Purple",
};

const FINISH_MAP = {
  modal: "Modal",
  woven: "Matte",
  jersey: "Matte",
  chiffon: "Chiffon",
  "silk-chiffon": "Chiffon",
  "crinkle-chiffon": "Crinkle",
  "crepe-chiffon": "Crinkle",
  satin: "Satin",
  silk: "Satin",
  bamboo: "Modal",
  cotton: "Matte",
  lace: "Chiffon",
  mesh: "Chiffon",
  knit: "Matte",
};

const NOTES = {
  Neutral: "A quiet ground that lets the face lead.",
  Red: "A warm signal colour with real presence at the face.",
  Pink: "Softer reds that read as skin-adjacent or deliberately romantic.",
  Orange: "Spice and earth: the warmest end of the wheel.",
  Yellow: "Light-giving colour; small shifts in depth change everything.",
  Green: "The widest family — from cool emerald to dusty olive.",
  Blue: "Cool, clarifying and often the easiest contrast for warm skin.",
  Purple: "Dusk tones that flatter cool and olive complexions.",
};

const csvEscape = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const rows = [];
const siteSummaries = [];

const entries = await fs.readdir(ROOT, { withFileTypes: true });
for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  const manifestPath = path.join(ROOT, entry.name, "manifest.json");
  if (!fss.existsSync(manifestPath)) continue;

  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  siteSummaries.push({
    site: entry.name,
    label: SITE_LABELS[entry.name] || entry.name,
    products: manifest.products,
    images: manifest.images,
    generated_at: manifest.generated_at,
  });

  for (const r of manifest.records || []) {
    const hex = r.color?.swatch_hex;
    rows.push({
      site: entry.name,
      site_label: SITE_LABELS[entry.name] || entry.name,
      category: r.category,
      fabric: r.fabric,
      color_label: r.color?.label ?? r.title,
      color_family: r.color?.family ?? "unclassified",
      family: FAMILY_MAP[r.color?.family] || null,
      finish: FINISH_MAP[r.fabric] || "Matte",
      hex: hex || null,
      measured_family: r.color?.swatch_family ?? null,
      palette: (r.color?.palette || []).join(" "),
      tags: (r.tags || []).join(" "),
      price: (r.prices || [])[0] ?? "",
      product_url: r.source_url,
      folder: r.folder,
      swatch_image: r.color?.swatch_image ?? r.images?.[0]?.file ?? null,
      images: r.image_count,
      title: r.title,
      is_gradient: Boolean(r.color?.gradient?.stops?.length),
      gradient_stops: (r.color?.gradient?.stops || []).join(" -> "),
      gradient_angle: r.color?.gradient?.angle_deg ?? "",
      gradient_delta: r.color?.gradient?.delta_e ?? "",
    });
  }
}

rows.sort(
  (a, b) =>
    a.site.localeCompare(b.site) ||
    a.category.localeCompare(b.category) ||
    a.fabric.localeCompare(b.fabric) ||
    (a.color_family || "").localeCompare(b.color_family || "") ||
    a.title.localeCompare(b.title),
);

/* ---------------- catalog.json ---------------- */

await fs.mkdir(ROOT, { recursive: true });
await fs.writeFile(
  path.join(ROOT, "catalog.json"),
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      sites: siteSummaries,
      counts: {
        products: rows.length,
        images: rows.reduce((a, r) => a + (r.images || 0), 0),
        with_hex: rows.filter((r) => r.hex).length,
      },
      colours: rows,
    },
    null,
    2,
  ),
);

/* ---------------- index.json (per-store summary) ---------------- */

await fs.writeFile(
  path.join(ROOT, "index.json"),
  JSON.stringify(
    { generated_at: new Date().toISOString(), sites: siteSummaries },
    null,
    2,
  ),
);

/* ---------------- colors.csv ---------------- */

const headers = [
  "site",
  "site_label",
  "category",
  "fabric",
  "color_label",
  "color_family",
  "mvp_family",
  "finish",
  "hex",
  "measured_family",
  "palette",
  "price",
  "images",
  "tags",
  "product_url",
  "folder",
  "swatch_image",
  "is_gradient",
  "gradient_stops",
  "gradient_angle",
  "gradient_delta",
];
const csv = [
  headers.join(","),
  ...rows.map((r) =>
    [
      r.site,
      r.site_label,
      r.category,
      r.fabric,
      r.color_label,
      r.color_family,
      r.family || "",
      r.finish,
      r.hex || "",
      r.measured_family || "",
      r.palette,
      r.price,
      r.images,
      r.tags,
      r.product_url,
      r.folder,
      r.swatch_image || "",
      r.is_gradient ? "yes" : "",
      r.gradient_stops,
      r.gradient_angle,
      r.gradient_delta,
    ]
      .map(csvEscape)
      .join(","),
  ),
].join("\n");
await fs.writeFile(path.join(ROOT, "colors.csv"), csv);

/* ---------------- gallery.html ---------------- */

const compact = rows
  .filter((r) => r.hex)
  .map((r) => ({
    s: r.site,
    l: SITE_LABELS[r.site] || r.site,
    n: r.color_label,
    h: r.hex,
    f: r.color_family,
    m: r.family || "",
    fab: r.fabric,
    img: r.swatch_image,
    u: r.product_url,
    p: r.price,
    g: r.is_gradient ? r.gradient_stops.split(" -> ") : null,
    a: r.is_gradient ? Number(r.gradient_angle) : null,
  }));

const gallery = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hijab shade library</title>
<style>
  :root{--bg:#0f0d0b;--panel:#181513;--line:#2a2521;--ink:#f4efe8;--muted:#9d9288;--acc:#d8b48a}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
  header{padding:28px 24px 18px;border-bottom:1px solid var(--line);position:sticky;top:0;background:linear-gradient(180deg,#0f0d0b 70%,rgba(15,13,11,.92));z-index:5}
  h1{margin:0 0 4px;font-size:20px;letter-spacing:.01em}
  .sub{color:var(--muted);font-size:12.5px}
  .controls{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
  select,input{background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:8px 10px;font:inherit}
  input{min-width:220px;flex:1}
  main{padding:20px 24px 64px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:12px;overflow:hidden;text-decoration:none;color:inherit;display:flex;flex-direction:column}
  .card:hover{border-color:var(--acc)}
  .sw{height:96px;display:block;width:100%}
  .meta{padding:9px 10px 11px;display:flex;flex-direction:column;gap:2px}
  .nm{font-weight:600;font-size:12.5px;line-height:1.3}
  .fx{color:var(--muted);font-size:11px;text-transform:capitalize}
  .row{display:flex;justify-content:space-between;color:var(--muted);font-size:10.5px;margin-top:4px}
  .count{color:var(--muted);margin:0 0 14px;font-size:12px}
  .empty{color:var(--muted);padding:40px 0}
</style>
</head>
<body>
<header>
  <h1>Hijab &amp; fabric shade library</h1>
  <div class="sub" id="sub"></div>
  <div style="margin-top:10px"><a href="print-flow.html" style="color:var(--acc);font-size:12px;text-decoration:none">View prints &amp; fabrics as one flowing image →</a></div>
  <div class="controls">
    <input id="q" placeholder="Search colour name, e.g. mauve, sand, olive…">
    <select id="site"><option value="">All stores</option></select>
    <select id="family"><option value="">All families</option></select>
    <select id="fabric"><option value="">All fabrics</option></select>
    <select id="sort">
      <option value="name">Sort: name</option>
      <option value="light">Sort: light → dark</option>
      <option value="dark">Sort: dark → light</option>
    </select>
  </div>
</header>
<main>
  <p class="count" id="count"></p>
  <div class="grid" id="grid"></div>
  <p class="empty" id="empty" hidden>No colours match those filters.</p>
</main>
<script>
const DATA = ${JSON.stringify(compact)};
const $ = (id) => document.getElementById(id);
const uniq = (k) => [...new Set(DATA.map((d) => d[k]).filter(Boolean))].sort();

for (const s of uniq("l")) $("site").insertAdjacentHTML("beforeend", \`<option>\${s}</option>\`);
for (const f of uniq("f")) $("family").insertAdjacentHTML("beforeend", \`<option>\${f}</option>\`);
for (const f of uniq("fab")) $("fabric").insertAdjacentHTML("beforeend", \`<option>\${f}</option>\`);

$("sub").textContent = \`\${DATA.length.toLocaleString()} measured colourways from \${uniq("l").length} stores · click a card for the source product\`;

const lum = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
};

function render() {
  const q = $("q").value.trim().toLowerCase();
  const site = $("site").value;
  const fam = $("family").value;
  const fab = $("fabric").value;
  const sort = $("sort").value;

  let list = DATA.filter(
    (d) =>
      (!site || d.l === site) &&
      (!fam || d.f === fam) &&
      (!fab || d.fab === fab) &&
      (!q || (d.n + " " + d.f + " " + d.fab + " " + d.l).toLowerCase().includes(q)),
  );
  if (sort === "light") list.sort((a, b) => lum(b.h) - lum(a.h));
  if (sort === "dark") list.sort((a, b) => lum(a.h) - lum(b.h));
  if (sort === "name") list.sort((a, b) => a.n.localeCompare(b.n));

  $("count").textContent = \`\${list.length.toLocaleString()} colourways\`;
  $("empty").hidden = list.length > 0;

  const shown = list.slice(0, 900);
  $("grid").innerHTML = shown
    .map(
      (d) => \`<a class="card" href="\${d.u}" target="_blank" rel="noreferrer">
        <span class="sw" style="background:\${d.g ? "linear-gradient(" + d.a + "deg, " + d.g[0] + ", " + d.g[1] + ")" : d.h}" title="\${d.g ? d.g.join(" → ") : d.h}"></span>
        <span class="meta">
          <span class="nm">\${d.n}</span>
          <span class="fx">\${d.f} · \${d.fab.replace(/-/g, " ")}</span>
          <span class="row"><span>\${d.l}</span><span>\${d.g ? d.g.join(" → ") : d.h}</span></span>
        </span></a>\`,
    )
    .join("");
}

for (const id of ["q", "site", "family", "fabric", "sort"]) {
  $(id).addEventListener("input", render);
}
render();
</script>
</body>
</html>
`;
await fs.writeFile(path.join(ROOT, "gallery.html"), gallery);

/* ---------------- TypeScript catalog for the MVP ---------------- */

const solids = rows.filter((r) => r.hex && r.family);
const byHex = new Map();
for (const r of solids) {
  const key = r.hex.toUpperCase();
  if (!byHex.has(key)) byHex.set(key, r);
}
const unique = [...byHex.values()].sort(
  (a, b) => a.family.localeCompare(b.family) || a.color_label.localeCompare(b.color_label),
);

// Keep the app-side catalog practical: dedupe by hex, prefer the primary
// store, and cap. The full set stays in library/catalog.json.
const CAP = 1500;
const priority = (r) => (r.site === "velascarves" ? 0 : r.site.includes("fabric") ? 2 : 1);
const solidRows = rows.filter((r) => r.hex && r.family);
const seenHex = new Set();
const picked = [];
for (const r of [...solidRows].sort((a, b) => priority(a) - priority(b))) {
  const key = r.hex.toUpperCase();
  if (seenHex.has(key)) continue;
  seenHex.add(key);
  picked.push(r);
  if (picked.length >= CAP) break;
}

const gradientRows = rows.filter((r) => r.is_gradient);
const gradientPayload = gradientRows.map((r) => [
  r.color_label,
  r.gradient_stops.split(" -> "),
  Number(r.gradient_angle),
  Number(r.gradient_delta),
  r.site,
  r.fabric,
]);

const payload = picked.map((r, i) => [
  `lib-${String(i + 1).padStart(4, "0")}`,
  r.color_label,
  r.hex.toUpperCase(),
  r.family,
  r.finish,
  NOTES[r.family],
  [r.site, r.fabric, r.color_family].filter(Boolean),
]);

const ts = `// AUTO-GENERATED by scripts/build-index.mjs — do not edit by hand.
// Source: ${rows.length} scraped colourways across ${siteSummaries.length} stores.
// ${picked.length} unique shades are embedded here; the full library is library/catalog.json.
import type { FabricColour } from "./catalog";
import { hexToLab } from "./color";

export const LIBRARY_META = {
  generatedAt: ${JSON.stringify(new Date().toISOString())},
  colourways: ${rows.length},
  uniqueSwatches: ${picked.length},
  stores: ${siteSummaries.length},
  note: "Real retail colourways scraped from storefronts. Hex is the measured dominant shade of the flattest product photo, not a studio-measured lab value.",
} as const;

type Row = [id: string, name: string, hex: string, family: FabricColour["family"], finish: FabricColour["finish"], note: string, tags: string[]];

const ROWS: Row[] = JSON.parse(${JSON.stringify(JSON.stringify(payload))});

export const LIBRARY_FABRICS: FabricColour[] = ROWS.map(([id, name, hex, family, finish, note, tags]) => ({
  id,
  name,
  hex,
  lab: hexToLab(hex),
  family,
  finish,
  note,
  tags,
}));

export interface GradientFabric {
  name: string;
  stops: [string, string];
  angleDeg: number;
  deltaE: number;
  site: string;
  fabric: string;
}

const GRADIENTS: GradientFabric[] = JSON.parse(${JSON.stringify(JSON.stringify(gradientPayload))}).map(
  ([name, stops, angleDeg, deltaE, site, fabric]: [string, [string, string], number, number, string, string]) => ({
    name, stops, angleDeg, deltaE, site, fabric,
  }),
);

export const LIBRARY_GRADIENTS = GRADIENTS;
`;

await fs.mkdir(SRC, { recursive: true });
await fs.writeFile(path.join(SRC, "library.generated.ts"), ts);

/* ---------------- README ---------------- */

const readme = `# Hijab & fabric shade library

A scraped, labelled image library for the Auriga shade-matching MVP.

Snapshot: **${rows.length.toLocaleString()} colourways**, **${rows.reduce((a, r) => a + (r.images || 0), 0).toLocaleString()} images**, **${siteSummaries.length} stores**, ${rows.filter((r) => r.hex).length.toLocaleString()} with a measured swatch hex.
Last built: ${new Date().toISOString()}

## What is here

\`\`\`
library/
  <store>/
    <category>/          scarves · apparel · accessories · hoodies · …
      <fabric>/          modal · chiffon · jersey · woven · silk-chiffon · …
        <colour-family>/ black · brown · beige · pink · blue · green · …
          <product>/     01.jpg 02.jpg … meta.json
    manifest.json        every product record for that store
  catalog.json           all stores flattened, one row per colourway
  colors.csv             the same table for spreadsheets
  gallery.html           open in a browser to browse every swatch
  print-flow.html        one flowing image of every textile photo
  print-flow.jpg         large justified collage of the same photos
  print-flow.webp        half-width screen preview
  print-flow.json        counts, stores and layout metadata
  index.json             per-store scrape summary
\`\`\`

\`meta.json\` in each product folder carries the label, colour family, fabric,
price, tags, source URL, per-image dominant hex, palette and flatness score.

## How it was scraped

All sources are Shopify storefronts, so the public JSON catalogue is used
instead of HTML scraping. No proxy or anti-bot service is required, and it
cannot time out mid-page because every product is fetched independently.

\`\`\`
GET https://<store>/products.json?limit=250&page=N   # 250 products per page
\`\`\`

This returns title, handle, product_type, tags, variants, prices and every
image URL. Images are pulled from \`cdn.shopify.com\`, resized to 900px and
re-encoded as JPEG, so the tree stays browsable and cheap to ship.

Run it:

\`\`\`bash
node scripts/scrape-library.mjs --site velascarves   # one store
node scripts/scrape-library.mjs --all                # every store in data/sources.json
node scripts/build-index.mjs                         # rebuild catalog, csv, gallery, TS
\`\`\`

Add a store by appending to \`data/sources.json\`:

\`\`\`json
{ "slug": "store-name", "domain": "store.com", "role": "hijab-brand",
  "maxProducts": 400, "maxImages": 3 }
\`\`\`

Downloads are cached: re-running skips files that already exist and only
recomputes metadata, so a partial run is always resumable.

### Why not the Oxylabs Web Scraper API

The Oxylabs skill needs \`OXY_WSA_USERNAME\` / \`OXY_WSA_PASSWORD\`. Neither is set
in this environment, and no Shopify storefront here blocks a plain request, so
the \`universal\` source would only have added cost and latency. The scrape kept
the same shape (one request per page, retries with backoff, per-image retry) so
it can be swapped to \`POST https://realtime.oxylabs.io/v1/queries\` later if a
non-Shopify source is added.

### treg

\`treg.web.search\` / \`treg.web.extract\` were the intended discovery path, but the
installed treg token is expired ("not signed in, or this token is invalid or
expired"), so store discovery used the built-in web search. Re-run
\`treg login\` + \`treg mcp install\` and the same queries work through treg.

## Gradients (ombre)

Ombre is not a flat colour, so those products get a different shape. They sit
under \`.../<fabric>/gradient/<product>/\` and their \`meta.json\` carries:

\`\`\`json
"gradient": {
  "stops": ["#cb849b", "#a77879"],
  "angle_deg": 90,
  "delta_e": 16.2,
  "detected": true,
  "stops_family": ["pink", "red"]
}
\`\`\`

\`angle_deg\` is 0 for a left-to-right fade and 90 for top-to-bottom. It is
measured by comparing the colour swing along both axes of the fabric photo, so
it reflects how the cloth actually reads, not how the product page is laid out.
\`delta_e\` below 6 means the "gradient" is probably lighting rather than dye.

The gallery draws these tiles as a real gradient; \`colors.csv\` has
\`is_gradient\`, \`gradient_stops\`, \`gradient_angle\` and \`gradient_delta\`
columns; \`library.generated.ts\` exports them separately as
\`LIBRARY_GRADIENTS\` because a two-stop object is not a \`FabricColour\`.

## Caveats

- **Hex is measured, not certified.** It is the median of the flattest product
  photo after dropping studio-white and shadow pixels. Model skin tones still
  leak into some shots. Treat \`color.family\` (from the store's own tags) as the
  trustworthy label and \`swatch_hex\` as a starting point for decking.
- **Prints** land in the \`print\` family; their hex is not a single shade.
- **Naming is the retailer's.** "Mushroom", "Taupe" and "Stone" overlap heavily
  across stores, which is exactly the mapping problem the MVP should solve.
- **Rights.** Images belong to each store. This library is for internal colour
  research and prototype matching; do not republish the photography.

## Print & fabric flow

The colourway gallery is a card index of measured swatches. print-flow.html is the visual counterpart: one justified, hue-sorted collage of the actual product photos for every scraped print/fabric textile colourway. It excludes accessories, gifts, beauty and tools.

Rebuild it with:

    node scripts/build-print-flow.mjs

Photos belong to each store; internal colour research only, not for republication.

## Use in the MVP

\`src/lib/library.generated.ts\` exports \`LIBRARY_FABRICS: FabricColour[]\` with
Lab values already attached, so it drops into \`nearestFabrics()\`:

\`\`\`ts
import { LIBRARY_FABRICS } from "@/lib/library.generated";
import { nearestFabrics } from "@/lib/catalog";

const matches = nearestFabrics(skinLab, 8, LIBRARY_FABRICS);
\`\`\`
`;
await fs.writeFile(path.join(ROOT, "README.md"), readme);
