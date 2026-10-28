import { chromium } from "playwright-core";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL_ = process.env.URL || "http://localhost:3000/";
const WIDTH = 1440;
const OUT = process.env.OUT || path.resolve("out");

// section name -> live CSS selector
const SECTIONS = [
  ["hero", ".atl-hero"],
  ["intro", ".atl-intro"],
  ["compare", ".atl-compare"],
  ["analysis", ".atl-analysis"],
  ["collection", ".atl-collection"],
  ["how", ".atl-how"],
  ["faq", ".atl-faq"],
  ["cta", ".atl-cta"],
  ["footer", ".atl-footer"],
];

const PEN_DIR = process.env.PEN_DIR || path.resolve("pen");

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: WIDTH, height: 1000 }, deviceScaleFactor: 1 });
await page.goto(URL_, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(600);

const report = [];

async function diffPair(name, liveBuf, designBuf) {
  const liveMeta = await sharp(liveBuf).metadata();
  const desMeta = await sharp(designBuf).metadata();
  const h = Math.max(liveMeta.height, desMeta.height);
  const w = Math.max(liveMeta.width, desMeta.width);

  const norm = async (buf) =>
    await sharp(buf)
      .resize(w, h, { fit: "fill", kernel: "nearest" })
      .flatten({ background: "#ffffff" })
      .raw()
      .toBuffer();

  const a = await norm(liveBuf);
  const b = await norm(designBuf);

  let sum = 0;
  let over = 0;
  const heat = Buffer.alloc(w * h * 3);
  const band = 10; // 10px rows
  const bands = Math.ceil(h / band);
  const bandScore = new Float64Array(bands);
  const bandHits = new Float64Array(bands);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      const d =
        Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
      sum += d;
      const bi = Math.floor(y / band);
      bandScore[bi] += d;
      bandHits[bi]++;
      if (d > 90) over++;
      const v = Math.min(255, d);
      heat[i] = v > 90 ? 255 : 255 - v;
      heat[i + 1] = d > 90 ? 40 : 255 - v;
      heat[i + 2] = 40;
    }
  }

  const px = w * h;
  const heatBuf = await sharp(heat, { raw: { width: w, height: h, channels: 3 } })
    .png()
    .toBuffer();

  return {
    w,
    h,
    liveH: liveMeta.height,
    designH: desMeta.height,
    meanDiff: +(sum / px / 3).toFixed(2),
    pctOver: +((over / px) * 100).toFixed(2),
    bands: Array.from(bandScore, (s, i) => ({
      y: i * band,
      d: +(s / bandHits[i] / 3).toFixed(1),
    })),
    heatBuf,
  };
}

// full page
const fullLive = await page.screenshot({ fullPage: true });
fs.writeFileSync(path.join(OUT, "live-full.png"), fullLive);
const liveFullMeta = await sharp(fullLive).metadata();

for (const [name, sel] of SECTIONS) {
  const el = await page.$(sel);
  if (!el) {
    report.push({ name, error: "selector missing" });
    continue;
  }
  const liveBuf = await el.screenshot();
  fs.writeFileSync(path.join(OUT, `live-${name}.png`), liveBuf);

  const penFile = path.join(PEN_DIR, `${name}.png`);
  if (!fs.existsSync(penFile)) {
    report.push({ name, live: liveBuf.length, note: "no pen export" });
    continue;
  }
  const designBuf = fs.readFileSync(penFile);
  const r = await diffPair(name, liveBuf, designBuf);
  fs.writeFileSync(path.join(OUT, `diff-${name}.png`), r.heatBuf);

  // contact sheet: live | design | diff
  const scale = Math.min(1, 900 / r.w);
  const cw = Math.round(r.w * scale);
  const ch = Math.round(r.h * scale);
  const tiles = await Promise.all(
    [liveBuf, designBuf, r.heatBuf].map(async (b) =>
      await sharp(b).resize(cw, ch, { fit: "fill" }).png().toBuffer()
    )
  );
  const sheet = await sharp({
    create: {
      width: cw * 3 + 24,
      height: ch,
      channels: 3,
      background: "#ffffff",
    },
  })
    .composite([
      { input: tiles[0], left: 0, top: 0 },
      { input: tiles[1], left: cw + 12, top: 0 },
      { input: tiles[2], left: cw * 2 + 24, top: 0 },
    ])
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(OUT, `sheet-${name}.png`), sheet);

  const worst = r.bands
    .slice()
    .sort((p, q) => q.d - p.d)
    .slice(0, 6)
    .map((b) => `${b.y}:${b.d}`);

  report.push({
    name,
    liveH: r.liveH,
    designH: r.designH,
    dH: r.designH - r.liveH,
    meanDiff: r.meanDiff,
    pctOver: r.pctOver,
    worstBands: worst,
  });
}

await browser.close();
console.log(JSON.stringify({ liveFullHeight: liveFullMeta.height, report }, null, 2));
