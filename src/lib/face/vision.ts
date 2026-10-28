"use client";

import type {
  FaceLandmarker,
  FaceLandmarkerResult,
  ImageSegmenter,
} from "@mediapipe/tasks-vision";
import type { Point } from "./landmarks";

let facePromise: Promise<FaceLandmarker> | null = null;
let segmenterPromise: Promise<ImageSegmenter> | null = null;
let activeDelegate: "GPU" | "CPU" | null = null;

export function getActiveDelegate(): "GPU" | "CPU" | null {
  return activeDelegate;
}

async function createFaceLandmarker(): Promise<FaceLandmarker> {
  const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
  const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
  try {
    const landmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: "/models/face_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: true,
      minFaceDetectionConfidence: 0.55,
      minFacePresenceConfidence: 0.55,
      minTrackingConfidence: 0.55,
    });
    activeDelegate = "GPU";
    return landmarker;
  } catch {
    const landmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: "/models/face_landmarker.task",
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: true,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    activeDelegate = "CPU";
    return landmarker;
  }
}

export async function loadFaceLandmarker(): Promise<FaceLandmarker> {
  if (!facePromise) facePromise = createFaceLandmarker();
  return facePromise;
}

export async function loadSegmenter(): Promise<ImageSegmenter> {
  if (segmenterPromise) return segmenterPromise;
  segmenterPromise = (async () => {
    const { ImageSegmenter, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
    try {
      return await ImageSegmenter.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: "/models/selfie_multiclass_256x256.tflite",
          delegate: "GPU",
        },
        runningMode: "IMAGE",
        outputCategoryMask: true,
        outputConfidenceMasks: false,
      });
    } catch {
      return ImageSegmenter.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: "/models/selfie_multiclass_256x256.tflite",
          delegate: "CPU",
        },
        runningMode: "IMAGE",
        outputCategoryMask: true,
        outputConfidenceMasks: false,
      });
    }
  })();
  return segmenterPromise;
}

export interface FaceFrame {
  landmarks: Point[];
  matrix: number[] | null;
  timestamp: number;
}

export function detectFaceSource(
  landmarker: FaceLandmarker,
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
  timestamp: number,
): FaceFrame | null {
  let result: FaceLandmarkerResult;
  const originalError = console.error;
  // MediaPipe logs a non-actionable XNNPACK/GL banner through console.error on
  // first inference, which trips dev overlays. Keep real errors intact.
  console.error = (...args: unknown[]) => {
    const text = args.map((value) => String(value)).join(" ");
    if (
      text.includes("TensorFlow Lite") ||
      text.includes("XNNPACK") ||
      text.includes("gl_context") ||
      text.includes("FaceBlendshapesGraph")
    ) {
      return;
    }
    originalError(...args);
  };
  try {
    result = landmarker.detectForVideo(source, timestamp);
  } catch {
    return null;
  } finally {
    console.error = originalError;
  }
  const landmarks = result.faceLandmarks?.[0];
  if (!landmarks || landmarks.length < 400) return null;
  return {
    landmarks: landmarks.map((point) => ({ x: point.x, y: point.y, z: point.z })),
    matrix: result.facialTransformationMatrixes?.[0]?.data
      ? Array.from(result.facialTransformationMatrixes[0].data)
      : null,
    timestamp,
  };
}

export function detectFaceFrame(
  landmarker: FaceLandmarker,
  video: HTMLVideoElement,
  timestamp: number,
): FaceFrame | null {
  if (video.readyState < 2) return null;
  return detectFaceSource(landmarker, video, timestamp);
}

export function smoothLandmarks(
  previous: Point[] | null,
  next: Point[],
  alpha = 0.55,
): Point[] {
  if (!previous || previous.length !== next.length) return next;
  return next.map((point, index) => {
    const old = previous[index];
    return {
      x: old.x + (point.x - old.x) * alpha,
      y: old.y + (point.y - old.y) * alpha,
      z: (old.z ?? 0) + ((point.z ?? 0) - (old.z ?? 0)) * alpha,
    };
  });
}

export interface HairMask {
  data: Uint8Array;
  width: number;
  height: number;
}

const SEGMENT_SIZE = 256;

export function segmentHair(
  segmenter: ImageSegmenter,
  source: HTMLVideoElement | HTMLCanvasElement,
): HairMask | null {
  if (source instanceof HTMLVideoElement && source.readyState < 2) return null;
  const canvas = document.createElement("canvas");
  canvas.width = SEGMENT_SIZE;
  canvas.height = SEGMENT_SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, SEGMENT_SIZE, SEGMENT_SIZE);
  try {
    const result = segmenter.segment(canvas);
    const mask = result.categoryMask;
    if (!mask) return null;
    const data = new Uint8Array(mask.getAsUint8Array());
    const width = mask.width;
    const height = mask.height;
    mask.close();
    result.close();
    return { data, width, height };
  } catch {
    return null;
  }
}

/**
 * Hair coverage: fraction of hair pixels hidden by the hijab silhouette.
 * The hijab mask is a low-res alpha map drawn by the preview renderer.
 */
export function hairCoverage(
  hair: HairMask,
  hijabMask: { data: Uint8ClampedArray; width: number; height: number },
): { coverage: number; visibleHair: number; totalHair: number } {
  let totalHair = 0;
  let covered = 0;
  for (let y = 0; y < hair.height; y += 2) {
    for (let x = 0; x < hair.width; x += 2) {
      const value = hair.data[y * hair.width + x];
      if (value !== 1) continue;
      totalHair += 1;
      const mx = Math.min(hijabMask.width - 1, Math.floor((x / hair.width) * hijabMask.width));
      const my = Math.min(hijabMask.height - 1, Math.floor((y / hair.height) * hijabMask.height));
      const alpha = hijabMask.data[(my * hijabMask.width + mx) * 4 + 3];
      if (alpha > 120) covered += 1;
    }
  }
  return {
    coverage: totalHair === 0 ? 0 : covered / totalHair,
    visibleHair: totalHair - covered,
    totalHair,
  };
}
