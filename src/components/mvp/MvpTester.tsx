"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, CameraOff, Check, Copy, Loader2, RefreshCw, RotateCcw, Send, Upload } from "lucide-react";
import { useToneLab } from "@/components/lab/useToneLab";
import { recommendFabrics } from "@/lib/match";
import { FABRICS } from "@/lib/catalog";
import { readableInk } from "@/lib/color";
import type { MatchResult } from "@/lib/api/engine";

const DEFAULTS = ["f28", "f14", "f57", "f41", "f55", "f21"]
  .map((id) => FABRICS.find((fabric) => fabric.id === id))
  .filter((fabric): fabric is (typeof FABRICS)[number] => Boolean(fabric));

export function MvpTester() {
  const lab = useToneLab({ mesh: true });
  const uploadRef = useRef<HTMLInputElement>(null);
  const [activeHex, setActiveHex] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiResult, setApiResult] = useState<MatchResult | null>(null);

  const best = useMemo(
    () => (lab.skin ? recommendFabrics(lab.skin, { limit: 6, category: "hijab" }).best : []),
    [lab.skin],
  );
  const active = best.find((match) => match.colour.hex === activeHex) ?? best[0] ?? null;
  const activeHexValue = active?.colour.hex ?? DEFAULTS[0]?.hex ?? "#C8892B";
  const activeName = active?.colour.name ?? DEFAULTS[0]?.name ?? "Saffron";
  const activeScore = active ? Math.round(active.score) : null;

  // A new top match should become the default card, not leave a stale manual
  // selection from the previous reading.
  const topHex = best[0]?.colour.hex ?? null;
  useEffect(() => {
    setActiveHex(null);
  }, [topHex]);

  useEffect(() => {
    setApiResult(null);
    setApiError(null);
  }, [lab.skin?.hex, lab.toneLocked]);

  const handoff = useMemo(
    () => ({
      ...lab.snapshot,
      recommended: best.map((match) => ({
        name: match.colour.name,
        hex: match.colour.hex,
        score: Math.round(match.score),
        verdict: match.verdict,
        reason: match.reasons[0],
      })),
    }),
    [lab.snapshot, best],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(handoff, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  async function runApi() {
    if (!lab.skin) return;
    setApiLoading(true);
    setApiError(null);
    const started = performance.now();
    try {
      const samples = [
        { lab: lab.skin.lab, region: "leftCheek" as const, weight: 1 },
        { lab: lab.skin.lab, region: "rightCheek" as const, weight: 1 },
        { lab: lab.skin.lab, region: "forehead" as const, weight: 1 },
      ];
      const response = await fetch("/api/v1/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          face: { samples, quality: lab.skin.quality },
          options: {
            category: "hijab",
            limit: 6,
            foundationLimit: 5,
            includeFoundations: true,
            includePreview: false,
          },
        }),
      });
      const body = (await response.json()) as MatchResult | { ok: false; error: { message: string } };
      if (!response.ok || !("ok" in body) || !body.ok) {
        throw new Error("error" in body ? body.error.message : "API match failed.");
      }
      // Let the scan/reveal animation be perceptible even when the engine is fast.
      const remaining = 700 - (performance.now() - started);
      if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
      setApiResult(body);
    } catch (cause) {
      setApiError(cause instanceof Error ? cause.message : "API match failed.");
    } finally {
      setApiLoading(false);
    }
  }

  function reRead() {
    setApiResult(null);
    setApiError(null);
    setActiveHex(null);
    if (lab.sourceMode === "photo") {
      uploadRef.current?.click();
      return;
    }
    lab.resetToneLock();
  }

  return (
    <div className="mvp">
      <header className="mvp-bar">
        <div className="mvp-bar-inner">
          <strong>AURIGA / MVP TEST</strong>
          <span className="mono muted">webcam → skin tone → colour box</span>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <Link className="mono" href="/lab">
              raw lab
            </Link>
          </div>
        </div>
      </header>

      <main className="mvp-shell">
        <div className="mvp-grid">
          <section className="mvp-camera">
            <div
              className={`mvp-colour-box ${apiLoading ? "matching" : ""} ${apiResult ? "matched" : ""}`}
              key={apiResult?.requestId ?? "live"}
            >
              {apiLoading && (
                <div className="mvp-match-overlay">
                  <span className="mvp-match-pill">
                    <span className="spinner" />
                    Matching 6 tones…
                  </span>
                </div>
              )}
              <div
                className="mvp-colour-main"
                style={{ background: activeHexValue, color: readableInk(activeHexValue) }}
              >
                <div className="mono" style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span>Best colour · above the frame</span>
                  <span>
                    {apiLoading
                      ? "MATCHING…"
                      : apiResult
                        ? `MATCH · ${apiResult.latencyMs}MS`
                        : lab.skin
                          ? lab.toneLocked
                            ? "TONE LOCKED"
                            : `SETTLING ${lab.stableSamples}/3`
                          : "WAITING"}
                  </span>
                </div>
                <div className="mvp-colour-name">{activeName}</div>
                <div className="mono">
                  {activeHexValue}
                  {activeScore !== null ? ` · ${activeScore}/100` : " · start camera to rank"}
                </div>
              </div>
              <div className="mvp-lockbar" aria-hidden="true">
                <i style={{ width: `${Math.round(lab.stability * 100)}%` }} />
              </div>
              <div className="mvp-colour-row">
                {(best.length > 0 ? best : DEFAULTS.map((colour) => ({ colour, score: null }))).map(
                  (item) => {
                    const colour = "colour" in item ? item.colour : item;
                    const score = "score" in item ? item.score : null;
                    return (
                      <button
                        key={colour.id}
                        type="button"
                        className="mvp-swatch"
                        data-active={activeHexValue.toUpperCase() === colour.hex.toUpperCase()}
                        onClick={() => setActiveHex(colour.hex)}
                        title={`${colour.name}${score ? ` · ${Math.round(score)}/100` : ""}`}
                      >
                        <span style={{ background: colour.hex }} />
                        <span className="mvp-swatch-label">
                          {colour.name}
                          <br />
                          {score ? `${Math.round(score)}/100` : "——"}
                        </span>
                      </button>
                    );
                  },
                )}
              </div>
            </div>

            <div className="mvp-video-wrap">
              <video
                ref={lab.videoRef}
                className="mvp-video"
                autoPlay
                playsInline
                muted
                style={{ opacity: lab.sourceMode === "photo" ? 0 : 1 }}
              />
              {lab.photoSrc && <img className="mvp-photo" src={lab.photoSrc} alt="Uploaded portrait" />}
              <canvas
                ref={lab.canvasRef}
                className={`mvp-canvas ${lab.sourceMode === "photo" ? "static" : ""}`}
              />
              <div className="mvp-hud left mono">
                <span className={`status-dot ${lab.status === "live" ? "live" : ""}`} />
                {lab.status === "live"
                  ? "LIVE"
                  : lab.status === "photo"
                    ? "PHOTO"
                    : lab.status === "loading"
                      ? "LOADING"
                      : "OFF"}
              </div>
              <div className="mvp-hud right mono">
                {lab.sourceMode === "photo"
                  ? `PHOTO · ${lab.delegate}`
                  : `${lab.faceDetected ? "FACE" : "SEARCH"} · ${lab.fps} FPS · ${lab.delegate}`}
              </div>

              {lab.status !== "live" && lab.status !== "photo" && (
                <div className="mvp-start">
                  <Camera size={30} strokeWidth={1.3} />
                  <h1>{lab.status === "loading" ? "Loading face mesh…" : "Camera off"}</h1>
                  <p>Allow camera access for localhost, or upload a still portrait.</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                    <button type="button" className="btn btn-primary" onClick={lab.start} disabled={lab.status === "loading"}>
                      <Camera size={15} strokeWidth={1.7} />
                      Start camera
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => uploadRef.current?.click()}
                      style={{ color: "var(--paper)", borderColor: "rgba(242,236,225,.35)" }}
                    >
                      <Upload size={15} strokeWidth={1.7} />
                      Upload photo
                    </button>
                  </div>
                  {lab.error && <div className="mvp-error">{lab.error}</div>}
                </div>
              )}
            </div>

            <div className="mvp-actions">
              {lab.status === "live" && (
                <button type="button" className="btn btn-ghost" onClick={lab.stop}>
                  <CameraOff size={15} strokeWidth={1.7} />
                  Stop
                </button>
              )}
              {lab.sourceMode === "photo" && (
                <button type="button" className="btn btn-ghost" onClick={lab.start} disabled={lab.status === "loading"}>
                  <Camera size={15} strokeWidth={1.7} />
                  Use camera
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => uploadRef.current?.click()}
                disabled={lab.status === "loading"}
              >
                <Upload size={15} strokeWidth={1.7} />
                Upload photo
              </button>
              <button
                type="button"
                className="btn btn-quiet"
                onClick={reRead}
                disabled={!lab.skin && lab.sourceMode !== "photo"}
              >
                <RefreshCw size={14} />
                {lab.sourceMode === "photo" ? "Replace photo" : "Re-read tone"}
              </button>
              <button
                type="button"
                className="btn btn-accent"
                onClick={runApi}
                disabled={!lab.skin || apiLoading || !lab.toneLocked}
                title={!lab.toneLocked ? "Hold still until the tone locks" : undefined}
              >
                {apiLoading ? <Loader2 size={15} className="spinner" style={{ border: 0 }} /> : <Send size={15} strokeWidth={1.7} />}
                {apiLoading ? "Calling…" : !lab.skin ? "Run API match" : lab.toneLocked ? "Run API match" : "Locking…"}
              </button>
              <button type="button" className="btn btn-quiet" onClick={copy} disabled={!lab.skin}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy JSON"}
              </button>
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => {
                  lab.reset();
                  setApiResult(null);
                  setApiError(null);
                  setActiveHex(null);
                }}
              >
                <RotateCcw size={14} />
                Reset
              </button>
              <button
                type="button"
                className={`btn btn-quiet ${lab.showMesh ? "btn-ghost" : ""}`}
                onClick={() => lab.setShowMesh(!lab.showMesh)}
              >
                {lab.showMesh ? "Hide mesh" : "Show mesh"}
              </button>
              <span className="mono muted" style={{ marginLeft: "auto" }}>
                {lab.statusMessage}
              </span>
            </div>

            {lab.sourceMode === "photo" && lab.error && <div className="mvp-warning">{lab.error}</div>}

            <p className="mvp-hint">
              Camera or still photo. Hold still for three stable readings and the tone locks. No
              hood is drawn on your head; the colour comparison lives in the box above the frame.
            </p>

            <input
              ref={uploadRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void lab.readPhoto(file);
                event.target.value = "";
              }}
            />
          </section>

          <aside className="mvp-readout">
            <div className="mvp-readout-head">
              <span className="mono muted">Skin reading</span>
              <span className="mono">
                {lab.skin ? `Score ${lab.skin.confidence.score}/100 · ${lab.skin.confidence.label}` : "waiting"}
              </span>
            </div>
            <div
              className="mono"
              style={{
                marginTop: 6,
                color: lab.toneLocked ? "var(--ok)" : lab.skin ? "var(--saffron)" : "var(--ink-3)",
              }}
            >
              {lab.toneLocked
                ? "Tone locked · stable reading"
                : lab.skin
                  ? `Settling ${lab.stableSamples}/3 · hold still`
                  : "Waiting for a face"}
            </div>

            {lab.skin ? (
              <>
                <div className="mvp-skin">
                  <span className="mvp-skin-swatch" style={{ background: lab.skin.hex }} />
                  <div>
                    <div className="mvp-hex">{lab.skin.hex}</div>
                    <div className="mvp-tone">
                      {lab.skin.depthLabel} · {lab.skin.undertoneLabel}
                    </div>
                    <div className="tiny muted" style={{ marginTop: 3 }}>
                      {lab.skin.undertoneNote}
                    </div>
                  </div>
                </div>

                <dl className="mvp-facts">
                  <div>
                    <dt>L* lightness</dt>
                    <dd>{lab.skin.lab.l.toFixed(1)}</dd>
                  </div>
                  <div>
                    <dt>a* red-green</dt>
                    <dd>{lab.skin.lab.a.toFixed(1)}</dd>
                  </div>
                  <div>
                    <dt>b* yellow-blue</dt>
                    <dd>{lab.skin.lab.b.toFixed(1)}</dd>
                  </div>
                  <div>
                    <dt>C* chroma</dt>
                    <dd>{lab.skin.chroma.toFixed(1)}</dd>
                  </div>
                  <div>
                    <dt>h° hue</dt>
                    <dd>{lab.skin.hue.toFixed(1)}°</dd>
                  </div>
                  <div>
                    <dt>ITA°</dt>
                    <dd>{lab.skin.ita.toFixed(1)}</dd>
                  </div>
                  <div>
                    <dt>Season</dt>
                    <dd>{lab.skin.season.name}</dd>
                  </div>
                  <div>
                    <dt>Fitzpatrick</dt>
                    <dd>~{lab.skin.fitzpatrick}</dd>
                  </div>
                  <div>
                    <dt>Spread</dt>
                    <dd>{lab.skin.spread.toFixed(1)} ΔE</dd>
                  </div>
                </dl>
                <p className="tiny muted" style={{ margin: "8px 0 0" }}>
                  ITA° is an angle, not the 0–100 reading score. The score is the confidence badge
                  above; the Lab values are the raw measurement behind it.
                </p>

                <div className="mvp-quality">
                  <span className="mono muted">Quality</span>
                  <span className="mono">
                    {lab.sourceMode === "photo"
                      ? `photo read · ${lab.sampleMs}ms sample · ${lab.sampleCount} px`
                      : `${lab.detectMs}ms detect · ${lab.sampleMs}ms sample · ${lab.fps} FPS`}
                  </span>
                </div>

                {lab.skin.warnings.length > 0 && (
                  <div className="mvp-warning">{lab.skin.warnings[0]}</div>
                )}

                {apiResult && (
                  <div className="mvp-api" key={apiResult.requestId}>
                    <div className="mono">API / {apiResult.latencyMs}ms</div>
                    <strong>{apiResult.colour.best[0]?.colour.name ?? "—"}</strong>
                    <span className="tiny muted">
                      score {apiResult.colour.best[0] ? Math.round(apiResult.colour.best[0].score) : "—"} ·
                      request {apiResult.requestId.slice(0, 8)}
                    </span>
                  </div>
                )}
                {apiError && <div className="mvp-warning">{apiError}</div>}
              </>
            ) : (
              <div className="mvp-empty">
                <p>Start the camera and hold your face in the frame.</p>
                <ol>
                  <li>Even light, front-facing.</li>
                  <li>Wait for “FACE” and the tone swatch.</li>
                  <li>The top six colours appear in the box above.</li>
                </ol>
              </div>
            )}

            <div className="mvp-json">
              <div className="mono" style={{ marginBottom: 6, color: "rgba(242,236,225,.45)" }}>
                reading.json
              </div>
              <pre>{JSON.stringify(handoff, null, 2)}</pre>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
