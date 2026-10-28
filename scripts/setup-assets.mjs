import { cp, mkdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Copies the MediaPipe WASM runtime out of node_modules and downloads the two
 * model files the app needs. Runs on `npm install` (postinstall) so a deploy
 * from GitHub always has the face mesh available.
 *
 * Pass --strict to fail the build when an asset is missing (used by Vercel).
 */
const strict = process.argv.includes("--strict");

const root = process.cwd();
const wasmSource = path.join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const wasmTarget = path.join(root, "public", "mediapipe", "wasm");
const modelTarget = path.join(root, "public", "models");

const MODELS = [
  {
    file: "face_landmarker.task",
    url: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
  },
  {
    file: "selfie_multiclass_256x256.tflite",
    url: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite",
  },
];

const fileSize = async (file) => {
  try {
    const info = await stat(file);
    return info.size;
  } catch {
    return 0;
  }
};

await mkdir(modelTarget, { recursive: true });
await mkdir(wasmTarget, { recursive: true });

if (existsSync(wasmSource)) {
  await cp(wasmSource, wasmTarget, { recursive: true });
  console.log(`Copied MediaPipe WASM -> ${path.relative(root, wasmTarget)}`);
} else {
  console.warn("MediaPipe wasm folder not found. Run npm install first.");
  if (strict) {
    console.error("Strict mode: MediaPipe WASM is missing.");
    process.exit(1);
  }
}

const missing = [];

for (const model of MODELS) {
  const target = path.join(modelTarget, model.file);
  const current = await fileSize(target);
  if (current > 1_000_000) {
    console.log(`✓ ${model.file} (${(current / 1_048_576).toFixed(1)} MB)`);
    continue;
  }
  console.log(`Downloading ${model.file}…`);
  try {
    const response = await fetch(model.url);
    if (!response.ok) {
      console.warn(`  failed: ${response.status} ${response.statusText}`);
      missing.push(model.file);
      continue;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(target, buffer);
    console.log(`✓ ${model.file} (${(buffer.length / 1_048_576).toFixed(1)} MB)`);
  } catch (error) {
    // A flaky network must never break `npm install`; the strict build step
    // turns a missing model into a failed deploy instead.
    console.warn(`  failed: ${error instanceof Error ? error.message : String(error)}`);
    missing.push(model.file);
  }
}

if (missing.length > 0 && strict) {
  console.error(`Strict mode: missing model assets: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("\nAssets ready. Start with: npm run dev");
