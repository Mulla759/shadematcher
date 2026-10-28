import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import path from "node:path";
import { ENGINE_VERSION } from "@/lib/api/engine";

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
  return NextResponse.json(
    {
      ok: ready,
      version: ENGINE_VERSION,
      now: new Date().toISOString(),
      assets,
      endpoints: {
        match: "POST /api/v1/match",
        catalog: "GET /api/v1/catalog",
        health: "GET /api/v1/health",
      },
    },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
