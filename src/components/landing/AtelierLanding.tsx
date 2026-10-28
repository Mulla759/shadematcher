"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Camera,
  Check,
  ChevronDown,
  Search,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useSmoothScroll } from "@/components/SmoothScroll";
import { readableInk } from "@/lib/color";

const PALETTE = [
  { name: "Saffron", hex: "#C88928", score: "94/100" },
  { name: "Oxblood", hex: "#5C1F2A", score: "88/100" },
  { name: "Teal", hex: "#2E6F73", score: "85/100" },
  { name: "Sage", hex: "#9AA48C", score: "81/100" },
  { name: "Navy", hex: "#23323C", score: "76/100" },
  { name: "Dusty rose", hex: "#C99898", score: "72/100" },
] as const;

const COLLECTION = [
  {
    name: "Saffron",
    hex: "#C88928",
    score: "94/100",
    shop: "Vela Scarves",
    verdict: "Signature",
    reason: "Warm yellow at 62% lightness — it separates without shouting.",
  },
  {
    name: "Oxblood",
    hex: "#5C1F2A",
    score: "88/100",
    shop: "Culture Hijab",
    verdict: "Easy to wear",
    reason: "Deep red cools the surface while keeping the skin's warmth.",
  },
  {
    name: "Teal",
    hex: "#2E6F73",
    score: "85/100",
    shop: "Lala Hijabs",
    verdict: "Easy to wear",
    reason: "Balanced blue-green lifts neutral-warm skin without turning grey.",
  },
  {
    name: "Sage",
    hex: "#9AA48C",
    score: "81/100",
    shop: "Modish Hijab",
    verdict: "Considered",
    reason: "Close to the undertone. Soft contrast, quieter presence.",
  },
  {
    name: "Navy",
    hex: "#23323C",
    score: "76/100",
    shop: "Unique Hijabs",
    verdict: "Considered",
    reason: "The strongest contrast here: clean, but it reads a little formal.",
  },
  {
    name: "Dusty rose",
    hex: "#C99898",
    score: "72/100",
    shop: "Voile Chic",
    verdict: "Harder to wear",
    reason: "Low separation from the skin; needs more light to hold.",
  },
] as const;

const FAQS = [
  {
    q: "What does the score actually mean?",
    a: "90–100 is a strong match, 80–89 is easy to wear, 70–79 is worth a try. Below 70 is a bolder choice — still allowed, just louder at the face. Scores are guidance, not verdicts.",
  },
  {
    q: "Does the reading leave my device?",
    a: "No. The face mesh and skin reading run in this browser tab. If you ask for a server check, only the measured colour values are sent — never the image.",
  },
  {
    q: "Why only six colours?",
    a: "Six is enough range to compare without overwhelm. Every colour still comes from the full 5,498-shade collection; the shortlist is just the part we put in front of you first.",
  },
  {
    q: "Will it work in artificial light?",
    a: "It works best in soft, even daylight. Mixed light can move the reading, so the app waits for three close readings before it saves your tone.",
  },
  {
    q: "Can I use an old photo?",
    a: "Yes, if it is front-facing, well lit and not filtered. A clear portrait gives the same reading path as the camera.",
  },
  {
    q: "Is Fitzpatrick a diagnosis?",
    a: "No. It is a rough estimate from the measured tone, not a clinical assessment. Treat it as context, not a medical result.",
  },
] as const;

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="atl-pill">{children}</span>;
}

function AtelierColourBox({
  label = "BEST OF SIX",
  state = "TONE LOCKED",
}: {
  label?: string;
  state?: string;
}) {
  return (
    <div className="atl-colour-box">
      <div
        className="atl-colour-main"
        style={{ background: PALETTE[0].hex, color: readableInk(PALETTE[0].hex) }}
      >
        <div className="atl-colour-top">
          <span>{label}</span>
          <span>{state}</span>
        </div>
        <div className="atl-colour-bottom">
          <div className="atl-colour-name">Saffron</div>
          <div className="atl-colour-meta">#C88928 · 94/100 · SIGNATURE</div>
        </div>
      </div>
      <div className="atl-colour-strip">
        {PALETTE.map((colour, index) => (
          <div className="atl-swatch" data-active={index === 0} key={colour.name}>
            <span className="atl-swatch-colour" style={{ background: colour.hex }} />
            <span className="atl-swatch-label">
              <strong>
                {index === 0 ? "● " : ""}
                {colour.name}
              </strong>
              <em>{colour.score}</em>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="atl-stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function SectionHeading({
  pill,
  lineOne,
  lineTwo,
  body,
  align = "left",
}: {
  pill: string;
  lineOne: string;
  lineTwo: string;
  body?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={`atl-section-heading ${align === "center" ? "is-center" : ""}`}>
      <Pill>{pill}</Pill>
      <h2>
        <span>{lineOne}</span>
        <span>{lineTwo}</span>
      </h2>
      {body ? <p>{body}</p> : null}
    </div>
  );
}

function FaceDiagram() {
  return (
    <div className="atl-face" aria-hidden="true">
      <span className="atl-face-oval" />
      <span className="atl-face-dot atl-dot-one" />
      <span className="atl-face-dot atl-dot-two" />
      <span className="atl-face-dot atl-dot-three" />
      <span className="atl-face-dot atl-dot-four" />
      <span className="atl-face-scan" />
    </div>
  );
}

export function AtelierLanding() {
  const { hidden, scrollY } = useSmoothScroll();
  const heroRef = useRef<HTMLElement>(null);
  const [heroHeight, setHeroHeight] = useState(900);

  useEffect(() => {
    const hero = heroRef.current;
    if (hero) setHeroHeight(hero.offsetHeight);
  }, []);

  // The nav sits over the portrait while the hero is on screen; once the page
  // has moved past the hero it needs a legible surface of its own.
  const pastHero = scrollY > heroHeight - 40;

  return (
    <div className="atl">
      <section className="atl-hero" id="top" ref={heroRef}>
        <div className="atl-portrait" aria-hidden="true" />
        <div className="atl-portrait-scrim" aria-hidden="true" />

        <header
          className={`atl-nav${hidden ? " is-hidden" : ""}${pastHero ? " is-scrolled" : ""}`}
        >
          <Link className="atl-brand" href="#top">
            <strong>Auriga</strong>
            <span />
            <em>COLOUR ATELIER</em>
          </Link>
          <nav className="atl-nav-links" aria-label="Primary">
            <Link href="/read#read">Tone</Link>
            <Link href="/read#shades">Colours</Link>
            <Link href="/read#method">How it works</Link>
            <Link className="atl-nav-cta" href="/read">
              Start a reading
            </Link>
          </nav>
        </header>

        <div className="atl-hero-copy">
          <Pill>SKIN TONE · 5,498 REAL FABRICS</Pill>
          <h1>
            <span>Find the colours</span>
            <span>that suit your face.</span>
          </h1>
          <p className="atl-lede">
            Auriga reads the light on your skin and searches 5,498 real scarves and fabrics for the
            colours that will look best near your face.
          </p>
          <div className="atl-actions">
            <Link className="atl-button atl-button-dark" href="/read">
              <Camera size={15} strokeWidth={1.8} />
              Use camera
            </Link>
            <Link className="atl-button atl-button-light" href="/read">
              <Upload size={15} strokeWidth={1.8} />
              Upload a photo
            </Link>
          </div>
          <p className="atl-privacy">ON-DEVICE · NOTHING UPLOADED · CAMERA NEEDS A SECURE CONTEXT</p>
          <div className="atl-stats">
            <Stat value="5,498" label="REAL COLOURS" />
            <Stat value="15" label="SHOPS" />
            <Stat value="6" label="RANKED AT ONCE" />
          </div>
        </div>

        <div className="atl-hero-box">
          <p className="atl-box-caption">LIVE SAMPLE · COLOUR BOX</p>
          <AtelierColourBox />
        </div>
        <span className="atl-portrait-chip">SAMPLE · FRAME 042</span>
      </section>

      <section className="atl-intro">
        <Pill>A NEW APPROACH</Pill>
        <h2>
          <span>Colour advice,</span>
          <span>without the guesswork.</span>
        </h2>
        <p>
          The usual answer is four hundred swatches and a trend cycle. Auriga measures the skin you
          have, searches real stock, and gives you six colours with a reason attached to each one.
        </p>
        <Link className="atl-text-link" href="/read#method">
          See how the reading works
          <ArrowRight size={13} strokeWidth={1.8} />
        </Link>
      </section>

      <section className="atl-compare">
        <article className="atl-compare-card atl-old">
          <div className="atl-card-head">
            <span>THE OLD WAY</span>
            <span>WHAT YOU DO NOW</span>
          </div>
          <h3>
            <span>Guesswork,</span>
            <span>dressed as choice.</span>
          </h3>
          <ol>
            {[
              "Pick from a colour wheel.",
              "Buy six; return five.",
              "Trust the shop's light.",
              "Never know why it worked.",
            ].map((item, index) => (
              <li key={item}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{item}</p>
              </li>
            ))}
          </ol>
        </article>

        <article className="atl-compare-card atl-new">
          <div className="atl-card-head">
            <span>THE AURIGA WAY</span>
            <span>WHAT THE READING DOES</span>
          </div>
          <h3>
            <span>A reading,</span>
            <span>then six colours.</span>
          </h3>
          <ol>
            {[
              "Read the light on your face.",
              "Search 5,498 real fabrics.",
              "Rank six against your tone.",
              "Keep the reason beside each one.",
            ].map((item, index) => (
              <li key={item}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{item}</p>
              </li>
            ))}
          </ol>
        </article>
      </section>

      <section className="atl-analysis">
        <div className="atl-analysis-head">
          <SectionHeading
            pill="PERSONALIZED ANALYSIS"
            lineOne="See the reading"
            lineTwo="before you choose."
          />
          <p>
            Face mesh, CIELAB values, confidence and quality — the same numbers that rank the six
            colours, visible while the reading settles. No colour is painted onto the face.
          </p>
        </div>

        <div className="atl-analysis-panel">
          <div className="atl-analysis-portrait">
            <span className="atl-live-chip">
              <i />
              LIVE · FACE
            </span>
            <span className="atl-frame-chip">FRAME 042 · 30 FPS</span>
          </div>
          <div className="atl-analysis-colour">
            <AtelierColourBox />
            <p>478 LANDMARKS · CHEEKS + FOREHEAD</p>
          </div>
          <div className="atl-analysis-reading">
            <div className="atl-reading-head">
              <span>SKIN READING</span>
              <span>
                <i />
                91/100 · HIGH
              </span>
            </div>
            <div className="atl-reading-skin">
              <span style={{ background: "#8A5A3B" }} />
              <div>
                <small>#8A5A3B</small>
                <strong>Medium-deep · Neutral-warm</strong>
                <p>Neutral-warm with a green-grey lean.</p>
              </div>
            </div>
            <div className="atl-reading-bar">
              <span>CONFIDENCE</span>
              <span>91/100 · consistent</span>
              <i>
                <b />
              </i>
            </div>
            <div className="atl-reading-values">
              <span><small>L*</small>42.8</span>
              <span><small>a*</small>15.2</span>
              <span><small>b*</small>21.6</span>
              <span><small>ITA°</small>8.4°</span>
              <span><small>FITZ</small>~V</span>
            </div>
          </div>
          <div className="atl-palette">
            <div className="atl-panel-head">
              <span>DEEP AUTUMN</span>
              <span>10 COLOURS</span>
            </div>
            <div className="atl-palette-grid">
              {[
                "#8C4A21",
                "#A9612C",
                "#C88928",
                "#C9A227",
                "#6F7A3F",
                "#43563C",
                "#2E6F73",
                "#7A3B2E",
                "#5C1F2A",
                "#8A5A3B",
              ].map((hex) => (
                <i key={hex} style={{ background: hex }} />
              ))}
            </div>
            <p>YOUR SEASON, NOT A TREND CYCLE</p>
          </div>
          <div className="atl-quality">
            <div className="atl-panel-head">
              <span>QUALITY</span>
              <span>LIVE</span>
            </div>
            {[
              ["Sample", "5,208 px"],
              ["Spread", "1.8 ΔE"],
              ["Detect", "9 ms"],
              ["Source", "camera"],
              ["FPS", "30"],
              ["Tone", "locked 3/3"],
            ].map(([key, value]) => (
              <div className="atl-quality-row" key={key}>
                <span>{key}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <p className="atl-analysis-footnote">
            SAMPLE READING · NOTHING UPLOADED · COLOUR VISUALISATION, NOT A FIT ASSESSMENT
          </p>
        </div>
      </section>

      <section className="atl-collection">
        <div className="atl-collection-head">
          <SectionHeading
            pill="THE COLLECTION"
            lineOne="Real fabrics,"
            lineTwo="ranked for your face."
            body="Each colour is scored on lightness, chroma, temperature and hue against your reading. The six are diversified so you see range, not six versions of the same shade."
          />
          <div className="atl-collection-count">
            <strong>5,498</strong>
            <span>REAL COLOURS · 15 SHOPS</span>
          </div>
        </div>

        <div className="atl-filters">
          <div className="atl-filter-group">
            <Link className="atl-search" href="/read#shades">
              <Search size={14} strokeWidth={1.8} />
              Search a colour, shop or fabric
            </Link>
            <Link className="atl-filter" href="/read#shades">Scarves &amp; fabric <ChevronDown size={13} /></Link>
            <Link className="atl-filter" href="/read#shades">Any colour <ChevronDown size={13} /></Link>
            <Link className="atl-filter" href="/read#shades">Any shop <ChevronDown size={13} /></Link>
          </div>
          <Link className="atl-filter atl-sort" href="/read#shades">Best for you <ChevronDown size={13} /></Link>
        </div>

        <div className="atl-results-meta">
          <span>SHOWING 6 OF 5,498 · SORTED FOR YOUR TONE</span>
          <span>SCORES GUIDE, NOT VERDICT</span>
        </div>

        <div className="atl-card-grid">
          {COLLECTION.map((card, index) => (
            <article className="atl-colour-card" key={card.name}>
              <div className="atl-card-colour" style={{ background: card.hex }}>
                <span>{String(index + 1).padStart(2, "0")}</span>
              </div>
              <div className="atl-card-body">
                <div className="atl-card-title">
                  <strong>{card.name}</strong>
                  <span>{card.score}</span>
                </div>
                <div className="atl-card-shop">
                  <span>{card.shop}</span>
                  <span>{card.verdict.toUpperCase()}</span>
                </div>
                <p className="atl-card-reason">{card.reason}</p>
                <Link className="atl-card-link" href="/read#shades">
                  VIEW THE COLOUR
                  <ArrowUpRight size={13} strokeWidth={1.8} />
                </Link>
              </div>
            </article>
          ))}
        </div>

        <div className="atl-collection-note">
          <p>
            Scores are guidance, not verdicts. Every colour here flatters; the rank is about how
            much attention it asks for. Sample rows from the live catalogue.
          </p>
          <Link className="atl-text-link" href="/read#shades">
            Search all 5,498 colours
            <ArrowUpRight size={13} strokeWidth={1.8} />
          </Link>
        </div>
      </section>

      <section className="atl-how">
        <SectionHeading
          pill="HOW IT WORKS"
          lineOne="Three steps."
          lineTwo="Then it holds."
          body="One reading. Five thousand real colours. Six that sit close to your face — and a plain-language reason for every one."
          align="center"
        />

        <div className="atl-how-grid">
          <article className="atl-how-step">
            <div className="atl-how-visual">
              <div className="atl-how-face-card">
                <FaceDiagram />
                <span>478 POINTS</span>
              </div>
            </div>
            <span className="atl-step-index">01</span>
            <h3>Read the light</h3>
            <p>478 landmarks keep the sample on your cheeks and forehead — not hair, not shadow.</p>
          </article>

          <article className="atl-how-step">
            <div className="atl-how-visual">
              <div className="atl-how-search">
                <Search size={13} strokeWidth={1.8} />
                Search 5,498 colours
              </div>
              <div className="atl-how-swatches">
                {PALETTE.map((colour) => (
                  <i key={colour.hex} style={{ background: colour.hex }} />
                ))}
              </div>
            </div>
            <span className="atl-step-index">02</span>
            <h3>Search the stock</h3>
            <p>5,498 colours from 15 shops, each tied to a real product in the live catalogue.</p>
          </article>

          <article className="atl-how-step">
            <div className="atl-how-visual">
              <div className="atl-how-rank">
                <div>
                  <strong>94/100</strong>
                  <i style={{ background: "#C88928" }} />
                </div>
                <span><b /> 94/100</span>
                <em>SIGNATURE · 94/100</em>
              </div>
            </div>
            <span className="atl-step-index">03</span>
            <h3>Rank and explain</h3>
            <p>Six colours, scored for lightness, chroma, temperature and hue harmony.</p>
          </article>
        </div>

        <div className="atl-score-band">
          <div>
            <span>WHAT THE SCORE MEANS</span>
            <p>A guide, not a leaderboard.</p>
          </div>
          {[
            ["90–100", "A strong match"],
            ["80–89", "Easy to wear"],
            ["70–79", "Worth a try"],
            ["Below 70", "A bolder choice"],
          ].map(([range, label]) => (
            <div key={range}>
              <strong>{range}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="atl-faq">
        <div className="atl-faq-intro">
          <Pill>YOUR QUESTIONS</Pill>
          <h2>
            <span>Questions,</span>
            <span>answered.</span>
          </h2>
          <p>
            No codes, no caveats buried in a modal. Here is the short version of how the reading
            behaves.
          </p>
          <Link className="atl-text-link" href="/read#method">
            Read the full method
            <ArrowRight size={13} strokeWidth={1.8} />
          </Link>
        </div>
        <div className="atl-faq-list">
          {FAQS.map((faq, index) => (
            <details key={faq.q} open={index === 0}>
              <summary>
                {faq.q}
                <ChevronDown size={16} strokeWidth={1.8} />
              </summary>
              <p>{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="atl-cta">
        <div className="atl-cta-top">
          <div className="atl-cta-copy">
            <Pill>START A READING</Pill>
            <h2>
              <span>Your colours,</span>
              <span>from the real collection.</span>
            </h2>
            <p className="atl-cta-meta">5,498 real colours · 15 shops</p>
            <p>
              One reading, six colours with a reason. Camera or photo — nothing leaves this tab.
            </p>
          </div>
          <div className="atl-cta-actions">
            <Link className="atl-button atl-button-light" href="/read">
              <Camera size={15} strokeWidth={1.8} />
              Use camera
            </Link>
            <Link className="atl-button atl-button-ghost" href="/read">
              <Upload size={15} strokeWidth={1.8} />
              Upload a photo
            </Link>
          </div>
        </div>
        <div className="atl-cta-foot">
          <span>478 LANDMARKS · SIX COLOURS RANKED</span>
          <span>CAMERA OR PHOTO · NOTHING LEAVES THIS TAB</span>
        </div>
      </section>

      <footer className="atl-footer">
        <div className="atl-footer-top">
          <div className="atl-footer-brand">
            <strong>Auriga</strong>
            <span>COLOUR ATELIER</span>
            <p>A local-first shade reading. Built for faces, not filters.</p>
          </div>
          <div className="atl-footer-col">
            <span>READ</span>
            <Link href="/read#read">Tone</Link>
            <Link href="/read#shades">Colours</Link>
            <Link href="/read#method">How it works</Link>
            <Link href="/read#method">Method</Link>
          </div>
          <div className="atl-footer-col">
            <span>COLLECTION</span>
            <Link href="/read#shades">Scarves &amp; fabric</Link>
            <Link href="/read#shades">Colour index</Link>
            <Link href="/read#shades">Shops</Link>
            <Link href="/read#shades">All colours</Link>
          </div>
          <div className="atl-footer-col">
            <span>COMPANY</span>
            <Link href="/read#method">About</Link>
            <Link href="/read#method">Privacy</Link>
            <Link href="/read#method">Contact</Link>
            <Link href="/read#method">Press</Link>
          </div>
          <div className="atl-footer-legal">
            <span>COLOUR VISUALISATION · NOT A FIT OR MEDICAL ASSESSMENT</span>
            <span>FITZPATRICK IS ALWAYS AN ESTIMATE</span>
            <span>© 2025 AURIGA</span>
          </div>
        </div>
        <div className="atl-footer-giant" aria-hidden="true">Auriga</div>
      </footer>
    </div>
  );
}
