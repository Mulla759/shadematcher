import { FACE_OVAL, LEFT_BROW, LEFT_EYE, LIPS, NOSE, RIGHT_BROW, RIGHT_EYE, type Point } from "./landmarks";

export interface MeshOptions {
  colour?: string;
  showFill?: boolean;
  /** Milliseconds; drives the scan and pulse animation. */
  time?: number;
  /** Solid blue ring and stopped scan when the tone is locked. */
  locked?: boolean;
  /** Disable for prefers-reduced-motion. */
  motion?: boolean;
}

const stroke = (ctx: CanvasRenderingContext2D, points: Point[], colour: string, width: number, close = true) => {
  if (points.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    ctx.lineTo(points[index].x, points[index].y);
  }
  if (close) ctx.closePath();
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.stroke();
};

const at = (landmarks: Point[], index: number, width: number, height: number): Point => ({
  x: landmarks[index].x * width,
  y: landmarks[index].y * height,
});

const average = (points: Point[]): Point => ({
  x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
  y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
});

/**
 * A diagnostic mesh, not a beauty render. Face oval, features, sample regions
 * and the geometry the tone engine actually uses.
 *
 * Motion is a slow scan while settling; when the tone locks, the scan stops and
 * the oval becomes a measured blue ring.
 */
export function drawFaceMesh(
  ctx: CanvasRenderingContext2D,
  landmarks: Point[],
  width: number,
  height: number,
  options: MeshOptions = {},
): void {
  ctx.clearRect(0, 0, width, height);
  if (landmarks.length < 468) return;

  const scale = Math.max(1, width / 720);
  const ink = options.colour ?? "rgba(251, 251, 248, 0.74)";
  const soft = "rgba(251, 251, 248, 0.27)";
  const accent = "rgba(127, 159, 255, 0.95)";
  const time = options.time ?? 0;
  const locked = Boolean(options.locked);
  const motion = Boolean(options.motion);

  const oval = FACE_OVAL.map((index) => at(landmarks, index, width, height));
  const ovalPath = () => {
    ctx.beginPath();
    ctx.moveTo(oval[0].x, oval[0].y);
    for (const point of oval.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.closePath();
  };

  if (options.showFill) {
    ctx.save();
    ovalPath();
    ctx.fillStyle = locked ? "rgba(127, 159, 255, 0.06)" : "rgba(251, 251, 248, 0.035)";
    ctx.fill();
    ctx.restore();
  }

  // Animated dashed oval while settling; solid metal ring when locked.
  ctx.save();
  if (motion && !locked) {
    ctx.setLineDash([5 * scale, 7 * scale]);
    ctx.lineDashOffset = -((time / 45) % (12 * scale));
  }
  stroke(ctx, oval, locked ? accent : ink, (locked ? 1.8 : 1.2) * scale);
  ctx.restore();

  for (const ring of [LEFT_EYE, RIGHT_EYE, LEFT_BROW, RIGHT_BROW, LIPS, NOSE]) {
    stroke(
      ctx,
      ring.map((index) => at(landmarks, index, width, height)),
      locked ? "rgba(127, 159, 255, 0.45)" : soft,
      0.9 * scale,
    );
  }

  // Irises.
  for (const index of [468, 473]) {
    const point = at(landmarks, index, width, height);
    ctx.beginPath();
    ctx.arc(point.x, point.y, 3.4 * scale, 0, Math.PI * 2);
    ctx.strokeStyle = locked ? "rgba(127, 159, 255, 0.75)" : "rgba(251, 251, 248, 0.55)";
    ctx.lineWidth = 0.9 * scale;
    ctx.stroke();
  }

  const xs = oval.map((point) => point.x);
  const ys = oval.map((point) => point.y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const pad = 14 * scale;

  // A soft scan line, clipped to the face, only until the tone locks.
  if (motion && !locked) {
    const scanY = y0 - pad + ((time * 0.12) % (y1 - y0 + pad * 2));
    ctx.save();
    ovalPath();
    ctx.clip();
    const gradient = ctx.createLinearGradient(x0 - pad, scanY, x1 + pad, scanY);
    gradient.addColorStop(0, "rgba(200, 216, 255, 0)");
    gradient.addColorStop(0.5, "rgba(200, 216, 255, 0.92)");
    gradient.addColorStop(1, "rgba(200, 216, 255, 0)");
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1.5 * scale;
    ctx.shadowColor = "rgba(127, 159, 255, 0.8)";
    ctx.shadowBlur = 16 * scale;
    ctx.beginPath();
    ctx.moveTo(x0 - pad, scanY);
    ctx.lineTo(x1 + pad, scanY);
    ctx.stroke();
    ctx.restore();
  }

  const regions: Array<{ point: Point; label: string }> = [
    { point: at(landmarks, 10, width, height), label: "forehead" },
    {
      point: average([
        at(landmarks, 50, width, height),
        at(landmarks, 116, width, height),
        at(landmarks, 205, width, height),
      ]),
      label: "L cheek",
    },
    {
      point: average([
        at(landmarks, 280, width, height),
        at(landmarks, 345, width, height),
        at(landmarks, 425, width, height),
      ]),
      label: "R cheek",
    },
    { point: at(landmarks, 152, width, height), label: "chin" },
    { point: at(landmarks, 1, width, height), label: "nose" },
  ];

  regions.forEach((region, index) => {
    const pulse = motion ? 1 + Math.sin(time / 380 + index * 1.3) * 0.18 : 1;
    const radius = 5 * scale * pulse;
    ctx.beginPath();
    ctx.arc(region.point.x, region.point.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = locked ? "rgba(127, 159, 255, 0.3)" : "rgba(127, 159, 255, 0.24)";
    ctx.fill();
    ctx.strokeStyle = locked ? accent : "rgba(200, 216, 255, 0.95)";
    ctx.lineWidth = 1.1 * scale;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(region.point.x, region.point.y, 1.4 * scale, 0, Math.PI * 2);
    ctx.fillStyle = locked ? accent : "rgba(220, 230, 255, 0.95)";
    ctx.fill();
  });

  // Face box.
  ctx.save();
  ctx.strokeStyle = locked ? "rgba(127, 159, 255, 0.38)" : "rgba(251, 251, 248, 0.22)";
  ctx.lineWidth = 1 * scale;
  ctx.setLineDash([4 * scale, 6 * scale]);
  ctx.lineDashOffset = motion && !locked ? -((time / 80) % (10 * scale)) : 0;
  ctx.strokeRect(x0 - pad, y0 - pad, x1 - x0 + pad * 2, y1 - y0 + pad * 2);
  ctx.restore();

  // Corner ticks, with a small breathing motion.
  const tick = (12 + (motion ? Math.sin(time / 500) * 2 : 0)) * scale;
  ctx.strokeStyle = locked ? accent : "rgba(251, 251, 248, 0.8)";
  ctx.lineWidth = 1.6 * scale;
  for (const [x, y, dx, dy] of [
    [x0 - pad, y0 - pad, 1, 1],
    [x1 + pad, y0 - pad, -1, 1],
    [x0 - pad, y1 + pad, 1, -1],
    [x1 + pad, y1 + pad, -1, -1],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x + dx * tick, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + dy * tick);
    ctx.stroke();
  }

  if (locked) {
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2 * scale;
    ctx.shadowColor = "rgba(127, 159, 255, 0.8)";
    ctx.shadowBlur = (12 + (motion ? Math.sin(time / 320) * 4 : 0)) * scale;
    stroke(ctx, oval, accent, 2 * scale);
    ctx.restore();
  }
}
