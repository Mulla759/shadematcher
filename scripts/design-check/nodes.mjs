import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL_ = process.env.URL || "http://localhost:3000/";
const DESIGN = process.env.DESIGN || path.resolve("design.html");
const WIDTH = 1440;

// pen layer name -> live selector (optional design selector override)
const MAP = {
  "A2 Hero": ".atl-hero",
  "A2 Portrait": ".atl-portrait",
  "A2 Nav scrim": ".atl-portrait-scrim",
  "A2 Brand": ".atl-brand",
  "A2 wordmark": ".atl-brand strong",
  "A2 Nav": ".atl-nav-links",
  "A2 nav Tone": ".atl-nav-links > a:nth-of-type(1)",
  "A2 nav Colours": ".atl-nav-links > a:nth-of-type(2)",
  "A2 nav How it works": ".atl-nav-links > a:nth-of-type(3)",
  "A2 nav cta": ".atl-nav-cta",
  "A2 Hero pill": ".atl-hero-copy .atl-pill",
  "A2 Hero pill label": ".atl-hero-copy .atl-pill",
  "A2 Hero headline": ".atl-hero-copy h1",
  "A2 h1 line 1": ".atl-hero-copy h1 span:nth-child(1)",
  "A2 h1 line 2": ".atl-hero-copy h1 span:nth-child(2)",
  "A2 Hero lede": ".atl-lede",
  "A2 Hero actions": ".atl-actions",
  "A2 use camera": ".atl-actions .atl-button:nth-of-type(1)",
  "A2 upload": ".atl-actions .atl-button:nth-of-type(2)",
  "A2 privacy note": ".atl-privacy",
  "A2 Hero stats": ".atl-stats",
  "A2 stat REAL COLOURS": ".atl-stat:nth-of-type(1)",
  "A2 stat SHOPS": ".atl-stat:nth-of-type(2)",
  "A2 stat RANKED AT ONCE": ".atl-stat:nth-of-type(3)",
  "A2 stat number REAL COLOURS": ".atl-stat:nth-of-type(1) strong",
  "A2 stat label REAL COLOURS": ".atl-stat:nth-of-type(1) span",
  "A2 sample caption": ".atl-box-caption",
  "A2 Colour box wrap": ".atl-colour-box",
  "A2 Portrait chip": ".atl-portrait-chip",
  "A2 Intro": ".atl-intro",
  "A2 Intro pill": ".atl-intro .atl-pill",
  "A2 Intro heading": ".atl-intro h2",
  "A2 Intro line 1": ".atl-intro h2 span:nth-child(1)",
  "A2 Intro line 2": ".atl-intro h2 span:nth-child(2)",
  "A2 Intro body": ".atl-intro > p",
  "A2 Intro link": ".atl-intro .atl-text-link",
  "A2 Intro link label": ".atl-intro .atl-text-link",
  "A2 Old way": ".atl-old",
  "A2 New way": ".atl-new",
  "A2 Old way head": ".atl-old .atl-card-head",
  "A2 New way head": ".atl-new .atl-card-head",
  "A2 Old way title": ".atl-old h3",
  "A2 Old way title a": ".atl-old h3 span:nth-child(1)",
  "A2 Old way title b": ".atl-old h3 span:nth-child(2)",
  "A2 New way title": ".atl-new h3",
  "A2 New way title a": ".atl-new h3 span:nth-child(1)",
  "A2 New way title b": ".atl-new h3 span:nth-child(2)",
  "A2 Old way rows": ".atl-old ol",
  "A2 New way rows": ".atl-new ol",
  "A2 Old way row 0": ".atl-old li:nth-of-type(1)",
  "A2 Old way text 0": ".atl-old li:nth-of-type(1) p",
  "A2 New way row 0": ".atl-new li:nth-of-type(1)",
  "A2 New way text 0": ".atl-new li:nth-of-type(1) p",
  "A2 Analysis": ".atl-analysis",
  "A2 Analysis head": ".atl-analysis-head",
  "A2 Analysis heading": ".atl-analysis-head h2",
  "A2 Analysis line 1": ".atl-analysis-head h2 span:nth-child(1)",
  "A2 Analysis line 2": ".atl-analysis-head h2 span:nth-child(2)",
  "A2 Analysis body": ".atl-analysis-head > p",
  "A2 Analysis panel": ".atl-analysis-panel",
  "A2 Analysis portrait": ".atl-analysis-portrait",
  "A2 panel box wrap": ".atl-analysis-colour",
  "A2 panel colour box": ".atl-analysis-colour .atl-colour-box",
  "A2 portrait caption": ".atl-analysis-colour > p",
  "A2 panel reading": ".atl-analysis-reading",
  "A2 read head": ".atl-reading-head",
  "A2 read skin": ".atl-reading-skin",
  "A2 read swatch": ".atl-reading-skin > span",
  "A2 read copy": ".atl-reading-skin div",
  "A2 read depth": ".atl-reading-skin strong",
  "A2 read note": ".atl-reading-skin p",
  "A2 read confidence": ".atl-reading-bar",
  "A2 read bar": ".atl-reading-bar > i",
  "A2 read values": ".atl-reading-values",
  "A2 read value data L*": ".atl-reading-values span:nth-child(1)",
  "A2 panel palette": ".atl-palette",
  "A2 palette grid": ".atl-palette-grid",
  "A2 palette title": ".atl-palette .atl-panel-head span:nth-child(1)",
  "A2 panel quality": ".atl-quality",
  "A2 quality title": ".atl-quality .atl-panel-head span:nth-child(1)",
  "A2 quality live": ".atl-quality .atl-panel-head span:nth-child(2)",
  "A2 quality row Sample": ".atl-quality-row",
  "A2 panel footnote": ".atl-analysis-footnote",
  "A2 Collection": ".atl-collection",
  "A2 Collection head": ".atl-collection-head",
  "A2 Collection heading": ".atl-collection-head h2",
  "A2 Collection line 1": ".atl-collection-head h2 span:nth-child(1)",
  "A2 Collection line 2": ".atl-collection-head h2 span:nth-child(2)",
  "A2 Collection body": ".atl-collection-head .atl-section-heading > p",
  "A2 Collection count": ".atl-collection-count",
  "A2 Collection number": ".atl-collection-count strong",
  "A2 Collection number label": ".atl-collection-count span",
  "A2 Filters": ".atl-filters",
  "A2 Filter group": ".atl-filter-group",
  "A2 Search": ".atl-search",
  "A2 Filter category": ".atl-filter-group > a:nth-of-type(2)",
  "A2 Filter colour": ".atl-filter-group > a:nth-of-type(3)",
  "A2 Filter shop": ".atl-filter-group > a:nth-of-type(4)",
  "A2 Sort": ".atl-sort",
  "A2 Results meta": ".atl-results-meta",
  "A2 Catalogue grid": ".atl-card-grid",
  "A2 Colour card Saffron": ".atl-colour-card:nth-of-type(1)",
  "A2 Card colour Saffron": ".atl-colour-card:nth-of-type(1) .atl-card-colour",
  "A2 Card rank Saffron": ".atl-colour-card:nth-of-type(1) .atl-card-colour > span",
  "A2 Card body Saffron": ".atl-colour-card:nth-of-type(1) .atl-card-body",
  "A2 Card name Saffron": ".atl-colour-card:nth-of-type(1) .atl-card-title strong",
  "A2 Card score Saffron": ".atl-colour-card:nth-of-type(1) .atl-card-title span",
  "A2 Card shop Saffron": ".atl-colour-card:nth-of-type(1) .atl-card-shop span:nth-child(1)",
  "A2 Card verdict Saffron": ".atl-colour-card:nth-of-type(1) .atl-card-shop span:nth-child(2)",
  "A2 Card reason Saffron": ".atl-colour-card:nth-of-type(1) .atl-card-reason",
  "A2 Card foot label Saffron": ".atl-colour-card:nth-of-type(1) .atl-card-link",
  "A2 Collection note": ".atl-collection-note",
  "A2 Collection note copy": ".atl-collection-note p",
  "A2 How": ".atl-how",
  "A2 How heading": ".atl-how h2",
  "A2 How line 1": ".atl-how h2 span:nth-child(1)",
  "A2 How line 2": ".atl-how h2 span:nth-child(2)",
  "A2 How body": ".atl-how .atl-section-heading > p",
  "A2 How grid": ".atl-how-grid",
  "A2 How step 01": ".atl-how-step:nth-of-type(1)",
  "A2 How visual 01": ".atl-how-step:nth-of-type(1) .atl-how-visual",
  "A2 How face card": ".atl-how-face-card",
  "A2 How face label": ".atl-how-face-card > span",
  "A2 How title 01": ".atl-how-step:nth-of-type(1) h3",
  "A2 How copy 01": ".atl-how-step:nth-of-type(1) > p",
  "A2 How step 02": ".atl-how-step:nth-of-type(2)",
  "A2 How visual 02": ".atl-how-step:nth-of-type(2) .atl-how-visual",
  "A2 How title 02": ".atl-how-step:nth-of-type(2) h3",
  "A2 How step 03": ".atl-how-step:nth-of-type(3)",
  "A2 How visual 03": ".atl-how-step:nth-of-type(3) .atl-how-visual",
  "A2 How title 03": ".atl-how-step:nth-of-type(3) h3",
  "A2 Score band": ".atl-score-band",
  "A2 Score label": ".atl-score-band > div:first-child",
  "A2 Score kicker": ".atl-score-band > div:first-child span",
  "A2 Score 90–100": ".atl-score-band > div:nth-of-type(2)",
  "A2 Score 80–89": ".atl-score-band > div:nth-of-type(3)",
  "A2 FAQ": ".atl-faq",
  "A2 FAQ intro": ".atl-faq-intro",
  "A2 FAQ heading": ".atl-faq-intro h2",
  "A2 FAQ line 1": ".atl-faq-intro h2 span:nth-child(1)",
  "A2 FAQ line 2": ".atl-faq-intro h2 span:nth-child(2)",
  "A2 FAQ body": ".atl-faq-intro > p",
  "A2 FAQ list": ".atl-faq-list",
  "A2 FAQ row 0": ".atl-faq-list details:nth-of-type(1)",
  "A2 FAQ q 0": ".atl-faq-list details:nth-of-type(1) summary",
  "A2 FAQ question 0": ".atl-faq-list details:nth-of-type(1) summary",
  "A2 FAQ answer wrap 0": ".atl-faq-list details:nth-of-type(1) > p",
  "A2 FAQ row 1": ".atl-faq-list details:nth-of-type(2)",
  "A2 FAQ q 1": ".atl-faq-list details:nth-of-type(2) summary",
  "A2 FAQ row 5": ".atl-faq-list details:nth-of-type(6)",
  "A2 CTA": ".atl-cta",
  "A2 CTA top": ".atl-cta-top",
  "A2 CTA heading": ".atl-cta h2",
  "A2 CTA line 1": ".atl-cta h2 span:nth-child(1)",
  "A2 CTA line 2": ".atl-cta h2 span:nth-child(2)",
  "A2 CTA body": ".atl-cta-top > div:first-child > p",
  "A2 CTA buttons": ".atl-cta-actions",
  "A2 CTA camera": ".atl-cta-actions .atl-button:nth-of-type(1)",
  "A2 CTA upload": ".atl-cta-actions .atl-button:nth-of-type(2)",
  "A2 CTA foot": ".atl-cta-foot",
  "A2 Footer": ".atl-footer",
  "A2 Footer top": ".atl-footer-top",
  "A2 Footer brand": ".atl-footer-brand",
  "A2 Footer wordmark small": ".atl-footer-brand strong",
  "A2 Footer tag": ".atl-footer-brand span",
  "A2 Footer note": ".atl-footer-brand p",
  "A2 Footer col READ": ".atl-footer-top > div:nth-of-type(2)",
  "A2 Footer legal": ".atl-footer-legal",
  "A2 Footer giant": ".atl-footer-giant",
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 1000 }, deviceScaleFactor: 1 });

const live = await ctx.newPage();
await live.goto(URL_, { waitUntil: "networkidle" });
await live.evaluate(() => document.fonts.ready);

const design = await ctx.newPage();
await design.goto("file://" + DESIGN, { waitUntil: "load" });
await design.addStyleTag({ content: "*, *::before, *::after { box-sizing: border-box !important; }" });
await design.evaluate(() => document.fonts.ready);
await design.waitForTimeout(400);

const grab = (ns) => {
  const out = {};
  for (const n of ns) {
    const el = document.querySelector(`[data-pencil-name="${n}"]`);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    out[n] = {
      x: +(r.x + window.scrollX).toFixed(1),
      y: +(r.y + window.scrollY).toFixed(1),
      w: +r.width.toFixed(1),
      h: +r.height.toFixed(1),
      fs: cs.fontSize,
      fw: cs.fontWeight,
      ls: cs.letterSpacing,
      lh: cs.lineHeight,
      color: cs.color,
      isText: el.children.length === 0,
      txt: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 70),
    };
  }
  return out;
};

const names = Object.keys(MAP);
const liveData = await live.evaluate(
  ([map, ns]) => {
    const out = {};
    for (const n of ns) {
      const el = document.querySelector(map[n]);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      out[n] = {
        x: +(r.x + window.scrollX).toFixed(1),
        y: +(r.y + window.scrollY).toFixed(1),
        w: +r.width.toFixed(1),
        h: +r.height.toFixed(1),
        fs: cs.fontSize,
        fw: cs.fontWeight,
        ls: cs.letterSpacing,
        lh: cs.lineHeight,
        color: cs.color,
        isText: el.children.length === 0,
        txt: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 70),
      };
    }
    return out;
  },
  [MAP, names]
);
const designData = await design.evaluate((ns) => {
  const out = {};
  for (const n of ns) {
    const el = document.querySelector(`[data-pencil-name="${n}"]`);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    out[n] = {
      x: +(r.x + window.scrollX).toFixed(1),
      y: +(r.y + window.scrollY).toFixed(1),
      w: +r.width.toFixed(1),
      h: +r.height.toFixed(1),
      fs: cs.fontSize,
      fw: cs.fontWeight,
      ls: cs.letterSpacing,
      lh: cs.lineHeight,
      color: cs.color,
      isText: el.children.length === 0,
      txt: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 70),
    };
  }
  return out;
}, names);

await browser.close();

const rows = [];
for (const name of names) {
  const l = liveData[name];
  const d = designData[name];
  if (!l || !d) {
    rows.push({ name, issue: !l ? "missing in live" : "missing in design" });
    continue;
  }
  const dd = {
    dx: +(d.x - l.x).toFixed(1),
    dy: +(d.y - l.y).toFixed(1),
    dw: +(d.w - l.w).toFixed(1),
    dh: +(d.h - l.h).toFixed(1),
  };
  const style = [];
  const bothText = d.isText && l.isText;
  if (bothText) {
    if (l.fs !== d.fs) style.push(`fs ${l.fs}->${d.fs}`);
    if (l.fw !== d.fw) style.push(`fw ${l.fw}->${d.fw}`);
    if (l.ls !== d.ls) style.push(`ls ${l.ls}->${d.ls}`);
    if (l.lh !== d.lh) style.push(`lh ${l.lh}->${d.lh}`);
    if (l.color !== d.color) style.push(`color ${l.color}->${d.color}`);
    if (l.txt !== d.txt) style.push(`txt "${l.txt}" vs "${d.txt}"`);
  }
  const off = Math.max(Math.abs(dd.dx), Math.abs(dd.dy));
  rows.push({
    name,
    off,
    ...dd,
    style: style.join(" | "),
    bad: off > 1.5 || Math.abs(dd.dw) > 1.5 || Math.abs(dd.dh) > 1.5 || style.length > 0,
    live: l,
    design: d,
  });
}

const bad = rows.filter((r) => r.bad).sort((a, b) => (b.off || 0) - (a.off || 0));
const missing = rows.filter((r) => r.issue);
console.log(
  `checked ${rows.length} layers | ${bad.length} differ | ${missing.length} unmatched | live ${await live
    .evaluate(() => document.body.scrollHeight)
    .catch(() => 0)}`
);
if (missing.length) console.log("unmatched:", missing.map((m) => `${m.name}(${m.issue})`).join(", "));
console.log("");
for (const r of bad) {
  console.log(
    `${r.name.padEnd(32)} d=${String(r.dx).padStart(7)},${String(r.dy).padStart(7)},${String(r.dw).padStart(7)},${String(r.dh).padStart(7)}  ${r.style || ""}`
  );
}
if (process.env.JSON_OUT) fs.writeFileSync(process.env.JSON_OUT, JSON.stringify(rows, null, 2));
