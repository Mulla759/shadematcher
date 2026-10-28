"use client";

import { useRef } from "react";
import {
  Aperture,
  Camera,
  CameraOff,
  Download,
  ImagePlus,
  Loader2,
  RefreshCcw,
  ScanFace,
  Sparkles,
  Upload,
} from "lucide-react";
import { FABRICS } from "@/lib/catalog";
import { HijabStudy } from "@/components/brand/HijabStudy";
import type { FaceStudio } from "./useFaceStudio";
import { SwatchChip } from "./Atoms";

const DECK_IDS = [
  "f28", "f14", "f57", "f41", "f55", "f21", "f42", "f54", "f06", "f26", "f50", "f45",
  "f13", "f31", "f36", "f43", "f51", "f63", "f11", "f02", "f18", "f33", "f48", "f69",
];

export function MirrorStage({ studio }: { studio: FaceStudio }) {
  const uploadRef = useRef<HTMLInputElement>(null);
  const deck = DECK_IDS.map((id) => FABRICS.find((fabric) => fabric.id === id)!).filter(Boolean);
  const showEmpty = studio.mode === "idle" && !studio.photoSrc;

  return (
    <div>
      <div className="mirror-wrap">
        <div className="mirror-status-row">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span className="mirror-badge mono">
              <span className={`status-dot ${studio.cameraState === "live" ? "live" : ""}`} />
              {studio.cameraState === "live"
                ? "Live"
                : studio.mode === "photo"
                  ? "Still photo"
                  : studio.cameraState === "loading"
                    ? "Loading model"
                    : "Camera off"}
            </span>
            <span className="mirror-badge mono">
              {studio.faceDetected ? "Face locked" : "No face"}
            </span>
          </div>
          <span
            className="mono"
            style={{
              color:
                studio.liveNote.tone === "good"
                  ? "var(--ok)"
                  : studio.liveNote.tone === "warn"
                    ? "var(--saffron)"
                    : "var(--danger)",
              textAlign: "right",
            }}
          >
            {studio.liveNote.label}
          </span>
        </div>
        <div className="mirror-frame">
          <video
            ref={studio.videoRef}
            className="mirror-media"
            autoPlay
            playsInline
            muted
            style={{ opacity: studio.mode === "camera" ? 1 : 0 }}
          />
          {studio.photoSrc && (
            <img
              className="mirror-photo"
              src={studio.photoSrc}
              alt="Your uploaded portrait"
              style={{ opacity: studio.mode === "photo" ? 1 : 0 }}
            />
          )}
          <canvas
            ref={studio.canvasRef}
            className={`mirror-canvas ${studio.mode === "photo" ? "static" : ""}`}
            style={{ opacity: studio.mode === "idle" ? 0 : 1 }}
          />

          {showEmpty && (
            <div className="mirror-empty">
              <div className="mirror-empty-inner">
                <div style={{ width: 150, margin: "0 auto 8px" }}>
                  <div
                    style={{
                      width: 150,
                      height: 190,
                      borderRadius: "999px 999px 4px 4px",
                      overflow: "hidden",
                      border: "1px solid var(--line)",
                      background: "var(--paper-2)",
                    }}
                  >
                    <HijabStudy colour={studio.previewColour} name="Your preview" finish="Satin" />
                  </div>
                </div>
                <h2>Your face, your frame.</h2>
                <p>
                  Enable the camera for a live preview, or upload a front-facing portrait. Skin
                  samples stay on this device unless you ask the API for a reading.
                </p>
                <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                  <button type="button" className="btn btn-primary btn-sm" onClick={studio.startCamera}>
                    <Camera size={14} strokeWidth={1.6} />
                    Enable camera
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => uploadRef.current?.click()}
                  >
                    <Upload size={14} strokeWidth={1.6} />
                    Upload photo
                  </button>
                </div>
                <div className="demo-row">
                  <span className="mono">Or try a demo portrait</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    {["portrait-01.jpg", "portrait-02.jpg", "portrait-03.jpg"].map((name) => (
                      <button
                        key={name}
                        type="button"
                        className="demo-thumb"
                        title="Load a demo portrait"
                        onClick={() => void studio.readPhotoUrl(`/demo/${name}`)}
                      >
                        <img src={`/demo/${name}`} alt="" />
                      </button>
                    ))}
                  </div>
                  <span className="tiny muted">Unsplash demo images</span>
                </div>
              </div>
            </div>
          )}

          {studio.scanning && <div className="scan-line" />}

          {studio.mode !== "idle" && studio.coverageEnabled && (
            <div
              className="mirror-badge mono"
              style={{ position: "absolute", bottom: 20, left: 20, zIndex: 4 }}
            >
              {studio.segmenterState === "ready"
                ? studio.hairCoverageValue !== null
                  ? `Hair cover ${Math.round(studio.hairCoverageValue * 100)}%`
                  : "Measuring cover"
                : studio.segmenterState === "loading"
                  ? "Loading mask"
                  : "Mask unavailable"}
            </div>
          )}
        </div>

        <div className="mirror-caption">
          <span className="mono">
            {studio.mode === "photo" ? "Photo preview" : "Live preview"} · colour is a
            visualization
          </span>
          <span className="mono" style={{ color: "var(--ink-3)" }}>
            {studio.sampleCount > 0 ? `${studio.sampleCount} skin px` : "No sample yet"}
          </span>
        </div>
      </div>

      {(studio.error || studio.apiError) && (
        <div
          className="warning"
          style={{ marginTop: 12, fontSize: 12, display: "flex", justifyContent: "space-between", gap: 12 }}
          role="alert"
        >
          <span>{studio.error ?? studio.apiError}</span>
          <button type="button" className="text-link" style={{ flex: "none" }} onClick={studio.reset}>
            Reset
          </button>
        </div>
      )}

      <div className="studio-tools">
        <div>
          <div className="style-tabs" role="group" aria-label="Drape style">
            {(["classic", "turkish", "modal"] as const).map((style) => (
              <button
                key={style}
                type="button"
                className="style-tab"
                data-active={studio.style === style}
                onClick={() => studio.setStyle(style)}
              >
                {style}
              </button>
            ))}
          </div>
          <div className="mono" style={{ marginTop: 6, color: "var(--ink-3)" }}>
            {studio.style === "classic"
              ? "Volume at the sides, soft shoulder fall"
              : studio.style === "turkish"
                ? "Slimmer, peaked crown, longer front"
                : "Close to the head, rounded everyday drape"}
          </div>
        </div>
        <div style={{ display: "grid", gap: 6, minWidth: 190 }}>
          <div className="control-group">
            <span className="control-label">Sheen</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={studio.sheen}
              onChange={(event) => studio.setSheen(Number(event.target.value))}
              aria-label="Fabric sheen"
            />
          </div>
          <div className="control-group">
            <span className="control-label">Cover</span>
            <input
              type="range"
              min={0.72}
              max={1}
              step={0.01}
              value={studio.coverage}
              onChange={(event) => studio.setCoverage(Number(event.target.value))}
              aria-label="Fabric coverage"
            />
          </div>
        </div>
      </div>

      <div className="fabric-deck" aria-label="Fabric colour deck">
        {deck.map((fabric) => (
          <SwatchChip
            key={fabric.id}
            hex={fabric.hex}
            name={`${fabric.name} · ${fabric.finish}`}
            active={studio.previewColour.toUpperCase() === fabric.hex.toUpperCase()}
            onClick={() => studio.setPreviewColour(fabric.hex)}
          />
        ))}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginTop: 10,
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-accent"
            onClick={() => studio.runReading()}
            disabled={studio.scanning || studio.sampleCount === 0}
          >
            {studio.scanning ? (
              <Loader2 size={15} className="spinner" style={{ border: 0 }} />
            ) : (
              <Aperture size={15} strokeWidth={1.7} />
            )}
            {studio.scanning ? "Reading…" : "Take reading"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => uploadRef.current?.click()}
          >
            <ImagePlus size={15} strokeWidth={1.7} />
            Photo
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={studio.mode === "camera" ? studio.stopCamera : studio.startCamera}
          >
            {studio.mode === "camera" ? (
              <>
                <CameraOff size={15} strokeWidth={1.7} />
                Stop
              </>
            ) : (
              <>
                <Camera size={15} strokeWidth={1.7} />
                Camera
              </>
            )}
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {studio.frozen && (
            <button type="button" className="btn btn-quiet" onClick={studio.resumeLive}>
              <Sparkles size={13} strokeWidth={1.6} />
              Resume live
            </button>
          )}
          <button
            type="button"
            className={`btn btn-quiet ${studio.coverageEnabled ? "btn-ghost" : ""}`}
            onClick={() => studio.setCoverageEnabled(!studio.coverageEnabled)}
            title="Run head/hair segmentation to measure how much hair the drape covers"
          >
            <ScanFace size={13} strokeWidth={1.6} />
            {studio.coverageEnabled ? "Coverage on" : "Coverage check"}
          </button>
          <button type="button" className="btn btn-quiet" onClick={studio.reset} title="Reset the studio">
            <RefreshCcw size={13} strokeWidth={1.6} />
            Reset
          </button>
        </div>
      </div>

      {studio.savedShot && (
        <div className="save-strip" style={{ marginTop: 12 }}>
          <img className="saved-thumb" src={studio.savedShot} alt="Saved look thumbnail" />
          <div>
            <div className="mono muted">Look saved in this tab</div>
            <div className="small">The reading is stored locally; the image is not uploaded.</div>
          </div>
          <button type="button" className="btn btn-quiet btn-sm" onClick={studio.downloadShot}>
            <Download size={13} strokeWidth={1.6} />
            Download
          </button>
        </div>
      )}

      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void studio.readPhoto(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}
