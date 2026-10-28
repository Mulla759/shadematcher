import { labToHex, rgbToLab, type Lab } from "@/lib/color";

export interface PaletteEntry {
  hex: string;
  share: number;
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Tiny client-side k-means for garment colour extraction.
 * Runs on a 180px copy; no upload required.
 */
export async function extractPaletteFromFile(file: File, count = 5): Promise<PaletteEntry[]> {
  const image = await loadImage(file);
  const maxEdge = 180;
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(image, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);

  const x0 = Math.floor(width * 0.12);
  const x1 = Math.ceil(width * 0.88);
  const y0 = Math.floor(height * 0.12);
  const y1 = Math.ceil(height * 0.88);
  const pixels: Lab[] = [];
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const offset = (y * width + x) * 4;
      if (data[offset + 3] < 180) continue;
      const lab = rgbToLab({ r: data[offset], g: data[offset + 1], b: data[offset + 2] });
      if (lab.l > 95 && Math.hypot(lab.a, lab.b) < 6) continue;
      pixels.push(lab);
    }
  }
  if (pixels.length === 0) return [];

  const k = Math.min(count, Math.max(2, Math.round(Math.sqrt(pixels.length / 120))), pixels.length);
  const centroids: Lab[] = Array.from({ length: k }, (_, index) => {
    const position = Math.floor((index / k) * pixels.length);
    return { ...pixels[position] };
  });
  const assignments = new Int32Array(pixels.length);

  for (let iteration = 0; iteration < 10; iteration += 1) {
    let changed = false;
    for (let index = 0; index < pixels.length; index += 1) {
      let best = 0;
      let bestDistance = Infinity;
      for (let cluster = 0; cluster < centroids.length; cluster += 1) {
        const centroid = centroids[cluster];
        const distance =
          (pixels[index].l - centroid.l) ** 2 +
          (pixels[index].a - centroid.a) ** 2 +
          (pixels[index].b - centroid.b) ** 2;
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
      sums[cluster].l += pixels[index].l;
      sums[cluster].a += pixels[index].a;
      sums[cluster].b += pixels[index].b;
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

  return centroids
    .map((lab, index) => ({
      hex: labToHex(lab),
      share: counts[index] / pixels.length,
    }))
    .filter((entry) => entry.share > 0.05)
    .sort((a, b) => b.share - a.share)
    .slice(0, count);
}
