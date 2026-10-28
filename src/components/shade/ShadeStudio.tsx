"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  ArrowUpRight,
  Camera,
  CameraOff,
  Check,
  ChevronDown,
  Copy,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import { useToneLab } from "@/components/lab/useToneLab";
import { useCatalogue } from "@/components/shade/useCatalogue";
import { useSmoothScroll } from "@/components/SmoothScroll";
import { FABRICS, type FabricColour } from "@/lib/catalog";
import { readableInk } from "@/lib/color";
import type { CatalogueSort, LibraryMatch } from "@/lib/library";
import type { Verdict } from "@/lib/match";
import type { MatchResult } from "@/lib/api/engine";

const SECTIONS = [
  { id: "read", label: "Tone" },
  { id: "shades", label: "Colours" },
  { id: "method", label: "How it works" },
] as const;

const SECTION_IDS = SECTIONS.map((section) => section.id);
type SectionId = (typeof SECTIONS)[number]["id"];

/** The four things that happen, in order, so the reader always knows where they are. */
const READING_STEPS = [
  { index: "01", label: "Find your face", note: "Bring your face into the frame" },
  { index: "02", label: "Read the light", note: "Three close readings" },
  { index: "03", label: "Lock the tone", note: "Held steady so it cannot drift" },
  { index: "04", label: "Rank your colours", note: "Six, each with a reason" },
] as const;

const DEFAULTS: FabricColour[] = ["f28", "f14", "f57", "f41", "f55", "f21"].flatMap(
  (id) => {
    const fabric = FABRICS.find((entry) => entry.id === id);
    return fabric ? [fabric] : [];
  },
);

type ShadeItem = {
  id: string;
  name: string;
  hex: string;
  score: number | null;
  verdict: string;
  reason: string;
  rank: number;
  siteLabel?: string;
  fabric?: string;
  price?: string;
  image?: string;
  url?: string;
};

function shortName(value: string, max = 34): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

function friendlyVerdict(verdict: Verdict): string {
  if (verdict === "signature") return "A strong match";
  if (verdict === "easy") return "Easy to wear";
  if (verdict === "considered") return "Worth considering";
  return "A bolder choice";
}

function categoryLabel(value: string): string {
  if (value === "face") return "Scarves & fabric";
  if (value === "all") return "Everything";
  if (value === "apparel") return "Clothing";
  if (value === "unclassified") return "Other";
  return value
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const DEFAULT_ITEMS: ShadeItem[] = DEFAULTS.map((colour, index) => ({
  id: colour.id,
  name: colour.name,
  hex: colour.hex,
  score: null,
  verdict: "Sample shade",
  reason: "Read your tone to rank this shade against your own skin.",
  rank: index + 1,
}));

function useActiveSection() {
  const [active, setActive] = useState<SectionId>("read");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id as SectionId);
      },
      { rootMargin: "-18% 0px -55% 0px", threshold: [0.05, 0.2, 0.5] },
    );

    for (const id of SECTION_IDS) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }

    return () => observer.disconnect();
  }, []);

  return active;
}

function FaceDiagram() {
  return (
    <svg className="shade-face-diagram" viewBox="0 0 220 300" aria-hidden="true" focusable="false">
      <rect className="shade-diagram-box" x="24" y="10" width="172" height="280" />
      <path
        className="shade-diagram-face"
        d="M110 24C65 24 42 59 42 106c0 66 31 158 68 158s68-92 68-158c0-47-23-82-68-82Z"
      />
      <path className="shade-diagram-feature" d="M73 108c11-7 23-9 35-7M112 101c12-2 24 0 35 7" />
      <path className="shade-diagram-feature" d="M73 122c10-5 22-5 32 0M115 122c10-5 22-5 32 0" />
      <path className="shade-diagram-feature" d="M110 120v34c0 6-4 10-9 11" />
      <path className="shade-diagram-feature" d="M85 193c15-7 35-7 50 0M85 193c15 13 35 13 50 0" />
      <line className="shade-diagram-scan" x1="26" y1="0" x2="194" y2="0" />
      {[
        [110, 67],
        [78, 151],
        [142, 151],
        [110, 168],
        [110, 226],
      ].map(([cx, cy]) => (
        <g key={`${cx}-${cy}`}>
          <circle className="shade-diagram-dot-ring" cx={cx} cy={cy} r="6" />
          <circle className="shade-diagram-dot" cx={cx} cy={cy} r="2" />
        </g>
      ))}
      <path className="shade-diagram-tick" d="M24 34V10h24M172 10h24v24M24 266v24h24M196 266v24h-24" />
    </svg>
  );
}

function Loader() {
  return (
    <span className="shade-loader" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

export function ShadeStudio() {
  const lab = useToneLab({ mesh: true });
  const uploadRef = useRef<HTMLInputElement>(null);
  const activeSection = useActiveSection();
  const { hidden, scrollTo } = useSmoothScroll();
  const [activeHex, setActiveHex] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiResult, setApiResult] = useState<MatchResult | null>(null);

  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("all");
  const [site, setSite] = useState("all");
  const [category, setCategory] = useState("face");
  const [sort, setSort] = useState<CatalogueSort>("match");

  const catalogue = useCatalogue({
    skin: lab.skin,
    query,
    family,
    site,
    category,
    sort,
    limit: 36,
  });

  const catalogueItems: ShadeItem[] = useMemo(
    () =>
      catalogue.results.map((match, index) => ({
        id: match.id,
        name: shortName(match.name),
        hex: match.hex,
        score: match.score,
        verdict: friendlyVerdict(match.verdict),
        reason: match.friendlyReason,
        rank: index + 1,
        siteLabel: match.siteLabel,
        fabric: match.fabric,
        price: match.price,
        image: match.image,
        url: match.url,
      })),
    [catalogue.results],
  );

  const hasMatches = catalogueItems.length > 0;
  const items = hasMatches ? catalogueItems : DEFAULT_ITEMS;
  const active =
    items.find((item) => item.hex.toUpperCase() === activeHex?.toUpperCase()) ??
    items[0];
  const activeHexValue = active.hex;
  const activeName = active.name;
  const activeScore = active.score === null ? null : Math.round(active.score);
  const activeRank = active.rank;
  const activeReason = active.reason;
  const activeSite = active.siteLabel;
  const activeFabric = active.fabric;
  const activeUrl = active.url;

  const topHex = hasMatches ? catalogueItems[0]?.hex ?? null : null;
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
      catalogue: {
        count: catalogue.count,
        stores: Object.keys(catalogue.stores).length,
        query,
        family,
        site,
        category,
        sort,
        matches: catalogue.total,
      },
      recommended: catalogue.results.slice(0, 12).map((match: LibraryMatch) => ({
        name: match.name,
        hex: match.hex,
        score: Math.round(match.score),
        verdict: match.verdict,
        site: match.siteLabel,
        image: match.image,
        url: match.url,
        reason: match.reasons[0],
      })),
    }),
    [
      lab.snapshot,
      catalogue.count,
      catalogue.stores,
      catalogue.total,
      catalogue.results,
      query,
      family,
      site,
      category,
      sort,
    ],
  );

  const isReading = lab.status === "live" || lab.status === "photo";
  const friendlyStatus =
    lab.status === "loading"
      ? "Getting ready…"
      : lab.status === "error"
        ? "Camera unavailable — try a photo"
        : lab.toneLocked
          ? "Your tone is ready"
          : lab.skin
            ? `Hold still — reading ${lab.stableSamples} of 3`
            : lab.status === "live"
              ? "Looking for your face"
              : lab.status === "photo"
                ? "Reading your photo…"
                : "Ready when you are";
  const delegateLabel =
    lab.delegate !== "unknown"
      ? lab.delegate
      : lab.status === "loading"
        ? "Getting ready…"
        : lab.status === "live" || lab.status === "photo"
          ? "Unavailable"
          : "Not started";

  // Which of the four stages the reading is on, 0-based. -1 means "not started".
  const readingStage = lab.toneLocked ? 3 : lab.skin ? 2 : isReading ? 1 : 0;
  const readingProgress = lab.toneLocked
    ? 100
    : lab.skin
      ? 20 + (lab.stableSamples / 3) * 60
      : isReading
        ? 12
        : 0;
  const readingNote = lab.toneLocked
    ? "Tone locked. Your colours are ready below."
    : lab.skin
      ? `Hold still — reading ${lab.stableSamples} of 3`
      : lab.status === "live"
        ? "Looking for your face"
        : lab.status === "photo"
          ? "Reading your photo"
          : "Start the camera or upload a photo";
  const apiTop = apiResult?.colour.best[0] ?? null;
  const catalogueReady = catalogue.status === "ready";
  const catalogueStoreCount = Object.keys(catalogue.stores).length;
  const filtersActive =
    query.trim() !== "" || family !== "all" || site !== "all" || category !== "face";
  const catalogueCount = catalogue.count || 5_498;
  const catalogueStatus =
    catalogue.status === "error"
      ? "Collection unavailable"
      : catalogue.searching
        ? "Finding your colours…"
        : catalogue.status === "loading"
          ? "Loading the collection…"
          : `${catalogue.total.toLocaleString()} colours · showing ${catalogue.results.length}`;
  const familyOptions = Object.keys(catalogue.families).sort();
  const storeOptions = Object.keys(catalogue.stores).sort();
  const categoryOptions = Object.keys(catalogue.categories).sort();


  function resetFilters() {
    setQuery("");
    setFamily("all");
    setSite("all");
    setCategory("face");
    setSort("match");
  }

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
            catalogue: category,
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

  function resetAll() {
    lab.reset();
    setApiResult(null);
    setApiError(null);
    setActiveHex(null);
    setCopied(false);
  }

  function openUpload() {
    uploadRef.current?.click();
  }

  return (
    <div className="shade-app">
      <a className="shade-skip" href="#read">
        Skip to the reading
      </a>

      <header className={`shade-topbar${hidden ? " is-hidden" : ""}`}>
        <div className="shade-topbar-left">
          <a className="shade-topbar-brand" href="#read">
            Auriga
          </a>
          <span className="shade-topbar-divider" aria-hidden="true" />
          <nav className="shade-topbar-nav" aria-label="On this page">
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                className="shade-topbar-link"
                href={`#${section.id}`}
                aria-current={activeSection === section.id ? "location" : undefined}
              >
                {section.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="shade-topbar-right">
          <span
            className={`shade-topbar-progress${
              lab.toneLocked ? " is-locked" : isReading ? " is-live" : ""
            }`}
            role="status"
            aria-live="polite"
          >
            <i aria-hidden="true">
              <b style={{ width: `${Math.round(readingProgress)}%` }} />
            </i>
            {lab.toneLocked
              ? "Tone locked"
              : isReading
                ? `Reading ${lab.stableSamples}/3`
                : "No reading"}
          </span>
          <span className="shade-local">
            <i aria-hidden="true" />
            Local only · nothing uploaded
          </span>
          <button className="shade-topbar-reset" type="button" onClick={resetAll}>
            Reset
          </button>
          <div className="shade-mobile-tools">
            <button type="button" onClick={openUpload} aria-label="Upload a photo">
              <Upload size={14} strokeWidth={1.7} />
            </button>
            <button
              type="button"
              onClick={() => document.getElementById("shades")?.scrollIntoView({ behavior: "smooth" })}
              aria-label="Go to colours"
            >
              <SlidersHorizontal size={14} strokeWidth={1.7} />
            </button>
          </div>
        </div>
      </header>

      <div className="shade-layout">

        <div className="shade-content">
          <main>
            <section className="shade-section" id="read" aria-labelledby="read-title">
              <div className="shade-section-head">
                <div>
                  <p className="shade-label">
                    01 / tone ·{" "}
                    {lab.status === "live" ? "live" : lab.status === "photo" ? "photo" : "camera off"}
                  </p>
                  <h2 className="shade-section-title" id="read-title">
                    Hold your face in the light.
                  </h2>
                </div>
                <div className="shade-status-chips">
                  <span className="shade-chip">
                    <i className={lab.toneLocked ? "is-ok" : ""} />
                    {lab.status === "live"
                      ? `Live · ${lab.fps} fps`
                      : lab.status === "photo"
                        ? "Photo ready"
                        : "Waiting for a face"}
                  </span>
                  <span className="shade-chip is-accent">
                    <i className={lab.toneLocked ? "is-ok" : ""} />
                    {lab.toneLocked ? "Tone locked · 3/3" : readingNote}
                  </span>
                  {lab.delegate !== "unknown" && (
                    <span className="shade-chip shade-chip-runtime">
                      <i />
                      {delegateLabel}
                    </span>
                  )}
                </div>
              </div>

              <ol className="shade-reading" aria-label="Reading progress">
                {READING_STEPS.map((step, index) => {
                  const done = index < readingStage;
                  const current = index === readingStage;
                  return (
                    <li
                      key={step.index}
                      className={`shade-reading-step${done ? " is-done" : ""}${
                        current ? " is-current" : ""
                      }`}
                      aria-current={current ? "step" : undefined}
                    >
                      <span className="shade-reading-index" aria-hidden="true">
                        {step.index}
                      </span>
                      <span className="shade-reading-copy">
                        <strong>{step.label}</strong>
                        <small>{current ? readingNote : step.note}</small>
                      </span>
                      {current && (
                        <span className="shade-reading-meter" aria-hidden="true">
                          <i style={{ width: `${Math.round(readingProgress)}%` }} />
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>

              <div className="shade-read-grid">
                <div className="shade-stage-col">
                  <div className="shade-stage" data-status={lab.status}>
                    <video
                      ref={lab.videoRef}
                      className="shade-video"
                      autoPlay
                      playsInline
                      muted
                      style={{ opacity: lab.sourceMode === "photo" ? 0 : 1 }}
                    />
                    {lab.photoSrc && (
                      <img className="shade-photo" src={lab.photoSrc} alt="Uploaded portrait" />
                    )}
                    <canvas
                      ref={lab.canvasRef}
                      className={`shade-canvas ${lab.sourceMode === "photo" ? "is-static" : ""}`}
                      aria-hidden="true"
                    />

                    <div className="shade-hud shade-hud--left">
                      <span
                        className={`shade-dot ${
                          lab.status === "live" ? "is-live" : lab.status === "photo" ? "is-photo" : ""
                        }`}
                      />
                      {lab.status === "live"
                        ? "LIVE"
                        : lab.status === "photo"
                          ? "PHOTO"
                          : lab.status === "loading"
                            ? "GETTING READY"
                            : "OFF"}
                    </div>
                    {!isReading && (
                      <div className="shade-stage-empty">
                        {lab.status === "loading" ? <Loader /> : <FaceDiagram />}
                        <p className="shade-stage-signal">
                          {lab.status === "loading"
                            ? "GETTING READY"
                            : lab.status === "error"
                              ? "CAMERA TROUBLE"
                              : "NO SIGNAL"}
                        </p>
                        <h3>
                          {lab.status === "loading"
                            ? "Getting things ready…"
                            : lab.status === "error"
                              ? "The camera needs another try."
                              : "Camera off"}
                        </h3>
                        <p>
                          {lab.status === "error"
                            ? lab.error ?? "Allow camera access, or upload a photo instead."
                            : "Natural light and a front-facing photo work best."}
                        </p>
                        <div className="shade-empty-actions">
                          <button
                            className="shade-btn shade-btn--primary"
                            type="button"
                            onClick={lab.start}
                            disabled={lab.status === "loading"}
                          >
                            <Camera size={15} strokeWidth={1.7} />
                            {lab.status === "error" ? "Try again" : "Use camera"}
                          </button>
                          <button
                            className="shade-btn shade-btn--outline shade-btn--on-dark"
                            type="button"
                            onClick={openUpload}
                          >
                            <Upload size={15} strokeWidth={1.7} />
                            Upload a photo
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {isReading && (
                  <div className="shade-capture-bar">
                    <div className="shade-capture-status" role="status" aria-live="polite">
                      <span
                        className={`shade-dot ${
                          lab.toneLocked ? "is-locked" : lab.status === "live" ? "is-live" : ""
                        }`}
                      />
                      <span>{friendlyStatus}</span>
                    </div>

                    <div className="shade-actions">
                      {lab.status === "live" && (
                        <button className="shade-btn shade-btn--quiet" type="button" onClick={lab.stop}>
                          <CameraOff size={14} strokeWidth={1.7} />
                          Stop camera
                        </button>
                      )}
                      {lab.status === "photo" && (
                        <button
                          className="shade-btn shade-btn--quiet"
                          type="button"
                          onClick={lab.start}
                        >
                          <Camera size={14} strokeWidth={1.7} />
                          Use camera
                        </button>
                      )}
                      {lab.status === "photo" ? (
                        <button className="shade-btn shade-btn--quiet" type="button" onClick={openUpload}>
                          <Upload size={14} strokeWidth={1.7} />
                          Replace photo
                        </button>
                      ) : (
                        <button className="shade-btn shade-btn--quiet" type="button" onClick={openUpload}>
                          <Upload size={14} strokeWidth={1.7} />
                          Upload a photo
                        </button>
                      )}
                      {lab.sourceMode !== "photo" && lab.skin && (
                        <button
                          className="shade-btn shade-btn--quiet"
                          type="button"
                          onClick={reRead}
                        >
                          <RefreshCw size={14} strokeWidth={1.7} />
                          Read again
                        </button>
                      )}
                      <button
                        className="shade-btn shade-btn--quiet"
                        type="button"
                        onClick={() => lab.setShowMesh(!lab.showMesh)}
                      >
                        {lab.showMesh ? "Hide guide" : "Show guide"}
                      </button>
                    </div>
                  </div>
                  )}

                  {lab.sourceMode === "photo" && lab.error && (
                    <p className="shade-error" role="alert">
                      {lab.error}
                    </p>
                  )}

                  {lab.toneLocked && (
                    <div className="shade-ready" role="status">
                      <div className="shade-ready-copy">
                        <strong>Your tone is locked.</strong>
                        <span>
                          {lab.skin
                            ? `${lab.skin.hex} · ${lab.skin.depthLabel} · ${lab.skin.undertoneLabel} · ${lab.skin.confidence.score}% confidence`
                            : "Saved on this device"}
                        </span>
                      </div>
                      <button
                        className="shade-ready-btn"
                        type="button"
                        onClick={() => scrollTo("#shades")}
                      >
                        See your six colours
                        <ChevronDown size={15} strokeWidth={1.8} />
                      </button>
                    </div>
                  )}

                  <div className="shade-mobile-capture">
                    <span>
                      <i className={lab.toneLocked ? "is-accent" : ""} />
                      {friendlyStatus}
                    </span>
                    <span>{lab.status === "live" ? `${lab.fps} FPS` : "478 PTS"}</span>
                  </div>

                  <a className="shade-mobile-sheet" href="#method">
                    <span
                      className="shade-mobile-sheet-swatch"
                      style={{ background: lab.skin?.hex ?? "#D8D4C8" }}
                    />
                    <span className="shade-mobile-sheet-copy">
                      <small>SKIN READING</small>
                      <strong>
                        {lab.skin
                          ? `${lab.skin.depthLabel} · ${lab.skin.undertoneLabel}`
                          : "No reading yet"}
                      </strong>
                    </span>
                    <span className="shade-mobile-sheet-score">
                      {lab.skin ? `${lab.skin.confidence.score}%` : "—"}
                    </span>
                    <ChevronDown size={14} strokeWidth={1.7} />
                  </a>

                  <div className="shade-mobile-actions">
                    {lab.toneLocked ? (
                      <a className="shade-mobile-primary" href="#shades">
                        <SlidersHorizontal size={14} strokeWidth={1.7} />
                        Compare six
                      </a>
                    ) : (
                      <button
                        className="shade-mobile-primary"
                        type="button"
                        onClick={lab.start}
                        disabled={lab.status === "loading"}
                      >
                        <Camera size={14} strokeWidth={1.7} />
                        {lab.status === "loading" ? "Getting ready…" : "Start camera"}
                      </button>
                    )}
                    {lab.status === "live" ? (
                      <button className="shade-mobile-secondary" type="button" onClick={reRead}>
                        <RefreshCw size={14} strokeWidth={1.7} />
                        Re-read
                      </button>
                    ) : (
                      <button className="shade-mobile-secondary" type="button" onClick={openUpload}>
                        <Upload size={14} strokeWidth={1.7} />
                        {lab.sourceMode === "photo" ? "Replace" : "Upload"}
                      </button>
                    )}
                  </div>

                  <p className="shade-mobile-footnote">
                    ON-DEVICE · NOTHING UPLOADED · FITZPATRICK IS AN ESTIMATE
                  </p>
                </div>

                <aside className="shade-readout" aria-labelledby="readout-title">
                  <div className="shade-readout-head">
                    <p className="shade-label" id="readout-title">
                      Your skin
                    </p>
                  </div>

                  {lab.skin ? (
                    <>
                      <div className="shade-skin">
                        <span className="shade-skin-swatch" style={{ background: lab.skin.hex }} />
                        <div>
                          <div className="shade-skin-tone">
                            {lab.skin.depthLabel} · {lab.skin.undertoneLabel}
                          </div>
                          <p className="shade-skin-note">{lab.skin.undertoneNote}</p>
                          <p className="shade-skin-meta">
                            {lab.skin.season.name} · {lab.skin.confidence.score}% confidence
                          </p>
                        </div>
                      </div>

                      {lab.skin.warnings.length > 0 && (
                        <p className="shade-warning">
                          The light may be affecting this reading. Try softer, even light.
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="shade-readout-empty">
                      <p className="shade-empty-title">Your reading will appear here.</p>
                    </div>
                  )}

                  <p className="shade-footnote">A guide, not a lab test. Daylight changes colour.</p>

                  <div className="shade-side-card">
                    <div className="shade-side-head">
                      <span>{lab.skin ? "WHY THIS COLOUR" : "BEFORE YOU START"}</span>
                      <span>{lab.skin ? "GUIDE" : "3 CHECKS"}</span>
                    </div>
                    {lab.skin ? (
                      <p className="shade-side-copy">{activeReason}</p>
                    ) : (
                      <ol className="shade-prep">
                        <li><span>01</span><p><strong>Even light</strong>Face a window, not a lamp.</p></li>
                        <li><span>02</span><p><strong>Full frame</strong>Keep the face large and level.</p></li>
                        <li><span>03</span><p><strong>Hold still</strong>Three readings save the tone.</p></li>
                      </ol>
                    )}
                  </div>

                  <div className="shade-side-card">
                    <div className="shade-side-head">
                      <span>PALETTE</span>
                      <span>{lab.skin ? lab.skin.season.name : "SAMPLE"}</span>
                    </div>
                    <div className="shade-side-palette">
                      {(lab.skin
                        ? lab.skin.season.palette.slice(0, 10).map((colour) => colour.hex)
                        : ["#C88928", "#5C1F2A", "#2E6F73", "#9AA48C", "#23323C", "#C99898"]
                      ).map((hex) => (
                        <i key={hex} style={{ background: hex }} />
                      ))}
                    </div>
                  </div>

                  <div className="shade-side-card shade-side-privacy">
                    <span className="shade-side-icon"><ShieldCheck size={15} strokeWidth={1.7} /></span>
                    <div>
                      <strong>ON-DEVICE</strong>
                      <p>Frames stay in this tab. Only colour values are sent when you ask for a server check.</p>
                    </div>
                  </div>

                  <div className="shade-side-card">
                    <div className="shade-side-head">
                      <span>WHEN A FACE ARRIVES</span>
                      <span>UNDER 4 S</span>
                    </div>
                    <div className="shade-side-pipeline">
                      {[
                        ["01", "Guide", "478 points"],
                        ["02", "Read", "cheeks + forehead"],
                        ["03", "Lock", "three close reads"],
                        ["04", "Rank", "six, with reasons"],
                      ].map(([index, label, note]) => (
                        <div key={index}>
                          <span>{index}</span>
                          <strong>{label}</strong>
                          <small>{note}</small>
                        </div>
                      ))}
                    </div>
                  </div>
                </aside>
              </div>
            </section>

            <section className="shade-section" id="shades" aria-labelledby="shades-title">
              <div className="shade-section-head">
                <div>
                  <p className="shade-label">02 / your colours</p>
                  <h2 className="shade-section-title" id="shades-title">
                    Your colours, from the real collection.
                  </h2>
                </div>
                <p className="shade-meta">
                  {catalogueReady
                    ? `${catalogueCount.toLocaleString()} real colours · ${catalogueStoreCount} shops`
                    : "Finding the collection…"}
                </p>
              </div>

              <div
                className={`shade-live-colour ${apiLoading ? "is-matching" : ""} ${
                  apiResult ? "is-matched" : ""
                }`}
              >
                <div
                  className="shade-live-main"
                  style={{ background: activeHexValue, color: readableInk(activeHexValue) }}
                >
                  <div className="shade-live-top">
                    <span>
                      {!hasMatches
                        ? lab.skin
                          ? "BEST SO FAR"
                          : "SAMPLE PALETTE"
                        : activeRank === 1
                          ? "BEST OF SIX"
                          : "YOUR PICK"}
                    </span>
                    <span>
                      {apiLoading
                        ? "CHECKING…"
                        : lab.toneLocked
                          ? "TONE LOCKED"
                          : lab.skin
                            ? "READING"
                            : "WAITING"}
                    </span>
                  </div>
                  <div className="shade-live-name">{activeName}</div>
                  <div className="shade-live-meta">
                    {activeHexValue}
                    {activeScore !== null ? ` · ${activeScore}/100` : ""}
                    {active.verdict ? ` · ${active.verdict.toUpperCase()}` : ""}
                  </div>
                </div>

                <div className="shade-live-swatches">
                  {items.slice(0, 6).map((item) => {
                    const selected = item.hex.toUpperCase() === activeHexValue.toUpperCase();
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className="shade-mini"
                        data-active={selected}
                        aria-pressed={selected}
                        onClick={() => setActiveHex(item.hex)}
                        title={`${item.name}${item.score !== null ? ` · ${Math.round(item.score)}/100` : ""}`}
                      >
                        <span className="shade-mini-colour" style={{ background: item.hex }} />
                        <span className="shade-mini-label">
                          <span>
                            {selected ? "● " : ""}
                            {item.name}
                          </span>
                          <span>
                            {item.score !== null ? `${Math.round(item.score)}/100` : "——"}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="shade-lockbar" aria-hidden="true">
                  <i style={{ width: `${Math.round(lab.stability * 100)}%` }} />
                </div>
              </div>

              <div className="shade-catalogue-bar">
                <div className="shade-catalogue-search">
                  <span className="shade-input-wrap">
                    <Search size={14} strokeWidth={1.7} aria-hidden="true" />
                    <input
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search a colour, shop or fabric"
                      aria-label="Search the collection"
                      spellCheck={false}
                    />
                  </span>
                </div>

                <div className="shade-catalogue-field">
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    aria-label="What are you looking for?"
                  >
                    <option value="face">Scarves &amp; fabric</option>
                    <option value="all">Everything</option>
                    {categoryOptions.map((option) => (
                      <option key={option} value={option}>
                        {categoryLabel(option)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="shade-catalogue-field">
                  <select
                    value={family}
                    onChange={(event) => setFamily(event.target.value)}
                    aria-label="Colour family"
                  >
                    <option value="all">Any colour</option>
                    {familyOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="shade-catalogue-field">
                  <select
                    value={site}
                    onChange={(event) => setSite(event.target.value)}
                    aria-label="Shop"
                  >
                    <option value="all">Any shop</option>
                    {storeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="shade-catalogue-field">
                  <select
                    value={sort}
                    onChange={(event) => setSort(event.target.value as CatalogueSort)}
                    aria-label="Sort by"
                  >
                    <option value="match">Best for you</option>
                    <option value="light">Lightest</option>
                    <option value="dark">Deepest</option>
                    <option value="hue">Colour</option>
                    <option value="name">Name</option>
                  </select>
                </div>
              </div>

              <div className="shade-catalogue-status" role="status" aria-live="polite">
                <span>{catalogueStatus}</span>
                {filtersActive && (
                  <button type="button" className="shade-text-button" onClick={resetFilters}>
                    Clear filters
                  </button>
                )}
              </div>

              {catalogue.error && (
                <p className="shade-error">
                  The collection didn't load. Refresh the page to try again.
                </p>
              )}

              {!lab.skin && (
                <p className="shade-catalogue-note">
                  Read your tone first and we'll rank these {catalogueCount.toLocaleString()} colours for you.
                </p>
              )}

              {lab.skin &&
                catalogue.status !== "error" &&
                (!catalogueReady || catalogue.searching) &&
                !hasMatches && (
                <div className="shade-catalogue-wait">
                  <Loader />
                  <div>
                    <strong>
                      {catalogue.status === "loading"
                        ? "Loading the collection…"
                        : "Finding your colours…"}
                    </strong>
                    <span>5,498 real colours stay on this device.</span>
                  </div>
                </div>
              )}

              {lab.skin && catalogueReady && !catalogue.searching && !hasMatches && (
                <div className="shade-no-results">
                  <p className="shade-empty-title">No colours match that search.</p>
                  <p>Try another colour, shop or fabric, or clear the filters.</p>
                  <button type="button" className="shade-btn shade-btn--outline" onClick={resetFilters}>
                    Clear filters
                  </button>
                </div>
              )}

              {(!lab.skin || hasMatches) && (
                <div className={`shade-sheet ${apiLoading ? "is-matching" : ""} ${apiResult ? "is-matched" : ""}`}>
                  <div
                    className="shade-sheet-main"
                    style={{ background: activeHexValue, color: readableInk(activeHexValue) }}
                  >
                    <div className="shade-sheet-top">
                      <span>
                        {hasMatches
                          ? activeRank === 1
                            ? "Your top pick"
                            : `Your pick · ${activeRank}`
                          : "Sample colours"}
                      </span>
                      <span>{activeScore !== null ? `${activeScore} out of 100` : "Waiting"}</span>
                    </div>
                    <div>
                      <div className="shade-sheet-name">{activeName}</div>
                      <div className="shade-sheet-meta">{active.verdict}</div>
                      {activeSite && (
                        <div className="shade-sheet-source">
                          {activeSite}
                          {activeFabric ? ` · ${activeFabric}` : ""}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="shade-sheet-reason">{activeReason}</p>
                      {activeUrl && (
                        <a
                          className="shade-sheet-link"
                          href={activeUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View this product
                          <ArrowUpRight size={13} strokeWidth={1.7} />
                        </a>
                      )}
                    </div>
                  </div>

                  <ol
                    className="shade-list"
                    aria-label="Colours picked for you"
                    data-lenis-prevent
                  >
                    {items.map((item) => {
                      const selected = item.hex.toUpperCase() === activeHexValue.toUpperCase();
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            className="shade-row"
                            aria-pressed={selected}
                            onClick={() => setActiveHex(item.hex)}
                            title={`${item.name} · ${item.hex}${item.siteLabel ? ` · ${item.siteLabel}` : ""}`}
                          >
                            <span className="shade-row-rank">
                              {String(item.rank).padStart(2, "0")}
                            </span>
                            <span className="shade-row-swatch" style={{ background: item.hex }}>
                              {item.image && (
                                <img
                                  src={`/library/${item.image}`}
                                  alt=""
                                  loading="lazy"
                                  decoding="async"
                                />
                              )}
                            </span>
                            <span className="shade-row-copy">
                              <strong>{item.name}</strong>
                              <span>{item.siteLabel ?? "—"}</span>
                            </span>
                            <span className="shade-row-score">
                              {item.score !== null ? Math.round(item.score) : "—"}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}

              <div className="shade-shade-actions">
                <p className="shade-shade-note">
                  Scores are a guide. Look at the product in daylight when you can.
                </p>
                <a className="shade-link" href="#read">
                  Read your tone again
                  <ArrowUp size={13} strokeWidth={1.7} />
                </a>
              </div>
            </section>

            <section className="shade-section" id="method" aria-labelledby="method-title">
              <div className="shade-section-head">
                <div>
                  <p className="shade-label">03 / how it works</p>
                  <h2 className="shade-section-title" id="method-title">
                    A simple reading, in three steps.
                  </h2>
                </div>
              </div>

              <div className="shade-steps">
                <article className="shade-step">
                  <span className="shade-step-number">01</span>
                  <h3>We read the light on your face.</h3>
                  <p>A face guide keeps the reading on your skin, not hair or shadow.</p>
                </article>
                <article className="shade-step">
                  <span className="shade-step-number">02</span>
                  <h3>We search real scarves and fabrics.</h3>
                  <p>5,498 colours from 15 shops, each with a real product photo.</p>
                </article>
                <article className="shade-step">
                  <span className="shade-step-number">03</span>
                  <h3>We rank what works near your face.</h3>
                  <p>Depth, warmth and contrast — not trends. Your face stays unchanged.</p>
                </article>
              </div>

              <div className="shade-score-guide">
                <p className="shade-label">What the score means</p>
                <div className="shade-score-list">
                  <span><strong>90–100</strong> A strong match</span>
                  <span><strong>80–89</strong> Easy to wear</span>
                  <span><strong>70–79</strong> Worth a try</span>
                  <span><strong>Below 70</strong> A bolder choice</span>
                </div>
              </div>

              <details className="shade-technical">
                <summary>More detail</summary>

                <div className="shade-method-grid">
                  <div className="shade-proof">
                    <h3>Skin</h3>
                    <dl className="shade-table">
                      <div>
                        <dt>Measured colour</dt>
                        <dd>{lab.skin?.hex ?? "—"}</dd>
                      </div>
                      <div>
                        <dt>Depth</dt>
                        <dd>{lab.skin?.depthLabel ?? "—"}</dd>
                      </div>
                      <div>
                        <dt>Undertone</dt>
                        <dd>{lab.skin?.undertoneLabel ?? "—"}</dd>
                      </div>
                      <div>
                        <dt>Season</dt>
                        <dd>{lab.skin?.season.name ?? "—"}</dd>
                      </div>
                      <div>
                        <dt>Fitzpatrick</dt>
                        <dd>{lab.skin ? `~${lab.skin.fitzpatrick}` : "—"}</dd>
                      </div>
                      <div>
                        <dt>Spread</dt>
                        <dd>{lab.skin ? `${lab.skin.spread.toFixed(1)} ΔE` : "—"}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="shade-proof">
                    <h3>Measurement</h3>
                    <dl className="shade-table">
                      <div>
                        <dt>L*</dt>
                        <dd>{lab.skin?.lab.l.toFixed(1) ?? "—"}</dd>
                      </div>
                      <div>
                        <dt>a*</dt>
                        <dd>{lab.skin?.lab.a.toFixed(1) ?? "—"}</dd>
                      </div>
                      <div>
                        <dt>b*</dt>
                        <dd>{lab.skin?.lab.b.toFixed(1) ?? "—"}</dd>
                      </div>
                      <div>
                        <dt>C*</dt>
                        <dd>{lab.skin?.chroma.toFixed(1) ?? "—"}</dd>
                      </div>
                      <div>
                        <dt>h°</dt>
                        <dd>{lab.skin ? `${lab.skin.hue.toFixed(1)}°` : "—"}</dd>
                      </div>
                      <div>
                        <dt>ITA°</dt>
                        <dd>{lab.skin ? `${lab.skin.ita.toFixed(1)}°` : "—"}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="shade-proof">
                    <h3>Engine</h3>
                    <dl className="shade-table">
                      <div>
                        <dt>Source</dt>
                        <dd>{lab.sourceMode}</dd>
                      </div>
                      <div>
                        <dt>Guide</dt>
                        <dd>{lab.faceDetected ? "Face found" : "searching"}</dd>
                      </div>
                      <div>
                        <dt>Processing</dt>
                        <dd>MediaPipe WASM</dd>
                      </div>
                      <div>
                        <dt>Device</dt>
                        <dd>{delegateLabel}</dd>
                      </div>
                      <div>
                        <dt>Startup</dt>
                        <dd>{lab.detectMs}ms</dd>
                      </div>
                      <div>
                        <dt>Reading</dt>
                        <dd>{lab.sampleMs}ms</dd>
                      </div>
                      <div>
                        <dt>Tone</dt>
                        <dd>{lab.toneLocked ? "saved" : `${lab.stableSamples}/3`}</dd>
                      </div>
                    </dl>
                    <p className="shade-technical-note">
                      Device shows GPU or CPU after your first reading starts.
                    </p>
                  </div>

                  <div className="shade-proof">
                    <h3>Collection</h3>
                    <dl className="shade-table">
                      <div>
                        <dt>Colours</dt>
                        <dd>{catalogueCount.toLocaleString()}</dd>
                      </div>
                      <div>
                        <dt>Shops</dt>
                        <dd>{catalogueStoreCount || "—"}</dd>
                      </div>
                      <div>
                        <dt>Source</dt>
                        <dd>scraped textiles</dd>
                      </div>
                      <div>
                        <dt>Search</dt>
                        <dd>CPU worker</dd>
                      </div>
                      <div>
                        <dt>Matches</dt>
                        <dd>{catalogue.total.toLocaleString()}</dd>
                      </div>
                      <div>
                        <dt>Filters</dt>
                        <dd>{filtersActive ? "on" : "none"}</dd>
                      </div>
                    </dl>
                  </div>
                </div>

                <div className="shade-method-actions">
                  <div>
                    <p className="shade-label">Server check</p>
                    <p className="shade-method-copy">
                      The same reading can be checked by the server. It scores the same 5,498
                      colours and returns the top result.
                    </p>
                  </div>
                  <div className="shade-actions">
                    <button
                      className="shade-btn shade-btn--outline"
                      type="button"
                      onClick={runApi}
                      disabled={!lab.skin || apiLoading || !lab.toneLocked}
                      title={!lab.toneLocked ? "Wait until your tone is saved" : undefined}
                    >
                      {apiLoading ? <Loader2 className="shade-spin" size={15} /> : <Send size={15} strokeWidth={1.7} />}
                      {apiLoading ? "Checking…" : "Check with server"}
                    </button>
                    <button
                      className="shade-btn shade-btn--quiet"
                      type="button"
                      onClick={copy}
                      disabled={!lab.skin}
                    >
                      {copied ? <Check size={14} strokeWidth={1.7} /> : <Copy size={14} strokeWidth={1.7} />}
                      {copied ? "Copied" : "Copy details"}
                    </button>
                    <button
                      className="shade-btn shade-btn--quiet"
                      type="button"
                      onClick={resetAll}
                    >
                      <RotateCcw size={14} strokeWidth={1.7} />
                      Start over
                    </button>
                  </div>
                </div>

                <div className="shade-api-note" role="status" aria-live="polite">
                  {apiError ? (
                    <span className="shade-error">{apiError}</span>
                  ) : apiTop ? (
                    <>
                      <span className="shade-dot is-locked" />
                      Same result: {apiTop.colour.name} · {Math.round(apiTop.score)} out of 100 ·{" "}
                      {apiResult?.latencyMs ?? 0}ms
                    </>
                  ) : (
                    "Save your tone first, then check the result with the server."
                  )}
                </div>

                <p className="shade-provenance">
                  The collection was built with <code>npm run library:catalog</code>. You only need
                  to run it again after adding new scraped products. Hex values are measured from
                  product photos, not studio equipment. Photography belongs to each shop.
                </p>

                <details className="shade-json">
                  <summary>Raw reading (JSON)</summary>
                  <pre data-lenis-prevent>{JSON.stringify(handoff, null, 2)}</pre>
                </details>
              </details>
            </section>

          </main>

          <footer className="shade-footer">
            <div>
              <strong>Auriga</strong>
              <span>Colour atelier</span>
            </div>
            <p>Your camera stays in this tab.</p>
          </footer>
        </div>
      </div>

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
    </div>
  );
}
