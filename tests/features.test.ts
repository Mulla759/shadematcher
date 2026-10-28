import { afterEach, describe, expect, it } from "vitest";
import { foundationsEnabled } from "@/lib/beta";
import { runMatch } from "@/lib/api/engine";

const original = process.env.FOUNDATIONS_ENABLED;

afterEach(() => {
  if (original === undefined) delete process.env.FOUNDATIONS_ENABLED;
  else process.env.FOUNDATIONS_ENABLED = original;
});

describe("foundation switch", () => {
  it("is off when the flag says so", () => {
    process.env.FOUNDATIONS_ENABLED = "0";
    expect(foundationsEnabled()).toBe(false);
  });

  it("is on when the flag says so", () => {
    process.env.FOUNDATIONS_ENABLED = "1";
    expect(foundationsEnabled()).toBe(true);
  });

  it("drops foundation matches and warns when disabled", async () => {
    process.env.FOUNDATIONS_ENABLED = "0";
    const result = await runMatch({
      face: {
        samples: [
          { lab: { l: 40, a: 12, b: 15 }, region: "leftCheek" },
          { lab: { l: 41, a: 12, b: 15 }, region: "rightCheek" },
          { lab: { l: 42, a: 11, b: 14 }, region: "forehead" },
        ],
        quality: { lighting: 0.7, evenness: 0.7, faceSize: 0.3 },
      },
      options: {
        category: "hijab",
        catalogue: "face",
        limit: 3,
        foundationLimit: 3,
        includeFoundations: true,
        includePreview: false,
      },
    }, "test-foundation-switch");

    expect(result.foundation).toHaveLength(0);
    expect(result.warnings.join(" ")).toContain("Foundation matches are switched off");
  });
});
