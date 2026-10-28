import { NextResponse } from "next/server";
import { MatchRequestSchema } from "@/lib/api/schema";
import { MatchError, runMatch } from "@/lib/api/engine";
import { clientKey, rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const started = Date.now();
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 12_000_000) {
    return NextResponse.json(
      {
        ok: false,
        requestId,
        error: { code: "payload_too_large", message: "Request exceeds 12 MB." },
      },
      { status: 413, headers: CORS },
    );
  }

  const limit = rateLimit(clientKey(request.headers), 40, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      {
        ok: false,
        requestId,
        error: {
          code: "rate_limited",
          message: "Too many scans. Wait a minute and try again.",
        },
      },
      {
        status: 429,
        headers: {
          ...CORS,
          "Retry-After": String(Math.ceil(limit.resetMs / 1000)),
          "X-RateLimit-Limit": String(limit.limit),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        requestId,
        error: { code: "invalid_json", message: "Body must be valid JSON." },
      },
      { status: 400, headers: CORS },
    );
  }

  const parsed = MatchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        requestId,
        error: {
          code: "invalid_request",
          message: "The request did not match the match schema.",
          details: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
      { status: 400, headers: CORS },
    );
  }

  try {
    const result = await runMatch(parsed.data, requestId);
    return NextResponse.json(result, {
      status: 200,
      headers: {
        ...CORS,
        "X-RateLimit-Limit": String(limit.limit),
        "X-RateLimit-Remaining": String(limit.remaining),
        "X-Engine": result.meta.engine,
        "Server-Timing": `engine;dur=${Date.now() - started}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const status = error instanceof MatchError ? error.status : 500;
    const code = error instanceof MatchError ? error.code : "internal_error";
    const message =
      error instanceof MatchError
        ? error.message
        : "The engine could not complete this request.";
    if (status >= 500) console.error("[auriga/match]", requestId, error);
    return NextResponse.json(
      { ok: false, requestId, error: { code, message } },
      { status, headers: CORS },
    );
  }
}
