/**
 * Colour maths for the Auriga engine.
 *
 * sRGB -> linear RGB -> XYZ (D65) -> CIELAB. All public helpers are pure and
 * isomorphic so the exact same code runs in the browser and in the API route.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Lab {
  l: number;
  a: number;
  b: number;
}

export interface LabA {
  a: number;
}

const D65 = { x: 95.047, y: 100, z: 108.883 } as const;
const EPSILON = 216 / 24389;
const KAPPA = 24389 / 27;

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const round = (value: number, digits = 1): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export function normalizeHex(input: string): string {
  let hex = input.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("");
  }
  if (!/^[0-9a-f]{6}$/i.test(hex)) {
    throw new Error(`Invalid hex colour: ${input}`);
  }
  return `#${hex.toUpperCase()}`;
}

export function hexToRgb(input: string): Rgb {
  const hex = normalizeHex(input).slice(1);
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const toHex = (value: number) =>
    clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function rgbToArray(rgb: Rgb): [number, number, number] {
  return [rgb.r, rgb.g, rgb.b];
}

export function arrayToRgb(value: readonly number[]): Rgb {
  return { r: value[0] ?? 0, g: value[1] ?? 0, b: value[2] ?? 0 };
}

/** sRGB transfer function (IEC 61966-2-1). */
export function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function linearToSrgb(channel: number): number {
  const c = clamp(channel, 0, 1);
  return (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055) * 255;
}

export function rgbToXyz(rgb: Rgb): { x: number; y: number; z: number } {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  return {
    x: (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) * 100,
    y: (r * 0.2126729 + g * 0.7151522 + b * 0.072175) * 100,
    z: (r * 0.0193339 + g * 0.119192 + b * 0.9503041) * 100,
  };
}

const pivot = (value: number): number =>
  value > EPSILON ? Math.cbrt(value) : (KAPPA * value + 16) / 116;

export function xyzToLab(xyz: { x: number; y: number; z: number }): Lab {
  const fx = pivot(xyz.x / D65.x);
  const fy = pivot(xyz.y / D65.y);
  const fz = pivot(xyz.z / D65.z);
  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

export function rgbToLab(rgb: Rgb): Lab {
  return xyzToLab(rgbToXyz(rgb));
}

export function labToXyz(lab: Lab): { x: number; y: number; z: number } {
  const fy = (lab.l + 16) / 116;
  const fx = lab.a / 500 + fy;
  const fz = fy - lab.b / 200;
  const xr = fx ** 3 > EPSILON ? fx ** 3 : (116 * fx - 16) / KAPPA;
  const yr = lab.l > KAPPA * EPSILON ? fy ** 3 : lab.l / KAPPA;
  const zr = fz ** 3 > EPSILON ? fz ** 3 : (116 * fz - 16) / KAPPA;
  return { x: xr * D65.x, y: yr * D65.y, z: zr * D65.z };
}

export function xyzToRgb(xyz: { x: number; y: number; z: number }): Rgb {
  const x = xyz.x / 100;
  const y = xyz.y / 100;
  const z = xyz.z / 100;
  const r = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
  const g = x * -0.969266 + y * 1.8760108 + z * 0.041556;
  const b = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;
  return {
    r: clamp(linearToSrgb(r), 0, 255),
    g: clamp(linearToSrgb(g), 0, 255),
    b: clamp(linearToSrgb(b), 0, 255),
  };
}

export function labToRgb(lab: Lab): Rgb {
  return xyzToRgb(labToXyz(lab));
}

export function labToHex(lab: Lab): string {
  return rgbToHex(labToRgb(lab));
}

export function hexToLab(hex: string): Lab {
  return rgbToLab(hexToRgb(hex));
}

export function labToCss(lab: Lab): string {
  const rgb = labToRgb(lab);
  return `rgb(${Math.round(rgb.r)} ${Math.round(rgb.g)} ${Math.round(rgb.b)})`;
}

export function labDistance(a: Lab, b: Lab): number {
  return Math.sqrt((a.l - b.l) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2);
}

export function chroma(lab: Lab): number {
  return Math.hypot(lab.a, lab.b);
}

/** Hue angle in degrees, 0..360. */
export function hueAngle(lab: Lab): number {
  const angle = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
  return angle < 0 ? angle + 360 : angle;
}

/** Individual Typology Angle, the standard skin-lightness descriptor. */
export function individualTypologyAngle(lab: Lab): number {
  // Clamp b* away from zero for very dark, low-chroma readings where the
  // ratio becomes unstable. 2 is a practical floor, not a physiological claim.
  const b = lab.b < 2 ? 2 : lab.b;
  return (Math.atan((lab.l - 50) / b) * 180) / Math.PI;
}

export function relativeLuminance(rgb: Rgb): number {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Best readable ink (near-black or near-white) for a swatch. */
export function readableInk(hex: string): string {
  return contrastRatio(hexToRgb(hex), { r: 20, g: 17, b: 14 }) >= 4.5
    ? "#171310"
    : "#FBF8F2";
}

/**
 * CIEDE2000 colour difference (Sharma, Wu & Dalal 2005).
 * kL/kC/kH allow weighting lightness, chroma and hue independently.
 */
export function deltaE2000(
  lab1: Lab,
  lab2: Lab,
  kL = 1,
  kC = 1,
  kH = 1,
): number {
  const { l: L1, a: a1, b: b1 } = lab1;
  const { l: L2, a: a2, b: b2 } = lab2;

  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const Cbar7 = Cbar ** 7;
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + 25 ** 7)));

  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);

  const h1p = C1p === 0 ? 0 : ((Math.atan2(b1, a1p) * 180) / Math.PI + 360) % 360;
  const h2p = C2p === 0 ? 0 : ((Math.atan2(b2, a2p) * 180) / Math.PI + 360) % 360;

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp = 0;
  if (C1p * C2p !== 0) {
    const diff = h2p - h1p;
    if (Math.abs(diff) <= 180) dhp = diff;
    else if (diff > 180) dhp = diff - 360;
    else dhp = diff + 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * Math.PI) / 360);

  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;

  let hbarp = 0;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) <= 180) hbarp = (h1p + h2p) / 2;
    else if (h1p + h2p < 360) hbarp = (h1p + h2p + 360) / 2;
    else hbarp = (h1p + h2p - 360) / 2;
  }

  const T =
    1 -
    0.17 * Math.cos(((hbarp - 30) * Math.PI) / 180) +
    0.24 * Math.cos(((2 * hbarp) * Math.PI) / 180) +
    0.32 * Math.cos(((3 * hbarp + 6) * Math.PI) / 180) -
    0.2 * Math.cos(((4 * hbarp - 63) * Math.PI) / 180);

  const dTheta = 30 * Math.exp(-(((hbarp - 275) / 25) ** 2));
  const Cbarp7 = Cbarp ** 7;
  const Rc = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + 25 ** 7));
  const Rt = -Math.sin((2 * dTheta * Math.PI) / 180) * Rc;

  const Sl = 1 + (0.015 * (Lbarp - 50) ** 2) / Math.sqrt(20 + (Lbarp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbarp;
  const Sh = 1 + 0.015 * Cbarp * T;

  const lightTerm = dLp / (kL * Sl);
  const chromaTerm = dCp / (kC * Sc);
  const hueTerm = dHp / (kH * Sh);

  return Math.sqrt(
    lightTerm ** 2 +
      chromaTerm ** 2 +
      hueTerm ** 2 +
      Rt * chromaTerm * hueTerm,
  );
}

export function deltaE76(a: Lab, b: Lab): number {
  return labDistance(a, b);
}

/** Smallest signed angular distance between two hues, -180..180. */
export function hueDelta(a: number, b: number): number {
  let diff = ((b - a + 540) % 360) - 180;
  if (diff === -180) diff = 180;
  return diff;
}

export function mixLab(a: Lab, b: Lab, t: number): Lab {
  return {
    l: a.l + (b.l - a.l) * t,
    a: a.a + (b.a - a.a) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

export function lightenLab(lab: Lab, amount: number): Lab {
  return {
    l: clamp(lab.l + amount, 0, 100),
    a: lab.a,
    b: lab.b,
  };
}

export function isValidHex(value: string): boolean {
  try {
    normalizeHex(value);
    return true;
  } catch {
    return false;
  }
}

/** Uniformly sample an sRGB cube along a line, used for swatch strips. */
export function swatchStrip(from: string, to: string, steps = 5): string[] {
  const a = hexToLab(from);
  const b = hexToLab(to);
  return Array.from({ length: steps }, (_, index) =>
    labToHex(mixLab(a, b, steps === 1 ? 0 : index / (steps - 1))),
  );
}
