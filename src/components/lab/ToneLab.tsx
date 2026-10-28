"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Braces,
  Camera,
  CameraOff,
  Check,
  Copy,
  Cpu,
  Eye,
  Pause,
  Play,
  RotateCcw,
  RefreshCw,
  ScanFace,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { FABRICS } from "@/lib/catalog";
import { useToneLab } from "./useToneLab";
import { ConfidencePill } from "@/components/studio/Atoms";

function labelFor(value: string): string {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

export function ToneLab() {
  const lab = useToneLab({ mesh: true });
  const skin = lab.skin;

  const handoff = skin
    ? {
        engine: `MediaPipe FaceLandmarker 1.1.1 · on-device ${lab.delegate === "unknown" ? "WASM" : lab.delegate}`,
        capturedAt: lab.lastSampleAt ? new Date(lab.lastSampleAt).toISOString() : null,
        samples: lab.sampleCount,
        toneLocked: lab.toneLocked,
        stability: lab.stability,
        stableSamples: lab.stableSamples,
        compute: {
          delegate: lab.delegate,
          detectMs: lab.detectMs,
          sampleMs: lab.sampleMs,
          analyzeMs: lab.analyzeMs,
          fps: lab.fps,
        },
        skin: {
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
        },
        quality: skin.quality,
      }
    : null;

  const depthPosition = skin ? Math.min(97, Math.max(3, ((skin.ita + 60) / 140) * 100)) : 50;

  return (
    <div className="lab-body">
      <div className="studio-topbar">
        <div className="shell studio-topbar-inner">
          <Logo compact />
          <div className="studio-status">
            <span className={`status-dot ${lab.status === "live" ? "live" : ""}`} />
            <span className="mono" style={{ color: "var(--ink-3)" }}>
              Lab 00 · raw tone capability
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span className="mono" style={{ color: "var(--ink-3)", display: "flex", gap: 6, alignItems: "center" }}>
              <ShieldCheck size={12} strokeWidth={1.7} />
              On-device
            </span>
            <Link className="text-link" href="/studio">
              <ArrowLeft size={13} strokeWidth={1.6} />
              Studio
            </Link>
          </div>
        </div>
      </div>

      <div className="lab-shell">
        <div className="lab-intro">
          <div>
            <p className="eyebrow mono">Raw capability · no hijab, no catalog</p>
            <h1 className="display lab-title">
              Webcam in. <span className="italic">Tone out.</span>
            </h1>
            <p className="small muted" style={{ maxWidth: "62ch", marginTop: 10 }}>
              This page does one job: open the camera, run a 478-point face mesh in the browser,
              sample skin patches, and print a stable CIELAB reading. No image upload, no server
              GPU, no LLM in the loop. The JSON at the bottom is the handoff for the next layer.
            </p>
          </div>
          <div className="lab-intro-meta mono">
            <div>ENGINE / MEDIAPIPE TASKS</div>
            <div>COMPUTE / CPU + WEBGL</div>
            <div>NETWORK / LOCAL ONLY</div>
          </div>
        </div>

        <div className="lab-grid">
          <div className="lab-stage">
            <div className="lab-frame">
              <video ref={lab.videoRef} className="lab-video" autoPlay playsInline muted />
              <canvas ref={lab.canvasRef} className="lab-canvas" />
              <div className="lab-frame-grid" aria-hidden="true" />
              <div className="lab-hud top-left mono">
                <span className={`status-dot ${lab.status === "live" ? "live" : ""}`} />
                {lab.status === "live" ? "CAM 01 · LIVE" : lab.status === "loading" ? "CAM 01 · STARTING" : "CAM 01 · OFF"}
              </div>
              <div className="lab-hud top-right mono">
                {lab.faceDetected ? "478 / LOCKED" : "478 / SEARCHING"} · {lab.fps} FPS
              </div>
              <div className="lab-hud bottom-left mono">
                {lab.status === "live" ? (lab.frozen ? "READING FROZEN" : "READING LIVE") : lab.statusMessage}
              </div>
              <div className="lab-hud bottom-right mono">
                {lab.delegate} · {lab.detectMs}MS
              </div>

              {lab.status !== "live" && (
                <div className="lab-empty">
                  <ScanFace size={34} strokeWidth={1.2} />
                  <h2>{lab.status === "loading" ? "Loading the face mesh…" : "The camera is off."}</h2>
                  <p>
                    Allow camera access for <strong>localhost</strong>. The first start downloads
                    the 3.6 MB face model and caches it.
                  </p>
                  <button type="button" className="btn btn-primary" onClick={lab.start} disabled={lab.status === "loading"}>
                    <Camera size={15} strokeWidth={1.7} />
                    {lab.status === "loading" ? "Starting…" : "Start camera"}
                  </button>
                  {lab.error && <div className="lab-error">{lab.error}</div>}
                </div>
              )}
            </div>

            <div className="lab-actions">
              {lab.status === "live" && (
                <button type="button" className="btn btn-primary" onClick={lab.stop}>
                  <CameraOff size={15} strokeWidth={1.7} />
                  Stop camera
                </button>
              )}
              <button type="button" className="btn btn-ghost" onClick={() => lab.setFrozen(!lab.frozen)} disabled={!skin}>
                {lab.frozen ? <Play size={15} strokeWidth={1.7} /> : <Pause size={15} strokeWidth={1.7} />}
                {lab.frozen ? "Resume reading" : "Freeze reading"}
              </button>
              <button type="button" className="btn btn-quiet" onClick={lab.resetToneLock} disabled={!skin}>
                <RefreshCw size={14} strokeWidth={1.7} />
                Re-read
              </button>
              <button type="button" className="btn btn-quiet" onClick={lab.copyJSON} disabled={!skin}>
                {lab.copied ? <Check size={14} strokeWidth={1.7} /> : <Copy size={14} strokeWidth={1.7} />}
                {lab.copied ? "Copied" : "Copy JSON"}
              </button>
              <button type="button" className="btn btn-quiet" onClick={lab.reset}>
                <RotateCcw size={14} strokeWidth={1.7} />
                Reset
              </button>
            </div>
          </div>

          <aside className="lab-readout">
            <div className="panel-head">
              <div>
                <p className="mono muted" style={{ margin: "0 0 6px" }}>
                  {lab.frozen
                    ? "Frozen reading"
                    : lab.toneLocked
                      ? "Tone locked"
                      : `Settling ${lab.stableSamples}/3`}{" "}
                  · {lab.sampleCount} px
                </p>
                <h2 className="panel-title">Skin tone</h2>
              </div>
              <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
                {skin ? (
                  <ConfidencePill label={skin.confidence.label} level={skin.confidence.label} />
                ) : (
                  <span className="confidence" data-level="low">
                    Awaiting face
                  </span>
                )}
                {skin && (
                  <span className="mono" style={{ color: lab.toneLocked ? "var(--ok)" : "var(--ink-3)" }}>
                    {lab.toneLocked ? "TONE LOCKED" : `SETTLING ${lab.stableSamples}/3`}
                  </span>
                )}
              </div>
            </div>

            {skin ? (
              <>
                <div className="lab-skin">
                  <div className="lab-swatch" style={{ background: skin.hex }} />
                  <div>
                    <div className="lab-hex mono">{skin.hex}</div>
                    <div className="lab-tone">
                      {skin.depthLabel} · {skin.undertoneLabel}
                    </div>
                    <div className="tiny muted" style={{ marginTop: 4 }}>
                      {skin.undertoneNote}
                    </div>
                  </div>
                </div>

                <div className="lab-stats">
                  <div>
                    <span>ITA°</span>
                    <strong>{skin.ita.toFixed(1)}</strong>
                  </div>
                  <div>
                    <span>Chroma</span>
                    <strong>{skin.chroma.toFixed(1)}</strong>
                  </div>
                  <div>
                    <span>Hue</span>
                    <strong>{skin.hue.toFixed(1)}°</strong>
                  </div>
                  <div>
                    <span>Season</span>
                    <strong style={{ fontSize: 11 }}>{skin.season.name}</strong>
                  </div>
                  <div>
                    <span>Fitzpatrick</span>
                    <strong>~{skin.fitzpatrick}</strong>
                  </div>
                  <div>
                    <span>Spread</span>
                    <strong>{skin.spread.toFixed(1)} ΔE</strong>
                  </div>
                </div>

                <div className="lab-compute">
                  <span className="mono">Compute</span>
                  <span className="mono">
                    {lab.delegate} · detect {lab.detectMs}ms · sample {lab.sampleMs}ms · analyse{" "}
                    {lab.analyzeMs}ms · {lab.fps} FPS
                  </span>
                </div>
                {lab.delegate === "CPU" && lab.fps < 10 && (
                  <p className="tiny" style={{ color: "var(--danger)", margin: "6px 0 0" }}>
                    CPU fallback is active. Close other apps and use Chrome/Edge with WebGL2; a GPU
                    delegate should bring the mesh to 15–30 fps. The reading still updates at ~1 Hz.
                  </p>
                )}

                <div className="depth-scale">
                  <div className="depth-track">
                    <span className="depth-marker" style={{ left: `${depthPosition}%` }} />
                  </div>
                  <div className="depth-labels">
                    <span>Rich</span>
                    <span>Tan</span>
                    <span>Medium</span>
                    <span>Light</span>
                    <span>Very light</span>
                  </div>
                </div>

                <div className="lab-quality">
                  <div className="section-mini-head" style={{ marginTop: 18 }}>
                    <h3>Reading quality</h3>
                    <span className="mono muted">{skin.confidence.score}/100</span>
                  </div>
                  {Object.entries(skin.confidence.factors).map(([key, factor]) => (
                    <div className="lab-bar-row" key={key}>
                      <span className="mono muted">{labelFor(key)}</span>
                      <span className="score-bar" style={{ width: "100%" }}>
                        <i style={{ width: `${factor.score}%` }} />
                      </span>
                      <span className="mono">{factor.score}</span>
                    </div>
                  ))}
                </div>

                <div className="season-strip" aria-label="Season palette">
                  {skin.season.palette.map((colour) => (
                    <i key={colour.name} style={{ background: colour.hex }} title={colour.name} />
                  ))}
                </div>

                {skin.warnings.length > 0 && (
                  <div className="warning-list">
                    {skin.warnings.slice(0, 2).map((warning) => (
                      <div className="warning" key={warning}>
                        <Eye size={12} strokeWidth={1.7} style={{ flex: "none", marginTop: 1 }} />
                        <span>{warning}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="lab-wait">
                <div className="mono muted">Waiting for a stable read</div>
                <ol className="start-steps" style={{ marginTop: 12 }}>
                  <li>
                    <b>01</b>
                    <div>
                      <strong>Start the camera</strong>
                      <p>Allow camera access for localhost. No upload happens.</p>
                    </div>
                  </li>
                  <li>
                    <b>02</b>
                    <div>
                      <strong>Fill the frame</strong>
                      <p>Front-facing, even light, whole face inside the box.</p>
                    </div>
                  </li>
                  <li>
                    <b>03</b>
                    <div>
                      <strong>Read the JSON</strong>
                      <p>The same payload can feed the shade engine or an agent.</p>
                    </div>
                  </li>
                </ol>
                <div className="lab-palette-preview">
                  {FABRICS.slice(0, 8).map((fabric) => (
                    <i key={fabric.id} style={{ background: fabric.hex }} />
                  ))}
                </div>
              </div>
            )}

            <div className="section-mini-head">
              <h3>Handoff JSON</h3>
              <span className="mono muted">for the next layer</span>
            </div>
            <div className="lab-json">
              <div className="code-label">
                <span className="mono">reading.json</span>
                <span className="mono" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <Braces size={11} />
                  {handoff ? "ready" : "empty"}
                </span>
              </div>
              <pre>{handoff ? JSON.stringify(handoff, null, 2) : "// start the camera to generate a reading"}</pre>
            </div>

            <div className="lab-note">
              <Cpu size={14} strokeWidth={1.6} />
              <p>
                <strong>No GPU worker in this path.</strong> The browser runs the mesh and the
                colour maths. A server GPU becomes useful only for photoreal rendering, heavier
                segmentation, or low-end devices — behind the same JSON contract.
              </p>
            </div>

            <div className="lab-note">
              <Sparkles size={14} strokeWidth={1.6} />
              <p>
                <strong>LLM handoff.</strong> Send <code>reading.json</code> to an agent to
                generate copy, pick a palette, or explain the result. The model never needs the
                webcam frame.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
