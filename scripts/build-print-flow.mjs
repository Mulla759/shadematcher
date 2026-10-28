#!/usr/bin/env node
/**
 * Build one flowing image from the scraped print + fabric photos.
 *
 * The existing gallery shows measured colour cards (and caps at 900). This
 * script uses the real product photo for each textile colourway and packs it
 * into a justified, colour-sorted flow.
 *
 *   node scripts/build-print-flow.mjs
 *   node scripts/build-print-flow.mjs --limit 300 --width 2400
 */

import fs from "node:fs/promises";
import fss from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve("library");
const args = process.argv.slice(2);
const opt = (name, def) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : def;
};

const LIMIT = Number(opt("--limit", 0));
const WIDTH = Number(opt("--width", 3200));
const ROW_H = Number(opt("--row", 96));
const GAP = 4;
const OUT_JPG = path.join(ROOT, "print-flow.jpg");
const OUT_WEBP = path.join(ROOT, "print-flow.webp");
const OUT_HTML = path.join(ROOT, "print-flow.html");
const OUT_JSON = path.join(ROOT, "print-flow.json");

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

const PRINT_RE =
  /print|floral|flower|paisley|leopard|cheetah|zebra|tie.?dye|abstract|plaid|windowpane|check|stripe|polka|animal|geometric|botanical|palm|leaf|damask|toile|aztec|batik|ikat|houndstooth|gingham|embroider|motif|spiderweb|halloween|camo|tartan|chevron|jacquard|brocade|novelty|scenic|butterfly|bird|snake|python|croc|marble|swirl|ornate/i;

function hexToHsl(hex) {
  const value = String(hex || "").replace("#", "");
  if (value.length !== 6) return { h: 0, s: 0, l: 0 };
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s, l };
}

function flowKey(hex) {
  const { h, s, l } = hexToHsl(hex);
  // Chromatic prints flow around the wheel; low-chroma textiles sit at the end.
  return s < 0.09 ? 360 + (1 - l) * 80 : h;
}

const catalog = JSON.parse(await fs.readFile(path.join(ROOT, "catalog.json"), "utf8"));
let rows = (catalog.colours || []).filter((row) => {
  if (!row.swatch_image) return false;
  if (!TEXTILE_CATEGORIES.has(row.category)) return false;
  if (EXCLUDE_TITLE.test(row.title || "")) return false;
  return fss.existsSync(path.join(ROOT, row.swatch_image));
});

// One flow entry per image; several colourways can point at the same photo.
const seen = new Set();
rows = rows.filter((row) => {
  if (seen.has(row.swatch_image)) return false;
  seen.add(row.swatch_image);
  return true;
});

rows.sort((a, b) => {
  const key = flowKey(a.hex) - flowKey(b.hex);
  if (Math.abs(key) > 0.001) return key;
  return String(a.title).localeCompare(String(b.title));
});

if (LIMIT > 0) rows = rows.slice(0, LIMIT);

console.log(`print/fabric candidates: ${rows.length}`);

const START = Date.now();
const measured = [];
let cursor = 0;
const WORKERS = 12;

async function measureWorker() {
  while (cursor < rows.length) {
    const index = cursor++;
    const row = rows[index];
    try {
      const meta = await sharp(path.join(ROOT, row.swatch_image)).metadata();
      const width = meta.width || 3;
      const height = meta.height || 4;
      const baseWidth = Math.max(42, Math.min(230, Math.round(ROW_H * (width / height))));
      measured.push({ ...row, baseWidth, aspect: width / height });
    } catch {
      // Skip unreadable images.
    }
    if (measured.length % 500 === 0 && measured.length > 0) {
      console.log(`  measured ${measured.length}/${rows.length}…`);
    }
  }
}

await Promise.all(Array.from({ length: WORKERS }, measureWorker));
console.log(`usable images: ${measured.length} in ${((Date.now() - START) / 1000).toFixed(1)}s`);

// Justified rows: fill the target width, keep a consistent visual rhythm.
const rowBuckets = [];
let current = [];
let currentWidth = 0;
for (const item of measured) {
  const nextWidth = currentWidth + item.baseWidth + (current.length > 0 ? GAP : 0);
  current.push(item);
  currentWidth = nextWidth;
  if (currentWidth >= WIDTH * 0.94) {
    rowBuckets.push(current);
    current = [];
    currentWidth = 0;
  }
}
if (current.length > 0) rowBuckets.push(current);

const rowLayouts = rowBuckets.map((items, rowIndex) => {
  const gaps = GAP * Math.max(0, items.length - 1);
  const rawWidth = items.reduce((sum, item) => sum + item.baseWidth, 0) + gaps;
  const isLast = rowIndex === rowBuckets.length - 1;
  // A short final row should not stretch three photos across the whole canvas.
  const fill = !(isLast && rawWidth < WIDTH * 0.75);
  const scale = fill ? (WIDTH - gaps) / items.reduce((sum, item) => sum + item.baseWidth, 0) : 1;
  const height = Math.max(64, Math.min(150, Math.round(ROW_H * scale)));
  const widths = items.map((item) => Math.max(28, Math.round(item.baseWidth * (height / ROW_H))));
  const used = widths.reduce((sum, width) => sum + width, 0) + gaps;
  if (fill && widths.length > 0) widths[widths.length - 1] += WIDTH - used;
  return { items, widths, height, isLast };
});

const totalHeight = rowLayouts.reduce((sum, row) => sum + row.height, 0) + GAP * Math.max(0, rowLayouts.length - 1);
console.log(`layout: ${rowLayouts.length} rows · ${WIDTH}×${totalHeight}px`);

const rowBuffers = [];
let y = 0;
let done = 0;
for (const row of rowLayouts) {
  const composites = [];
  let x = 0;
  for (let index = 0; index < row.items.length; index += 1) {
    const item = row.items[index];
    const width = row.widths[index];
    try {
      const input = await sharp(path.join(ROOT, item.swatch_image))
        .rotate()
        .resize({ width, height: row.height, fit: "cover", position: "centre" })
        .flatten({ background: "#0f0d0b" })
        .png()
        .toBuffer();
      composites.push({ input, left: x, top: 0 });
    } catch {
      // Leave the dark background for unreadable images.
    }
    x += width + GAP;
  }
  const rowBuffer = await sharp({
    create: { width: WIDTH, height: row.height, channels: 3, background: "#0f0d0b" },
  })
    .composite(composites)
    .png()
    .toBuffer();
  rowBuffers.push({ input: rowBuffer, left: 0, top: y });
  y += row.height + GAP;
  done += 1;
  if (done % 25 === 0) console.log(`  composited ${done}/${rowLayouts.length} rows…`);
}

console.log("compositing final image…");
const startFinal = Date.now();
const final = await sharp({
  create: { width: WIDTH, height: totalHeight, channels: 3, background: "#0f0d0b" },
})
  .composite(rowBuffers)
  .jpeg({ quality: 83, mozjpeg: true, progressive: true, chromaSubsampling: "4:2:0" })
  .toBuffer();

await fs.writeFile(OUT_JPG, final);
let webpBytes = 0;
try {
  // WebP caps out at 16,383 px per side; publish a half-width preview.
  const webp = await sharp(final)
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 76, effort: 4 })
    .toBuffer();
  await fs.writeFile(OUT_WEBP, webp);
  webpBytes = webp.length;
} catch (error) {
  console.warn(`WebP preview skipped: ${error.message}`);
}

const printCount = measured.filter((row) =>
  row.color_family === "print" || PRINT_RE.test([row.title, row.tags, row.color_label].join(" ")),
).length;
const sites = measured.reduce((map, row) => {
  map[row.site] = (map[row.site] || 0) + 1;
  return map;
}, {});
const families = measured.reduce((map, row) => {
  map[row.color_family] = (map[row.color_family] || 0) + 1;
  return map;
}, {});

const placements = [];
let placementY = 0;
for (const row of rowLayouts) {
  let placementX = 0;
  for (let index = 0; index < row.items.length; index += 1) {
    const item = row.items[index];
    placements.push({
      ...item,
      left: placementX,
      top: placementY,
      width: row.widths[index],
      height: row.height,
    });
    placementX += row.widths[index] + GAP;
  }
  placementY += row.height + GAP;
}

const escapeAttr = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const tilesHtml = placements
  .map((tile) => {
    const left = ((tile.left / WIDTH) * 100).toFixed(4);
    const top = ((tile.top / totalHeight) * 100).toFixed(4);
    const width = ((tile.width / WIDTH) * 100).toFixed(4);
    const height = ((tile.height / totalHeight) * 100).toFixed(4);
    const label = `${tile.site} · ${tile.title}`;
    return `<a class="tile" href="${escapeAttr(tile.swatch_image)}" target="_blank" rel="noreferrer" style="left:${left}%;top:${top}%;width:${width}%;height:${height}%" data-src="${escapeAttr(tile.swatch_image)}" data-title="${escapeAttr(tile.title)}" data-site="${escapeAttr(tile.site)}" data-hex="${escapeAttr(tile.hex)}" data-url="${escapeAttr(tile.product_url)}" aria-label="${escapeAttr(label)}" title="${escapeAttr(label)}"></a>`;
  })
  .join("");

const meta = {
  generated_at: new Date().toISOString(),
  count: measured.length,
  print_count: printCount,
  width: WIDTH,
  height: totalHeight,
  rows: rowLayouts.length,
  interactive_tiles: placements.length,
  gap: GAP,
  source: "library/catalog.json",
  note: "Actual product photos for scraped textile colourways. Internal colour research only; photography belongs to each store.",
  sites,
  families,
  jpg_bytes: final.length,
  webp_bytes: webpBytes,
};
await fs.writeFile(OUT_JSON, JSON.stringify(meta, null, 2));

const siteList = Object.entries(sites)
  .sort((a, b) => b[1] - a[1])
  .map(([site, count]) => `${site} ${count}`)
  .join(" · ");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Print &amp; fabric flow — Auriga library</title>
<style>
  :root{--bg:#0f0d0b;--panel:#181513;--line:#2a2521;--ink:#f4efe8;--muted:#9d9288;--acc:#d8b48a}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.55 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
  header{padding:26px 24px 18px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap;align-items:flex-end}
  h1{margin:0;font-size:24px;font-weight:600;letter-spacing:-.01em}
  .sub{color:var(--muted);font-size:12px;margin-top:4px}
  .links{display:flex;gap:14px;flex-wrap:wrap;font-size:12px}
  a{color:var(--acc);text-decoration:none}
  a:hover{text-decoration:underline}
  main{padding:18px 24px 70px}
  .meta{display:flex;gap:16px;flex-wrap:wrap;color:var(--muted);font-size:11px;margin-bottom:12px}
  .meta b{color:var(--ink);font-weight:500}
  .flow{display:block;width:100%;height:auto;border:1px solid var(--line);background:#0f0d0b}
  .note{max-width:80ch;color:var(--muted);font-size:11px;line-height:1.6;margin-top:14px}
  .stores{color:var(--muted);font-size:10.5px;margin-top:8px;line-height:1.6}
  header{position:sticky;top:0;z-index:20;background:linear-gradient(180deg,#0f0d0b 72%,rgba(15,13,11,.94));backdrop-filter:blur(8px)}
  .flow-wrap{position:relative;line-height:0;border:1px solid var(--line);background:#0f0d0b}
  .flow-wrap picture{display:block}
  .flow{border:0}
  .tile{position:absolute;display:block;cursor:zoom-in;outline:1px solid transparent;transition:outline-color .12s ease,background .12s ease;z-index:2}
  .tile:hover,.tile:focus-visible{outline:2px solid var(--acc);background:rgba(216,180,138,.13);z-index:4}
  .hint{color:var(--muted);font-size:11px;margin:0 0 10px}
  .lb{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:28px;background:rgba(0,0,0,.9);backdrop-filter:blur(6px)}
  .lb[hidden]{display:none}
  .lb-panel{display:flex;flex-direction:column;max-width:min(94vw,1100px);max-height:92vh;background:var(--panel);border:1px solid var(--line)}
  .lb-img{display:block;max-width:100%;max-height:calc(92vh - 104px);object-fit:contain;background:#000;cursor:zoom-in}
  .lb-meta{display:flex;justify-content:space-between;gap:18px;align-items:flex-end;padding:12px 14px;background:var(--panel);flex-wrap:wrap}
  .lb-title{font-size:13px;font-weight:600;line-height:1.35;max-width:70ch}
  .lb-sub{color:var(--muted);font-size:11px;margin-top:3px}
  .lb-actions{display:flex;gap:12px;align-items:center;flex-wrap:wrap;font-size:11px}
  .lb-hex{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--muted)}
  .lb-close{position:fixed;top:18px;right:22px;z-index:101;width:40px;height:40px;border:1px solid var(--line);border-radius:50%;background:#181513;color:var(--ink);font-size:22px;line-height:1;cursor:pointer}
  .lb-close:hover{border-color:var(--acc)}
  [hidden]{display:none!important}
  @media (max-width:640px){main{padding:14px}header{padding:18px 14px 14px}.lb{padding:10px}.lb-panel{max-width:100%;max-height:94vh}.lb-img{max-height:calc(94vh - 112px)}}
</style>
</head>
<body>
<header>
  <div>
    <h1>Print &amp; fabric flow</h1>
    <div class="sub">${measured.length.toLocaleString()} actual textile photos · ${printCount.toLocaleString()} print-labelled · ${WIDTH}×${totalHeight}px</div>
  </div>
  <div class="links">
    <a href="print-flow.jpg" target="_blank" rel="noreferrer">Expand full collage ↗</a>
    <a href="print-flow.webp" target="_blank" rel="noreferrer">WebP · half size</a>
    <a href="gallery.html">Colourway index →</a>
  </div>
</header>
<main>
  <div class="meta">
    <span><b>${rowLayouts.length}</b> rows</span>
    <span><b>${measured.length.toLocaleString()}</b> images</span>
    <span><b>${(final.length / 1048576).toFixed(1)} MB</b> JPEG</span>
    <span><b>Click any tile</b> for the original photo</span>
    <span>Sorted by measured hue, then lightness</span>
  </div>
  <div class="flow-wrap">
    <picture>
      <source srcset="print-flow.webp" type="image/webp">
      <img class="flow" src="print-flow.jpg" width="${WIDTH}" height="${totalHeight}" alt="Flowing collage of scraped print and fabric photos" loading="eager" decoding="async">
    </picture>
    ${tilesHtml}
  </div>
  <p class="note">The screen preview is half-width for speed — open the full JPEG for print detail. Every tile is the product photo used for a scraped textile colourway, not a synthetic swatch. The gallery is for internal colour research and prototype matching; the photography belongs to each store and is not for republication.</p>
  <p class="stores">${siteList}</p>

  <div class="lb" id="lb" hidden>
    <button class="lb-close" id="lb-close" type="button" aria-label="Close">×</button>
    <div class="lb-panel" role="dialog" aria-modal="true" aria-label="Original textile photo">
      <img class="lb-img" id="lb-img" alt="">
      <div class="lb-meta">
        <div>
          <div class="lb-title" id="lb-title"></div>
          <div class="lb-sub" id="lb-site"></div>
        </div>
        <div class="lb-actions">
          <span class="lb-hex" id="lb-hex"></span>
          <a id="lb-product" href="#" target="_blank" rel="noreferrer">Product ↗</a>
          <a id="lb-original" href="#" target="_blank" rel="noreferrer">Open original ↗</a>
        </div>
      </div>
    </div>
  </div>
</main>
<script>
(function () {
  var lb = document.getElementById('lb');
  var lbImg = document.getElementById('lb-img');
  var lbTitle = document.getElementById('lb-title');
  var lbSite = document.getElementById('lb-site');
  var lbHex = document.getElementById('lb-hex');
  var lbOriginal = document.getElementById('lb-original');
  var lbProduct = document.getElementById('lb-product');
  var close = document.getElementById('lb-close');
  var lastFocus = null;

  function closeLightbox() {
    lb.hidden = true;
    lbImg.removeAttribute('src');
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }

  document.querySelectorAll('.tile').forEach(function (tile) {
    tile.addEventListener('click', function (event) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      lastFocus = tile;
      lbImg.src = tile.getAttribute('data-src');
      lbImg.alt = tile.getAttribute('data-title') || 'Textile photo';
      lbTitle.textContent = tile.getAttribute('data-title') || '';
      lbSite.textContent = tile.getAttribute('data-site') || '';
      lbHex.textContent = tile.getAttribute('data-hex') || '';
      lbOriginal.href = tile.getAttribute('data-src') || '#';
      var product = tile.getAttribute('data-url');
      if (product) {
        lbProduct.href = product;
        lbProduct.hidden = false;
      } else {
        lbProduct.hidden = true;
      }
      lb.hidden = false;
      document.body.style.overflow = 'hidden';
      close.focus();
    });
  });

  lbImg.addEventListener('click', function () {
    if (lbOriginal.href) window.open(lbOriginal.href, '_blank', 'noopener');
  });
  close.addEventListener('click', closeLightbox);
  lb.addEventListener('click', function (event) {
    if (event.target === lb) closeLightbox();
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !lb.hidden) closeLightbox();
  });
})();
</script>
</body>
</html>
`;
await fs.writeFile(OUT_HTML, html);

console.log(`✓ ${path.relative(process.cwd(), OUT_JPG)}  ${(final.length / 1048576).toFixed(1)} MB  ${WIDTH}×${totalHeight}`);
console.log(`✓ ${path.relative(process.cwd(), OUT_WEBP)}`);
console.log(`✓ ${path.relative(process.cwd(), OUT_HTML)}`);
console.log(`✓ ${path.relative(process.cwd(), OUT_JSON)}`);
console.log(`final composite: ${((Date.now() - startFinal) / 1000).toFixed(1)}s · total ${((Date.now() - START) / 1000).toFixed(1)}s`);
