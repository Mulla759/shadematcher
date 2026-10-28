#!/usr/bin/env node
/**
 * Add the stores' own image URLs to the published search index.
 *
 * The scrape kept, for every downloaded photo, the exact CDN URL it came from
 * (library/**\/meta.json -> images[].source_url). This script copies that URL
 * into public/catalog/shades.json as `remote`, so the browser can show the real
 * product photograph without the 1.3 GB library ever being deployed.
 *
 * The `remote` value is the store's own CDN link, plus Shopify's resize
 * parameters so the browser pulls a ~9 KB thumbnail instead of a ~400 KB
 * original. Nothing is copied or mirrored: the bytes stay with the store.
 *
 *   node scripts/build-hotlink-index.mjs
 */

import fs from "node:fs/promises";
import fss from "node:fs";
import path from "node:path";

const ROOT = path.resolve("library");
const INDEX = path.join("public", "catalog", "shades.json");

/** Square crop for the 54 px row swatches; falls back to a width for other hosts. */
const thumb = (url) => {
  if (url.includes("cdn.shopify.com")) {
    return `${url}${url.includes("?") ? "&" : "?"}width=240&height=240&crop=center`;
  }
  return url;
};

async function collectMeta(dir, out = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectMeta(full, out);
    } else if (entry.name === "meta.json") {
      out.push(full);
    }
  }
  return out;
}

if (!fss.existsSync(ROOT)) {
  console.error(`Library not found at ${ROOT}. Run npm run scrape:all first.`);
  process.exit(1);
}
if (!fss.existsSync(INDEX)) {
  console.error(`Index not found at ${INDEX}. Run npm run library:catalog first.`);
  process.exit(1);
}

const metaFiles = await collectMeta(ROOT);
const remoteByFile = new Map();

for (const file of metaFiles) {
  let meta;
  try {
    meta = JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    continue;
  }
  for (const image of meta.images ?? []) {
    if (image?.file && image?.source_url) {
      remoteByFile.set(image.file, image.source_url);
    }
  }
}

const index = JSON.parse(await fs.readFile(INDEX, "utf8"));
let matched = 0;
let missing = 0;

for (const row of index.rows ?? []) {
  const remote = remoteByFile.get(row.image);
  if (remote) {
    row.remote = remote;
    row.remoteThumb = thumb(remote);
    matched += 1;
  } else {
    delete row.remote;
    delete row.remoteThumb;
    missing += 1;
  }
}

index.note =
  "Measured dominant shade from each scraped textile product photo. Internal colour research; photography belongs to each store. `remote` points at the store's own CDN.";

await fs.writeFile(INDEX, JSON.stringify(index));

console.log(`Indexed ${matched.toLocaleString()} of ${(index.rows?.length ?? 0).toLocaleString()} colourways with a store CDN URL`);
if (missing > 0) {
  console.log(`${missing.toLocaleString()} rows have no remote URL — they fall back to the local library or the measured hex.`);
}
console.log(`Wrote ${INDEX}`);
