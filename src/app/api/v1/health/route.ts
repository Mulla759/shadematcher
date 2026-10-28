import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import path from "node:path";
import { ENGINE_VERSION } from "@/lib/api/engine";
import { BETA_MODE, foundationsEnabled, SHOW_PHOTOS } from "@/lib/beta";
import { getLibrary } from "@/lib/server/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const root = process.cwd();
  const assets = {
    faceLandmarker: existsSync(path.join(root, "public/models/face_landmarker.task")),
    selfieMulticlass: existsSync(path.join(root, "public/models/selfie_multiclass_256x256.tflite")),
    wasm: existsSync(path.join(root, "public/mediapipe/wasm/vision_wasm_internal.wasm")),
  };
  const ready = Object.values(assets).every(Boolean);
  const library = await getLibrary();

  return NextResponse.json(
    {
      ok: ready,
      version: ENGINE_VERSION,
      now: new Date().toISOString(),
      assets,
      catalogue: {
        count: library.count,
        stores: library.stores,
        source: library.source,
      },
      features: {
        beta: BETA_MODE,
        photos: SHOW_PHOTOS,
        foundations: foundationsEnabled(),
        rateLimit: process.env.KV_REST_API_URL ? "shared" : "in-memory",
      },
      endpoints: {
        match: "POST /api/v1/match",
        catalog: "GET /api/v1/catalog",
        feedback: "POST /api/v1/feedback",
        health: "GET /api/v1/health",
      },
    },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
