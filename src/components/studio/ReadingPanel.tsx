"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  ImagePlus,
  Info,
  Lock,
  Palette,
  Pipette,
  ScanFace,
  Sparkles,
  Upload,
} from "lucide-react";
import { FABRICS } from "@/lib/catalog";
import { isValidHex, normalizeHex } from "@/lib/color";
import { verdictLabel } from "@/lib/match";
import { extractPaletteFromFile, type PaletteEntry } from "@/lib/client/palette";
import type { FaceStudio } from "./useFaceStudio";
import { ConfidencePill, ScoreBar, Swatch } from "./Atoms";

const PRESETS = [
  { hex: "#7C2433", name: "Pomegranate" },
  { hex: "#22262B", name: "Ink" },
  { hex: "#B08A5E", name: "Camel" },
  { hex: "#9AA48C", name: "Sage" },
  { hex: "#2F5C96", name: "Cobalt" },
  { hex: "#E3B7AE", name: "Blush" },
];

const REGION_LABEL: Record<string, string> = {
  forehead: "Forehead",
  leftCheek: "Left cheek",
  rightCheek: "Right cheek",
  nose: "Nose",
  jaw: "Jaw",
  neck: "Neck",
  unknown: "Patch",
};

function prettyRegion(region: string): string {
  return REGION_LABEL[region] ?? region;
}

export function ReadingPanel({ studio }: { studio: FaceStudio }) {
  const [tab, setTab] = useState<"colours" | "piece" | "foundation" | "method">("colours");
  const [hexInput, setHexInput] = useState(studio.garmentHex ?? "#7C2433");
  const [hexError, setHexError] = useState<string | null>(null);
  const [palette, setPalette] = useState<PaletteEntry[]>([]);
  const [paletteLoading, setPaletteLoading] = useState(false);
  const [paletteError, setPaletteError] = useState<string | null>(null);
  const pieceUploadRef = useRef<HTMLInputElement>(null);

  const skin = studio.apiResult?.skin ?? studio.skin;
  const best = studio.apiResult?.colour.best ?? studio.recommendations?.best ?? [];
  const avoid = studio.apiResult?.colour.avoid ?? studio.recommendations?.avoid ?? [];
  const foundations =
    studio.apiResult && studio.apiResult.foundation.length > 0
      ? studio.apiResult.foundation
      : studio.foundations;
  const garment =
    studio.apiResult?.garment &&
    studio.garmentHex &&
    studio.apiResult.garment.input.hex.toUpperCase() === studio.garmentHex.toUpperCase()
      ? studio.apiResult.garment
      : studio.localGarment;

  const depthPosition = useMemo(() => {
    if (!skin) return 50;
    return Math.min(97, Math.max(3, ((skin.ita + 60) / 140) * 100));
  }, [skin]);

  const activeColour = studio.previewColour.toUpperCase();

  function submitHex(hex: string, name?: string) {
    try {
      const normalized = normalizeHex(hex);
      setHexInput(normalized);
      setHexError(null);
      studio.setGarment(normalized, name);
    } catch {
      setHexError("Use a 6-digit hex, e.g. #7C2433.");
    }
  }

  async function readGarment(file: File) {
    setPaletteError(null);
    setPaletteLoading(true);
    try {
      const entries = await extractPaletteFromFile(file, 6);
      if (entries.length === 0) throw new Error("No colours found. Try a tighter crop of the garment.");
      setPalette(entries);
      submitHex(entries[0].hex, "Garment image");
    } catch (cause) {
      setPaletteError(cause instanceof Error ? cause.message : "Could not read that garment.");
    } finally {
      setPaletteLoading(false);
    }
  }

  const statusLabel = studio.apiResult ? "API reading" : "On-device estimate";

  return (
    <aside>
      <div className="panel-head">
        <div>
          <p className="mono muted" style={{ margin: "0 0 6px" }}>
            {statusLabel} · {studio.frozen ? "locked" : "live"}
          </p>
          <h1 className="panel-title">Your reading</h1>
        </div>
        <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
          {skin ? (
            <ConfidencePill label={skin.confidence.label} level={skin.confidence.label} />
          ) : (
            <span className="confidence" data-level="low">
              Awaiting face
            </span>
          )}
          {studio.frozen && (
            <button
              type="button"
              className="mono"
              onClick={studio.resumeLive}
              style={{ background: "none", border: 0, color: "var(--oxblood)", padding: 0 }}
            >
              Resume live ↺
            </button>
          )}
        </div>
      </div>

      {!skin && (
        <>
          <div className="empty-note" style={{ marginTop: 18 }}>
            Enable the camera or upload a front-facing portrait. The engine needs a face to read
            depth, undertone and the colours that frame it.
          </div>
          <div className="section-mini-head">
            <h3>Three steps</h3>
            <span className="mono muted">on-device</span>
          </div>
          <ol className="start-steps">
            <li>
              <b>01</b>
              <div>
                <strong>Find even light</strong>
                <p>Face a window. Avoid a single lamp on one side of the face.</p>
              </div>
            </li>
            <li>
              <b>02</b>
              <div>
                <strong>Fill the mirror</strong>
                <p>Look straight on. Keep the whole face inside the arch.</p>
              </div>
            </li>
            <li>
              <b>03</b>
              <div>
                <strong>Take the reading</strong>
                <p>Pick a fabric, or match a piece you already own.</p>
              </div>
            </li>
          </ol>
          <div className="section-mini-head">
            <h3>What you get</h3>
            <span className="mono muted">one request</span>
          </div>
          <ul className="start-list">
            <li>Depth (ITA°), undertone, season and a confidence score.</li>
            <li>A ranked fabric palette with the reason behind each score.</li>
            <li>An exact-colour check for a piece you own, plus pairings.</li>
            <li>Closest foundation shades from the demo Atlas.</li>
          </ul>
          <p className="tiny muted" style={{ marginTop: 14 }}>
            No account, no upload by default. The demo portraits in the mirror are the fastest way
            to see the whole pipeline.
          </p>
        </>
      )}

      {skin && (
        <div style={{ marginTop: 18 }}>
          <div className="skin-hero">
            <div className="skin-swatch" style={{ background: skin.hex }} aria-label={`Skin reading ${skin.hex}`} />
            <div className="skin-meta">
              <div className="skin-title">
                <strong>
                  {skin.depthLabel}
                  <span style={{ color: "var(--ink-3)", fontWeight: 300 }}> · </span>
                  {skin.undertoneLabel}
                </strong>
                <span>{skin.hex}</span>
              </div>
              <div className="mono" style={{ color: "var(--ink-3)" }}>
                {skin.season.name} · ITA° {skin.ita.toFixed(1)}
              </div>
              <div className="skin-facts">
                <div className="fact">
                  <span>Chromat.</span>
                  <strong>{skin.chroma.toFixed(1)}</strong>
                </div>
                <div className="fact">
                  <span>Fitzpatrick</span>
                  <strong>~{skin.fitzpatrick}</strong>
                </div>
                <div className="fact">
                  <span>Spread</span>
                  <strong>{skin.spread.toFixed(1)} ΔE</strong>
                </div>
              </div>
            </div>
          </div>

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

          <div className="region-row">
            {skin.regions.slice(0, 5).map((region) => (
              <span key={region.region} className="region-chip" title={`${region.deltaE} ΔE from the face median`}>
                <i style={{ background: region.hex }} />
                {prettyRegion(region.region)} {region.deltaE > 3 ? `+${region.deltaE}` : ""}
              </span>
            ))}
            <span className="region-chip" title="Estimated from ITA°, not a clinical assessment">
              <Info size={9} strokeWidth={1.7} />
              ~Fitz {skin.fitzpatrick}
            </span>
          </div>

          {skin.warnings.length > 0 && (
            <div className="warning-list">
              {skin.warnings.slice(0, 3).map((warning) => (
                <div className="warning" key={warning}>
                  <AlertTriangle size={12} strokeWidth={1.7} style={{ flex: "none", marginTop: 1 }} />
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="tabs" role="tablist" aria-label="Reading sections">
        {(
          [
            ["colours", "Colours"],
            ["piece", "Your piece"],
            ["foundation", "Foundation"],
            ["method", "Method"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className="tab"
            data-active={tab === value}
            onClick={() => setTab(value)}
            role="tab"
            aria-selected={tab === value}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="tab-panel" key={tab}>
        {tab === "colours" && (
          <>
            <div className="section-mini-head">
              <h3>Best on you</h3>
              <span className="mono muted">harmony score / 100</span>
            </div>
            {best.length === 0 ? (
              <div className="empty-note">A stable skin reading will unlock the palette.</div>
            ) : (
              <div className="match-list">
                {best.map((match) => {
                  const active = activeColour === match.colour.hex.toUpperCase();
                  return (
                    <button
                      key={match.colour.id}
                      type="button"
                      className="match-row"
                      data-active={active}
                      onClick={() => studio.setPreviewColour(match.colour.hex)}
                      aria-label={`Preview ${match.colour.name}, score ${match.score}`}
                    >
                      <Swatch hex={match.colour.hex} size={34} />
                      <span>
                        <span className="match-name">{match.colour.name}</span>
                        <span className="match-sub">
                          {match.colour.family} · {match.colour.finish} · {verdictLabel(match.verdict)}
                        </span>
                        <span className="reason-line">{match.reasons[0]}</span>
                      </span>
                      <span className="match-score">
                        {Math.round(match.score)}
                        <ScoreBar value={match.score} />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {skin && (
              <>
                <div className="section-mini-head">
                  <h3>{skin.season.name} palette</h3>
                  <span className="mono muted">tap to preview</span>
                </div>
                <div className="season-strip">
                  {skin.season.palette.map((colour) => (
                    <button
                      key={colour.name}
                      type="button"
                      title={colour.name}
                      aria-label={`Preview ${colour.name}`}
                      onClick={() => studio.setPreviewColour(colour.hex)}
                      style={{
                        flex: 1,
                        height: 26,
                        background: colour.hex,
                        border: "1px solid rgba(25,20,16,0.12)",
                        padding: 0,
                      }}
                    />
                  ))}
                </div>
                <p className="tiny muted" style={{ marginTop: 6 }}>
                  {skin.season.description}
                </p>
              </>
            )}

            {avoid.length > 0 && (
              <>
                <div className="section-mini-head">
                  <h3>Harder to wear</h3>
                  <span className="mono muted">why, not a ban</span>
                </div>
                <div className="match-list">
                  {avoid.map((match) => (
                    <button
                      key={match.colour.id}
                      type="button"
                      className="match-row"
                      onClick={() => studio.setPreviewColour(match.colour.hex)}
                      aria-label={`Preview ${match.colour.name}, score ${match.score}`}
                    >
                      <Swatch hex={match.colour.hex} size={34} />
                      <span>
                        <span className="match-name">{match.colour.name}</span>
                        <span className="match-sub">
                          {match.colour.family} · {Math.round(match.score)} / 100
                        </span>
                        <span className="reason-line">{match.reasons[0]}</span>
                      </span>
                      <span className="match-score" style={{ color: "var(--danger)" }}>
                        low
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            <p className="tiny muted" style={{ marginTop: 14, maxWidth: "52ch" }}>
              A score is a harmony estimate, not a verdict. A 62 can be exactly right for a
              deliberate, high-contrast look. The reasons matter more than the number.
            </p>
          </>
        )}

        {tab === "piece" && (
          <>
            <div className="section-mini-head">
              <h3>Match a piece</h3>
              <span className="mono muted">exact colour in</span>
            </div>
            <p className="small muted" style={{ marginTop: 0 }}>
              Paste a hex, choose a preset, or upload a garment photo. We evaluate the colour you
              actually have — then suggest the frame colours that make it work.
            </p>

            <div className="garment-form">
              <div className="color-row">
                <label className="color-well" aria-label="Pick a garment colour">
                  <input
                    type="color"
                    value={isValidHex(hexInput) ? normalizeHex(hexInput) : "#7C2433"}
                    onChange={(event) => submitHex(event.target.value)}
                  />
                </label>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="garment-hex">Garment hex</label>
                  <input
                    id="garment-hex"
                    type="text"
                    value={hexInput}
                    onChange={(event) => setHexInput(event.target.value)}
                    onBlur={() => {
                      if (isValidHex(hexInput)) submitHex(hexInput);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") submitHex(hexInput);
                    }}
                    placeholder="#7C2433"
                    spellCheck={false}
                  />
                </div>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => submitHex(hexInput)}>
                  Check
                </button>
              </div>
              {hexError && <p className="tiny" style={{ color: "var(--danger)", margin: 0 }}>{hexError}</p>}

              <div className="preset-row">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.hex}
                    type="button"
                    className="preset-chip"
                    onClick={() => submitHex(preset.hex, preset.name)}
                  >
                    <i style={{ background: preset.hex }} />
                    {preset.name}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn btn-quiet"
                  onClick={() => pieceUploadRef.current?.click()}
                  disabled={paletteLoading}
                >
                  {paletteLoading ? <span className="spinner" /> : <ImagePlus size={13} strokeWidth={1.6} />}
                  {paletteLoading ? "Reading cloth…" : "Upload garment"}
                </button>
                <span className="tiny muted">The photo stays in this tab.</span>
              </div>

              {paletteError && <p className="tiny" style={{ color: "var(--danger)", margin: 0 }}>{paletteError}</p>}

              {palette.length > 0 && (
                <div>
                  <div className="mono muted" style={{ marginBottom: 6 }}>
                    Dominant colours · tap one
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {palette.map((entry) => (
                      <button
                        key={entry.hex}
                        type="button"
                        className="fabric-chip"
                        style={{ background: entry.hex, width: 34, height: 34 }}
                        title={`${entry.hex} · ${Math.round(entry.share * 100)}% of crop`}
                        aria-label={`Use ${entry.hex}`}
                        onClick={() => submitHex(entry.hex, "Garment image")}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {!skin && (
              <div className="empty-note" style={{ marginTop: 14 }}>
                Take a skin reading first. A piece can only be judged against a face.
              </div>
            )}

            {garment && skin && (
              <>
                <div className="verdict" style={{ marginTop: 16 }}>
                  <div className="verdict-head">
                    <div>
                      <div className="mono muted">Your piece</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                        <Swatch hex={garment.input.hex} size={28} />
                        <span style={{ fontWeight: 500 }}>{garment.input.name ?? "Custom piece"}</span>
                      </div>
                      <h4>{garment.headline}</h4>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="verdict-score">{Math.round(garment.score)}</div>
                      <div className="mono muted">{verdictLabel(garment.verdict)}</div>
                    </div>
                  </div>
                  <p>{garment.summary}</p>
                  <ul className="verdict-reasons">
                    {garment.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      marginTop: 14,
                      paddingTop: 10,
                      borderTop: "1px solid var(--line)",
                      flexWrap: "wrap",
                    }}
                  >
                    <span className="mono muted">ΔE00 to skin {garment.deltaE.toFixed(1)}</span>
                    <button
                      type="button"
                      className="text-link"
                      onClick={() =>
                        studio.runReading({ hex: garment.input.hex, name: garment.input.name })
                      }
                    >
                      Confirm with the API
                      <ArrowUpRight size={12} strokeWidth={1.6} />
                    </button>
                  </div>
                </div>

                <div className="section-mini-head">
                  <h3>Nearest catalog colours</h3>
                  <span className="mono muted">ΔE00</span>
                </div>
                <div className="match-list">
                  {garment.nearest.map((entry) => (
                    <button
                      key={entry.colour.id}
                      type="button"
                      className="match-row"
                      onClick={() => studio.setPreviewColour(entry.colour.hex)}
                    >
                      <Swatch hex={entry.colour.hex} size={34} />
                      <span>
                        <span className="match-name">{entry.colour.name}</span>
                        <span className="match-sub">
                          {entry.colour.family} · {entry.colour.finish}
                        </span>
                      </span>
                      <span className="match-score">{entry.deltaE.toFixed(1)}</span>
                    </button>
                  ))}
                </div>

                <div className="section-mini-head">
                  <h3>Pair it with</h3>
                  <span className="mono muted">skin + garment harmony</span>
                </div>
                <div>
                  {garment.pairings.map((pairing) => (
                    <button
                      key={pairing.colour.id}
                      type="button"
                      className="pairing-row"
                      onClick={() => studio.setPreviewColour(pairing.colour.hex)}
                    >
                      <i style={{ background: pairing.colour.hex }} />
                      <span>
                        <span className="match-name">{pairing.colour.name}</span>
                        <span className="match-sub">
                          {pairing.relationship} · {pairing.reasons[0]}
                        </span>
                      </span>
                      <span className="match-score">{Math.round(pairing.score)}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            <input
              ref={pieceUploadRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void readGarment(file);
                event.target.value = "";
              }}
            />
          </>
        )}

        {tab === "foundation" && (
          <>
            <div className="section-mini-head">
              <h3>Closest Atlas shades</h3>
              <span className="mono muted">ΔE00 + undertone</span>
            </div>
            <p className="small muted" style={{ marginTop: 0 }}>
              The demo catalog is a reference grid, not a retail product list. Match depth first,
              then undertone; full coverage needs a closer match than sheer.
            </p>
            {foundations.length === 0 ? (
              <div className="empty-note">A skin reading unlocks the shade list.</div>
            ) : (
              <div>
                {foundations.map((match) => (
                  <div className="foundation-row" key={match.shade.id}>
                    <span className="foundation-swatch" style={{ background: match.shade.hex }} />
                    <span>
                      <span className="match-name">
                        {match.shade.name} · {match.shade.code}
                      </span>
                      <span className="match-sub">
                        {match.shade.finish} · {match.shade.coverage} · ΔE {match.deltaE.toFixed(1)}
                      </span>
                      <span className="reason-line">{match.notes[0]}</span>
                    </span>
                    <span style={{ textAlign: "right" }}>
                      <span className="mono">{Math.round(match.score)}</span>
                      <span className="foundation-grade" data-grade={match.grade} style={{ display: "block", marginTop: 3 }}>
                        {match.grade}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="tiny muted" style={{ marginTop: 12 }}>
              Face skin usually runs redder than the neck. Compare the top match against your
              jaw/neck in daylight. This is not a dermatology or Fitzpatrick assessment.
            </p>
          </>
        )}

        {tab === "method" && (
          <>
            <div className="section-mini-head">
              <h3>How this reading is made</h3>
              <span className="mono muted">v0.1.0</span>
            </div>
            <ul className="method-list">
              <li>
                <b>01</b>
                <span>
                  478-point face mesh; face-oval sampling with eye, brow, lip and nose exclusions.
                  Weighted by region, then median + ΔE00 outlier rejection.
                </span>
              </li>
              <li>
                <b>02</b>
                <span>
                  sRGB → linear → XYZ → CIELAB (D65). Sclera white point applies a conservative
                  camera-cast correction.
                </span>
              </li>
              <li>
                <b>03</b>
                <span>
                  ITA° gives depth. Hue angle and chroma give warm / cool / neutral / olive.
                  Seasons are a product taxonomy, not a clinical claim.
                </span>
              </li>
              <li>
                <b>04</b>
                <span>
                  Fabric score: lightness separation 40%, chroma 25%, temperature 20%, hue 15%.
                  Season affinity adds up to 5 points. ΔE00 kL=1.5 for fabric.
                </span>
              </li>
              <li>
                <b>05</b>
                <span>
                  Foundation: ΔE00 kL=1.0, depth penalty above 4 L*, undertone penalty from hue
                  direction, finish and coverage notes.
                </span>
              </li>
              <li>
                <b>06</b>
                <span>
                  Preview: layered canvas drape with a landmark-anchored face opening. Hair-aware
                  coverage uses MediaPipe selfie multiclass segmentation.
                </span>
              </li>
            </ul>

            {skin && (
              <>
                <div className="section-mini-head">
                  <h3>Confidence factors</h3>
                  <span className="mono muted">{skin.confidence.score}/100</span>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  {Object.entries(skin.confidence.factors).map(([key, factor]) => (
                    <div
                      key={key}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "92px 1fr 44px",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <span className="mono muted" style={{ fontSize: 8 }}>
                        {key.replace(/([A-Z])/g, " $1")}
                      </span>
                      <span className="score-bar" style={{ width: "100%" }}>
                        <i style={{ width: `${factor.score}%` }} />
                      </span>
                      <span className="mono" style={{ fontSize: 9, textAlign: "right" }}>
                        {factor.score}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="section-mini-head">
              <h3>Privacy</h3>
              <Lock size={11} strokeWidth={1.7} />
            </div>
            <p className="small muted" style={{ marginTop: 0 }}>
              Live analysis runs in this tab. “Take reading” sends colour samples and landmarks to
              the local API — not the camera image. The saved look stays in this tab until you
              download it. No accounts, no storage, no analytics.
            </p>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginTop: 14,
              }}
            >
              <a className="btn btn-quiet btn-sm" href="/#api">
                Read the API contract
                <ArrowUpRight size={12} strokeWidth={1.6} />
              </a>
              <a className="btn btn-quiet btn-sm" href="/api/v1/catalog" target="_blank" rel="noreferrer">
                Catalog JSON
                <ArrowUpRight size={12} strokeWidth={1.6} />
              </a>
              <button type="button" className="btn btn-quiet btn-sm" onClick={() => setTab("colours")}>
                Back to colours
                <Palette size={12} strokeWidth={1.6} />
              </button>
            </div>

            <p className="tiny muted" style={{ marginTop: 16 }}>
              Visualization only. Fabric, lighting and screen calibration change how a colour
              reads. No fit, drape or dermatology guarantee is made.
            </p>
          </>
        )}
      </div>

      <div className="api-foot">
        <span className="mono">
          {studio.apiResult
            ? `ENGINE ${studio.apiResult.version} · ${studio.apiResult.latencyMs}ms · ${studio.apiResult.requestId.slice(0, 8)}`
            : "ENGINE 0.1.0 · on-device estimate"}
        </span>
        <span className="mono" style={{ textAlign: "right" }}>
          {studio.apiResult ? "POST /api/v1/match" : "API optional"}
        </span>
      </div>
    </aside>
  );
}
