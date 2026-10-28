import { hexToLab, labToHex, lightenLab, mixLab } from "../color";
import type { Point } from "../face/landmarks";
import { computeFaceGeometry, FACE_OVAL, type FaceGeometry } from "../face/landmarks";

export type HijabStyle = "classic" | "turkish" | "modal";

export interface HijabOptions {
  landmarks: Point[];
  width: number;
  height: number;
  colour: string;
  style?: HijabStyle;
  sheen?: number;
  coverage?: number;
  yaw?: number;
  showAnchors?: boolean;
}

interface PathPoint {
  x: number;
  y: number;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

function smoothClosedPath(ctx: CanvasRenderingContext2D, points: PathPoint[]): void {
  if (points.length < 3) return;
  const first = points[0];
  const last = points[points.length - 1];
  ctx.beginPath();
  ctx.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2);
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    ctx.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
  }
  ctx.closePath();
}

function outerPath(ctx: CanvasRenderingContext2D, map: (x: number, y: number) => PathPoint, style: HijabStyle): void {
  ctx.beginPath();
  if (style === "turkish") {
    ctx.moveTo(...xy(map(0, -1.24)));
    ctx.bezierCurveTo(...xy(map(-0.42, -1.08)), ...xy(map(-0.84, -0.84)), ...xy(map(-1.0, -0.3)));
    ctx.bezierCurveTo(...xy(map(-1.12, 0.14)), ...xy(map(-1.0, 0.56)), ...xy(map(-1.16, 0.98)));
    ctx.bezierCurveTo(...xy(map(-1.3, 1.34)), ...xy(map(-0.82, 1.52)), ...xy(map(-0.28, 1.52)));
    ctx.lineTo(...xy(map(0.28, 1.52)));
    ctx.bezierCurveTo(...xy(map(0.82, 1.52)), ...xy(map(1.3, 1.34)), ...xy(map(1.16, 0.98)));
    ctx.bezierCurveTo(...xy(map(1.0, 0.56)), ...xy(map(1.12, 0.14)), ...xy(map(1.0, -0.3)));
    ctx.bezierCurveTo(...xy(map(0.84, -0.84)), ...xy(map(0.42, -1.08)), ...xy(map(0, -1.24)));
    ctx.closePath();
    return;
  }
  if (style === "modal") {
    ctx.moveTo(...xy(map(0, -1.0)));
    ctx.bezierCurveTo(...xy(map(-0.42, -0.98)), ...xy(map(-0.86, -0.74)), ...xy(map(-1.0, -0.28)));
    ctx.bezierCurveTo(...xy(map(-1.1, 0.12)), ...xy(map(-1.02, 0.52)), ...xy(map(-1.1, 0.86)));
    ctx.bezierCurveTo(...xy(map(-1.18, 1.14)), ...xy(map(-0.88, 1.3)), ...xy(map(-0.42, 1.32)));
    ctx.lineTo(...xy(map(0.42, 1.32)));
    ctx.bezierCurveTo(...xy(map(0.88, 1.3)), ...xy(map(1.18, 1.14)), ...xy(map(1.1, 0.86)));
    ctx.bezierCurveTo(...xy(map(1.02, 0.52)), ...xy(map(1.1, 0.12)), ...xy(map(1.0, -0.28)));
    ctx.bezierCurveTo(...xy(map(0.86, -0.74)), ...xy(map(0.42, -0.98)), ...xy(map(0, -1.0)));
    ctx.closePath();
    return;
  }
  // Classic drape: volume at the crown, a soft cheek curve, and a shoulder fall
  // that keeps its width instead of tapering into a tube.
  ctx.moveTo(...xy(map(0, -1.08)));
  ctx.bezierCurveTo(...xy(map(-0.38, -1.06)), ...xy(map(-0.82, -0.9)), ...xy(map(-1.02, -0.5)));
  ctx.bezierCurveTo(...xy(map(-1.2, -0.16)), ...xy(map(-1.12, 0.2)), ...xy(map(-1.24, 0.56)));
  ctx.bezierCurveTo(...xy(map(-1.36, 0.94)), ...xy(map(-1.52, 1.2)), ...xy(map(-1.62, 1.5)));
  ctx.bezierCurveTo(...xy(map(-1.68, 1.62)), ...xy(map(-1.22, 1.7)), ...xy(map(-0.7, 1.71)));
  ctx.bezierCurveTo(...xy(map(-0.32, 1.72)), ...xy(map(0.32, 1.72)), ...xy(map(0.7, 1.71)));
  ctx.bezierCurveTo(...xy(map(1.22, 1.7)), ...xy(map(1.68, 1.62)), ...xy(map(1.62, 1.5)));
  ctx.bezierCurveTo(...xy(map(1.52, 1.2)), ...xy(map(1.36, 0.94)), ...xy(map(1.24, 0.56)));
  ctx.bezierCurveTo(...xy(map(1.12, 0.2)), ...xy(map(1.2, -0.16)), ...xy(map(1.02, -0.5)));
  ctx.bezierCurveTo(...xy(map(0.82, -0.9)), ...xy(map(0.38, -1.06)), ...xy(map(0, -1.08)));
  ctx.closePath();
}

function xy(point: PathPoint): [number, number] {
  return [point.x, point.y];
}

function faceOpeningPath(ctx: CanvasRenderingContext2D, landmarks: Point[], width: number, height: number, geometry: FaceGeometry): void {
  const cx = geometry.center.x;
  const cy = geometry.center.y;
  // Expand sideways to clear the cheeks and ears, but keep the top at the
  // hairline. Uniform expansion reveals hair above the forehead and makes the
  // drape read as a headband.
  const scaleX = 1.085;
  const points = FACE_OVAL.map((index) => {
    const point = landmarks[index];
    const px = point.x * width;
    const py = point.y * height;
    const dy = py - cy;
    const scaleY = dy < 0 ? 0.997 : 1.012;
    return {
      x: cx + (px - cx) * scaleX,
      y: cy + dy * scaleY,
    };
  });
  smoothClosedPath(ctx, points);
}

let textureCanvas: HTMLCanvasElement | null = null;
let hullCanvas: HTMLCanvasElement | null = null;

function getHull(width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  if (!hullCanvas) hullCanvas = document.createElement("canvas");
  if (hullCanvas.width !== width || hullCanvas.height !== height) {
    hullCanvas.width = width;
    hullCanvas.height = height;
  }
  return hullCanvas;
}

function getTexture(): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  if (textureCanvas) return textureCanvas;
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 48;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const image = ctx.createImageData(48, 48);
  let seed = 0x9e3779b9;
  for (let i = 0; i < image.data.length; i += 4) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    const value = 90 + (seed >>> 24) * 0.22;
    image.data[i] = value;
    image.data[i + 1] = value;
    image.data[i + 2] = value;
    image.data[i + 3] = 26;
  }
  ctx.putImageData(image, 0, 0);
  textureCanvas = canvas;
  return canvas;
}



export function drawHijabPreview(
  ctx: CanvasRenderingContext2D,
  options: HijabOptions,
): void {
  const { landmarks, width, height, colour } = options;
  if (landmarks.length < 468 || width < 2 || height < 2) return;

  const style = options.style ?? "classic";
  const sheen = clamp01(options.sheen ?? 0.55);
  const coverage = clamp01(options.coverage ?? 0.94);
  const geometry = computeFaceGeometry(landmarks, width, height);
  const rx = Math.max(20, geometry.faceWidth / 2);
  const ry = Math.max(30, geometry.faceHeight);
  const yaw = options.yaw ?? geometry.yaw;
  const roll = (geometry.roll * Math.PI) / 180;
  const cos = Math.cos(roll);
  const sin = Math.sin(roll);
  const yawFactor = Math.max(-1, Math.min(1, yaw / 45));

  const map = (x: number, y: number): PathPoint => {
    const squeeze = 1 - Math.abs(yawFactor) * 0.02;
    const px = (x * squeeze + yawFactor * y * 0.014) * rx;
    const py = y * ry;
    return {
      x: geometry.center.x + px * cos - py * sin,
      y: geometry.center.y + px * sin + py * cos,
    };
  };

  const baseLab = hexToLab(colour);
  const light = labToHex(lightenLab(baseLab, 8 + sheen * 4));
  const mid = labToHex(mixLab(baseLab, lightenLab(baseLab, -2), 0.3));
  const dark = labToHex(lightenLab(baseLab, -10 - sheen * 4));
  const edge = labToHex(lightenLab(baseLab, -18));

  const hull = getHull(width, height);
  if (!hull) return;
  const off = hull.getContext("2d");
  if (!off) return;
  off.setTransform(1, 0, 0, 1, 0, 0);
  off.clearRect(0, 0, width, height);

  off.save();
  off.shadowColor = "rgba(22, 14, 10, 0.32)";
  off.shadowBlur = Math.max(8, geometry.faceWidth * 0.1);
  off.shadowOffsetY = Math.max(3, geometry.faceWidth * 0.03);
  outerPath(off, map, style);
  off.fillStyle = dark;
  off.fill();
  off.restore();

  const gradient = off.createLinearGradient(
    ...xy(map(-1.1, -1.2)),
    ...xy(map(1.1, 1.4)),
  );
  gradient.addColorStop(0, light);
  gradient.addColorStop(0.42, mid);
  gradient.addColorStop(0.76, colour);
  gradient.addColorStop(1, dark);
  outerPath(off, map, style);
  off.fillStyle = gradient;
  off.fill();

  off.save();
  outerPath(off, map, style);
  off.clip();

  // Soft light from above, then a cooler shadow at the bottom.
  const glow = off.createRadialGradient(
    ...xy(map(-0.55, -1.25)),
    0,
    ...xy(map(-0.55, -1.25)),
    Math.max(rx, ry) * 1.9,
  );
  glow.addColorStop(0, `rgba(255,255,255,${0.12 + sheen * 0.2})`);
  glow.addColorStop(0.55, "rgba(255,255,255,0.03)");
  glow.addColorStop(1, "rgba(0,0,0,0.1)");
  off.fillStyle = glow;
  off.fillRect(0, 0, width, height);

  // A centre part and two crown folds keep the top band from reading as a
  // corrugated tube.
  const partStart = map(0, -1.06);
  const partEnd = map(0, -0.46);
  off.beginPath();
  off.moveTo(partStart.x, partStart.y);
  off.lineTo(partEnd.x, partEnd.y);
  off.strokeStyle = `rgba(28, 18, 12, ${0.08 + sheen * 0.04})`;
  off.lineWidth = Math.max(2, geometry.faceWidth * 0.018);
  off.stroke();

  for (const side of [-1, 1]) {
    const start = map(0, -0.96);
    const control = map(side * 0.48, -0.82);
    const end = map(side * 0.86, -0.44);
    off.beginPath();
    off.moveTo(start.x, start.y);
    off.quadraticCurveTo(control.x, control.y, end.x, end.y);
    off.strokeStyle = `rgba(28, 18, 12, ${0.05 + sheen * 0.03})`;
    off.lineWidth = Math.max(3, geometry.faceWidth * 0.028);
    off.stroke();
  }

  // Drape folds. Each has a shadow and a narrow highlight. The curves bend
  // around the cheek and flare toward the shoulder instead of running straight.
  const foldOffsets = [-1, -0.62, -0.18, 0.32, 0.78];
  for (let index = 0; index < foldOffsets.length; index += 1) {
    const offset = foldOffsets[index];
    const topX = offset * 0.42 + 0.02;
    const topY = -0.55 + Math.abs(offset) * 0.04;
    const controlAX = offset * 0.7 - 0.18;
    const controlAY = -0.34 + Math.abs(offset) * 0.08;
    const controlBX = offset * 1.08 + 0.06;
    const controlBY = 0.62;
    const bottomX = offset * 1.28 + 0.04;
    const bottomY = 1.62;

    const start = map(topX, topY);
    const c1 = map(controlAX, controlAY);
    const c2 = map(controlBX, controlBY);
    const end = map(bottomX, bottomY);
    const widthPx = Math.max(5, geometry.faceWidth * 0.042);

    const shadowGradient = off.createLinearGradient(start.x, start.y, end.x, end.y);
    shadowGradient.addColorStop(0, "rgba(28, 18, 12, 0)");
    shadowGradient.addColorStop(0.2, `rgba(28, 18, 12, ${0.03 + sheen * 0.03})`);
    shadowGradient.addColorStop(0.8, `rgba(28, 18, 12, ${0.02 + sheen * 0.02})`);
    shadowGradient.addColorStop(1, "rgba(28, 18, 12, 0)");

    off.beginPath();
    off.moveTo(start.x, start.y);
    off.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y);
    off.strokeStyle = shadowGradient;
    off.lineWidth = widthPx;
    off.stroke();

    const shift = Math.max(2, geometry.faceWidth * 0.018);
    const highlightGradient = off.createLinearGradient(start.x, start.y, end.x, end.y);
    highlightGradient.addColorStop(0, "rgba(255, 250, 240, 0)");
    highlightGradient.addColorStop(0.2, `rgba(255, 250, 240, ${0.05 + sheen * 0.07})`);
    highlightGradient.addColorStop(0.78, `rgba(255, 250, 240, ${0.04 + sheen * 0.05})`);
    highlightGradient.addColorStop(1, "rgba(255, 250, 240, 0)");

    off.beginPath();
    off.moveTo(start.x + shift, start.y);
    off.bezierCurveTo(c1.x + shift, c1.y, c2.x + shift, c2.y, end.x + shift, end.y);
    off.strokeStyle = highlightGradient;
    off.lineWidth = Math.max(1.4, widthPx * 0.34);
    off.stroke();
  }

  // Two soft cross-folds near the shoulder suggest the fabric gathering.
  for (const [y, alpha] of [
    [0.82, 0.03],
    [1.16, 0.025],
  ] as const) {
    off.beginPath();
    const start = map(-1.32, y);
    const control = map(-0.1, y + 0.12);
    const end = map(1.32, y);
    off.moveTo(start.x, start.y);
    off.quadraticCurveTo(control.x, control.y, end.x, end.y);
    off.strokeStyle = `rgba(28, 18, 12, ${alpha})`;
    off.lineWidth = Math.max(4, geometry.faceWidth * 0.03);
    off.stroke();
  }

  // A subtle woven texture, only when there is enough sheen to justify it.
  if (sheen > 0.18) {
    const texture = getTexture();
    if (texture) {
      const pattern = off.createPattern(texture, "repeat");
      if (pattern) {
        off.globalAlpha = 0.18 + sheen * 0.22;
        off.fillStyle = pattern;
        off.fillRect(0, 0, width, height);
        off.globalAlpha = 1;
      }
    }
  }

  // A subtle side-and-bottom vignette gives the flat fill some volume.
  const sideShade = off.createLinearGradient(
    ...xy(map(-1.7, 0)),
    ...xy(map(1.7, 0)),
  );
  sideShade.addColorStop(0, "rgba(20, 12, 8, 0.16)");
  sideShade.addColorStop(0.22, "rgba(20, 12, 8, 0)");
  sideShade.addColorStop(0.78, "rgba(20, 12, 8, 0)");
  sideShade.addColorStop(1, "rgba(20, 12, 8, 0.16)");
  off.fillStyle = sideShade;
  off.fillRect(0, 0, width, height);

  const bottomShade = off.createLinearGradient(
    ...xy(map(0, 0.2)),
    ...xy(map(0, 1.7)),
  );
  bottomShade.addColorStop(0, "rgba(20, 12, 8, 0)");
  bottomShade.addColorStop(1, "rgba(20, 12, 8, 0.24)");
  off.fillStyle = bottomShade;
  off.fillRect(0, 0, width, height);

  off.restore();

  // Shadow ring around the face opening, then cut the opening clear.
  off.save();
  faceOpeningPath(off, landmarks, width, height, geometry);
  off.strokeStyle = "rgba(20, 12, 8, 0.42)";
  off.lineWidth = Math.max(2, geometry.faceWidth * 0.026);
  off.shadowColor = "rgba(20, 12, 8, 0.38)";
  off.shadowBlur = Math.max(4, geometry.faceWidth * 0.028);
  off.stroke();
  off.restore();

  off.save();
  off.globalCompositeOperation = "destination-out";
  faceOpeningPath(off, landmarks, width, height, geometry);
  off.fill();
  off.restore();

  // Hem line along the outer edge.
  off.save();
  outerPath(off, map, style);
  off.strokeStyle = "rgba(0,0,0,0.16)";
  off.lineWidth = Math.max(1, geometry.faceWidth * 0.008);
  off.stroke();
  off.restore();

  ctx.save();
  ctx.globalAlpha = 0.82 + coverage * 0.18;
  ctx.drawImage(hull, 0, 0);
  ctx.restore();

  // A thin catch-light on the inner hem.
  ctx.save();
  faceOpeningPath(ctx, landmarks, width, height, geometry);
  ctx.strokeStyle = "rgba(255,248,235,0.18)";
  ctx.lineWidth = 1.1;
  ctx.stroke();
  ctx.restore();

  if (options.showAnchors) {
    ctx.save();
    const anchors = Object.values(geometry.anchors);
    ctx.fillStyle = "rgba(255, 250, 240, 0.85)";
    ctx.strokeStyle = "rgba(23, 19, 16, 0.7)";
    ctx.lineWidth = 1;
    for (const anchor of anchors) {
      ctx.beginPath();
      ctx.arc(anchor.x, anchor.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
}

/**
 * White silhouette mask used to measure hair coverage. Keeps the same
 * geometry as the preview so the metric and the visual agree.
 */
export function drawHijabMask(
  ctx: CanvasRenderingContext2D,
  options: Pick<HijabOptions, "landmarks" | "width" | "height" | "style" | "yaw"> & {
    maskWidth: number;
    maskHeight: number;
  },
): void {
  const { landmarks, width, height, maskWidth, maskHeight } = options;
  if (landmarks.length < 468) return;
  const geometry = computeFaceGeometry(landmarks, width, height);
  const rx = Math.max(20, geometry.faceWidth / 2);
  const ry = Math.max(30, geometry.faceHeight);
  const roll = (geometry.roll * Math.PI) / 180;
  const cos = Math.cos(roll);
  const sin = Math.sin(roll);
  const yawFactor = Math.max(-1, Math.min(1, (options.yaw ?? geometry.yaw) / 45));

  const scaleX = maskWidth / width;
  const scaleY = maskHeight / height;

  const map = (x: number, y: number): PathPoint => {
    const squeeze = 1 - Math.abs(yawFactor) * 0.02;
    const px = (x * squeeze + yawFactor * y * 0.014) * rx;
    const py = y * ry;
    return {
      x: (geometry.center.x + px * cos - py * sin) * scaleX,
      y: (geometry.center.y + px * sin + py * cos) * scaleY,
    };
  };

  ctx.clearRect(0, 0, maskWidth, maskHeight);
  ctx.fillStyle = "#FFFFFF";
  outerPath(ctx, map, options.style ?? "classic");
  ctx.fill();

  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  const scaledLandmarks = landmarks.map((point) => ({ x: point.x, y: point.y }));
  faceOpeningPath(
    ctx,
    scaledLandmarks,
    maskWidth,
    maskHeight,
    {
      ...geometry,
      center: { x: geometry.center.x * scaleX, y: geometry.center.y * scaleY },
      faceWidth: geometry.faceWidth * scaleX,
      faceHeight: geometry.faceHeight * scaleY,
    },
  );
  ctx.fill();
  ctx.restore();
}
