import { z } from "zod";

export const REGIONS = [
  "forehead",
  "leftCheek",
  "rightCheek",
  "nose",
  "jaw",
  "neck",
  "unknown",
] as const;

const rgbTuple = z.tuple([z.number().min(0).max(255), z.number().min(0).max(255), z.number().min(0).max(255)]);

const labObject = z.object({
  l: z.number().min(0).max(100),
  a: z.number().min(-128).max(127),
  b: z.number().min(-128).max(127),
});

export const SkinSampleSchema = z
  .object({
    rgb: rgbTuple.optional(),
    lab: labObject.optional(),
    weight: z.number().min(0.1).max(5).optional(),
    region: z.enum(REGIONS).optional(),
  })
  .refine((value) => Boolean(value.rgb || value.lab), {
    message: "Each sample needs either rgb or lab",
  });

export const QualitySchema = z.object({
  lighting: z.number().min(0).max(1).optional(),
  evenness: z.number().min(0).max(1).optional(),
  faceSize: z.number().min(0).max(1).optional(),
  sharpness: z.number().min(0).max(1).optional(),
  yaw: z.number().min(-90).max(90).optional(),
  pitch: z.number().min(-90).max(90).optional(),
  roll: z.number().min(-180).max(180).optional(),
  whitePoint: rgbTuple.optional(),
});

export const LandmarkSchema = z.object({
  x: z.number().min(-0.1).max(1.1),
  y: z.number().min(-0.1).max(1.1),
  z: z.number().optional(),
});

export const MatchRequestSchema = z.object({
  image: z
    .string()
    .max(9_000_000, "Image payload is too large; send a JPEG under 6 MB")
    .optional(),
  face: z
    .object({
      samples: z.array(SkinSampleSchema).min(1).max(5000).optional(),
      landmarks: z.array(LandmarkSchema).min(400).max(5000).optional(),
      quality: QualitySchema.optional(),
      whitePoint: rgbTuple.optional(),
    })
    .optional(),
  garment: z
    .object({
      hex: z
        .string()
        .regex(/^#?[0-9a-fA-F]{6}$/, "Garment hex must be a 6-digit hex colour")
        .optional(),
      name: z.string().max(80).optional(),
      image: z.string().max(9_000_000).optional(),
    })
    .optional(),
  options: z
    .object({
      category: z.enum(["hijab", "scarf", "top", "dress"]).default("hijab"),
      catalogue: z.string().max(40).default("face"),
      limit: z.number().int().min(1).max(12).default(6),
      foundationLimit: z.number().int().min(1).max(10).default(5),
      includeFoundations: z.boolean().default(true),
      includePreview: z.boolean().default(true),
    })
    .default({
      category: "hijab",
      catalogue: "face",
      limit: 6,
      foundationLimit: 5,
      includeFoundations: true,
      includePreview: true,
    }),
});

export type MatchRequest = z.infer<typeof MatchRequestSchema>;
