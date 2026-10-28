interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetMs: number;
  limit: number;
  /** "kv" when a shared store (Vercel KV / Upstash) enforced the limit. */
  source: "kv" | "memory";
}

/**
 * Rate limiter for the public API.
 *
 * Serverless instances each keep their own memory, so the in-memory bucket is
 * only a local-development fallback. Set KV_REST_API_URL and
 * KV_REST_API_TOKEN (Vercel KV / Upstash Redis) to enforce the limit across
 * every instance and region.
 */
export async function rateLimit(
  key: string,
  limit = 40,
  windowMs = 60_000,
): Promise<RateLimitResult> {
  const shared = await sharedLimit(key, limit, windowMs);
  if (shared) return shared;
  return memoryLimit(key, limit, windowMs);
}

function memoryLimit(key: string, limit: number, windowMs: number): RateLimitResult {
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
    source: "memory",
  };
}

/** Upstash/Vercel KV REST pipeline: INCR + PEXPIRE(NX) + PTTL in one round trip. */
async function sharedLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult | null> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;

  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", `auriga:rl:${key}`],
        ["PEXPIRE", `auriga:rl:${key}`, String(windowMs), "NX"],
        ["PTTL", `auriga:rl:${key}`],
      ]),
      cache: "no-store",
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as Array<{ result?: number | null }>;
    const count = Number(payload?.[0]?.result ?? 0);
    const ttl = Number(payload?.[2]?.result ?? windowMs);
    if (!Number.isFinite(count)) return null;

    return {
      ok: count <= limit,
      remaining: Math.max(0, limit - count),
      resetMs: ttl > 0 ? ttl : windowMs,
      limit,
      source: "kv",
    };
  } catch {
    // A flaky store must not take the API down; fall back to local buckets.
    return null;
  }
}

export function clientKey(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "local"
  );
}
