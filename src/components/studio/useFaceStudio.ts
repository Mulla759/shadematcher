"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FaceLandmarker, ImageSegmenter } from "@mediapipe/tasks-vision";
import type { Point } from "@/lib/face/landmarks";
import {
  computeFaceGeometry,
  sampleFace,
  type SamplingResult,
} from "@/lib/face/landmarks";
import {
  detectFaceFrame,
  detectFaceSource,
  loadFaceLandmarker,
  loadSegmenter,
  segmentHair,
  smoothLandmarks,
  hairCoverage,
} from "@/lib/face/vision";
import { analyzeSkin, type QualityMetrics, type SkinProfile, type SkinSampleInput } from "@/lib/skin";
import {
  evaluateGarment,
  matchFoundations,
  recommendFabrics,
  type FabricRecommendations,
  type FoundationMatch,
  type GarmentEvaluation,
} from "@/lib/match";
import type { MatchResult } from "@/lib/api/engine";
import { drawHijabMask, drawHijabPreview, type HijabStyle } from "@/lib/preview/hijab";
import { FABRICS } from "@/lib/catalog";

export type StudioMode = "idle" | "camera" | "photo";
export type CameraState = "idle" | "loading" | "live" | "error";
export type PreviewMode = "cards" | "drape";

export interface LiveNote {
  label: string;
  tone: "good" | "warn" | "bad";
  detail: string;
}

const DEFAULT_COLOUR = FABRICS.find((fabric) => fabric.name === "Saffron")?.hex ?? "#C8892B";

function downsample<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  const stride = items.length / max;
  return Array.from({ length: max }, (_, index) => items[Math.floor(index * stride)]);
}

function qualityNote(
  quality: QualityMetrics | null,
  detected: boolean,
  confidence: number | null,
): LiveNote {
  if (!detected) return { label: "Find the face", tone: "warn", detail: "Centre your face in the mirror." };
  if (!quality) return { label: "Reading", tone: "good", detail: "Hold still while the face is mapped." };
  const lighting = quality.lighting ?? 0.65;
  const evenness = quality.evenness ?? 0.7;
  const size = quality.faceSize ?? 0.28;
  const yaw = Math.abs(quality.yaw ?? 0);
  if (size < 0.14) return { label: "Move closer", tone: "warn", detail: "The face is too small for a stable reading." };
  if (yaw > 20) return { label: "Face the camera", tone: "warn", detail: "A turned head shifts the cheek reading." };
  if (lighting < 0.38) return { label: "Low light", tone: "bad", detail: "Face a window or add soft, even light." };
  if (lighting > 0.86) return { label: "Too bright", tone: "warn", detail: "Highlights can wash out undertone." };
  if (evenness < 0.48) return { label: "Uneven light", tone: "warn", detail: "Move away from a single strong source." };
  if (confidence !== null && confidence > 0) return { label: "Holding", tone: "good", detail: "Reading is stable. Take it when you are ready." };
  return { label: "Ready", tone: "good", detail: "Landmarks locked. Take a reading." };
}

export function useFaceStudio() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const segmenterRef = useRef<ImageSegmenter | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const smoothedRef = useRef<Point[] | null>(null);
  const landmarksRef = useRef<Point[] | null>(null);
  const samplesRef = useRef<SkinSampleInput[]>([]);
  const qualityRef = useRef<QualityMetrics>({});
  const whitePointRef = useRef<[number, number, number] | undefined>(undefined);
  const drawSizeRef = useRef<{ width: number; height: number } | null>(null);
  const photoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const photoDataRef = useRef<ImageData | null>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastSampleRef = useRef(0);
  const lastQualityRef = useRef(0);
  const lastSegRef = useRef(0);
  const faceSeenRef = useRef(false);
  const modeRef = useRef<StudioMode>("idle");
  const colourRef = useRef(DEFAULT_COLOUR);
  const styleRef = useRef<HijabStyle>("classic");
  const sheenRef = useRef(0.55);
  const coverageRef = useRef(0.94);
  const anchorsRef = useRef(false);
  const yawRef = useRef(0);
  const frozenRef = useRef(false);
  const manualColourRef = useRef(false);
  const coverageEnabledRef = useRef(false);
  const previewModeRef = useRef<PreviewMode>("cards");
  const stopCameraRef = useRef<() => void>(() => {});

  const [mode, setMode] = useState<StudioMode>("idle");
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [skin, setSkin] = useState<SkinProfile | null>(null);
  const [sampleCount, setSampleCount] = useState(0);
  const [liveNote, setLiveNote] = useState<LiveNote>({
    label: "Ready",
    tone: "good",
    detail: "Enable the camera or upload a portrait.",
  });
  const [previewColour, setPreviewColourState] = useState(DEFAULT_COLOUR);
  const [style, setStyleState] = useState<HijabStyle>("classic");
  const [sheen, setSheenState] = useState(0.55);
  const [coverage, setCoverageState] = useState(0.94);
  const [showAnchors, setShowAnchorsState] = useState(false);
  const [frozen, setFrozenState] = useState(false);
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [apiResult, setApiResult] = useState<MatchResult | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [savedShot, setSavedShot] = useState<string | null>(null);
  const [coverageEnabled, setCoverageEnabledState] = useState(false);
  const [previewMode, setPreviewModeState] = useState<PreviewMode>("cards");
  const [hairCoverageValue, setHairCoverageValue] = useState<number | null>(null);
  const [segmenterState, setSegmenterState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [garmentHex, setGarmentHex] = useState<string | null>(null);
  const [garmentName, setGarmentName] = useState<string | null>(null);

  const recommendations = useMemo<FabricRecommendations | null>(
    () => (skin ? recommendFabrics(skin, { limit: 6, category: "hijab" }) : null),
    [skin],
  );

  const foundations = useMemo<FoundationMatch[]>(
    () => (skin ? matchFoundations(skin, { limit: 5 }) : []),
    [skin],
  );

  const localGarment = useMemo<GarmentEvaluation | null>(() => {
    if (!skin || !garmentHex) return null;
    return evaluateGarment(skin, { hex: garmentHex, name: garmentName ?? undefined }, { category: "hijab" });
  }, [skin, garmentHex, garmentName]);

  const paint = useCallback((landmarks: Point[] | null, width: number, height: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    drawSizeRef.current = { width, height };
    if (!landmarks) return;
    if (previewModeRef.current !== "drape") return;
    drawHijabPreview(ctx, {
      landmarks,
      width,
      height,
      colour: colourRef.current,
      style: styleRef.current,
      sheen: sheenRef.current,
      coverage: coverageRef.current,
      yaw: yawRef.current,
      showAnchors: anchorsRef.current,
    });
  }, []);

  const redraw = useCallback(() => {
    const landmarks = landmarksRef.current;
    const size = drawSizeRef.current;
    if (!landmarks || !size) return;
    paint(landmarks, size.width, size.height);
  }, [paint]);

  useEffect(() => {
    colourRef.current = previewColour;
    redraw();
  }, [previewColour, redraw]);

  useEffect(() => {
    styleRef.current = style;
    redraw();
  }, [style, redraw]);

  useEffect(() => {
    sheenRef.current = sheen;
    redraw();
  }, [sheen, redraw]);

  useEffect(() => {
    coverageRef.current = coverage;
    redraw();
  }, [coverage, redraw]);

  useEffect(() => {
    anchorsRef.current = showAnchors;
    redraw();
  }, [showAnchors, redraw]);

  useEffect(() => {
    frozenRef.current = frozen;
  }, [frozen]);

  useEffect(() => {
    coverageEnabledRef.current = coverageEnabled;
    if (coverageEnabled && segmenterState === "idle") {
      setSegmenterState("loading");
      loadSegmenter()
        .then((segmenter) => {
          segmenterRef.current = segmenter;
          setSegmenterState("ready");
        })
        .catch(() => setSegmenterState("error"));
    }
  }, [coverageEnabled, segmenterState]);

  const applyResult = useCallback(
    (result: MatchResult, selectBest: boolean) => {
      setApiResult(result);
      setSkin(result.skin);
      setFrozenState(true);
      frozenRef.current = true;
      if (selectBest && !manualColourRef.current && result.colour.best[0]) {
        setPreviewColourState(result.colour.best[0].colour.hex);
      }
      if (result.garment) {
        setGarmentHex(result.garment.input.hex);
        setGarmentName(result.garment.input.name ?? null);
      }
    },
    [],
  );

  const processImage = useCallback(
    async (image: HTMLImageElement) => {
      setError(null);
      setApiError(null);
      setApiResult(null);
      setFrozenState(false);
      frozenRef.current = false;
      stopCameraRef.current();
      try {
        const maxEdge = 1200;
        const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("Canvas is unavailable in this browser.");
        ctx.drawImage(image, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        photoCanvasRef.current = canvas;
        photoDataRef.current = imageData;
        setPhotoSrc(canvas.toDataURL("image/jpeg", 0.9));
        setMode("photo");
        modeRef.current = "photo";

        const landmarker = await loadFaceLandmarker();
        landmarkerRef.current = landmarker;
        const frame = detectFaceSource(landmarker, canvas, performance.now());
        if (!frame) {
          setError("No face found. Use a front-facing portrait with the face large in frame.");
          setLiveNote({ label: "No face", tone: "bad", detail: "Try another photo, or use the camera." });
          return;
        }
        const landmarks = frame.landmarks;
        landmarksRef.current = landmarks;
        smoothedRef.current = landmarks;
        const geometry = computeFaceGeometry(landmarks, width, height);
        yawRef.current = geometry.yaw;
        const sampled = sampleFace(imageData.data, width, height, landmarks);
        samplesRef.current = sampled.samples;
        qualityRef.current = sampled.quality;
        whitePointRef.current = sampled.whitePoint;
        setSampleCount(sampled.samples.length);
        const analysis = analyzeSkin(sampled.samples, sampled.quality, { whitePoint: sampled.whitePoint });
        setSkin(analysis);
        setFaceDetected(true);
        setLiveNote(qualityNote(sampled.quality, true, analysis.confidence.score));
        paint(landmarks, width, height);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not read that image.");
        setMode("photo");
        modeRef.current = "photo";
      }
    },
    [paint],
  );

  const readPhoto = useCallback(
    async (file: File) => {
      const objectUrl = URL.createObjectURL(file);
      try {
        const image = new Image();
        image.src = objectUrl;
        await image.decode();
        await processImage(image);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not read that image.");
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    },
    [processImage],
  );

  const readPhotoUrl = useCallback(
    async (url: string) => {
      try {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.src = url;
        await image.decode();
        await processImage(image);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not load that demo portrait.");
      }
    },
    [processImage],
  );

  const sampleCurrentFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const maxEdge = 900;
    const scale = Math.min(1, maxEdge / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.max(1, Math.round(video.videoWidth * scale));
    const height = Math.max(1, Math.round(video.videoHeight * scale));
    let canvas = sampleCanvasRef.current;
    if (!canvas) {
      canvas = document.createElement("canvas");
      sampleCanvasRef.current = canvas;
    }
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const landmarks = landmarksRef.current;
    if (!landmarks) return;
    const sampled: SamplingResult = sampleFace(imageData.data, width, height, landmarks);
    if (sampled.samples.length < 24) return;
    try {
      const analysis = analyzeSkin(sampled.samples, sampled.quality, {
        whitePoint: sampled.whitePoint,
      });
      if (analysis.confidence.score < 26) return;
      samplesRef.current = sampled.samples;
      qualityRef.current = sampled.quality;
      whitePointRef.current = sampled.whitePoint;
      setSampleCount(sampled.samples.length);
      setSkin(analysis);
      setLiveNote(qualityNote(sampled.quality, true, analysis.confidence.score));
    } catch {
      // Keep the previous stable reading.
    }
  }, []);

  const runCoverage = useCallback(() => {
    const segmenter = segmenterRef.current;
    const video = videoRef.current;
    const landmarks = landmarksRef.current;
    if (!segmenter || !landmarks) return;
    const source = modeRef.current === "photo" ? photoCanvasRef.current : video;
    if (!source) return;
    const hair = segmentHair(segmenter, source);
    if (!hair) return;
    let mask = maskCanvasRef.current;
    if (!mask) {
      mask = document.createElement("canvas");
      mask.width = 96;
      mask.height = 120;
      maskCanvasRef.current = mask;
    }
    const ctx = mask.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    const sourceWidth = modeRef.current === "photo" ? photoCanvasRef.current?.width ?? 1 : video?.videoWidth ?? 1;
    const sourceHeight = modeRef.current === "photo" ? photoCanvasRef.current?.height ?? 1 : video?.videoHeight ?? 1;
    drawHijabMask(ctx, {
      landmarks,
      width: sourceWidth,
      height: sourceHeight,
      maskWidth: mask.width,
      maskHeight: mask.height,
      style: styleRef.current,
      yaw: yawRef.current,
    });
    const maskData = ctx.getImageData(0, 0, mask.width, mask.height);
    const coverageResult = hairCoverage(hair, {
      data: maskData.data,
      width: mask.width,
      height: mask.height,
    });
    setHairCoverageValue(coverageResult.coverage);
  }, []);

  const startLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    let lastDetect = 0;

    const loop = (now: number) => {
      rafRef.current = requestAnimationFrame(loop);
      if (now - lastDetect < 42) return;
      lastDetect = now;
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;
      if (!video || !landmarker || video.readyState < 2) return;

      const frame = detectFaceFrame(landmarker, video, now);
      if (frame) {
        const smoothed = smoothLandmarks(smoothedRef.current, frame.landmarks, 0.52);
        smoothedRef.current = smoothed;
        landmarksRef.current = smoothed;
        const geometry = computeFaceGeometry(smoothed, video.videoWidth, video.videoHeight);
        yawRef.current = geometry.yaw;
        paint(smoothed, video.videoWidth, video.videoHeight);
        if (!faceSeenRef.current) {
          faceSeenRef.current = true;
          setFaceDetected(true);
        }
        if (now - lastQualityRef.current > 480) {
          lastQualityRef.current = now;
          setLiveNote(
            qualityNote(
              {
                lighting: qualityRef.current.lighting,
                evenness: qualityRef.current.evenness,
                faceSize: geometry.faceWidth / video.videoWidth,
                yaw: geometry.yaw,
                pitch: geometry.pitch,
              },
              true,
              null,
            ),
          );
        }
        if (
          !frozenRef.current &&
          now - lastSampleRef.current > 1500 &&
          samplesRef.current.length >= 0
        ) {
          lastSampleRef.current = now;
          sampleCurrentFrame();
        }
        if (
          coverageEnabledRef.current &&
          segmenterRef.current &&
          now - lastSegRef.current > 1900
        ) {
          lastSegRef.current = now;
          runCoverage();
        }
      } else if (faceSeenRef.current) {
        faceSeenRef.current = false;
        setFaceDetected(false);
        landmarksRef.current = null;
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
        setLiveNote(qualityNote(null, false, null));
      }
    };

    rafRef.current = requestAnimationFrame(loop);
  }, [paint, runCoverage, sampleCurrentFrame]);

  const startCamera = useCallback(async () => {
    setError(null);
    setApiError(null);
    setCameraState("loading");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("This browser does not expose a camera. Upload a photo instead.");
      }
      const landmarker = await loadFaceLandmarker();
      landmarkerRef.current = landmarker;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Camera surface is not mounted.");
      video.srcObject = stream;
      await video.play();
      if (video.videoWidth === 0) {
        await new Promise<void>((resolve) => {
          video.addEventListener("loadedmetadata", () => resolve(), { once: true });
        });
      }
      setMode("camera");
      modeRef.current = "camera";
      setCameraState("live");
      setPhotoSrc(null);
      startLoop();
    } catch (cause) {
      const message =
        cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access in your browser, or upload a photo."
          : cause instanceof Error
            ? cause.message
            : "Could not start the camera.";
      setError(message);
      setCameraState("error");
    }
  }, [startLoop]);

  const stopCameraInternal = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
    faceSeenRef.current = false;
    landmarksRef.current = null;
    smoothedRef.current = null;
    setFaceDetected(false);
    setCameraState("idle");
    setMode("idle");
    modeRef.current = "idle";
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  useEffect(() => {
    stopCameraRef.current = stopCameraInternal;
  }, [stopCameraInternal]);

  const stopCamera = useCallback(() => {
    stopCameraInternal();
    setLiveNote({ label: "Camera off", tone: "good", detail: "Enable the camera or upload a portrait." });
  }, [stopCameraInternal]);

  const reset = useCallback(() => {
    stopCameraInternal();
    setPhotoSrc(null);
    photoCanvasRef.current = null;
    photoDataRef.current = null;
    setSkin(null);
    setSampleCount(0);
    setApiResult(null);
    setApiError(null);
    setError(null);
    setSavedShot(null);
    setGarmentHex(null);
    setGarmentName(null);
    setFrozenState(false);
    frozenRef.current = false;
    manualColourRef.current = false;
    setHairCoverageValue(null);
    setLiveNote({ label: "Ready", tone: "good", detail: "Enable the camera or upload a portrait." });
  }, [stopCameraInternal]);

  const setPreviewColour = useCallback((hex: string, manual = true) => {
    manualColourRef.current = manual;
    setPreviewColourState(hex);
  }, []);

  const setStyle = useCallback((next: HijabStyle) => setStyleState(next), []);
  const setSheen = useCallback((next: number) => setSheenState(next), []);
  const setCoverage = useCallback((next: number) => setCoverageState(next), []);
  const setShowAnchors = useCallback((next: boolean) => setShowAnchorsState(next), []);
  const setCoverageEnabled = useCallback((next: boolean) => setCoverageEnabledState(next), []);

  const composeShot = useCallback((): string | null => {
    const overlay = canvasRef.current;
    if (!overlay || overlay.width === 0) return null;
    const out = document.createElement("canvas");
    out.width = overlay.width;
    out.height = overlay.height;
    const ctx = out.getContext("2d");
    if (!ctx) return null;
    if (modeRef.current === "photo" && photoCanvasRef.current) {
      ctx.drawImage(photoCanvasRef.current, 0, 0, out.width, out.height);
    } else if (videoRef.current) {
      ctx.drawImage(videoRef.current, 0, 0, out.width, out.height);
    } else {
      return null;
    }
    ctx.drawImage(overlay, 0, 0, out.width, out.height);
    return out.toDataURL("image/jpeg", 0.9);
  }, []);

  const runReading = useCallback(
    async (garmentOverride?: { hex: string; name?: string }) => {
      if (samplesRef.current.length === 0) {
        setApiError("No stable skin reading yet. Hold still in even light for a moment.");
        return;
      }
      setScanning(true);
      setApiError(null);
      const shot = composeShot();
      if (shot) setSavedShot(shot);

      const payload = {
        face: {
          samples: downsample(samplesRef.current, 850).map((sample) => ({
            rgb: sample.rgb,
            lab: sample.lab,
            weight: sample.weight,
            region: sample.region,
          })),
          quality: qualityRef.current,
          whitePoint: whitePointRef.current,
          landmarks: landmarksRef.current?.map((point) => ({
            x: Number(point.x.toFixed(4)),
            y: Number(point.y.toFixed(4)),
          })),
        },
        garment: garmentOverride ?? (garmentHex ? { hex: garmentHex, name: garmentName ?? undefined } : undefined),
        options: {
          category: "hijab" as const,
          limit: 6,
          foundationLimit: 5,
          includeFoundations: true,
          includePreview: true,
        },
      };

      try {
        const response = await fetch("/api/v1/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = (await response.json()) as MatchResult | { ok: false; error: { message: string } };
        if (!response.ok || !("ok" in body) || !body.ok) {
          const message =
            "error" in body && body.error?.message
              ? body.error.message
              : "The engine could not complete the reading.";
          throw new Error(message);
        }
        applyResult(body, true);
        if (garmentOverride) {
          setGarmentHex(garmentOverride.hex);
          setGarmentName(garmentOverride.name ?? null);
        }
      } catch (cause) {
        setApiError(cause instanceof Error ? cause.message : "Could not reach the engine.");
      } finally {
        setScanning(false);
      }
    },
    [applyResult, composeShot, garmentHex, garmentName],
  );

  const resumeLive = useCallback(() => {
    setFrozenState(false);
    frozenRef.current = false;
    setApiResult(null);
    setApiError(null);
    manualColourRef.current = false;
    setPreviewColourState(skin?.season.palette[0]?.hex ?? DEFAULT_COLOUR);
    lastSampleRef.current = 0;
  }, [skin]);

  const downloadShot = useCallback(() => {
    if (!savedShot) return;
    const link = document.createElement("a");
    link.href = savedShot;
    link.download = `auriga-look-${Date.now()}.jpg`;
    link.click();
  }, [savedShot]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return {
    videoRef,
    canvasRef,
    mode,
    cameraState,
    error,
    faceDetected,
    skin,
    sampleCount,
    liveNote,
    previewColour,
    style,
    sheen,
    coverage,
    showAnchors,
    frozen,
    photoSrc,
    scanning,
    apiResult,
    apiError,
    savedShot,
    coverageEnabled,
    hairCoverageValue,
    segmenterState,
    garmentHex,
    garmentName,
    recommendations,
    foundations,
    localGarment,
    startCamera,
    stopCamera,
    reset,
    readPhoto,
    readPhotoUrl,
    setPreviewColour,
    setStyle,
    setSheen,
    setCoverage,
    setShowAnchors,
    setCoverageEnabled,
    runReading,
    resumeLive,
    downloadShot,
    setGarment: (hex: string, name?: string) => {
      setGarmentHex(hex);
      setGarmentName(name ?? null);
    },
  };
}

export type FaceStudio = ReturnType<typeof useFaceStudio>;
