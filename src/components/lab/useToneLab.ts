"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import type { Point } from "@/lib/face/landmarks";
import { sampleFace } from "@/lib/face/landmarks";
import { detectFaceFrame, detectFaceSource, getActiveDelegate, loadFaceLandmarker, smoothLandmarks } from "@/lib/face/vision";
import { analyzeSkin, type SkinProfile } from "@/lib/skin";
import { drawFaceMesh } from "@/lib/face/mesh";
import { deltaE2000 } from "@/lib/color";

export type LabStatus = "idle" | "loading" | "live" | "photo" | "error";
export type ToneSource = "camera" | "photo";

const LOCK_SAMPLES = 3;
const LOCK_DELTA = 1.8;
const LOCK_MIN_CONFIDENCE = 42;
const LOCK_MAX_SPREAD = 12;
const UNLOCK_AFTER = 5;

export interface ToneSnapshot {
  engine: string;
  source: ToneSource;
  capturedAt: string | null;
  faceDetected: boolean;
  fps: number;
  samples: number;
  toneLocked: boolean;
  stability: number;
  stableSamples: number;
  skin: {
    hex: string;
    lab: SkinProfile["lab"];
    ita: number;
    depth: string;
    undertone: string;
    undertoneNote: string;
    chroma: number;
    hue: number;
    fitzpatrick: string;
    season: string;
    seasonPalette: string[];
    confidence: SkinProfile["confidence"];
  } | null;
  quality: SkinProfile["quality"] | null;
}

export function useToneLab(options: { mesh?: boolean } = {}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const smoothedRef = useRef<Point[] | null>(null);
  const samplesRef = useRef<ReturnType<typeof sampleFace> | null>(null);
  const lastSampleRef = useRef(0);
  const lastDetectRef = useRef(0);
  const frozenRef = useRef(false);
  const frameTimesRef = useRef<number[]>([]);
  const lastFpsUpdateRef = useRef(0);
  const statusRef = useRef<LabStatus>("idle");
  const faceDetectedRef = useRef(false);
  const meshRef = useRef(options.mesh ?? false);
  const motionRef = useRef(true);
  const stopRef = useRef<() => void>(() => {});
  const photoFaceRef = useRef<{ landmarks: Point[]; width: number; height: number } | null>(null);

  // Temporal lock: a tone is accepted only after several close, confident
  // readings, then held until the light genuinely changes.
  const stableRef = useRef<SkinProfile | null>(null);
  const lockedRef = useRef(false);
  const candidateRef = useRef<{ profile: SkinProfile; count: number; best: SkinProfile } | null>(null);
  const farCountRef = useRef(0);

  const [status, setStatus] = useState<LabStatus>("idle");
  const [sourceMode, setSourceMode] = useState<ToneSource>("camera");
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Camera off");
  const [error, setError] = useState<string | null>(null);
  const [skin, setSkin] = useState<SkinProfile | null>(null);
  const [fps, setFps] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const [sampleCount, setSampleCount] = useState(0);
  const [frozen, setFrozen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastSampleAt, setLastSampleAt] = useState<number | null>(null);
  const [showMesh, setShowMesh] = useState(options.mesh ?? false);
  const [detectMs, setDetectMs] = useState(0);
  const [sampleMs, setSampleMs] = useState(0);
  const [analyzeMs, setAnalyzeMs] = useState(0);
  const [delegate, setDelegate] = useState<"GPU" | "CPU" | "unknown">("unknown");
  const [toneLocked, setToneLocked] = useState(false);
  const [stability, setStability] = useState(0);
  const [stableSamples, setStableSamples] = useState(0);

  useEffect(() => {
    frozenRef.current = frozen;
  }, [frozen]);

  useEffect(() => {
    meshRef.current = showMesh;
  }, [showMesh]);

  useEffect(() => {
    // MediaPipe's WASM prints a non-actionable XNNPACK banner through
    // console.error on first inference. It trips the dev error badge; filter
    // only that banner and leave real errors alone.
    const original = console.error;
    console.error = (...args: unknown[]) => {
      const text = args.map((value) => String(value)).join(" ");
      if (
        text.includes("TensorFlow Lite") ||
        text.includes("XNNPACK") ||
        text.includes("gl_context")
      ) {
        return;
      }
      original(...args);
    };
    return () => {
      console.error = original;
    };
  }, []);

  useEffect(() => {
    motionRef.current = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const clearToneLock = useCallback(() => {
    stableRef.current = null;
    candidateRef.current = null;
    farCountRef.current = 0;
    lockedRef.current = false;
    setToneLocked(false);
    setStability(0);
    setStableSamples(0);
  }, []);

  const drawMesh = useCallback((landmarks: Point[] | null, width: number, height: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (!landmarks) {
      ctx.clearRect(0, 0, width, height);
      return;
    }
    drawFaceMesh(ctx, landmarks, width, height, {
      showFill: true,
      time: performance.now(),
      locked: lockedRef.current,
      motion: motionRef.current,
    });
  }, []);

  useEffect(() => {
    if (sourceMode !== "photo") return;
    const photoFace = photoFaceRef.current;
    if (!photoFace) return;
    if (showMesh) {
      drawMesh(photoFace.landmarks, photoFace.width, photoFace.height);
    } else {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [showMesh, sourceMode, drawMesh]);

  const acceptProfile = useCallback(
    (profile: SkinProfile) => {
      const confident = profile.confidence.score >= LOCK_MIN_CONFIDENCE;
      const clean = profile.spread <= LOCK_MAX_SPREAD;

      if (lockedRef.current && stableRef.current) {
        const drift = deltaE2000(profile.lab, stableRef.current.lab);
        if (drift <= LOCK_DELTA) {
          farCountRef.current = 0;
          setStability(1);
          return;
        }
        if (!confident || !clean) return;
        farCountRef.current += 1;
        setStatusMessage(`Light changed · ${farCountRef.current}/${UNLOCK_AFTER}`);
        if (farCountRef.current >= UNLOCK_AFTER) {
          clearToneLock();
          candidateRef.current = { profile, count: 1, best: profile };
          setSkin(profile);
          setSampleCount(profile.sampleCount);
          setLastSampleAt(Date.now());
          setStability(1 / LOCK_SAMPLES);
          setStableSamples(1);
          setStatusMessage("Re-locking…");
        }
        return;
      }

      if (!confident || !clean) {
        if (!stableRef.current) {
          setSkin(profile);
          setSampleCount(profile.sampleCount);
          setLastSampleAt(Date.now());
        }
        setStatusMessage(clean ? "Need more even light to lock" : "Mixed light — hold steady");
        return;
      }

      if (!candidateRef.current) {
        candidateRef.current = { profile, count: 1, best: profile };
        setSkin(profile);
        setSampleCount(profile.sampleCount);
        setLastSampleAt(Date.now());
        setStability(1 / LOCK_SAMPLES);
        setStableSamples(1);
        setStatusMessage(`Stabilising 1/${LOCK_SAMPLES}…`);
        return;
      }

      const drift = deltaE2000(profile.lab, candidateRef.current.profile.lab);
      if (drift > LOCK_DELTA) {
        candidateRef.current = { profile, count: 1, best: profile };
        setStability(1 / LOCK_SAMPLES);
        setStableSamples(1);
        setStatusMessage(`Stabilising 1/${LOCK_SAMPLES}…`);
        return;
      }

      const count = candidateRef.current.count + 1;
      const best =
        profile.confidence.score > candidateRef.current.best.confidence.score
          ? profile
          : candidateRef.current.best;
      candidateRef.current = { profile, count, best };
      setStability(Math.min(1, count / LOCK_SAMPLES));
      setStableSamples(Math.min(count, LOCK_SAMPLES));

      if (count >= LOCK_SAMPLES) {
        stableRef.current = best;
        lockedRef.current = true;
        setToneLocked(true);
        setSkin(best);
        setSampleCount(best.sampleCount);
        setLastSampleAt(Date.now());
        setStability(1);
        setStableSamples(LOCK_SAMPLES);
        setStatusMessage("Tone locked");
      } else {
        setSkin(best);
        setSampleCount(best.sampleCount);
        setLastSampleAt(Date.now());
        setStatusMessage(`Stabilising ${count}/${LOCK_SAMPLES}…`);
      }
    },
    [clearToneLock],
  );

  const sampleFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const sampleStart = performance.now();
    const maxEdge = 820;
    const scale = Math.min(1, maxEdge / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.max(1, Math.round(video.videoWidth * scale));
    const height = Math.max(1, Math.round(video.videoHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);
    const data = ctx.getImageData(0, 0, width, height);
    const landmarks = smoothedRef.current;
    if (!landmarks) return;
    const sampled = sampleFace(data.data, width, height, landmarks);
    samplesRef.current = sampled;
    if (sampled.samples.length < 20) return;
    const analyseStart = performance.now();
    try {
      const profile = analyzeSkin(sampled.samples, sampled.quality, {
        whitePoint: sampled.whitePoint,
      });
      setSampleMs(Math.round(analyseStart - sampleStart));
      setAnalyzeMs(Math.round(performance.now() - analyseStart));
      acceptProfile(profile);
    } catch {
      // Keep last stable reading.
    }
  }, [acceptProfile]);

  const startLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    frameTimesRef.current = [];
    lastFpsUpdateRef.current = performance.now();

    const loop = (now: number) => {
      rafRef.current = requestAnimationFrame(loop);
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;
      if (!video || !landmarker || video.readyState < 2) return;

      if (now - lastDetectRef.current > 33) {
        lastDetectRef.current = now;
        const detectStart = performance.now();
        const frame = detectFaceFrame(landmarker, video, now);
        const duration = performance.now() - detectStart;
        if (duration > 20) setDetectMs(Math.round(duration));
        if (frame) {
          const smoothed = smoothLandmarks(smoothedRef.current, frame.landmarks, 0.5);
          smoothedRef.current = smoothed;
          if (meshRef.current) {
            drawMesh(smoothed, video.videoWidth, video.videoHeight);
          } else if (canvasRef.current) {
            const canvas = canvasRef.current;
            if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
            }
            canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
          }
          if (!faceDetectedRef.current) {
            faceDetectedRef.current = true;
            setFaceDetected(true);
          }
          frameTimesRef.current.push(now);
          if (!frozenRef.current && now - lastSampleRef.current > 720) {
            lastSampleRef.current = now;
            sampleFrame();
          }
        } else {
          if (faceDetectedRef.current) {
            faceDetectedRef.current = false;
            setFaceDetected(false);
          }
          setStatusMessage("Searching for a face");
        }
      }

      if (now - lastFpsUpdateRef.current > 500) {
        const cutoff = now - 1000;
        frameTimesRef.current = frameTimesRef.current.filter((timestamp) => timestamp >= cutoff);
        setFps(frameTimesRef.current.length);
        lastFpsUpdateRef.current = now;
      }
    };

    rafRef.current = requestAnimationFrame(loop);
  }, [drawMesh, sampleFrame]);

  const readPhoto = useCallback(
    async (file: File) => {
      if (statusRef.current === "loading") return;
      setError(null);
      setStatus("loading");
      statusRef.current = "loading";
      setStatusMessage("Reading photo…");
      stopRef.current();
      const objectUrl = URL.createObjectURL(file);
      let hasPhoto = false;
      try {
        const image = new Image();
        image.src = objectUrl;
        await image.decode();
        const maxEdge = 1200;
        const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const photoCanvas = document.createElement("canvas");
        photoCanvas.width = width;
        photoCanvas.height = height;
        const ctx = photoCanvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("Canvas is unavailable in this browser.");
        ctx.drawImage(image, 0, 0, width, height);
        const data = ctx.getImageData(0, 0, width, height);
        setPhotoSrc(photoCanvas.toDataURL("image/jpeg", 0.92));
        setSourceMode("photo");
        hasPhoto = true;
        setStatus("photo");
        statusRef.current = "photo";
        setStatusMessage("Reading photo…");

        const landmarker = await loadFaceLandmarker();
        landmarkerRef.current = landmarker;
        setDelegate(getActiveDelegate() ?? "unknown");
        const detectStart = performance.now();
        const frame = detectFaceSource(landmarker, photoCanvas, performance.now());
        setDetectMs(Math.round(performance.now() - detectStart));
        if (!frame) {
          throw new Error("No face found. Use a front-facing portrait with the face large in frame.");
        }
        const sampleStart = performance.now();
        const sampled = sampleFace(data.data, width, height, frame.landmarks);
        setSampleMs(Math.round(performance.now() - sampleStart));
        if (sampled.samples.length < 20) {
          throw new Error("Not enough visible skin. Use a front-facing portrait without heavy shadow.");
        }
        const analyzeStart = performance.now();
        const profile = analyzeSkin(sampled.samples, sampled.quality, {
          whitePoint: sampled.whitePoint,
        });
        setAnalyzeMs(Math.round(performance.now() - analyzeStart));
        photoFaceRef.current = { landmarks: frame.landmarks, width, height };
        samplesRef.current = sampled;
        setSkin(profile);
        setSampleCount(sampled.samples.length);
        setLastSampleAt(Date.now());
        setFaceDetected(true);
        setFps(0);
        stableRef.current = profile;
        lockedRef.current = true;
        setToneLocked(true);
        setStability(1);
        setStableSamples(LOCK_SAMPLES);
        setStatusMessage("Photo reading · tone locked");
        if (meshRef.current) {
          drawMesh(frame.landmarks, width, height);
        } else {
          const overlay = canvasRef.current;
          if (overlay) {
            overlay.width = width;
            overlay.height = height;
            overlay.getContext("2d")?.clearRect(0, 0, width, height);
          }
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not read that image.");
        setStatus(hasPhoto ? "photo" : "error");
        statusRef.current = hasPhoto ? "photo" : "error";
        setStatusMessage(hasPhoto ? "Photo loaded · no face" : "Photo error");
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    },
    [drawMesh],
  );

  const start = useCallback(async () => {
    if (statusRef.current === "live" || statusRef.current === "loading") return;
    setError(null);
    setPhotoSrc(null);
    setSourceMode("camera");
    photoFaceRef.current = null;
    clearToneLock();
    setSkin(null);
    setSampleCount(0);
    setLastSampleAt(null);
    setStatus("loading");
    statusRef.current = "loading";
    setStatusMessage("Loading face mesh…");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("This browser does not expose a camera. Try Chrome, Edge or Safari on localhost/HTTPS.");
      }
      const landmarker = await loadFaceLandmarker();
      landmarkerRef.current = landmarker;
      setDelegate(getActiveDelegate() ?? "unknown");
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
      if (!video) throw new Error("Video surface is not mounted.");
      video.srcObject = stream;
      await video.play();
      if (video.videoWidth === 0) {
        await new Promise<void>((resolve) => {
          video.addEventListener("loadedmetadata", () => resolve(), { once: true });
        });
      }
      setStatus("live");
      statusRef.current = "live";
      setStatusMessage("Reading live");
      startLoop();
    } catch (cause) {
      const message =
        cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access for localhost in your browser settings and retry."
          : cause instanceof DOMException && cause.name === "NotFoundError"
            ? "No camera found. Use Upload photo instead."
            : cause instanceof DOMException && cause.name === "NotReadableError"
              ? "The camera is in use by another app. Close Zoom/Photo Booth and retry."
              : cause instanceof Error
                ? cause.message
                : "Could not start the camera.";
      setError(message);
      setStatus("error");
      statusRef.current = "error";
      setStatusMessage("Camera error");
    }
  }, [startLoop, clearToneLock]);

  const stop = useCallback(() => {
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
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    setStatus("idle");
    statusRef.current = "idle";
    setStatusMessage("Camera off");
    faceDetectedRef.current = false;
    setFaceDetected(false);
    setFps(0);
    smoothedRef.current = null;
    frameTimesRef.current = [];
    photoFaceRef.current = null;
    setPhotoSrc(null);
    setSourceMode("camera");
    clearToneLock();
  }, [clearToneLock]);

  stopRef.current = stop;

  const reset = useCallback(() => {
    stop();
    setSkin(null);
    setSampleCount(0);
    setError(null);
    setLastSampleAt(null);
    setFrozen(false);
    frozenRef.current = false;
    setCopied(false);
  }, [stop]);
  const resetToneLock = useCallback(() => {
    clearToneLock();
    setSkin(null);
    setSampleCount(0);
    setLastSampleAt(null);
    setFrozen(false);
    frozenRef.current = false;
    setCopied(false);
    lastSampleRef.current = 0;
    setStatusMessage(
      statusRef.current === "photo"
        ? "Upload a new photo or start the camera"
        : "Re-reading…",
    );
  }, [clearToneLock]);


  const snapshot = useMemo<ToneSnapshot>(
    () => ({
      engine: "MediaPipe FaceLandmarker 1.1.1 · on-device WASM/WebGL",
      source: sourceMode,
      capturedAt: lastSampleAt ? new Date(lastSampleAt).toISOString() : null,
      faceDetected,
      fps,
      samples: sampleCount,
      toneLocked,
      stability,
      stableSamples,
      skin: skin
        ? {
            hex: skin.hex,
            lab: skin.lab,
            ita: skin.ita,
            depth: skin.depth,
            undertone: skin.undertone,
            undertoneNote: skin.undertoneNote,
            chroma: skin.chroma,
            hue: skin.hue,
            fitzpatrick: skin.fitzpatrick,
            season: skin.season.name,
            seasonPalette: skin.season.palette.map((colour) => colour.hex),
            confidence: skin.confidence,
          }
        : null,
      quality: skin?.quality ?? null,
    }),
    [faceDetected, fps, sampleCount, skin, lastSampleAt, sourceMode, toneLocked, stability, stableSamples],
  );

  const copyJSON = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }, [snapshot]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return {
    videoRef,
    canvasRef,
    status,
    sourceMode,
    photoSrc,
    statusMessage,
    error,
    skin,
    fps,
    faceDetected,
    sampleCount,
    frozen,
    toneLocked,
    stability,
    stableSamples,
    copied,
    lastSampleAt,
    snapshot,
    start,
    stop,
    readPhoto,
    reset,
    resetToneLock,
    setFrozen,
    copyJSON,
    detectMs,
    sampleMs,
    analyzeMs,
    delegate,
    showMesh,
    setShowMesh,
  };
}

export type ToneLab = ReturnType<typeof useToneLab>;
