import type { Lab, Rgb } from "./color";
import {
  chroma,
  clamp,
  deltaE2000,
  hexToLab,
  hueAngle,
  individualTypologyAngle,
  labToHex,
  mixLab,
  rgbToLab,
  round,
} from "./color";

export type SkinRegion =
  | "forehead"
  | "leftCheek"
  | "rightCheek"
  | "nose"
  | "jaw"
  | "neck"
  | "unknown";

export type Undertone = "cool" | "neutral" | "warm" | "olive";

export type DepthKey =
  | "veryLight"
  | "light"
  | "lightMedium"
  | "medium"
  | "tan"
  | "deep";

export interface SkinSampleInput {
  rgb?: readonly [number, number, number] | Rgb;
  lab?: Lab;
  weight?: number;
  region?: SkinRegion;
}

export interface NormalisedSample {
  lab: Lab;
  rgb: Rgb;
  weight: number;
  region: SkinRegion;
}

export interface QualityMetrics {
  lighting?: number;
  evenness?: number;
  faceSize?: number;
  sharpness?: number;
  yaw?: number;
  pitch?: number;
  roll?: number;
  whitePoint?: readonly [number, number, number] | Rgb;
}

export interface ConfidenceFactor {
  score: number;
  label: string;
}

export interface SkinConfidence {
  score: number;
  label: "high" | "good" | "fair" | "low";
  factors: {
    samples: ConfidenceFactor;
    agreement: ConfidenceFactor;
    regionCoverage: ConfidenceFactor;
    lighting: ConfidenceFactor;
    evenness: ConfidenceFactor;
    faceSize: ConfidenceFactor;
    pose: ConfidenceFactor;
  };
}

export interface RegionReading {
  region: SkinRegion;
  hex: string;
  lab: Lab;
  count: number;
  deltaE: number;
}

export interface PaletteColour {
  name: string;
  hex: string;
}

export interface Season {
  key: string;
  name: string;
  family: "spring" | "summer" | "autumn" | "winter";
  description: string;
  palette: PaletteColour[];
}

export interface SkinProfile {
  lab: Lab;
  hex: string;
  ita: number;
  depth: DepthKey;
  depthLabel: string;
  undertone: Undertone;
  undertoneLabel: string;
  undertoneNote: string;
  warmth: number;
  oliveLean: number;
  chroma: number;
  hue: number;
  fitzpatrick: string;
  fitzpatrickNote: string;
  season: Season;
  confidence: SkinConfidence;
  spread: number;
  sampleCount: number;
  regions: RegionReading[];
  quality: Required<Omit<QualityMetrics, "whitePoint">>;
  warnings: string[];
  whiteBalanceApplied: boolean;
}

export const DEPTH_LABELS: Record<DepthKey, string> = {
  veryLight: "Very light",
  light: "Light",
  lightMedium: "Light medium",
  medium: "Medium",
  tan: "Tan / deep",
  deep: "Rich / deep",
};

export const UNDERTONE_LABELS: Record<Undertone, string> = {
  cool: "Cool",
  neutral: "Neutral",
  warm: "Warm",
  olive: "Olive",
};

const isRgbTuple = (
  value: readonly [number, number, number] | Rgb,
): value is readonly [number, number, number] => Array.isArray(value);

const asRgb = (value: readonly [number, number, number] | Rgb): Rgb =>
  isRgbTuple(value)
    ? { r: value[0], g: value[1], b: value[2] }
    : { r: value.r, g: value.g, b: value.b };

const smoothstep = (edge0: number, edge1: number, value: number): number => {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

const weightedMedian = (
  values: Array<{ value: number; weight: number }>,
): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a.value - b.value);
  const total = sorted.reduce((sum, item) => sum + item.weight, 0);
  let cursor = 0;
  for (const item of sorted) {
    cursor += item.weight;
    if (cursor >= total / 2) return item.value;
  }
  return sorted[sorted.length - 1].value;
};

export const medianLab = (samples: NormalisedSample[]): Lab => ({
  l: weightedMedian(samples.map((sample) => ({ value: sample.lab.l, weight: sample.weight }))),
  a: weightedMedian(samples.map((sample) => ({ value: sample.lab.a, weight: sample.weight }))),
  b: weightedMedian(samples.map((sample) => ({ value: sample.lab.b, weight: sample.weight }))),
});

/**
 * Partially neutralise a colour cast using a presumed-white reference.
 * The reference is usually the sclera. Strength is deliberately conservative:
 * sclera is not a calibrated grey card.
 */
export function applyWhiteBalance(rgb: Rgb, white: Rgb, strength = 0.55): Rgb {
  const w = { r: Math.max(white.r, 1), g: Math.max(white.g, 1), b: Math.max(white.b, 1) };
  const mean = (w.r + w.g + w.b) / 3;
  if (mean < 25) return rgb;
  const gains = {
    r: 1 + (mean / w.r - 1) * strength,
    g: 1 + (mean / w.g - 1) * strength,
    b: 1 + (mean / w.b - 1) * strength,
  };
  return {
    r: clamp(rgb.r * gains.r, 0, 255),
    g: clamp(rgb.g * gains.g, 0, 255),
    b: clamp(rgb.b * gains.b, 0, 255),
  };
}

export function normaliseSamples(
  inputs: SkinSampleInput[],
  whitePoint?: readonly [number, number, number] | Rgb,
): NormalisedSample[] {
  const white = whitePoint ? asRgb(whitePoint) : undefined;
  const samples: NormalisedSample[] = [];
  for (const input of inputs) {
    if (!input) continue;
    const weight = clamp(Number(input.weight ?? 1) || 1, 0.1, 5);
    if (input.lab && Number.isFinite(input.lab.l)) {
      samples.push({
        lab: {
          l: clamp(input.lab.l, 0, 100),
          a: clamp(input.lab.a, -128, 127),
          b: clamp(input.lab.b, -128, 127),
        },
        rgb: input.rgb ? asRgb(input.rgb) : { r: 0, g: 0, b: 0 },
        weight,
        region: input.region ?? "unknown",
      });
      continue;
    }
    if (!input.rgb) continue;
    const original = asRgb(input.rgb);
    const corrected = white ? applyWhiteBalance(original, white) : original;
    samples.push({
      lab: rgbToLab(corrected),
      rgb: corrected,
      weight,
      region: input.region ?? "unknown",
    });
  }
  return samples;
}

function depthFromIta(ita: number, lightness: number): { key: DepthKey; label: string } {
  if (ita > 55) return { key: "veryLight", label: DEPTH_LABELS.veryLight };
  if (ita > 41) return { key: "light", label: DEPTH_LABELS.light };
  if (ita > 28) return { key: "lightMedium", label: DEPTH_LABELS.lightMedium };
  if (ita > 10) return { key: "medium", label: DEPTH_LABELS.medium };
  if (ita > -30) return { key: "tan", label: DEPTH_LABELS.tan };
  // ITA is an angle in the L*/b* plane. A red-leaning, low-b* face can land in
  // the "dark" ITA band even when its L* is medium-depth. Cross-check L* so the
  // label does not overstate depth; the season still uses the deep branch.
  if (lightness >= 38) return { key: "tan", label: DEPTH_LABELS.tan };
  return { key: "deep", label: DEPTH_LABELS.deep };
}

function fitzpatrickFromIta(ita: number, lightness: number): string {
  if (ita > 55) return "I";
  if (ita > 41) return "II";
  if (ita > 28) return "III";
  if (ita > 10) return "IV";
  if (ita > -30 || lightness >= 35) return "V";
  return "VI";
}

const SPRING_LIGHT: PaletteColour[] = [
  { name: "Peach", hex: "#F2B39A" },
  { name: "Coral", hex: "#E37A63" },
  { name: "Warm ivory", hex: "#F3E7CE" },
  { name: "Camel", hex: "#B08A5E" },
  { name: "Golden yellow", hex: "#D9B04B" },
  { name: "Aqua", hex: "#7FC3C0" },
  { name: "Light moss", hex: "#A8B27A" },
  { name: "Soft tomato", hex: "#D25C45" },
  { name: "Champagne", hex: "#D8C3A0" },
  { name: "Turquoise", hex: "#4FA9A4" },
];

const SPRING_WARM: PaletteColour[] = [
  { name: "Marigold", hex: "#D59A2F" },
  { name: "Coral", hex: "#E37A63" },
  { name: "Leaf green", hex: "#7C9A4A" },
  { name: "Turquoise", hex: "#3E9C98" },
  { name: "Warm red", hex: "#C54535" },
  { name: "Camel", hex: "#B08A5E" },
  { name: "Peach", hex: "#F2B39A" },
  { name: "Golden", hex: "#C9A45C" },
  { name: "Clear aqua", hex: "#6BC0BC" },
  { name: "Cream", hex: "#F3E7CE" },
];

const SUMMER_LIGHT: PaletteColour[] = [
  { name: "Powder blue", hex: "#A9C1CE" },
  { name: "Dusty rose", hex: "#C99A98" },
  { name: "Lavender", hex: "#B6A8C9" },
  { name: "Sage", hex: "#9AA48C" },
  { name: "Soft navy", hex: "#3A4A66" },
  { name: "Cool grey", hex: "#9AA0A6" },
  { name: "Mauve", hex: "#A9848E" },
  { name: "Sea glass", hex: "#9BBFB2" },
  { name: "Icy pink", hex: "#E8C9CE" },
  { name: "Periwinkle", hex: "#8C9BC9" },
];

const SUMMER_COOL: PaletteColour[] = [
  { name: "Dusty rose", hex: "#C99A98" },
  { name: "Slate blue", hex: "#5B7895" },
  { name: "Emerald", hex: "#2F7D66" },
  { name: "Plum", hex: "#6B4256" },
  { name: "Soft white", hex: "#F2F0EA" },
  { name: "Lavender", hex: "#B6A8C9" },
  { name: "Teal", hex: "#2E6F73" },
  { name: "Berry", hex: "#8A3B52" },
  { name: "Cool grey", hex: "#8E9295" },
  { name: "Navy", hex: "#23324C" },
];

const AUTUMN_SOFT: PaletteColour[] = [
  { name: "Sage", hex: "#9AA48C" },
  { name: "Terracotta", hex: "#B5654A" },
  { name: "Camel", hex: "#B08A5E" },
  { name: "Olive", hex: "#77784D" },
  { name: "Dusty rose", hex: "#C99A98" },
  { name: "Rust", hex: "#A34E2A" },
  { name: "Oat", hex: "#D6C2A4" },
  { name: "Moss", hex: "#5F6B45" },
  { name: "Warm grey", hex: "#8C8177" },
  { name: "Fig", hex: "#6B4256" },
];

const AUTUMN_DEEP: PaletteColour[] = [
  { name: "Rust", hex: "#A34E2A" },
  { name: "Chocolate", hex: "#4E3328" },
  { name: "Olive", hex: "#77784D" },
  { name: "Mustard", hex: "#C29A3E" },
  { name: "Brick", hex: "#9B4A3A" },
  { name: "Forest", hex: "#2F4F3A" },
  { name: "Copper", hex: "#A6613B" },
  { name: "Cream", hex: "#EFE3CC" },
  { name: "Deep teal", hex: "#275B66" },
  { name: "Burgundy", hex: "#6B2533" },
];

const WINTER_DEEP: PaletteColour[] = [
  { name: "Oxblood", hex: "#5C1F2A" },
  { name: "Navy", hex: "#23324C" },
  { name: "Emerald", hex: "#1F6B53" },
  { name: "Plum", hex: "#6B4256" },
  { name: "Charcoal", hex: "#3B3936" },
  { name: "True red", hex: "#A61E32" },
  { name: "Cobalt", hex: "#2F5C96" },
  { name: "Icy pink", hex: "#E8C9CE" },
  { name: "Silver", hex: "#B9BDC0" },
  { name: "Ink", hex: "#22262B" },
];

const WINTER_BRIGHT: PaletteColour[] = [
  { name: "Fuchsia", hex: "#B0306A" },
  { name: "Cobalt", hex: "#2F5C96" },
  { name: "Emerald", hex: "#1F6B53" },
  { name: "Cherry", hex: "#A61E32" },
  { name: "Icy blue", hex: "#C9D9DE" },
  { name: "White", hex: "#FBF8F2" },
  { name: "Violet", hex: "#6C4C86" },
  { name: "Teal", hex: "#2E6F73" },
  { name: "Silver", hex: "#B9BDC0" },
  { name: "True red", hex: "#A61E32" },
];

export const SEASONS: Record<string, Season> = {
  lightSpring: {
    key: "lightSpring",
    name: "Light Spring",
    family: "spring",
    description: "Warm, clear and delicate. Keep contrast light and colour fresh.",
    palette: SPRING_LIGHT,
  },
  warmSpring: {
    key: "warmSpring",
    name: "True Spring",
    family: "spring",
    description: "Golden warmth with clear, sunlit colour. Avoid dusty or icy tones.",
    palette: SPRING_WARM,
  },
  lightSummer: {
    key: "lightSummer",
    name: "Light Summer",
    family: "summer",
    description: "Cool, soft and light. Think watercolour, not neon.",
    palette: SUMMER_LIGHT,
  },
  coolSummer: {
    key: "coolSummer",
    name: "Cool Summer",
    family: "summer",
    description: "Cool and muted with medium contrast. Berry and slate are friends.",
    palette: SUMMER_COOL,
  },
  softAutumn: {
    key: "softAutumn",
    name: "Soft Autumn",
    family: "autumn",
    description: "Warm-neutral and muted. Earth tones with a little dust in them.",
    palette: AUTUMN_SOFT,
  },
  deepAutumn: {
    key: "deepAutumn",
    name: "Deep Autumn",
    family: "autumn",
    description: "Warm, deep and rich. Spice, forest and chocolate.",
    palette: AUTUMN_DEEP,
  },
  deepWinter: {
    key: "deepWinter",
    name: "Deep Winter",
    family: "winter",
    description: "Cool, deep and high contrast. Jewel tones and ink.",
    palette: WINTER_DEEP,
  },
  brightWinter: {
    key: "brightWinter",
    name: "Bright Winter",
    family: "winter",
    description: "Cool, clear and vivid. Icy brights against deep darks.",
    palette: WINTER_BRIGHT,
  },
};

export function seasonFor(depth: DepthKey, undertone: Undertone): Season {
  const light = depth === "veryLight" || depth === "light" || depth === "lightMedium";
  const deep = depth === "tan" || depth === "deep";
  if (undertone === "warm") {
    if (light) return SEASONS.lightSpring;
    if (deep) return SEASONS.deepAutumn;
    return SEASONS.warmSpring;
  }
  if (undertone === "cool") {
    if (light) return SEASONS.lightSummer;
    if (deep) return SEASONS.deepWinter;
    return SEASONS.coolSummer;
  }
  if (undertone === "olive") {
    return deep ? SEASONS.deepAutumn : SEASONS.softAutumn;
  }
  if (light) return SEASONS.lightSummer;
  if (deep) return SEASONS.deepWinter;
  return SEASONS.softAutumn;
}

export function seasonalAffinity(lab: Lab, season: Season): number {
  const distances = season.palette.map((colour) => deltaE2000(lab, hexToLab(colour.hex)));
  const nearest = Math.min(...distances);
  return clamp(1 - nearest / 14, 0, 1);
}

function confidenceLabel(score: number): SkinConfidence["label"] {
  if (score >= 82) return "high";
  if (score >= 66) return "good";
  if (score >= 45) return "fair";
  return "low";
}

/**
 * Turn raw skin pixels into a stable, explainable profile.
 * Robust medians + outlier rejection stop a single lipstick pixel or highlight
 * from dragging the reading.
 */
export function analyzeSkin(
  inputs: SkinSampleInput[],
  quality: QualityMetrics = {},
  options: { whitePoint?: readonly [number, number, number] | Rgb } = {},
): SkinProfile {
  const whitePoint = quality.whitePoint ?? options.whitePoint;
  let samples = normaliseSamples(inputs, whitePoint);
  const warnings: string[] = [];

  if (samples.length === 0) {
    throw new Error("No skin samples supplied");
  }

  const initial = medianLab(samples);
  const distances = samples.map((sample) => deltaE2000(sample.lab, initial));
  const sortedDistances = [...distances].sort((a, b) => a - b);
  const mad = sortedDistances[Math.floor(sortedDistances.length / 2)] || 0;
  const threshold = Math.max(6, mad * 2.6);
  const retained = samples.filter((_, index) => distances[index] <= threshold);
  samples = retained.length >= Math.max(12, samples.length * 0.35) ? retained : samples;

  const allMedian = medianLab(samples);
  // Shadows are illumination, not pigment. Read the lit-skin band (around the
  // 70th lightness percentile) instead of letting a large shadow region drag
  // the whole face darker. The median remains the fallback for tiny samples.
  const byLightness = [...samples].sort((a, b) => a.lab.l - b.lab.l);
  const p70 = byLightness[Math.min(byLightness.length - 1, Math.floor(byLightness.length * 0.7))].lab.l;
  const litBand = samples.filter((sample) => Math.abs(sample.lab.l - p70) <= 4);
  const lab =
    litBand.length >= Math.max(24, samples.length * 0.12)
      ? medianLab(litBand)
      : allMedian;
  const ita = individualTypologyAngle(lab);
  const c = chroma(lab);
  const hue = hueAngle(lab);
  const depth = depthFromIta(ita, lab.l);

  const warmth = clamp((hue - 52) / 16, -1, 1);
  const oliveBase =
    0.5 * clamp((hue - 48) / 20, 0, 1) +
    0.3 * clamp((22 - c) / 10, 0, 1) +
    0.2 * (lab.a < 13 ? 1 : 0);
  const depthFactor = clamp((65 - lab.l) / 32, 0, 1);
  const oliveLean = clamp(oliveBase * (0.28 + 0.72 * depthFactor), 0, 1);

  let undertone: Undertone;
  if (oliveLean > 0.52 && warmth > -0.35) undertone = "olive";
  else if (warmth > 0.18) undertone = "warm";
  else if (warmth < -0.18) undertone = "cool";
  else undertone = "neutral";

  const undertoneNote =
    undertone === "olive"
      ? "Neutral-warm with a green-grey lean"
      : undertone === "warm"
        ? "Golden / yellow lean"
        : undertone === "cool"
          ? "Rose / pink lean"
          : "Balanced, neither strongly pink nor golden";

  const spread =
    samples.reduce((sum, sample) => sum + deltaE2000(sample.lab, lab) * sample.weight, 0) /
    samples.reduce((sum, sample) => sum + sample.weight, 0);

  const byRegion = new Map<SkinRegion, NormalisedSample[]>();
  for (const sample of samples) {
    const region = sample.region ?? "unknown";
    if (!byRegion.has(region)) byRegion.set(region, []);
    byRegion.get(region)!.push(sample);
  }
  const regions: RegionReading[] = [...byRegion.entries()]
    .filter(([, list]) => list.length >= 3)
    .map(([region, list]) => {
      const regionLab = medianLab(list);
      return {
        region,
        lab: regionLab,
        hex: labToHex(regionLab),
        count: list.length,
        deltaE: round(deltaE2000(regionLab, lab), 1),
      };
    })
    .sort((a, b) => b.count - a.count);

  const lighting = clamp(quality.lighting ?? 0.65, 0, 1);
  const evenness = clamp(quality.evenness ?? 0.7, 0, 1);
  const faceSize = clamp(quality.faceSize ?? 0.28, 0, 1);
  const yaw = quality.yaw ?? 0;
  const pitch = quality.pitch ?? 0;
  const roll = quality.roll ?? 0;
  const sharpness = clamp(quality.sharpness ?? 0.55, 0, 1);

  const regionCoverage = clamp(regions.length / 4, 0, 1);
  const posePenalty = clamp((Math.abs(yaw) - 6) / 34, 0, 1) * 0.65 + clamp((Math.abs(pitch) - 6) / 30, 0, 1) * 0.2;
  const score =
    100 *
    (0.2 * smoothstep(30, 150, samples.length) +
      0.26 * (1 - clamp(spread / 15, 0, 1)) +
      0.1 * regionCoverage +
      0.15 * lighting +
      0.1 * evenness +
      0.09 * smoothstep(0.14, 0.34, faceSize) +
      0.1 * sharpness -
      0.12 * posePenalty);

  const confidence: SkinConfidence = {
    score: Math.round(clamp(score, 0, 100)),
    label: confidenceLabel(clamp(score, 0, 100)),
    factors: {
      samples: {
        score: Math.round(smoothstep(30, 150, samples.length) * 100),
        label: `${samples.length} pixels`,
      },
      agreement: {
        score: Math.round((1 - clamp(spread / 15, 0, 1)) * 100),
        label: `${round(spread, 1)} ΔE spread`,
      },
      regionCoverage: {
        score: Math.round(regionCoverage * 100),
        label: `${regions.length} regions`,
      },
      lighting: {
        score: Math.round(lighting * 100),
        label: lighting < 0.4 ? "Low" : lighting > 0.82 ? "Hot" : "Even",
      },
      evenness: {
        score: Math.round(evenness * 100),
        label: evenness < 0.5 ? "Uneven" : "Balanced",
      },
      faceSize: {
        score: Math.round(smoothstep(0.14, 0.34, faceSize) * 100),
        label: `${Math.round(faceSize * 100)}% of frame`,
      },
      pose: {
        score: Math.round((1 - posePenalty) * 100),
        label: `${Math.round(yaw)}° yaw`,
      },
    },
  };

  if (samples.length < 40) warnings.push("Only a small patch of skin was sampled. Move closer to the camera.");
  if (spread > 8) warnings.push(`Cheek and forehead readings differ by ${round(spread, 1)} ΔE — mixed lighting is likely.`);
  if (lighting < 0.38) warnings.push("The face is under-lit. Face a window or add soft, even light.");
  if (lighting > 0.86) warnings.push("The face is very bright. Highlights can wash out undertone.");
  if (evenness < 0.5) warnings.push("Lighting is uneven across the face. Turn away from a single strong light source.");
  if (faceSize < 0.16) warnings.push("The face is small in frame. Move closer so the face fills more of the view.");
  if (Math.abs(yaw) > 18) warnings.push("Head is turned. Face the camera straight on for a stable reading.");
  if (Math.abs(pitch) > 15) warnings.push("Head is tilted. Keep your chin level.");
  if (c < 8) warnings.push("Very low colour signal. The reading may read more neutral than it is.");
  if (ita < -30 && lab.l >= 38) {
    warnings.push("ITA reads dark, but L* is medium-deep. Red-leaning, low-yellow skin can read deeper on ITA; treat depth as a range.");
  }

  const season = seasonFor(depth.key, undertone);

  return {
    lab: { l: round(lab.l, 2), a: round(lab.a, 2), b: round(lab.b, 2) },
    hex: labToHex(lab),
    ita: round(ita, 1),
    depth: depth.key,
    depthLabel: depth.label,
    undertone,
    undertoneLabel: UNDERTONE_LABELS[undertone],
    undertoneNote,
    warmth: round(warmth, 2),
    oliveLean: round(oliveLean, 2),
    chroma: round(c, 1),
    hue: round(hue, 1),
    fitzpatrick: fitzpatrickFromIta(ita, lab.l),
    fitzpatrickNote: "Estimated from ITA° and L*. Fitzpatrick is clinically assessed by questionnaire; treat this as a guide.",
    season,
    confidence,
    spread: round(spread, 2),
    sampleCount: samples.length,
    regions,
    quality: {
      lighting: round(lighting, 2),
      evenness: round(evenness, 2),
      faceSize: round(faceSize, 2),
      sharpness: round(sharpness, 2),
      yaw: round(yaw, 1),
      pitch: round(pitch, 1),
      roll: round(roll, 1),
    },
    warnings,
    whiteBalanceApplied: Boolean(whitePoint),
  };
}

/** Lighten/darken a skin reading only for diagrammatic use, never analysis. */
export function toneRamp(lab: Lab, steps = 5): string[] {
  return Array.from({ length: steps }, (_, index) =>
    labToHex(mixLab({ l: 12, a: lab.a * 0.6, b: lab.b * 0.6 }, { l: 96, a: lab.a * 0.5, b: lab.b * 0.5 }, index / (steps - 1))),
  );
}
