#!/usr/bin/env node
/**
 * OneYard (oneyard.shop) scraper — Shopify-free, so it gets its own pass.
 *
 * The ombre listing is plain HTML with root-level product slugs; each product
 * page carries schema.org Product JSON-LD, which is where the gallery images
 * and price come from. Records match the shape scripts/scrape-library.mjs
 * writes, plus a two-stop gradient measurement.
 *
 *   node scripts/scrape-oneyard.mjs [--max-pages 6]
 */

import fs from "node:fs/promises";
import fss from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SITE = "oneyard";
const DOMAIN = "oneyard.shop";
const BASE = `https://${DOMAIN}`;
const ROOT = path.resolve("library");
const RAW = path.resolve("data/raw");
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";

const args = process.argv.slice(2);
const MAX_PAGES = Number(args[args.indexOf("--max-pages") + 1]) || 6;

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "untitled";

const MULTI_RE = /rainbow|multi[- ]?colou?r|\b(?:[3-9]|1[0-9]) colou?rs?\b/i;

const FABRICS = [
  "chiffon", "sequin", "lace", "tulle", "satin", "organza", "mesh", "velvet",
  "crepe", "jersey", "tricot", "knit", "challis", "boucle", "seersucker",
  "jacquard", "taffeta", "georgette", "voile",
];

function classifyFabric(title) {
  const t = title.toLowerCase();
  for (const f of FABRICS) if (t.includes(f)) return f;
  return "unclassified";
}

const toHex = (m) =>
  "#" + m.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

function rgb2lab(r, g, b) {
  const lin = (c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(r), G = lin(g), B = lin(b);
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}
const labDist = (p, q) =>
  Math.sqrt((p.l - q.l) ** 2 + (p.a - q.a) ** 2 + (p.b - q.b) ** 2);

const hexToFamily = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2 / 255;
  const s = max === min ? 0 : (max - min) / (255 - Math.abs(2 * l - 1) || 1);
  if (s < 0.12 || l < 0.08) return l > 0.75 ? "white" : "black";
  if (l > 0.9 && s < 0.25) return "white";
  let h;
  const d = max - min;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  if (l > 0.78 && s < 0.3) return h > 20 && h < 60 ? "cream" : "white";
  if (l < 0.3) return h > 200 && h < 260 ? "blue" : "black";
  if (s < 0.18) return l > 0.62 ? "gray" : "taupe";
  if (h < 15 || h >= 345) return "red";
  if (h < 40) return "brown";
  if (h < 52) return "orange";
  if (h < 68) return "yellow";
  if (h < 160) return "green";
  if (h < 255) return "blue";
  if (h < 290) return "purple";
  return "pink";
};

async function measureGradient(file) {
  const raw = await sharp(file).resize(80, 80, { fit: "fill" }).removeAlpha().raw().toBuffer();
  const N = 80;
  const at = (x, y) => { const i = (y * N + x) * 3; return [raw[i], raw[i + 1], raw[i + 2]]; };
  const median = (px) => {
    const s = [...px].sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
    return s[Math.floor(s.length / 2)];
  };
  const band = (axis, from, to) => {
    const px = [];
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const t = axis === "x" ? x / N : y / N;
        if (t >= from && t < to) px.push(at(x, y));
      }
    return median(px);
  };
  // Inset bands: the outer 15% is usually studio backdrop, and sampling it
  // drags a white stop into every reading.
  const hA = band("x", 0.15, 0.35), hB = band("x", 0.65, 0.85);
  const vA = band("y", 0.15, 0.35), vB = band("y", 0.65, 0.85);
  const compare = (p, q) => {
    const A = rgb2lab(...p), B = rgb2lab(...q);
    const cA = Math.hypot(A.a, A.b), cB = Math.hypot(B.a, B.b);
    return {
      full: labDist(A, B),
      chroma: Math.hypot(A.a - B.a, A.b - B.b),
      light: Math.abs(A.l - B.l),
      cShift: Math.abs(cA - cB),
    };
  };
  const H = compare(hA, hB), V = compare(vA, vB);
  const horizontal = H.chroma + H.cShift >= V.chroma + V.cShift;
  const best = horizontal ? H : V;
  const stops = horizontal ? [hA, hB] : [vA, vB];
  const round1 = (n) => Math.round(n * 10) / 10;
  return {
    stops: [toHex(stops[0]), toHex(stops[1])],
    angle_deg: horizontal ? 0 : 90,
    delta_e: round1(best.full),
    chroma_delta: round1(best.chroma),
    lightness_delta: round1(best.light),
    detected: best.chroma >= 5 || best.light >= 30,
  };
}

async function dominantColor(file) {
  const img = sharp(file);
  const meta = await img.metadata();
  const w = meta.width || 600, h = meta.height || 800;
  const cw = Math.round(w * 0.5), ch = Math.round(h * 0.5);
  const raw = await img
    .extract({ left: Math.round((w - cw) / 2), top: Math.round(h * 0.25), width: cw, height: ch })
    .resize(40, 40, { fit: "fill" }).removeAlpha().raw().toBuffer();
  const px = [];
  for (let i = 0; i < raw.length; i += 3) {
    const r = raw[i], g = raw[i + 1], b = raw[i + 2];
    if (r > 245 && g > 245 && b > 245) continue;
    if (r < 12 && g < 12 && b < 12) continue;
    px.push([r, g, b]);
  }
  const use = px.length ? px : [[128, 128, 128]];
  const s = [...use].sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
  return toHex(s[Math.floor(s.length / 2)]);
}

async function download(url, dest) {
  if (fss.existsSync(dest)) return { skipped: true };
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(45000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1000) throw new Error("tiny body");
      await fs.mkdir(path.dirname(dest), { recursive: true });
      const out = await sharp(buf).rotate().resize({ width: 900, withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true }).toBuffer();
      await fs.writeFile(dest, out);
      return { bytes: out.length };
    } catch (err) {
      if (attempt === 3) return { error: String(err?.message || err) };
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
}

function productLd(html) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  for (const b of blocks) {
    try {
      const j = JSON.parse(b[1]);
      const arr = Array.isArray(j) ? j : [j];
      for (const x of arr) if (x["@type"] === "Product") return x;
    } catch {}
  }
  return null;
}

/* ---------------- listing ---------------- */

console.log("=== oneyard (oneyard.shop) — ombre listing ===");
const links = new Set();
for (let page = 1; page <= MAX_PAGES; page++) {
  const url = page === 1 ? `${BASE}/fabrics/ombre` : `${BASE}/fabrics/ombre?p=${page}`;
  let html;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(40000) });
    if (!res.ok) break;
    html = await res.text();
  } catch { break; }
  const found = [...html.matchAll(/href="(\/[a-z0-9-]+\.html)"/g)].map((m) => m[1]);
  const before = links.size;
  found.forEach((f) => links.add(f));
  console.log(`  page ${page}: +${links.size - before} (total ${links.size})`);
  if (links.size === before) break;
}
await fs.mkdir(RAW, { recursive: true });
await fs.writeFile(path.join(RAW, "oneyard-links.json"), JSON.stringify([...links], null, 2));

/* ---------------- products ---------------- */

const records = [];
const errors = [];
let imageCount = 0;

for (const rel of links) {
  const url = BASE + rel;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(40000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const ld = productLd(html);
    if (!ld) throw new Error("no JSON-LD");

    const title = ld.name || rel.replace(/\.html$/, "").replace(/-/g, " ");
    const imgs = (Array.isArray(ld.image) ? ld.image : [ld.image]).filter(Boolean).slice(0, 4);
    const price = ld.offers?.price ?? ld.offers?.[0]?.price ?? null;
    const fabric = classifyFabric(title);
    const handle = rel.replace(/^\//, "").replace(/\.html$/, "");
    const isMulti = MULTI_RE.test(title);
    const dir = path.join(
      ROOT,
      SITE,
      "fabric",
      fabric,
      isMulti ? "multi" : "gradient",
      slugify(handle),
    );

    const local = [];
    let n = 0;
    for (const src of imgs) {
      n++;
      const ext = ".jpg";
      const file = path.join(dir, `${String(n).padStart(2, "0")}${ext}`);
      const r = await download(src, file);
      if (r.error) { errors.push({ url, src, error: r.error }); continue; }
      if (!r.skipped) imageCount++;
      local.push({ position: n, file: path.relative(ROOT, file), source_url: src, dominant_hex: null });
    }
    for (const im of local) {
      im.dominant_hex = await dominantColor(path.join(ROOT, im.file));
    }

    // keep the frame with the strongest chroma swing, not just the first
    let gradient = null;
    let swatch = local[0] || null;
    for (const im of local) {
      const g = await measureGradient(path.join(ROOT, im.file));
      if (!gradient || g.chroma_delta > (gradient.chroma_delta ?? -1)) {
        gradient = g;
        swatch = im;
      }
    }
    if (gradient) gradient.stops_family = gradient.stops.map(hexToFamily);

    // rainbow / multi-colour: keep as a normal colourway, out of the gradient set
    if (isMulti) gradient = null;

    const record = {
      site: SITE,
      source_url: url,
      handle,
      title,
      label: title.replace(/\s*(fabric )?by the yard\s*/i, "").trim(),
      parent_title: null,
      colour_option: false,
      product_type: "fabric",
      category: "fabric",
      fabric,
      color: {
        label: title.replace(/\s*(fabric )?by the yard\s*/i, "").trim(),
        label_family: gradient?.stops_family?.[0] || "unclassified",
        family: gradient
          ? "gradient"
          : swatch?.dominant_hex
            ? hexToFamily(swatch.dominant_hex)
            : "unclassified",
        family_source: gradient ? "gradient" : "measured",
        tags: [],
        swatch_hex: swatch?.dominant_hex || null,
        swatch_family: swatch?.dominant_hex ? hexToFamily(swatch.dominant_hex) : null,
        swatch_image: swatch?.file || null,
        palette: gradient?.stops || [],
        gradient,
      },
      tags: ["ombre", "gradient"],
      vendor: "OneYard",
      prices: price ? [String(price)] : [],
      sizes: [],
      description: (ld.description || "").slice(0, 700),
      images: local,
      image_count: local.length,
      folder: path.relative(ROOT, dir),
      scraped_at: new Date().toISOString(),
    };

    if (local.length) {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, "meta.json"), JSON.stringify(record, null, 2));
    }
    records.push(record);
    if (records.length % 10 === 0)
      console.log(`  … ${records.length}/${links.size} products, ${imageCount} images`);
  } catch (err) {
    errors.push({ url, error: String(err?.message || err) });
  }
}

await fs.mkdir(path.join(ROOT, SITE), { recursive: true });
await fs.writeFile(
  path.join(ROOT, SITE, "manifest.json"),
  JSON.stringify(
    {
      site: SITE,
      domain: DOMAIN,
      generated_at: new Date().toISOString(),
      products: records.length,
      images: records.reduce((a, r) => a + r.image_count, 0),
      categories: ["fabric"],
      fabrics: [...new Set(records.map((r) => r.fabric))],
      color_families: ["gradient"],
      errors,
      records,
    },
    null,
    2,
  ),
);
// prune product folders that moved between gradient/ and multi/
const canonical = new Set(records.map((r) => path.resolve(ROOT, r.folder)));
let pruned = 0;
const walk = async (dir) => {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (!e.isDirectory()) continue;
    if (!canonical.has(full) && fss.existsSync(path.join(full, "meta.json"))) {
      await fs.rm(full, { recursive: true, force: true });
      pruned++;
      continue;
    }
    await walk(full);
  }
};
await walk(path.join(ROOT, SITE));
if (pruned) console.log(`  pruned ${pruned} stale folder(s)`);

console.log(`done: ${records.length} products, ${imageCount} new images, ${errors.length} errors`);
