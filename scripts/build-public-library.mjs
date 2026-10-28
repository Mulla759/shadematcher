/**
 * Builds a deployable subset of the scraped photography.
 *
 *   npm run library:subset -- --limit 600
 *
 * The full library is ~1.3 GB of third-party store photography and is not in
 * Git. This copies the first N colourways into `public/photos/` so a
 * deployment can show real product photos, and writes a manifest the client
 * can use to decide what to load.
 *
 * `public/photos/` is gitignored on purpose: the photography belongs to the
 * shops. Use it for a private deployment, or run it as a build step on a host
 * that has the library.
 */
import { cp, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const libraryDir = path.join(root, process.env.AURIGA_LIBRARY_DIR ?? "library");
const indexFile = path.join(root, "public", "catalog", "shades.json");
const outDir = path.join(root, "public", "photos");

const args = process.argv.slice(2);
const limitArg = args.indexOf("--limit");
const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : 600;
const categoryArg = args.indexOf("--category");
const category = categoryArg >= 0 ? args[categoryArg + 1] : null;

if (!existsSync(libraryDir)) {
  console.error(`Library not found at ${libraryDir}. Run npm run scrape:all first.`);
  process.exit(1);
}
if (!existsSync(indexFile)) {
  console.error(`Index not found at ${indexFile}. Run npm run library:catalog first.`);
  process.exit(1);
}

const index = JSON.parse(await (await import("node:fs/promises")).readFile(indexFile, "utf8"));
let rows = index.rows ?? [];
if (category) rows = rows.filter((row) => row.category === category);
rows = rows.slice(0, Math.max(0, limit));

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

let copied = 0;
let bytes = 0;
const manifest = [];

for (const row of rows) {
  const source = path.join(libraryDir, row.image);
  const target = path.join(outDir, row.image);
  try {
    const info = await stat(source);
    if (!info.isFile()) continue;
    await mkdir(path.dirname(target), { recursive: true });
    await cp(source, target);
    copied += 1;
    bytes += info.size;
    manifest.push({ id: row.id, image: row.image, bytes: info.size });
  } catch {
    // Missing photo: the client falls back to the measured hex swatch.
  }
}

await writeFile(
  path.join(outDir, "manifest.json"),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), count: copied, rows: manifest }, null, 2)}\n`,
);

console.log(
  `Copied ${copied} photos (${(bytes / 1_048_576).toFixed(1)} MB) into ${path.relative(root, outDir)}`,
);
console.log("Set NEXT_PUBLIC_SHOW_PHOTOS=1 and point /photos at this folder to serve them.");
