import sharp from "sharp";
import { labToHex, rgbToLab, clamp, type Lab, type Rgb } from "../color";
import type { QualityMetrics, SkinSampleInput } from "../skin";
import type { Point } from "../face/landmarks";

export interface DecodedImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

const MAX_EDGE = 1280;

export async function decodeImage(input: string): Promise<DecodedImage> {
  const base64 = input.includes(",") ? input.slice(input.indexOf(",") + 1) : input;
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0) throw new Error("Empty image payload");
  if (buffer.length > 8_000_000) throw new Error("Image exceeds 8 MB");
  const { data, info } = await sharp(buffer)
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
    width: info.width,
    height: info.height,
  };
}

interface HeuristicFace {
  samples: SkinSampleInput[];
  quality: QualityMetrics;
  usedHeuristic: true;
}

/**
 * Fallback for API callers who only send an image.
 * Assumes a centred portrait and uses a broad YCbCr skin gate. Low confidence.
 */
export function heuristicFace(image: DecodedImage): HeuristicFace {
  const { data, width, height } = image;
  const cx = width * 0.5;
  const cy = height * 0.43;
  const rx = width * 0.19;
  const ry = height * 0.27;
  const samples: SkinSampleInput[] = [];
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  const step = Math.max(3, Math.round(Math.min(width, height) / 110));
  for (let y = Math.max(0, cy - ry); y < Math.min(height, cy + ry); y += step) {
    for (let x = Math.max(0, cx - rx); x < Math.min(width, cx + rx); x += step) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      const offset = (y * width + x) * 4;
      if (data[offset + 3] < 180) continue;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      if (cb < 72 || cb > 142 || cr < 124 || cr > 188) continue;
      if (r < 25 || r > 252) continue;
      const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      sum += luma;
      sumSq += luma * luma;
      count += 1;
      samples.push({
        rgb: [r, g, b],
        weight: 1,
        region: y < cy - ry * 0.25 ? "forehead" : x < cx ? "leftCheek" : "rightCheek",
      });
    }
  }

  const mean = count ? sum / count : 0;
  const variance = count ? sumSq / count - mean * mean : 0;
  return {
    samples,
    usedHeuristic: true,
    quality: {
      lighting: clamp(1 - Math.abs(mean - 0.6) / 0.45, 0, 1),
      evenness: clamp(1 - Math.sqrt(Math.max(0, variance)) / 0.24, 0, 1),
      faceSize: 0.38,
      sharpness: 0.35,
      yaw: 0,
      pitch: 0,
      roll: 0,
    },
  };
}

export interface PaletteEntry {
  hex: string;
  lab: Lab;
  share: number;
}

/**
 * Deterministic k-means over a centre crop, in Lab.
 * Returns dominant garment colours, not a "correct" colour.
 */
export function extractPalette(image: DecodedImage, limit = 5): PaletteEntry[] {
  const { data, width, height } = image;
  const x0 = Math.floor(width * 0.14);
  const x1 = Math.ceil(width * 0.86);
  const y0 = Math.floor(height * 0.14);
  const y1 = Math.ceil(height * 0.86);
  const step = Math.max(2, Math.round(Math.min(width, height) / 90));

  const pixels: Array<{ lab: Lab; rgb: Rgb }> = [];
  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      const offset = (y * width + x) * 4;
      if (data[offset + 3] < 180) continue;
      const rgb = { r: data[offset], g: data[offset + 1], b: data[offset + 2] };
      const lab = rgbToLab(rgb);
      // Skip near-white background and fully clipped pixels, but keep black.
      if (lab.l > 94 && Math.hypot(lab.a, lab.b) < 7) continue;
      pixels.push({ lab, rgb });
    }
  }
  if (pixels.length === 0) return [];

  const k = Math.min(limit, Math.max(2, Math.round(Math.sqrt(pixels.length / 80))), pixels.length);
  const centroids: Lab[] = Array.from({ length: k }, (_, index) => {
    const position = Math.floor((index / k) * pixels.length);
    return { ...pixels[position].lab };
  });

  const assignments = new Int32Array(pixels.length);
  for (let iteration = 0; iteration < 12; iteration += 1) {
    let changed = false;
    for (let index = 0; index < pixels.length; index += 1) {
      let best = 0;
      let bestDistance = Infinity;
      for (let cluster = 0; cluster < centroids.length; cluster += 1) {
        const centroid = centroids[cluster];
        const distance =
          (pixels[index].lab.l - centroid.l) ** 2 +
          (pixels[index].lab.a - centroid.a) ** 2 +
          (pixels[index].lab.b - centroid.b) ** 2;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = cluster;
        }
      }
      if (assignments[index] !== best) {
        assignments[index] = best;
        changed = true;
      }
    }
    const sums = centroids.map(() => ({ l: 0, a: 0, b: 0, count: 0 }));
    for (let index = 0; index < pixels.length; index += 1) {
      const cluster = assignments[index];
      sums[cluster].l += pixels[index].lab.l;
      sums[cluster].a += pixels[index].lab.a;
      sums[cluster].b += pixels[index].lab.b;
      sums[cluster].count += 1;
    }
    for (let cluster = 0; cluster < centroids.length; cluster += 1) {
      if (sums[cluster].count === 0) continue;
      centroids[cluster] = {
        l: sums[cluster].l / sums[cluster].count,
        a: sums[cluster].a / sums[cluster].count,
        b: sums[cluster].b / sums[cluster].count,
      };
    }
    if (!changed && iteration > 1) break;
  }

  const counts = new Array(k).fill(0);
  for (let index = 0; index < pixels.length; index += 1) counts[assignments[index]] += 1;

  const entries = centroids.map((lab, index) => ({
    hex: labToHex(lab),
    lab,
    share: counts[index] / pixels.length,
  }));

  return entries
    .filter((entry) => entry.share > 0.04)
    .sort((a, b) => b.share - a.share)
    .slice(0, limit);
}

export function normalisedFaceOutline(landmarks: Point[]): Array<{ x: number; y: number }> {
  return landmarks.map((point) => ({ x: Number(point.x.toFixed(4)), y: Number(point.y.toFixed(4)) }));
}
