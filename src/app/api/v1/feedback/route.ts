import { NextResponse } from "next/server";
import { z } from "zod";
import { clientKey, rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const FeedbackSchema = z.object({
  kind: z.enum(["feedback", "error"]).default("feedback"),
  message: z.string().trim().min(1).max(2_000),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  path: z.string().trim().max(300).optional(),
  context: z.string().trim().max(1_000).optional(),
});

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * Public-testing feedback and client error reports.
 *
 * Entries are written to the server log (visible in Vercel → Logs) and, when
 * FEEDBACK_WEBHOOK_URL is set, forwarded to that webhook. No database, no
 * third-party account, no cookies.
 */
export async function POST(request: Request) {
  const limit = await rateLimit(clientKey(request.headers), 8, 10 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: { code: "rate_limited", message: "Too many messages. Try again shortly." } },
      { status: 429, headers: { ...CORS, "Retry-After": String(Math.ceil(limit.resetMs / 1000)) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_json", message: "Body must be valid JSON." } },
      { status: 400, headers: CORS },
    );
  }

  const parsed = FeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_request", message: "Message is required." } },
      { status: 400, headers: CORS },
    );
  }

  const entry = {
    kind: parsed.data.kind,
    message: parsed.data.message,
    email: parsed.data.email || undefined,
    path: parsed.data.path,
    context: parsed.data.context,
    userAgent: request.headers.get("user-agent") ?? undefined,
    at: new Date().toISOString(),
  };

  console.log("[auriga/feedback]", JSON.stringify(entry));

  const webhook = process.env.FEEDBACK_WEBHOOK_URL;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
    } catch (error) {
      console.error("[auriga/feedback] webhook failed", error);
    }
  }

  return NextResponse.json(
    { ok: true, received: true },
    { status: 202, headers: { ...CORS, "Cache-Control": "no-store" } },
  );
}
