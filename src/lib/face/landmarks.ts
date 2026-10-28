import type { SkinRegion, SkinSampleInput, QualityMetrics } from "../skin";
import { clamp, rgbToLab, type Rgb } from "../color";

export interface Point {
  x: number;
  y: number;
  z?: number;
}

export interface FaceGeometry {
  center: Point;
  faceWidth: number;
  faceHeight: number;
  chin: Point;
  forehead: Point;
  eyeLineY: number;
  mouthY: number;
  roll: number;
  yaw: number;
  pitch: number;
  anchors: {
    crown: Point;
    chin: Point;
    leftTragion: Point;
    rightTragion: Point;
    leftTemple: Point;
    rightTemple: Point;
    leftBrow: Point;
    rightBrow: Point;
    leftEyeOuter: Point;
    rightEyeOuter: Point;
    noseTip: Point;
  };
}

/** MediaPipe FaceMesh face-oval ring (36 points). */
export const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378,
  400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21,
  54, 103, 67, 109,
] as const;

export const LEFT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
export const RIGHT_EYE = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466];
export const LEFT_BROW = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46];
export const RIGHT_BROW = [300, 293, 334, 296, 336, 285, 295, 282, 283, 276];
export const LIPS = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];
export const NOSE = [98, 2, 326, 327, 294, 278, 344, 440, 275, 4, 45, 220, 115, 48, 64];
export const SCLERA = [33, 133, 159, 145, 362, 263, 386, 374];
export const IRIS = [468, 469, 470, 471, 472, 473, 474, 475, 476, 477];

export const HIJAB_ANCHOR_IDS = {
  crown: 10,
  chin: 152,
  leftTragion: 234,
  rightTragion: 454,
  leftTemple: 127,
  rightTemple: 356,
  leftBrow: 21,
  rightBrow: 251,
  leftEyeOuter: 33,
  rightEyeOuter: 263,
  noseTip: 1,
} as const;

export const pointAt = (landmarks: Point[], index: number, width: number, height: number): Point => {
  const point = landmarks[index];
  return { x: point.x * width, y: point.y * height, z: point.z };
};

export const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

export const midpoint = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

export function computeFaceGeometry(
  landmarks: Point[],
  width: number,
  height: number,
): FaceGeometry {
  const p = (index: number) => pointAt(landmarks, index, width, height);
  const crown = p(10);
  const chin = p(152);
  const leftTragion = p(234);
  const rightTragion = p(454);
  const leftEyeOuter = p(33);
  const rightEyeOuter = p(263);
  const noseTip = p(1);
  const leftEyeInner = p(133);
  const rightEyeInner = p(362);
  const mouthCenter = midpoint(p(13), p(14));

  const faceWidth = distance(leftTragion, rightTragion);
  const faceHeight = distance(crown, chin);
  const eyeLineY = (leftEyeOuter.y + rightEyeOuter.y + leftEyeInner.y + rightEyeInner.y) / 4;
  const roll = (Math.atan2(rightEyeOuter.y - leftEyeOuter.y, rightEyeOuter.x - leftEyeOuter.x) * 180) / Math.PI;
  const center = {
    x: (leftTragion.x + rightTragion.x + noseTip.x * 2) / 4,
    y: (crown.y + chin.y) / 2,
  };
  const yaw = clamp(((noseTip.x - center.x) / Math.max(faceWidth / 2, 1)) * 45, -65, 65);
  const noseRatio = (noseTip.y - eyeLineY) / Math.max(1, chin.y - eyeLineY);
  const pitch = clamp((noseRatio - 0.55) * 75, -45, 45);

  return {
    center,
    faceWidth,
    faceHeight,
    chin,
    forehead: crown,
    eyeLineY,
    mouthY: mouthCenter.y,
    roll,
    yaw,
    pitch,
    anchors: {
      crown,
      chin,
      leftTragion,
      rightTragion,
      leftTemple: p(127),
      rightTemple: p(356),
      leftBrow: p(21),
      rightBrow: p(251),
      leftEyeOuter,
      rightEyeOuter,
      noseTip,
    },
  };
}

export function polygon(points: Point[]): Point[] {
  return points;
}

export function pointInPolygon(point: { x: number; y: number }, polygonPoints: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygonPoints.length - 1; i < polygonPoints.length; j = i++) {
    const xi = polygonPoints[i].x;
    const yi = polygonPoints[i].y;
    const xj = polygonPoints[j].x;
    const yj = polygonPoints[j].y;
    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function shrinkPolygon(points: Point[], factor = 0.94): Point[] {
  const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  return points.map((point) => ({
    x: cx + (point.x - cx) * factor,
    y: cy + (point.y - cy) * factor,
  }));
}

export function regionForPoint(
  x: number,
  y: number,
  geometry: FaceGeometry,
): SkinRegion {
  const { center, faceWidth, faceHeight, eyeLineY, mouthY, chin } = geometry;
  if (y < eyeLineY - faceHeight * 0.02) return "forehead";
  if (y > chin.y - faceHeight * 0.12) return "jaw";
  if (y > mouthY - faceHeight * 0.04) return "jaw";
  const dx = (x - center.x) / Math.max(faceWidth, 1);
  if (Math.abs(dx) < 0.13) return "nose";
  if (dx < -0.16) return "leftCheek";
  if (dx > 0.16) return "rightCheek";
  return "nose";
}

const REGION_WEIGHT: Record<SkinRegion, number> = {
  forehead: 1,
  leftCheek: 1.3,
  rightCheek: 1.3,
  nose: 0.5,
  jaw: 0.85,
  neck: 0.8,
  unknown: 0.6,
};

export interface SamplingResult {
  samples: SkinSampleInput[];
  whitePoint?: [number, number, number];
  quality: QualityMetrics;
  face: FaceGeometry;
  faceOval: Point[];
  coverage: {
    sampledPoints: number;
    rejectedPoints: number;
    facePixels: number;
  };
}

function averagePatch(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  radius: number,
): Rgb | null {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  const x0 = Math.max(0, Math.round(x) - radius);
  const x1 = Math.min(width - 1, Math.round(x) + radius);
  const y0 = Math.max(0, Math.round(y) - radius);
  const y1 = Math.min(height - 1, Math.round(y) + radius);
  for (let py = y0; py <= y1; py += 1) {
    for (let px = x0; px <= x1; px += 1) {
      const offset = (py * width + px) * 4;
      if (data[offset + 3] < 180) continue;
      r += data[offset];
      g += data[offset + 1];
      b += data[offset + 2];
      count += 1;
    }
  }
  if (count === 0) return null;
  return { r: r / count, g: g / count, b: b / count };
}

function isPlausibleSkin(rgb: Rgb): boolean {
  const lab = rgbToLab(rgb);
  // Broad gate only: reject near-black, blown highlights, hair and non-skin neon.
  if (lab.l < 6 || lab.l > 98) return false;
  if (lab.l > 93 && Math.hypot(lab.a, lab.b) < 4) return false;
  const c = Math.hypot(lab.a, lab.b);
  if (c < 6 && lab.l < 65) return false;
  return true;
}

/**
 * Sample the face from RGBA pixels using landmark geometry.
 * Only geometry + robust clustering decide what is skin; no skin-tone priors.
 */
export function sampleFace(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  landmarks: Point[],
): SamplingResult {
  const p = (index: number) => pointAt(landmarks, index, width, height);
  const all = (indices: readonly number[]) => indices.map(p);
  const geometry = computeFaceGeometry(landmarks, width, height);
  const oval = shrinkPolygon(all(FACE_OVAL), 0.91);
  const exclusions = [
    all(LEFT_EYE),
    all(RIGHT_EYE),
    all(LEFT_BROW),
    all(RIGHT_BROW),
    all(LIPS),
    all(NOSE),
  ];

  const samples: SkinSampleInput[] = [];
  const step = Math.max(2, Math.floor(geometry.faceWidth / 30));
  let rejected = 0;
  let facePixels = 0;
  const top = geometry.forehead.y + geometry.faceHeight * 0.07;

  for (let y = Math.max(0, top); y < Math.min(height, geometry.chin.y); y += step) {
    for (let x = Math.max(0, geometry.center.x - geometry.faceWidth * 0.55); x < Math.min(width, geometry.center.x + geometry.faceWidth * 0.55); x += step) {
      if (!pointInPolygon({ x, y }, oval)) continue;
      facePixels += 1;
      if (exclusions.some((polygonPoints) => pointInPolygon({ x, y }, polygonPoints))) {
        rejected += 1;
        continue;
      }
      const rgb = averagePatch(data, width, height, x, y, 1);
      if (!rgb || !isPlausibleSkin(rgb)) {
        rejected += 1;
        continue;
      }
      const region = regionForPoint(x, y, geometry);
      samples.push({
        rgb: [rgb.r, rgb.g, rgb.b],
        weight: REGION_WEIGHT[region],
        region,
      });
    }
  }

  // A small neck patch below the chin improves foundation matching, when visible.
  const neckY = geometry.chin.y + geometry.faceHeight * 0.1;
  const neckXs = [-0.22, -0.08, 0.08, 0.22];
  for (const offset of neckXs) {
    const x = geometry.center.x + geometry.faceWidth * offset;
    if (y2OutOfBounds(neckY, x, width, height)) continue;
    const rgb = averagePatch(data, width, height, x, neckY, 2);
    if (!rgb || !isPlausibleSkin(rgb)) continue;
    samples.push({
      rgb: [rgb.r, rgb.g, rgb.b],
      weight: REGION_WEIGHT.neck,
      region: "neck",
    });
  }

  const whitePoint = findWhitePoint(data, width, height, landmarks);
  const quality = qualityFromPixels(data, width, height, geometry, oval);
  return {
    samples: samples.slice(0, 2400),
    whitePoint,
    quality,
    face: geometry,
    faceOval: oval,
    coverage: {
      sampledPoints: samples.length,
      rejectedPoints: rejected,
      facePixels,
    },
  };
}

function y2OutOfBounds(y: number, x: number, width: number, height: number): boolean {
  return y < 0 || y >= height || x < 0 || x >= width;
}

function findWhitePoint(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  landmarks: Point[],
): [number, number, number] | undefined {
  const candidates: Array<{ rgb: Rgb; luma: number; chroma: number }> = [];
  for (const index of SCLERA) {
    const point = landmarks[index];
    if (!point) continue;
    const rgb = averagePatch(data, width, height, point.x * width, point.y * height, 1);
    if (!rgb) continue;
    const lab = rgbToLab(rgb);
    const c = Math.hypot(lab.a, lab.b);
    if (lab.l < 38 || c > 18) continue;
    candidates.push({ rgb, luma: lab.l, chroma: c });
  }
  if (candidates.length === 0) return undefined;
  candidates.sort((a, b) => b.luma - a.luma || a.chroma - b.chroma);
  const top = candidates.slice(0, 3);
  return [
    top.reduce((sum, item) => sum + item.rgb.r, 0) / top.length,
    top.reduce((sum, item) => sum + item.rgb.g, 0) / top.length,
    top.reduce((sum, item) => sum + item.rgb.b, 0) / top.length,
  ];
}

function qualityFromPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  geometry: FaceGeometry,
  oval: Point[],
): QualityMetrics {
  const xs = oval.map((point) => point.x);
  const ys = oval.map((point) => point.y);
  const x0 = Math.max(0, Math.floor(Math.min(...xs)));
  const x1 = Math.min(width - 1, Math.ceil(Math.max(...xs)));
  const y0 = Math.max(0, Math.floor(Math.min(...ys)));
  const y1 = Math.min(height - 1, Math.ceil(Math.max(...ys)));

  let sum = 0;
  let sumSq = 0;
  let count = 0;
  let laplacianSum = 0;
  let laplacianSq = 0;
  let laplacianCount = 0;

  for (let y = y0; y <= y1; y += 2) {
    for (let x = x0; x <= x1; x += 2) {
      if (!pointInPolygon({ x, y }, oval)) continue;
      const offset = (y * width + x) * 4;
      const luma = (0.2126 * data[offset] + 0.7152 * data[offset + 1] + 0.0722 * data[offset + 2]) / 255;
      sum += luma;
      sumSq += luma * luma;
      count += 1;

      if (x > 1 && x < width - 2 && y > 1 && y < height - 2) {
        const centre = luma;
        const left = (0.2126 * data[offset - 4] + 0.7152 * data[offset - 3] + 0.0722 * data[offset - 2]) / 255;
        const right = (0.2126 * data[offset + 4] + 0.7152 * data[offset + 5] + 0.0722 * data[offset + 6]) / 255;
        const up = (0.2126 * data[offset - width * 4] + 0.7152 * data[offset - width * 4 + 1] + 0.0722 * data[offset - width * 4 + 2]) / 255;
        const down = (0.2126 * data[offset + width * 4] + 0.7152 * data[offset + width * 4 + 1] + 0.0722 * data[offset + width * 4 + 2]) / 255;
        const laplacian = left + right + up + down - 4 * centre;
        laplacianSum += laplacian;
        laplacianSq += laplacian * laplacian;
        laplacianCount += 1;
      }
    }
  }

  const mean = count > 0 ? sum / count : 0;
  const variance = count > 0 ? sumSq / count - mean * mean : 0;
  const std = Math.sqrt(Math.max(0, variance));
  const laplacianMean = laplacianCount > 0 ? laplacianSum / laplacianCount : 0;
  const laplacianVariance = laplacianCount > 0 ? laplacianSq / laplacianCount - laplacianMean ** 2 : 0;

  const lighting = clamp(1 - Math.abs(mean - 0.6) / 0.45, 0, 1);
  const evenness = clamp(1 - std / 0.24, 0, 1);
  const sharpness = clamp(laplacianVariance / 0.004, 0, 1);

  return {
    lighting,
    evenness,
    sharpness,
    faceSize: clamp(geometry.faceWidth / width, 0, 1),
    yaw: geometry.yaw,
    pitch: geometry.pitch,
    roll: geometry.roll,
  };
}
