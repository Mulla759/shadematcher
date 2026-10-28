interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetMs: number;
  limit: number;
}

/**
 * Tiny in-memory limiter for the demo. Replace with Upstash/Redis or a gateway
 * limiter before production; serverless instances each keep their own bucket.
 */
export function rateLimit(
  key: string,
  limit = 40,
  windowMs = 60_000,
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((timestamp) => now - timestamp < windowMs);
  const ok = bucket.hits.length < limit;
  if (ok) bucket.hits.push(now);
  buckets.set(key, bucket);
  const oldest = bucket.hits[0] ?? now;
  return {
    ok,
    remaining: Math.max(0, limit - bucket.hits.length),
    resetMs: Math.max(0, windowMs - (now - oldest)),
    limit,
  };
}

export function clientKey(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "local"
  );
}
