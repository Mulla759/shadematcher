#!/usr/bin/env node
/**
 * Hijab / fabric image library builder.
 *
 * Pulls a Shopify store's public catalogue (/products.json), classifies each
 * product into category -> fabric -> colour family, downloads every product
 * image into that nested tree, measures the dominant colour of each image and
 * writes per-product metadata plus a library-wide manifest.
 *
 * Usage:
 *   node scripts/scrape-library.mjs --site velascarves
 *   node scripts/scrape-library.mjs --site velascarves --limit 20 --no-download
 *   node scripts/scrape-library.mjs --all
 */

import fs from "node:fs/promises";
import fss from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve("library");
const RAW = path.resolve("data/raw");
const SOURCES_FILE = path.resolve("data/sources.json");

/* ------------------------------------------------------------------ */
/* classification tables                                               */
/* ------------------------------------------------------------------ */

const FABRICS = [
  "silk chiffon",
  "crinkle chiffon",
  "crepe chiffon",
  "chiffon",
  "pima cotton",
  "pima",
  "bamboo",
  "modal",
  "jersey",
  "woven",
  "satin",
  "cotton",
  "silk",
  "lace",
  "mesh",
  "knit",
  "fleece",
  "crochet",
  "linen",
  "crepe",
  "viscose",
  "charmeuse",
  "georgette",
  "organza",
];

/** raw tag/word -> canonical colour family */
const COLOR_WORDS = {
  black: "black",
  "off black": "black",
  charcoal: "black",
  white: "white",
  "off white": "white",
  ivory: "white",
  optic: "white",
  unbleached: "white",
  cream: "cream",
  vanilla: "cream",
  pearl: "cream",
  moonlight: "cream",
  beige: "beige",
  sand: "beige",
  almond: "beige",
  oat: "beige",
  shell: "beige",
  nude: "beige",
  tan: "tan",
  camel: "tan",
  caramel: "tan",
  cognac: "tan",
  toffee: "tan",
  pecan: "tan",
  honey: "tan",
  brown: "brown",
  chocolate: "brown",
  coffee: "brown",
  mocha: "brown",
  espresso: "brown",
  mushroom: "brown",
  truffle: "brown",
  taupe: "taupe",
  stone: "taupe",
  gray: "gray",
  grey: "gray",
  "blue gray": "gray",
  silver: "gray",
  ash: "gray",
  graphite: "gray",
  blue: "blue",
  navy: "blue",
  "sky blue": "blue",
  cobalt: "blue",
  denim: "blue",
  teal: "green",
  green: "green",
  sage: "green",
  olive: "green",
  moss: "green",
  forest: "green",
  mint: "green",
  emerald: "green",
  matcha: "green",
  pistachio: "green",
  "yellow green": "green",
  lime: "green",
  "blue green": "green",
  yellow: "yellow",
  gold: "yellow",
  mustard: "yellow",
  lemon: "yellow",
  butter: "yellow",
  orange: "orange",
  peach: "orange",
  coral: "orange",
  apricot: "orange",
  tangerine: "orange",
  rust: "orange",
  clay: "orange",
  terracotta: "orange",
  red: "red",
  maroon: "red",
  burgundy: "red",
  berry: "red",
  wine: "red",
  cherry: "red",
  crimson: "red",
  pink: "pink",
  blush: "pink",
  rose: "pink",
  rosewood: "pink",
  mauve: "pink",
  sakura: "pink",
  flamingo: "pink",
  purple: "purple",
  violet: "purple",
  plum: "purple",
  lavender: "purple",
  lilac: "purple",
  orchid: "purple",
  amethyst: "purple",
  bronze: "brown",
  copper: "orange",
};

/** longest first so "silk chiffon" wins over "chiffon" */
const COLOR_KEYS = Object.keys(COLOR_WORDS).sort(
  (a, b) => b.length - a.length,
);

const FAMILY_ORDER = [
  "black",
  "white",
  "cream",
  "beige",
  "tan",
  "brown",
  "taupe",
  "gray",
  "blue",
  "green",
  "yellow",
  "orange",
  "red",
  "pink",
  "purple",
];

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "untitled";

const titleCase = (s) =>
  String(s)
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

function mapCategory(product) {
  const t = String(product?.product_type || "").toLowerCase().trim();

  if (t.includes("scarf") || t.includes("hijab")) return "scarves";
  if (t.includes("apparel") || t.includes("clothing")) return "apparel";
  if (t.includes("accessor")) return "accessories";
  if (t.includes("hoodie") || t.includes("crewneck")) return "hoodies";
  if (t.includes("station")) return "stationery";
  if (t.includes("gift card")) return "gift-cards";
  if (t.includes("insurance") || t.includes("event")) return "unclassified";

  // Some storefronts put the fabric (or nothing useful) in product_type, so
  // fall back to the words in the title and tags.
  const hay = `${t} ${product?.title || ""} ${(product?.tags || []).join(" ")}`.toLowerCase();
  if (/hijab|scarf|khimar|shayla|chador|dupatta|bandana|velaclava/.test(hay)) return "scarves";
  if (/abaya|dress|top|shirt|skirt|pant|trouser|sweater|jacket|kimono|kaftan|hoodie/.test(hay))
    return "apparel";
  if (/bag|tote|pin|cap|headband|scrunchie|jewel|hoop|charm|candle|prayer mat|towel/.test(hay))
    return "accessories";
  if (/fabric|yard|swatch/.test(hay)) return "fabric";
  if (t) return slugify(t);
  return "unclassified";
}

function classifyFabric(product) {
  const category = mapCategory(product);
  // Descriptions are only trusted for wearable categories: an accessory page
  // that merely mentions "chiffon" is not a chiffon product.
  const wearable = category === "scarves" || category === "apparel" || category === "hoodies";
  const parts = [
    product.title,
    product.product_type,
    ...(product.tags || []),
  ];
  if (wearable) {
    parts.push(
      ...(product.body_html || "")
        .replace(/<[^>]*>/g, " ")
        .split(/\s+/)
        .slice(0, 120),
    );
  }
  const hay = parts.join(" ").toLowerCase();

  for (const f of FABRICS) if (hay.includes(f)) return slugify(f);
  return "unclassified";
}

/** colour family from tags / title */
function classifyColor(product) {
  const tags = (product.tags || []).map((t) => t.toLowerCase());
  const title = product.title.toLowerCase();

  const fromTags = [];
  for (const t of tags) {
    const key = COLOR_KEYS.find(
      (k) => t === k || t.split(/\s+/).includes(k) || t.includes(k),
    );
    if (key) fromTags.push(COLOR_WORDS[key]);
  }
  if (fromTags.length) {
    // stable pick: most frequent family, tie broken by FAMILY_ORDER
    const freq = {};
    fromTags.forEach((f) => (freq[f] = (freq[f] || 0) + 1));
    return {
      family: Object.keys(freq).sort(
        (a, b) =>
          freq[b] - freq[a] ||
          FAMILY_ORDER.indexOf(a) - FAMILY_ORDER.indexOf(b),
      )[0],
      source: "tags",
      evidence: [...new Set(fromTags)],
    };
  }

  for (const k of COLOR_KEYS) {
    if (title.includes(k)) {
      return {
        family: COLOR_WORDS[k],
        source: "title",
        evidence: [k],
      };
    }
  }

  const isPrint = tags.some((t) =>
    /print|animal|floral|paisley|plaid|stripe|check|ombre|leopard|marble|tortoise|embroider|pattern/.test(
      t,
    ),
  );
  if (isPrint) return { family: "print", source: "tags", evidence: ["print"] };

  return { family: "unclassified", source: "none", evidence: [] };
}

/** hue -> family, used when colour has to be measured from pixels */
function hexToFamily(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
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
  if (h < 95) return "green";
  if (h < 160) return "green";
  if (h < 200) return "blue";
  if (h < 255) return "blue";
  if (h < 290) return "purple";
  return "pink";
}

async function download(url, dest, { width = 900 } = {}) {
  if (fss.existsSync(dest)) return { skipped: true, bytes: 0 };
  const cdn = url.split("?")[0] + `?width=${width}`;
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(cdn, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(45000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1000) throw new Error(`tiny body ${buf.length}`);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      // normalise to jpeg so the tree is uniform
      const out = await sharp(buf)
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer();
      await fs.writeFile(dest, out);
      return { bytes: out.length };
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  return { error: String(lastErr?.message || lastErr) };
}

const GRADIENT_RE = /ombre|gradient|fade[d]?\b|two[- ]tone|rainbow/i;
// Rainbow / many-colour fabrics need an N-stop ramp, not two stops. They stay
// in the library as ordinary colourways and are kept out of the gradient set.
const MULTI_RE = /rainbow|multi[- ]?colou?r|\b(?:[3-9]|1[0-9]) colou?rs?\b/i;

/** rgb -> lab, kept local so the scraper has no app dependency */
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

/**
 * Read a two-stop gradient off a fabric photo.
 * Compares the colour swing along the horizontal and vertical axes and keeps
 * the stronger one, so a wrap shot and a flat-lay both resolve.
 */
async function measureGradient(file) {
  const raw = await sharp(file)
    .resize(80, 80, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();
  const N = 80;
  const at = (x, y) => {
    const i = (y * N + x) * 3;
    return [raw[i], raw[i + 1], raw[i + 2]];
  };
  const median = (px) => {
    const s = [...px].sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
    return s[Math.floor(s.length / 2)];
  };
  const band = (axis, from, to) => {
    const px = [];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const t = axis === "x" ? x / N : y / N;
        if (t >= from && t < to) px.push(at(x, y));
      }
    }
    return median(px);
  };

  // Inset bands: the outer 15% is usually studio backdrop, and sampling it
  // drags a white stop into every reading.
  const hA = band("x", 0.15, 0.35), hB = band("x", 0.65, 0.85);
  const vA = band("y", 0.15, 0.35), vB = band("y", 0.65, 0.85);

  // Studio lighting itself creates a top-to-bottom lightness ramp, so the axis
  // is chosen on the chroma plane (a,b) — that only moves when the DYE moves.
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
    // a hue/chroma move of 5, or a genuine black-to-white step
    detected: best.chroma >= 5 || best.light >= 30,
  };
}

const toHex = (m) =>
  "#" + m.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

/**
 * Colour of the fabric in one photo.
 * Samples a 40x40 centre crop, drops studio-white / shadow pixels, then returns
 * the median colour plus the crop's spatial variance. A flat-lay shot of the
 * fabric has a low variance, which is how we pick the canonical swatch frame.
 */
async function dominantColor(file) {
  const img = sharp(file);
  const meta = await img.metadata();
  const w = meta.width || 600;
  const h = meta.height || 800;
  const cw = Math.round(w * 0.5);
  const ch = Math.round(h * 0.5);
  const raw = await img
    .extract({
      left: Math.round((w - cw) / 2),
      top: Math.round(h * 0.25),
      width: cw,
      height: ch,
    })
    .resize(40, 40, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();

  const px = [];
  for (let i = 0; i < raw.length; i += 3) {
    const r = raw[i],
      g = raw[i + 1],
      b = raw[i + 2];
    if (r > 245 && g > 245 && b > 245) continue; // white backdrop
    if (r < 12 && g < 12 && b < 12) continue; // shadow
    px.push([r, g, b]);
  }
  const use = px.length ? px : [[128, 128, 128]];
  const sorted = [...use].sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
  const median = sorted[Math.floor(sorted.length / 2)];

  const mean = use.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0]).map((v) => v / use.length);
  const variance =
    use.reduce(
      (a, p) =>
        a +
        (p[0] - mean[0]) ** 2 +
        (p[1] - mean[1]) ** 2 +
        (p[2] - mean[2]) ** 2,
      0,
    ) /
    use.length;

  // crude 3-bucket palette (light / mid / dark thirds) for shade matching
  const third = Math.max(1, Math.floor(sorted.length / 3));
  const palette = [
    sorted[Math.floor(third / 2)],
    sorted[Math.floor(third * 1.5)],
    sorted[Math.floor(third * 2.5)],
  ].map(toHex);

  return {
    hex: toHex(median),
    variance: Math.round(variance),
    palette,
  };
}

/* ------------------------------------------------------------------ */
/* shopify fetch                                                       */
/* ------------------------------------------------------------------ */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";

const normaliseDomain = (d) =>
  d.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");

async function fetchAll(domain, { perPage = 250, maxPages = 40 } = {}) {
  const out = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = `https://${domain}/products.json?limit=${perPage}&page=${page}`;
    let res;
    try {
      res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(40000),
      });
    } catch (err) {
      console.warn(`  ! ${domain} page ${page}: ${err.message}`);
      break;
    }
    if (!res.ok) {
      console.warn(`  ! ${domain} page ${page}: HTTP ${res.status}`);
      break;
    }
    let json;
    try {
      json = await res.json();
    } catch {
      console.warn(`  ! ${domain} page ${page}: not JSON (not Shopify?)`);
      break;
    }
    const batch = json.products || [];
    if (!batch.length) break;
    out.push(...batch);
    process.stdout.write(`  · page ${page}: +${batch.length} (total ${out.length})\n`);
    if (batch.length < perPage) break;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

function parseArgs() {
  const args = process.argv.slice(2);
  const o = { all: false, download: true, limit: 0, concurrency: 6 };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--site") o.site = args[++i];
    else if (a === "--all") o.all = true;
    else if (a === "--no-download") o.download = false;
    else if (a === "--limit") o.limit = Number(args[++i]);
    else if (a === "--concurrency") o.concurrency = Number(args[++i]);
  }
  return o;
}

async function pool(items, n, fn) {
  const results = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}

async function buildSite(site, opts) {
  const domain = normaliseDomain(site.domain);
  const slug = site.slug;
  console.log(`\n=== ${slug} (${domain}) ===`);

  let products = [];
  const cache = path.join(RAW, `${slug}-products.json`);
  if (fss.existsSync(cache)) {
    products = JSON.parse(await fs.readFile(cache, "utf8"));
    console.log(`  cached: ${products.length} products`);
  } else {
    products = await fetchAll(domain);
    await fs.mkdir(RAW, { recursive: true });
    await fs.writeFile(cache, JSON.stringify(products));
    console.log(`  fetched: ${products.length} products`);
  }
  if (site.focus === "gradient") {
    const all = products.length;
    products = products.filter(
      (p) => !/sample card|colou?r card|swatch (card|book)|colour chart|color chart/i.test(p.title),
    );
    products = products.filter((p) =>
      GRADIENT_RE.test(`${p.title} ${(p.tags || []).join(" ")}`),
    );
    console.log(`  gradient focus: ${products.length}/${all} products match`);
  }
  if (site.maxProducts) products = products.slice(0, site.maxProducts);
  if (opts.limit) products = products.slice(0, opts.limit);
  if (!products.length) return { slug, products: 0, images: 0, errors: [] };

  let done = 0;
  let imageCount = 0;
  const errors = [];
  const maxColours = site.maxColours || 24;

  /** download one image set into `dir` and build its record */
  async function makeRecord({
    p,
    category,
    fabric,
    colorLabel,
    family,
    familySource,
    dir,
    gradientCandidate,
    imageSpecs,
    parentTitle,
    colourOption,
    sizes,
    prices,
  }) {
    const localImages = [];
    let n = 0;
    for (const spec of imageSpecs) {
      n++;
      const file = path.join(dir, `${String(n).padStart(2, "0")}.jpg`);
      const rel = path.relative(ROOT, file);
      if (opts.download) {
        const r = await download(spec.src, file);
        if (r.error) {
          errors.push({ product: p.handle, url: spec.src, error: r.error });
          continue;
        }
        if (!r.skipped) imageCount++;
      }
      if (fss.existsSync(file)) {
        let dom = null;
        try {
          dom = await dominantColor(file);
        } catch {}
        localImages.push({
          position: n,
          file: rel,
          source_url: spec.src,
          width: spec.width,
          height: spec.height,
          dominant_hex: dom?.hex ?? null,
          measured_family: dom ? hexToFamily(dom.hex) : null,
          palette: dom?.palette ?? [],
          flatness: dom?.variance ?? null,
        });
      }
    }

    // the flattest frame is usually a flat-lay / folded shot of the fabric
    let swatch =
      [...localImages]
        .filter((i) => i.dominant_hex)
        .sort((a, b) => (a.flatness ?? 1e9) - (b.flatness ?? 1e9))[0] || null;

    // Ombre products are not one shade. Measure every downloaded frame and
    // keep the one with the strongest chroma swing: the gallery order is
    // arbitrary, and the first shot is often the styled/model version.
    let gradient = null;
    if (gradientCandidate) {
      for (const im of localImages) {
        try {
          const g = await measureGradient(path.join(ROOT, im.file));
          if (!gradient || g.chroma_delta > (gradient.chroma_delta ?? -1)) {
            gradient = g;
            swatch = im;
          }
        } catch {}
      }
      if (gradient) gradient.stops_family = gradient.stops.map(hexToFamily);
    }

    // an unrecognised shade name ("Abalone", "Sycamore") still has a colour:
    // read it off the photo rather than dumping it in unclassified.
    let finalFamily = family;
    let finalSource = familySource;
    if ((!family || family === "unclassified") && swatch?.dominant_hex) {
      finalFamily = hexToFamily(swatch.dominant_hex);
      finalSource = "measured";
    }

    const record = {
      site: slug,
      source_url: `https://${domain}/products/${p.handle}`,
      handle: p.handle,
      title: parentTitle || p.title,
      label: colorLabel,
      parent_title: parentTitle || null,
      colour_option: Boolean(colourOption),
      product_type: p.product_type,
      category,
      fabric,
      color: {
        label: colorLabel,
        label_family: family,
        family: finalFamily,
        family_source: finalSource,
        tags: (p.tags || []).filter((t) => COLOR_KEYS.some((k) => t.toLowerCase().includes(k))),
        swatch_hex: swatch?.dominant_hex ?? null,
        swatch_family: swatch ? hexToFamily(swatch.dominant_hex) : null,
        swatch_image: swatch?.file ?? null,
        palette: swatch?.palette ?? [],
        gradient,
      },
      tags: p.tags || [],
      vendor: p.vendor,
      prices: prices?.length ? prices : [...new Set((p.variants || []).map((v) => v.price))],
      sizes: sizes?.length
        ? sizes
        : (p.options || []).find((o) => /size/i.test(o.name))?.values || [],
      description: (p.body_html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 700),
      images: localImages,
      image_count: localImages.length,
      folder: path.relative(ROOT, dir),
      scraped_at: new Date().toISOString(),
    };

    if (opts.download && localImages.length) {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        path.join(dir, "meta.json"),
        JSON.stringify(record, null, 2),
      );
    }
    return record;
  }

  const records = await pool(products, opts.concurrency, async (p) => {
    try {
      const category = mapCategory(p);
      const fabric = classifyFabric(p);
      const prodSlug = slugify(p.handle || p.title);
      const options = p.options || [];
      const colorOpt = options.find((o) => /colou?r|shade/i.test(o.name));
      const gradientCandidate =
        GRADIENT_RE.test(`${p.title} ${(p.tags || []).join(" ")}`) &&
        !MULTI_RE.test(p.title);

      /* ---- stores that hide the shades inside a variant option ---- */
      if (colorOpt && site.focus !== "gradient") {
        const pos = options.indexOf(colorOpt) + 1;
        const groups = new Map();
        for (const v of p.variants || []) {
          const val = v[`option${pos}`];
          if (!val) continue;
          const g = groups.get(val) || {
            value: val,
            image: null,
            sizes: new Set(),
            prices: new Set(),
            index: groups.size,
          };
          if (v.featured_image?.src && !g.image) g.image = v.featured_image.src;
          const rest = v.title.split(" / ").filter((x) => x.trim() && x !== val);
          rest.forEach((r) => g.sizes.add(r));
          g.prices.add(v.price);
          groups.set(val, g);
        }

        if (groups.size > 1) {
          const canIndexImages = (p.images || []).length >= groups.size;
          const out = [];
          let ci = 0;
          for (const g of groups.values()) {
            if (ci >= maxColours) break;
            let src = g.image;
            if (!src && canIndexImages) src = p.images[g.index]?.src;
            if (!src && (p.images || []).length === 1) src = p.images[0]?.src;
            if (!src) continue;
            const color = classifyColor({ title: g.value, tags: [] });
            const fam =
              gradientCandidate || (GRADIENT_RE.test(g.value) && !MULTI_RE.test(g.value))
                ? "gradient"
                : color.family;
            const dir = path.join(
              ROOT,
              slug,
              category,
              fabric,
              fam,
              prodSlug,
              slugify(g.value),
            );
            out.push(
              await makeRecord({
                p,
                category,
                fabric,
                colorLabel: g.value,
                family: fam,
                familySource: "variant",
                dir,
                gradientCandidate: gradientCandidate || GRADIENT_RE.test(g.value),
                imageSpecs: [{ src }],
                parentTitle: p.title,
                colourOption: colorOpt.name,
                sizes: [...g.sizes].filter((x) => !/^default title$/i.test(x)),
                prices: [...g.prices],
              }),
            );
            ci++;
          }
          if (out.length) {
            done++;
            if (done % 25 === 0)
              console.log(`  … ${done}/${products.length} products, ${imageCount} images saved`);
            return out;
          }
        }
      }

      /* ---- one product = one colourway ---- */
      const color = classifyColor(p);
      const fam = gradientCandidate ? "gradient" : color.family;
      const dir = path.join(ROOT, slug, category, fabric, fam, prodSlug);
      const images = (p.images || []).slice(0, site.maxImages || 99);
      const record = await makeRecord({
        p,
        category,
        fabric,
        colorLabel:
          p.title.replace(/\b(modal|woven|jersey|chiffon|hijab|scarf)\b/gi, "").trim() || p.title,
        family: fam,
        familySource: color.source,
        dir,
        gradientCandidate,
        imageSpecs: images.map((im) => ({
          src: im.src,
          width: im.width,
          height: im.height,
        })),
        parentTitle: null,
      });
      done++;
      if (done % 25 === 0)
        console.log(`  … ${done}/${products.length} products, ${imageCount} images saved`);
      return record;
    } catch (err) {
      errors.push({ product: p.handle, error: String(err?.message || err) });
      done++;
      return null;
    }
  });
  const good = records
    .flatMap((r) => (Array.isArray(r) ? r : [r]))
    .filter(Boolean);

  await fs.mkdir(path.join(ROOT, slug), { recursive: true });
  await fs.writeFile(
    path.join(ROOT, slug, "manifest.json"),
    JSON.stringify(
      {
        site: slug,
        domain,
        generated_at: new Date().toISOString(),
        products: good.length,
        images: good.reduce((a, r) => a + r.image_count, 0),
        categories: [...new Set(good.map((r) => r.category))],
        fabrics: [...new Set(good.map((r) => r.fabric))],
        color_families: [...new Set(good.map((r) => r.color.family))],
        errors,
        records: good,
      },
      null,
      2,
    ),
  );
  // prune anything a re-classification left behind: the canonical file list is
  // known from this run, so stray images and stale meta.json files go.
  let pruned = 0;
  if (opts.download && !opts.limit) {
    const keep = new Set();
    for (const r of good) {
      keep.add(path.resolve(ROOT, r.folder, "meta.json"));
      for (const img of r.images) keep.add(path.resolve(ROOT, img.file));
    }
    const walk = async (dir) => {
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      let remaining = 0;
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          await walk(full);
          if (fss.existsSync(full) && (await fs.readdir(full)).length === 0) {
            await fs.rmdir(full).catch(() => {});
          } else remaining++;
        } else if (/\.(jpe?g|png)$/i.test(e.name) || e.name === "meta.json") {
          if (!keep.has(full)) {
            await fs.rm(full, { force: true });
            pruned++;
          } else remaining++;
        } else remaining++;
      }
      return remaining;
    };
    await walk(path.join(ROOT, slug));
    if (pruned) console.log(`  pruned ${pruned} stale file(s)`);
  }

  console.log(`  done: ${good.length} products, ${imageCount} new images`);
  return { slug, products: good.length, images: imageCount, errors };
}

const opts = parseArgs();
let sources;
if (fss.existsSync(SOURCES_FILE)) {
  sources = JSON.parse(await fs.readFile(SOURCES_FILE, "utf8"));
} else {
  sources = [
    { slug: "velascarves", domain: "velascarves.com", role: "primary" },
  ];
}
if (opts.site) sources = sources.filter((s) => s.slug === opts.site);
if (!sources.length) {
  console.error(`No source matched. Known: see ${SOURCES_FILE}`);
  process.exit(1);
}

const summary = [];
for (const s of sources) {
  try {
    summary.push(await buildSite(s, opts));
  } catch (err) {
    console.error(`  !! ${s.slug} failed: ${err.message}`);
    summary.push({ slug: s.slug, error: err.message });
  }
}
await fs.mkdir(ROOT, { recursive: true });
await fs.writeFile(
  path.join(ROOT, "index.json"),
  JSON.stringify({ generated_at: new Date().toISOString(), sites: summary }, null, 2),
);
console.log("\nSUMMARY", JSON.stringify(summary, null, 2));
