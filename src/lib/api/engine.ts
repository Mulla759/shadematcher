import { z } from "zod";
import { analyzeSkin, type SkinProfile, type SkinSampleInput, type QualityMetrics } from "../skin";
import { CATALOG_META, FABRICS } from "../catalog";
import {
  evaluateGarment,
  matchFoundations,
  recommendFabrics,
  type FabricMatch,
  type FoundationMatch,
  type GarmentEvaluation,
} from "../match";
import { computeFaceGeometry, FACE_OVAL, sampleFace } from "../face/landmarks";
import { decodeImage, extractPalette, heuristicFace } from "../server/image";
import { getLibrary } from "../server/library";
import { foundationsEnabled } from "../beta";
import { MatchRequestSchema, type MatchRequest } from "./schema";

export const ENGINE_VERSION = "0.1.0";

export interface PreviewPayload {
  recommendedStyle: string;
  colour: string;
  fabricName: string;
  faceOutline: Array<{ x: number; y: number }>;
  anchors: Record<string, { x: number; y: number }>;
}

export interface MatchResult {
  ok: true;
  version: string;
  requestId: string;
  latencyMs: number;
  source: {
    face: "landmarks+samples" | "landmarks" | "samples" | "heuristic" | "none";
    garment: "hex" | "image" | "none";
  };
  skin: SkinProfile;
  colour: {
    category: string;
    best: FabricMatch[];
    avoid: FabricMatch[];
    palette: Array<{ name: string; hex: string }>;
  };
  garment: (GarmentEvaluation & { palette?: Array<{ hex: string; share: number }> }) | null;
  foundation: FoundationMatch[];
  preview: PreviewPayload | null;
  warnings: string[];
  disclaimer: string;
  meta: {
    engine: string;
    catalog: typeof CATALOG_META;
    catalogue: {
      count: number;
      stores: number;
      source: string;
    };
    samplePolicy: string;
  };
}

export class MatchError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status = 422,
  ) {
    super(message);
  }
}

const DISCLAIMER =
  "Auriga is a colour-visualisation tool, not a fit or dermatology device. Preview colours on your own screen; fabric, lighting and screen calibration change how a shade reads. Scraped fabric hex values are measured from product photography, not studio spectrophotometry. Foundation swatches in the demo catalog are reference points, not retail products.";

export async function runMatch(input: MatchRequest, requestId: string): Promise<MatchResult> {
  const started = performance.now();
  const warnings: string[] = [];
  let image: Awaited<ReturnType<typeof decodeImage>> | null = null;

  if (input.image) {
    try {
      image = await decodeImage(input.image);
    } catch (error) {
      throw new MatchError(
        error instanceof Error ? error.message : "Could not decode image",
        "invalid_image",
        400,
      );
    }
  }

  let samples: SkinSampleInput[] = input.face?.samples ?? [];
  let quality: QualityMetrics = input.face?.quality ?? {};
  let faceSource: MatchResult["source"]["face"] = "none";
  let landmarks = input.face?.landmarks ?? null;

  if (samples.length > 0) {
    faceSource = landmarks ? "landmarks+samples" : "samples";
  } else if (image && landmarks) {
    const sampled = sampleFace(image.data, image.width, image.height, landmarks);
    samples = sampled.samples;
    quality = { ...sampled.quality, ...quality, whitePoint: input.face?.whitePoint ?? sampled.whitePoint };
    faceSource = "landmarks";
  } else if (image) {
    const sampled = heuristicFace(image);
    samples = sampled.samples;
    quality = { ...sampled.quality, ...quality };
    faceSource = "heuristic";
    warnings.push(
      "No face landmarks were provided, so a centred-face heuristic was used. Send landmark points or skin samples for a precise reading.",
    );
  }

  if (samples.length === 0) {
    throw new MatchError(
      "No usable skin pixels. Send face.samples, face.landmarks + image, or a centred portrait image.",
      "no_skin_samples",
      422,
    );
  }

  let skin: SkinProfile;
  try {
    skin = analyzeSkin(samples, quality, {
      whitePoint: input.face?.whitePoint ?? quality.whitePoint,
    });
  } catch (error) {
    throw new MatchError(
      error instanceof Error ? error.message : "Skin analysis failed",
      "skin_analysis_failed",
      422,
    );
  }

  warnings.push(...skin.warnings);

  const category = input.options.category;
  const library = await getLibrary();
  const catalogueFilter = input.options.catalogue;
  const cataloguePool =
    catalogueFilter === "all"
      ? library.fabrics
      : catalogueFilter === "face"
        ? library.faceFabrics
        : library.categories[catalogueFilter];

  if (!cataloguePool || cataloguePool.length === 0) {
    warnings.push(
      `No catalogue category named “${catalogueFilter}” was found; the face-framing catalogue was used instead.`,
    );
  }

  const recommendations = recommendFabrics(skin, {
    category,
    limit: input.options.limit ?? 6,
    fabrics: cataloguePool && cataloguePool.length > 0 ? cataloguePool : library.faceFabrics,
  });

  if (library.stores === 0) {
    warnings.push(
      "The scraped catalogue index is missing, so the demo fabric catalogue was used. Run npm run library:catalog to rebuild it.",
    );
  }

  let garment: MatchResult["garment"] = null;
  let garmentSource: MatchResult["source"]["garment"] = "none";

  if (input.garment?.hex) {
    garment = evaluateGarment(
      skin,
      { hex: input.garment.hex, name: input.garment.name },
      { category, limit: 3 },
    );
    garmentSource = "hex";
  } else if (input.garment?.image) {
    if (!image) {
      throw new MatchError(
        "garment.image requires the image field for this MVP. Send one image and a garment crop, or send garment.hex.",
        "garment_image_unsupported",
        400,
      );
    }
    const palette = extractPalette(image, 5);
    if (palette.length === 0) {
      throw new MatchError("Could not extract a garment palette from the image.", "garment_palette_empty", 422);
    }
    const primary = palette[0];
    garment = {
      ...evaluateGarment(skin, { hex: primary.hex, name: input.garment.name }, { category, limit: 3 }),
      palette: palette.map((entry) => ({ hex: entry.hex, share: Number(entry.share.toFixed(3)) })),
    };
    garmentSource = "image";
  }

  const foundationsOn = foundationsEnabled();
  const foundation =
    foundationsOn && input.options.includeFoundations
      ? matchFoundations(skin, { limit: input.options.foundationLimit ?? 5 })
      : [];

  if (input.options.includeFoundations && !foundationsOn) {
    warnings.push(
      "Foundation matches are switched off in this build: the atlas is a generated reference grid, not retail product data.",
    );
  } else if (foundation.length > 0) {
    warnings.push(
      "Foundations are matched to the face reading. Face skin usually runs redder than the neck; compare the top match against your jaw/neck in daylight before buying.",
    );
  }

  let preview: PreviewPayload | null = null;
  if (input.options.includePreview && landmarks) {
    const geometry = computeFaceGeometry(landmarks, 1000, 1000);
    const best = recommendations.best[0]?.colour;
    preview = {
      recommendedStyle: "classic",
      colour: best?.hex ?? FABRICS[0].hex,
      fabricName: best?.name ?? FABRICS[0].name,
      faceOutline: FACE_OVAL.map((index) => ({
        x: Number(landmarks[index].x.toFixed(4)),
        y: Number(landmarks[index].y.toFixed(4)),
      })),
      anchors: Object.fromEntries(
        Object.entries(geometry.anchors).map(([key, point]) => [
          key,
          { x: Number((point.x / 1000).toFixed(4)), y: Number((point.y / 1000).toFixed(4)) },
        ]),
      ),
    };
  }

  if (!input.face?.whitePoint && !quality.whitePoint) {
    warnings.push(
      "No white reference was supplied (sclera or grey card), so any camera colour cast is uncorrected.",
    );
  }

  return {
    ok: true,
    version: ENGINE_VERSION,
    requestId,
    latencyMs: Math.round(performance.now() - started),
    source: { face: faceSource, garment: garmentSource },
    skin,
    colour: {
      category,
      best: recommendations.best,
      avoid: recommendations.avoid,
      palette: skin.season.palette,
    },
    garment,
    foundation,
    preview,
    warnings: [...new Set(warnings)].slice(0, 8),
    disclaimer: DISCLAIMER,
    meta: {
      engine: `auriga-colour-engine/${ENGINE_VERSION}`,
      catalog: CATALOG_META,
      catalogue: {
        count: cataloguePool?.length ?? library.faceCount,
        stores: library.stores,
        source: library.source,
      },
      samplePolicy: "Skin samples are processed in memory and never persisted by this MVP.",
    },
  };
}

export const RequestSchema = MatchRequestSchema;
export type { MatchRequest };
export { z };
