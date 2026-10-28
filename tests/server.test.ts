import { describe, expect, it } from "vitest";
import { clientKey, rateLimit } from "@/lib/server/rate-limit";
import { FeedbackSchema } from "@/app/api/v1/feedback/route";

describe("rate limiting", () => {
  it("allows up to the limit and then blocks", async () => {
    const key = `test-${Math.random()}`;
    const first = await rateLimit(key, 2, 60_000);
    const second = await rateLimit(key, 2, 60_000);
    const third = await rateLimit(key, 2, 60_000);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(third.ok).toBe(false);
    expect(third.remaining).toBe(0);
    expect(third.resetMs).toBeGreaterThan(0);
  });

  it("keeps separate buckets per key", async () => {
    const a = await rateLimit(`a-${Math.random()}`, 1, 60_000);
    const b = await rateLimit(`b-${Math.random()}`, 1, 60_000);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
  });

  it("reads the client address from the forwarded headers", () => {
    expect(clientKey(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe(
      "203.0.113.7",
    );
    expect(clientKey(new Headers({ "x-real-ip": "198.51.100.9" }))).toBe("198.51.100.9");
    expect(clientKey(new Headers())).toBe("local");
  });
});

describe("feedback payload", () => {
  it("accepts a short message", () => {
    const parsed = FeedbackSchema.safeParse({ kind: "feedback", message: "The reading drifted." });
    expect(parsed.success).toBe(true);
  });

  it("rejects an empty or oversized message", () => {
    expect(FeedbackSchema.safeParse({ kind: "feedback", message: "   " }).success).toBe(false);
    expect(FeedbackSchema.safeParse({ kind: "feedback", message: "x".repeat(2_001) }).success).toBe(
      false,
    );
  });

  it("rejects a malformed email", () => {
    expect(FeedbackSchema.safeParse({ kind: "feedback", message: "hi", email: "nope" }).success).toBe(
      false,
    );
    expect(
      FeedbackSchema.safeParse({ kind: "feedback", message: "hi", email: "a@b.com" }).success,
    ).toBe(true);
  });
});
