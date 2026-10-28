#!/usr/bin/env node
/**
 * Score the vision pilot: does grounding the fabric beat our blind crop?
 *
 * For each labelled image we have three opinions:
 *   - store_family   : the retailer's own tag/name mapping
 *   - baseline       : family from the old whole-crop median hex
 *   - grounded       : family from the median hex *inside the VL box*
 * and the VL model's own family guess.
 */

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const hexToFamily = (hex) => {
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
  if (h < 160) return "green";
  if (h < 255) return "blue";
  if (h < 290) return "purple";
  return "pink";
};

/** median colour of a normalised box inside an image */
async function medianInBox(file, [x0, y0, x1, y1]) {
  const img = sharp(file);
  const { width = 0, height = 0 } = await img.metadata();
  let left = Math.round(x0 * width);
  let top = Math.round(y0 * height);
  let w = Math.round((x1 - x0) * width);
  let h = Math.round((y1 - y0) * height);
  // keep at least 12x12 px and inside the frame
  w = Math.max(12, Math.min(w, width - left));
  h = Math.max(12, Math.min(h, height - top));
  left = Math.max(0, Math.min(left, width - w));
  top = Math.max(0, Math.min(top, height - h));

  const raw = await img
    .extract({ left, top, width: w, height: h })
    .resize(40, 40, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();
  const px = [];
  for (let i = 0; i < raw.length; i += 3) {
    const r = raw[i], g = raw[i + 1], b = raw[i + 2];
    if (r > 246 && g > 246 && b > 246) continue;
    if (r < 12 && g < 12 && b < 12) continue;
    px.push([r, g, b]);
  }
  const use = px.length ? px : [[128, 128, 128]];
  const sorted = [...use].sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
  const m = sorted[Math.floor(sorted.length / 2)];
  return "#" + m.map((v) => v.toString(16).padStart(2, "0")).join("");
}

const rows = [];
for (const b of [1, 2, 3]) {
  const batch = JSON.parse(await fs.readFile(`/tmp/vl-batch-${b}.json`, "utf8"));
  const out = (await fs.readFile(`/tmp/vl-out-${b}.jsonl`, "utf8"))
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  for (const entry of batch) {
    const v = out.find((o) => o.id === entry.id);
    rows.push({ ...entry, vl: v || null });
  }
}

const catalog = JSON.parse(await fs.readFile("library/catalog.json", "utf8"));
const byKey = new Map(catalog.colours.map((c) => [`${c.site}:${c.color_label}`, c]));

const scored = [];
for (const r of rows) {
  if (!r.vl) continue;
  const base = byKey.get(r.id);
  const item = {
    id: r.id,
    label: r.label,
    store_family: base?.color_family || null,
    baseline_family: base?.measured_family || null,
    vl_family: r.vl.fabric_present ? r.vl.family : null,
    fabric_present: r.vl.fabric_present,
    grounded_family: null,
    grounded_hex: null,
    baseline_hex: r.hex,
    vl_hex: r.vl.fabric_hex,
  };
  if (r.vl.fabric_present) {
    const [x0, y0, x1, y1] = r.vl.bbox || [0, 0, 1, 1];
    if ((x1 - x0) * (y1 - y0) > 0.01) {
      try {
        item.grounded_hex = await medianInBox(r.path, [x0, y0, x1, y1]);
        item.grounded_family = hexToFamily(item.grounded_hex);
      } catch {}
    }
  }
  scored.push(item);
}

const pct = (n, d) => (d ? `${((n / d) * 100).toFixed(0)}%` : "n/a");
const withFabric = scored.filter((s) => s.fabric_present);
const agree = (key) => withFabric.filter((s) => s[key] && s[key] === s.store_family).length;

console.log("rows scored:", scored.length);
console.log("fabric detected:", withFabric.length, `(${pct(withFabric.length, scored.length)})`);
console.log("no fabric (filtered out):", scored.length - withFabric.length);
console.log();
console.log("agreement with store family (of", withFabric.length, "with fabric):");
console.log("  baseline (blind crop) :", agree("baseline_family"), pct(agree("baseline_family"), withFabric.length));
console.log("  grounded (VL box)     :", agree("grounded_family"), pct(agree("grounded_family"), withFabric.length));
console.log("  VL model's own guess  :", agree("vl_family"), pct(agree("vl_family"), withFabric.length));
console.log();

const changed = withFabric.filter(
  (s) => s.grounded_family && s.baseline_family && s.grounded_family !== s.baseline_family,
);
console.log("rows where grounding changed the family:", changed.length);
for (const c of changed.slice(0, 12)) {
  console.log(
    `  ${c.label.padEnd(22)} store=${String(c.store_family).padEnd(8)} base=${String(c.baseline_family).padEnd(8)} -> grounded=${String(c.grounded_family).padEnd(8)} vl=${c.vl_family}`,
  );
}

await fs.writeFile("/tmp/pilot-scored.json", JSON.stringify(scored, null, 2));
console.log("\nwrote /tmp/pilot-scored.json");
