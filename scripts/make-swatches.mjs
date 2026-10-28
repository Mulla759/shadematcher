#!/usr/bin/env node
/**
 * Build tight fabric swatches for vision labelling.
 *
 * For every colourway we already store a per-image `flatness` score. The
 * flattest frame is usually a flat-lay, so we crop it hard and save it next to
 * the product. The crop is what a vision model should look at — a full model
 * shot makes the model describe skin and background instead of cloth.
 *
 *   node scripts/make-swatches.mjs --limit 40
 *   node scripts/make-swatches.mjs --site velascarves
 */

import fs from "node:fs/promises";
import fss from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve("library");
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const LIMIT = Number(opt("--limit", 0));
const PER_SITE = Number(opt("--per-site", 0));
const SITE = opt("--site", null);

const catalog = JSON.parse(await fs.readFile(path.join(ROOT, "catalog.json"), "utf8"));

let rows = catalog.colours;
if (SITE) rows = rows.filter((r) => r.site === SITE);
if (PER_SITE) {
  // balanced sample: same number from each store, spread through its catalogue
  const bySite = {};
  for (const r of rows) (bySite[r.site] ||= []).push(r);
  rows = Object.values(bySite).flatMap((list) => {
    const step = Math.max(1, Math.floor(list.length / PER_SITE));
    return Array.from({ length: Math.min(PER_SITE, list.length) }, (_, i) => list[i * step]);
  });
}
if (LIMIT) rows = rows.slice(0, LIMIT);

const out = [];
let made = 0;
let skipped = 0;

for (const row of rows) {
  const src = row.swatch_image && path.join(ROOT, row.swatch_image);
  if (!src || !fss.existsSync(src)) {
    skipped++;
    continue;
  }
  const dest = path.join(ROOT, row.folder, "swatch.jpg");
  out.push({
    id: `${row.site}:${row.color_label}`,
    swatch: path.relative(process.cwd(), dest),
    store_label: row.color_label,
    store_family: row.color_family,
    measured_hex: row.hex,
    product: row.title,
    site: row.site,
  });

  if (fss.existsSync(dest)) continue;
  try {
    const img = sharp(src);
    const { width = 900, height = 1200 } = await img.metadata();
    // centre 55% crop: flat-lays fill the frame, so this stays on cloth
    const w = Math.round(width * 0.55);
    const h = Math.round(height * 0.55);
    const buf = await img
      .extract({
        left: Math.round((width - w) / 2),
        top: Math.round(height * 0.22),
        width: w,
        height: h,
      })
      .resize({ width: 420 })
      .jpeg({ quality: 86 })
      .toBuffer();
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, buf);
    made++;
  } catch {
    skipped++;
  }
}

await fs.writeFile(
  path.join(ROOT, "swatch-batch.jsonl"),
  out.map((o) => JSON.stringify(o)).join("\n") + "\n",
);

console.log(`swatches written: ${made}, batched: ${out.length}, skipped: ${skipped}`);
console.log(`batch file: library/swatch-batch.jsonl`);
