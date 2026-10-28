import type { FabricColour, FoundationShade } from "./catalog";
import { FABRICS, FOUNDATIONS } from "./catalog";
import { seasonalAffinity, type SkinProfile, type Undertone } from "./skin";
import {
  chroma,
  clamp,
  deltaE2000,
  hexToLab,
  hueAngle,
  hueDelta,
  labToHex,
  round,
  type Lab,
} from "./color";

export type GarmentCategory = "hijab" | "scarf" | "top" | "dress";
export type Verdict = "signature" | "easy" | "considered" | "harder";

export interface ScoreParts {
  lightness: number;
  chroma: number;
  temperature: number;
  hue: number;
  season: number;
}

export interface FabricMatch {
  colour: FabricColour;
  score: number;
  verdict: Verdict;
  deltaE: number;
  lightnessGap: number;
  chromaRatio: number;
  temperature: "warm" | "cool" | "neutral";
  parts: ScoreParts;
  reasons: string[];
}

export interface GarmentEvaluation {
  input: {
    hex: string;
    name?: string;
    lab: Lab;
  };
  score: number;
  verdict: Verdict;
  headline: string;
  summary: string;
  reasons: string[];
  deltaE: number;
  nearest: Array<{ colour: FabricColour; deltaE: number }>;
  alternatives: FabricMatch[];
  pairings: PairingMatch[];
}

export interface PairingMatch {
  colour: FabricColour;
  score: number;
  relationship: "Tonal" | "Analogous" | "Complementary" | "Neutral anchor" | "Contrast";
  reasons: string[];
}

export interface FoundationMatch {
  shade: FoundationShade;
  score: number;
  deltaE: number;
  depthDelta: number;
  undertoneDelta: number;
  grade: "Invisible" | "Close" | "Visible" | "Off";
  notes: string[];
}

const CATEGORY_COVERAGE: Record<GarmentCategory, number> = {
  hijab: 0.95,
  scarf: 0.85,
  top: 0.65,
  dress: 0.45,
};

const VERDICT_LABELS: Record<Verdict, string> = {
  signature: "Signature",
  easy: "Easy to wear",
  considered: "Considered",
  harder: "Harder to wear",
};

export const verdictLabel = (verdict: Verdict): string => VERDICT_LABELS[verdict];

export function verdictFor(score: number): Verdict {
  if (score >= 84) return "signature";
  if (score >= 72) return "easy";
  if (score >= 60) return "considered";
  return "harder";
}

/** A plateau function: 1 inside [lo, hi], falling off over `soft`. */
export function plateau(value: number, lo: number, hi: number, soft: number): number {
  if (value >= lo && value <= hi) return 1;
  const distance = value < lo ? lo - value : value - hi;
  return clamp(1 - distance / soft, 0, 1);
}

/**
 * Rough warm/cool temperature of a colour on the garment axis.
 * Neutral colours sit at 0; warm at +1; cool at -1.
 */
export function colourTemperature(lab: Lab): number {
  const c = chroma(lab);
  if (c < 8) return 0;
  const hue = hueAngle(lab);
  if (hue >= 330 || hue < 90) return 1;
  if (hue < 165) return 0.35;
  if (hue < 300) return -1;
  return 0.2;
}

function temperatureLabel(value: number): "warm" | "cool" | "neutral" {
  if (value > 0.25) return "warm";
  if (value < -0.25) return "cool";
  return "neutral";
}

function hueHarmony(skinHue: number, fabricHue: number, fabricChroma: number): number {
  if (fabricChroma < 8) return 0.9;
  const delta = Math.abs(hueDelta(skinHue, fabricHue));
  if (delta <= 30) return 1;
  if (delta >= 150 && delta <= 210) return fabricChroma < 38 ? 0.82 : 0.7;
  if ((delta >= 105 && delta < 150) || (delta > 210 && delta <= 255)) return 0.72;
  return 0.48;
}

function undertoneHarmony(skin: SkinProfile, fabricTemp: number, fabricChroma: number): number {
  if (fabricChroma < 8) return 0.68;
  const skinTemp = clamp(skin.warmth, -1, 1);
  const diff = Math.abs(fabricTemp - skinTemp);
  return clamp(1 - diff * 0.52, 0.15, 1);
}

function reasonsFor(
  skin: SkinProfile,
  fabric: FabricColour,
  parts: ScoreParts,
  category: GarmentCategory,
): string[] {
  const reasons: string[] = [];
  const gap = Math.abs(fabric.lab.l - skin.lab.l);

  if (parts.lightness >= 0.85) {
    reasons.push(
      `${round(gap, 0)}° of lightness separation gives the face definition without shouting.`,
    );
  } else if (gap < 12) {
    reasons.push(
      `Only ${round(gap, 0)}° of lightness separation — close to your skin, so the face may flatten.`,
    );
  } else if (gap > 55) {
    reasons.push(`Very high ${round(gap, 0)}° lightness contrast; dramatic, but it can overpower a soft face.`);
  } else {
    reasons.push(`${round(gap, 0)}° lightness separation sits just outside the ideal ${category === "hijab" ? "face-framing" : "wardrobe"} range.`);
  }

  const ratio = fabric.lab.l === skin.lab.l ? 1 : chroma(fabric.lab) / Math.max(skin.chroma, 5);
  if (parts.chroma >= 0.9) {
    reasons.push(`Chroma is ${round(ratio, 2)}× your skin — balanced, not competing.`);
  } else if (ratio > 2.2) {
    reasons.push(`Chroma is ${round(ratio, 2)}× your skin; the colour may wear you before you wear it.`);
  } else if (ratio < 0.55) {
    reasons.push(`Very low chroma (${round(ratio, 2)}× your skin); it may read grey or washed out.`);
  } else {
    reasons.push(`Chroma ratio ${round(ratio, 2)}× sits outside the easiest band (0.8–1.8×).`);
  }

  const temp = colourTemperature(fabric.lab);
  if (parts.temperature >= 0.8) {
    reasons.push(
      `Repeats the ${temperatureLabel(temp)} cast in your skin, so the frame feels continuous.`,
    );
  } else if (temp === 0) {
    reasons.push("A neutral frame: it lets your face, not the fabric, carry the colour.");
  } else if (Math.sign(temp) !== Math.sign(skin.warmth) && Math.abs(skin.warmth) > 0.2) {
    reasons.push(
      `Cross-temperature contrast (${temperatureLabel(temp)} fabric on ${skin.undertoneLabel.toLowerCase()} skin); striking, but less forgiving.`,
    );
  } else {
    reasons.push(`The ${temperatureLabel(temp)} temperature is a partial match for your ${skin.undertoneLabel.toLowerCase()} undertone.`);
  }

  if (parts.season > 0.72) {
    reasons.push(`Lives inside the ${skin.season.name} palette.`);
  } else if (parts.season < 0.25) {
    reasons.push(`Outside the ${skin.season.name} palette; it can still work as a deliberate contrast.`);
  }

  return reasons.slice(0, 4);
}

export interface WardrobeOptions {
  category?: GarmentCategory;
}

/**
 * Score a fabric as a face-framing colour for a specific skin reading.
 * Weights follow the colour-science brief: lightness 0.40, chroma 0.25,
 * temperature 0.20, hue 0.15. Season affinity is a small bonus, not a gate.
 */
export function scoreFabric(
  skin: SkinProfile,
  fabric: FabricColour,
  options: WardrobeOptions = {},
): FabricMatch {
  const category = options.category ?? "hijab";
  const coverage = CATEGORY_COVERAGE[category];
  const area = 0.7 + 0.6 * coverage;

  const gap = Math.abs(fabric.lab.l - skin.lab.l);
  const ratio = chroma(fabric.lab) / Math.max(skin.chroma, 5);
  const temp = colourTemperature(fabric.lab);

  const fitL = plateau(gap, 15, 35, 9);
  const fitC = plateau(ratio, 0.8, 1.8, 0.5);
  const fitT = undertoneHarmony(skin, temp, chroma(fabric.lab));
  const fitH = hueHarmony(skin.hue, hueAngle(fabric.lab), chroma(fabric.lab));
  const fitS = seasonalAffinity(fabric.lab, skin.season);

  const weights = { L: 0.4, C: 0.25, T: 0.2, H: 0.15 };
  const total = weights.L * area + weights.C * area + weights.T + weights.H;
  const raw =
    (weights.L * area * fitL +
      weights.C * area * fitC +
      weights.T * fitT +
      weights.H * fitH) /
    total;

  // Compress the generous harmony model so "good" and "excellent" separate
  // visually instead of all collapsing into 100.
  const score = clamp(Math.pow(clamp(raw, 0, 1), 1.22) * 100 + fitS * 4, 0, 99);
  const parts: ScoreParts = {
    lightness: round(fitL, 3),
    chroma: round(fitC, 3),
    temperature: round(fitT, 3),
    hue: round(fitH, 3),
    season: round(fitS, 3),
  };

  return {
    colour: fabric,
    score: round(score, 1),
    verdict: verdictFor(score),
    deltaE: round(deltaE2000(skin.lab, fabric.lab, 1.5, 1, 1), 2),
    lightnessGap: round(gap, 1),
    chromaRatio: round(ratio, 2),
    temperature: temperatureLabel(temp),
    parts,
    reasons: reasonsFor(skin, fabric, parts, category),
  };
}

function diversify(matches: FabricMatch[], limit: number): FabricMatch[] {
  const chosen: FabricMatch[] = [];
  const families = new Map<string, number>();
  for (const match of matches) {
    const familyCount = families.get(match.colour.family) ?? 0;
    if (familyCount >= 2) continue;
    const isTooSimilar = chosen.some(
      (existing) =>
        deltaE2000(existing.colour.lab, match.colour.lab) < 7 ||
        (existing.colour.family === match.colour.family &&
          Math.abs(existing.colour.lab.l - match.colour.lab.l) < 9),
    );
    if (isTooSimilar) continue;
    chosen.push(match);
    families.set(match.colour.family, familyCount + 1);
    if (chosen.length >= limit) break;
  }
  if (chosen.length < limit) {
    for (const match of matches) {
      if (chosen.includes(match)) continue;
      const isTooSimilar = chosen.some(
        (existing) => deltaE2000(existing.colour.lab, match.colour.lab) < 5,
      );
      if (isTooSimilar) continue;
      chosen.push(match);
      if (chosen.length >= limit) break;
    }
  }
  if (chosen.length < limit) {
    for (const match of matches) {
      if (!chosen.includes(match)) chosen.push(match);
      if (chosen.length >= limit) break;
    }
  }
  return chosen;
}

export interface RecommendationOptions extends WardrobeOptions {
  limit?: number;
  fabrics?: FabricColour[];
  exclude?: string[];
}

export interface FabricRecommendations {
  best: FabricMatch[];
  avoid: FabricMatch[];
  all: FabricMatch[];
}

export function recommendFabrics(
  skin: SkinProfile,
  options: RecommendationOptions = {},
): FabricRecommendations {
  const limit = clamp(options.limit ?? 6, 1, 60);
  const pool = (options.fabrics ?? FABRICS).filter(
    (fabric) => !options.exclude?.includes(fabric.id),
  );
  const all = pool
    .map((fabric) => scoreFabric(skin, fabric, options))
    .sort((a, b) => b.score - a.score);
  const best = diversify(all, limit);
  const avoid = [...all].reverse().slice(0, 3);
  return { best, avoid, all };
}

/** Relationship between a candidate frame colour and a specific garment. */
function garmentHarmony(garment: Lab, candidate: Lab): { score: number; relationship: PairingMatch["relationship"] } {
  const gC = chroma(garment);
  const cC = chroma(candidate);
  const dE = deltaE2000(garment, candidate, 1.5, 1, 1);
  const hueDeltaAbs = Math.abs(hueDelta(hueAngle(garment), hueAngle(candidate)));

  if (cC < 8) return { score: 0.82, relationship: "Neutral anchor" };
  if (dE < 9) return { score: 0.58, relationship: "Tonal" };
  if (hueDeltaAbs <= 30) return { score: 0.98, relationship: "Analogous" };
  if (hueDeltaAbs >= 150) return { score: gC < 38 ? 0.86 : 0.74, relationship: "Complementary" };
  if (hueDeltaAbs >= 45 && hueDeltaAbs <= 75) return { score: 0.68, relationship: "Contrast" };
  return { score: 0.55, relationship: "Contrast" };
}

export function recommendPairings(
  skin: SkinProfile,
  garment: Lab,
  options: { limit?: number; category?: GarmentCategory } = {},
): PairingMatch[] {
  const limit = options.limit ?? 4;
  const scored = FABRICS.map((colour) => {
    const skinScore = scoreFabric(skin, colour, { category: options.category ?? "hijab" });
    const harmony = garmentHarmony(garment, colour.lab);
    const score = clamp(skinScore.score * 0.56 + harmony.score * 100 * 0.44, 0, 100);
    const reasons = [
      `${harmony.relationship} with the garment${harmony.relationship === "Complementary" ? " — opposite on the wheel, balanced by depth" : ""}.`,
      ...skinScore.reasons.slice(0, 2),
    ];
    return {
      colour,
      score: round(score, 1),
      relationship: harmony.relationship,
      reasons,
    } satisfies PairingMatch;
  })
    .sort((a, b) => b.score - a.score);

  const chosen: PairingMatch[] = [];
  for (const match of scored) {
    if (chosen.some((existing) => deltaE2000(existing.colour.lab, match.colour.lab) < 8)) continue;
    chosen.push(match);
    if (chosen.length >= limit) break;
  }
  return chosen;
}

export function evaluateGarment(
  skin: SkinProfile,
  input: { hex: string; name?: string },
  options: { category?: GarmentCategory; limit?: number } = {},
): GarmentEvaluation {
  const lab = hexToLab(input.hex);
  const fabric: FabricColour = {
    id: "input",
    name: input.name ?? "Your piece",
    hex: labToHex(lab),
    lab,
    family: "Neutral",
    finish: "Matte",
    note: "The colour you supplied.",
    tags: ["input"],
  };
  const match = scoreFabric(skin, fabric, options);
  const nearest = [...FABRICS]
    .map((colour) => ({ colour, deltaE: round(deltaE2000(lab, colour.lab, 1.5, 1, 1), 2) }))
    .sort((a, b) => a.deltaE - b.deltaE)
    .slice(0, 3);

  const alternatives = recommendFabrics(skin, {
    ...options,
    limit: options.limit ?? 3,
    exclude: ["f01"],
  }).best.filter((candidate) => {
    const hueGap = Math.abs(hueDelta(hueAngle(lab), hueAngle(candidate.colour.lab)));
    return hueGap <= 40 || candidate.score >= 80;
  });

  const pairings = recommendPairings(skin, lab, {
    limit: 4,
    category: options.category ?? "hijab",
  });

  const headline =
    match.score >= 84
      ? "This one works hard for your face."
      : match.score >= 72
        ? "A reliable choice, with one small caveat."
        : match.score >= 60
          ? "Wearable — if you want the colour to lead."
          : "This colour will fight your reading.";

  const summary =
    match.lightnessGap < 12
      ? "It sits very close to your skin's lightness. In a large face-framing piece that can erase the jawline."
      : match.temperature === "neutral"
        ? "Its neutrality lets your skin tone do the talking; the result depends on finish and styling."
        : `Its ${match.temperature} cast and ${match.lightnessGap}° lightness gap are the two things doing the work here.`;

  return {
    input: { hex: labToHex(lab), name: input.name, lab },
    score: match.score,
    verdict: match.verdict,
    headline,
    summary,
    reasons: [
      ...match.reasons,
      ...(match.verdict === "harder"
        ? ["Try it in a smaller area — a bag, trim or underlayer — before committing to a full hijab."]
        : []),
    ].slice(0, 5),
    deltaE: match.deltaE,
    nearest,
    alternatives,
    pairings,
  };
}

function foundationGrade(deltaE: number): FoundationMatch["grade"] {
  if (deltaE < 1.5) return "Invisible";
  if (deltaE < 3) return "Close";
  if (deltaE < 5) return "Visible";
  return "Off";
}

export function matchFoundations(
  skin: SkinProfile,
  options: { limit?: number; foundations?: FoundationShade[] } = {},
): FoundationMatch[] {
  const limit = clamp(options.limit ?? 5, 1, 20);
  const pool = options.foundations ?? FOUNDATIONS;
  return pool
    .map((shade) => {
      const dE = deltaE2000(skin.lab, shade.lab, 1, 1, 1);
      const depthDelta = shade.lab.l - skin.lab.l;
      const undertoneDelta = hueDelta(skin.hue, hueAngle(shade.lab));
      const base = 100 * Math.exp(-0.5 * (dE / 2.5) ** 2);
      const depthPenalty = 10 * clamp((Math.abs(depthDelta) - 4) / 4, 0, 1);
      const undertonePenalty =
        12 * (1 - Math.cos((Math.abs(undertoneDelta) * Math.PI) / 180)) / 2;
      const score = clamp(base - depthPenalty - undertonePenalty, 0, 99);

      const notes: string[] = [];
      if (Math.abs(depthDelta) <= 1.5) notes.push("Depth is effectively a match.");
      else if (depthDelta > 0) notes.push(`${round(depthDelta, 1)} L* lighter than your reading.`);
      else notes.push(`${round(Math.abs(depthDelta), 1)} L* deeper than your reading.`);
      if (Math.abs(undertoneDelta) < 5) notes.push("Undertone direction agrees.");
      else if (undertoneDelta > 0) notes.push(`${round(undertoneDelta, 0)}° warmer — watch for a peach cast.`);
      else notes.push(`${round(Math.abs(undertoneDelta), 0)}° cooler — watch for a pink cast.`);
      if (shade.coverage === "Full") notes.push("Full coverage: undertone has to be close, not approximate.");
      if (shade.finish === "Radiant") notes.push("Radiant finish reflects light and can read lighter in daylight.");

      return {
        shade,
        score: round(score, 1),
        deltaE: round(dE, 2),
        depthDelta: round(depthDelta, 2),
        undertoneDelta: round(undertoneDelta, 1),
        grade: foundationGrade(dE),
        notes: notes.slice(0, 3),
      } satisfies FoundationMatch;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function warmerCoolerOptions(
  skin: SkinProfile,
  best: FoundationMatch,
): { warmer: FoundationShade | null; cooler: FoundationShade | null } {
  const neighbours = FOUNDATIONS.filter(
    (shade) =>
      shade.depth === best.shade.depth &&
      shade.undertone !== best.shade.undertone,
  );
  const warmer =
    neighbours
      .filter((shade) => shade.undertone === "warm" || shade.undertone === "olive")
      .sort((a, b) => deltaE2000(skin.lab, a.lab) - deltaE2000(skin.lab, b.lab))[0] ?? null;
  const cooler =
    neighbours
      .filter((shade) => shade.undertone === "cool" || shade.undertone === "neutral")
      .sort((a, b) => deltaE2000(skin.lab, a.lab) - deltaE2000(skin.lab, b.lab))[0] ?? null;
  return { warmer, cooler };
}

export function undertoneFromHex(hex: string): Undertone {
  const lab = hexToLab(hex);
  const hue = hueAngle(lab);
  const c = chroma(lab);
  if (c < 8) return "neutral";
  if (hue >= 45 && hue <= 75) return "warm";
  if (hue >= 330 || hue <= 20) return "cool";
  if (hue > 75 && hue < 160) return "olive";
  return "neutral";
}
