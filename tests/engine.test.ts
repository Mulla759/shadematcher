import { describe, expect, it } from "vitest";
import { analyzeSkin } from "@/lib/skin";
import { matchFoundations, recommendFabrics, scoreFabric, evaluateGarment } from "@/lib/match";
import { FABRICS, FOUNDATIONS } from "@/lib/catalog";
import { runMatch } from "@/lib/api/engine";
import { MatchRequestSchema } from "@/lib/api/schema";

const sample = (lab: { l: number; a: number; b: number }, region: "forehead" | "leftCheek" | "rightCheek" | "jaw" = "leftCheek") => ({
  lab,
  weight: 1,
  region,
});

const lightWarm = analyzeSkin(
  [sample({ l: 70, a: 12.5, b: 18 }, "forehead"), sample({ l: 69, a: 13, b: 18.5 }, "leftCheek"), sample({ l: 68, a: 12, b: 17.5 }, "rightCheek"), sample({ l: 66, a: 13.5, b: 18 }, "jaw")],
  { lighting: 0.72, evenness: 0.8, faceSize: 0.33, sharpness: 0.7, yaw: 2 },
);

const deepCool = analyzeSkin(
  [sample({ l: 28, a: 12.5, b: 11.5 }, "forehead"), sample({ l: 27, a: 13, b: 12 }, "leftCheek"), sample({ l: 26, a: 12, b: 11 }, "rightCheek")],
  { lighting: 0.7, evenness: 0.75, faceSize: 0.3, sharpness: 0.6, yaw: 1 },
);

describe("skin analysis", () => {
  it("estimates a light warm profile", () => {
    expect(lightWarm.depth).toBe("light");
    expect(lightWarm.undertone).toBe("warm");
    expect(lightWarm.confidence.score).toBeGreaterThan(55);
    expect(lightWarm.season.name).toBe("Light Spring");
  });

  it("does not melt down on a deep, cool reading", () => {
    expect(deepCool.depth).toBe("deep");
    expect(deepCool.undertone).toBe("cool");
    expect(deepCool.season.name).toBe("Deep Winter");
  });

  it("rejects a single outlier pixel", () => {
    const noisy = analyzeSkin([
      sample({ l: 60, a: 13, b: 17 }),
      sample({ l: 60.2, a: 13.1, b: 17.1 }),
      sample({ l: 59.8, a: 12.9, b: 16.9 }),
      sample({ l: 60.1, a: 13.2, b: 17.2 }),
      sample({ l: 60, a: 13, b: 17 }),
      sample({ l: 20, a: 40, b: -20 }), // lipstick / neon
    ]);
    expect(noisy.lab.l).toBeGreaterThan(59);
    expect(noisy.lab.l).toBeLessThan(61);
  });
});

describe("fabric matching", () => {
  it("returns a diverse, scored set", () => {
    const result = recommendFabrics(lightWarm, { limit: 6 });
    expect(result.best).toHaveLength(6);
    expect(new Set(result.best.map((match) => match.colour.id)).size).toBe(6);
    for (const match of result.best) {
      expect(match.score).toBeGreaterThanOrEqual(0);
      expect(match.score).toBeLessThanOrEqual(100);
      expect(match.reasons.length).toBeGreaterThan(0);
    }
    expect(result.best[0].score).toBeGreaterThan(60);
  });

  it("scores every catalog fabric", () => {
    for (const fabric of FABRICS) {
      const match = scoreFabric(lightWarm, fabric);
      expect(Number.isFinite(match.score)).toBe(true);
      expect(match.score).toBeGreaterThanOrEqual(0);
      expect(match.score).toBeLessThanOrEqual(100);
    }
  });

  it("evaluates a supplied garment and suggests pairings", () => {
    const result = evaluateGarment(lightWarm, { hex: "#7C2433", name: "Pomegranate" });
    expect(result.input.hex).toBe("#7C2433");
    expect(result.nearest.length).toBeGreaterThan(0);
    expect(result.pairings.length).toBeGreaterThan(0);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("warns when a garment is almost the skin colour", () => {
    const result = evaluateGarment(lightWarm, { hex: lightWarm.hex });
    expect(result.reasons.join(" ").toLowerCase()).toContain("separation");
  });
});

describe("foundation matching", () => {
  it("finds a close shade from the demo atlas", () => {
    const matches = matchFoundations(lightWarm, { limit: 5 });
    expect(matches).toHaveLength(5);
    expect(matches[0].deltaE).toBeLessThan(2.5);
    expect(matches[0].score).toBeGreaterThan(70);
    expect(FOUNDATIONS.length).toBe(60);
  });
});

describe("api engine", () => {
  it("validates a samples-only request", () => {
    const parsed = MatchRequestSchema.safeParse({
      face: {
        samples: [
          { lab: { l: 61, a: 13, b: 17 }, region: "leftCheek" },
          { lab: { l: 60, a: 13, b: 17 }, region: "forehead" },
        ],
      },
      garment: { hex: "#23324C" },
    });
    expect(parsed.success).toBe(true);
  });

  it("runs end to end without an image", async () => {
    const result = await runMatch(
      {
        face: {
          samples: [
            { lab: { l: 70, a: 12.5, b: 18 }, region: "forehead" },
            { lab: { l: 69, a: 13, b: 18.5 }, region: "leftCheek" },
            { lab: { l: 68, a: 12, b: 17.5 }, region: "rightCheek" },
          ],
          quality: { lighting: 0.7, evenness: 0.8, faceSize: 0.3 },
        },
        garment: { hex: "#7C2433" },
        options: {
          category: "hijab",
          catalogue: "face",
          limit: 5,
          foundationLimit: 3,
          includeFoundations: true,
          includePreview: false,
        },
      },
      "test-request",
    );
    expect(result.ok).toBe(true);
    expect(result.source.face).toBe("samples");
    expect(result.colour.best).toHaveLength(5);
    expect(result.garment?.input.hex).toBe("#7C2433");
    expect(result.foundation).toHaveLength(3);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
