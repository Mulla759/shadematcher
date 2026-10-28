# Auriga — open catalogue shade reading (MVP)

`/` is the Atelier landing page from `auriga.pen`. `/read` is the live shade-reading app.

The core loop:

**webcam → 478-point face mesh → CIELAB / ITA° skin reading → open scraped textile catalogue → ranked colourways → colour card above the frame → one API endpoint.**

No hood is drawn on the face. The colour comparison lives in a box above the video, so you can judge it against your face and hair. The search runs across **5,498 scraped textile colourways from 15 stores**, not a fixed demo shortlist.

## Run it

```bash
npm install          # also runs setup:assets (postinstall)
npm run dev
```

`npm install` restores the MediaPipe runtime and the two model files through the `postinstall` hook. Run `npm run setup:assets` by hand if the assets are missing; `npm run setup:assets -- --strict` fails instead of warning, which is what CI and the Vercel build use.

Open **http://localhost:3000** for the landing page, then **http://localhost:3000/read** for the reading app.

Camera access requires a secure context. `localhost` counts. If you open the app from a phone or another machine on the LAN, serve it over HTTPS (or use a tunnel); a plain `http://192.168.x.x` page will not get camera permission.

Click **Start camera**, or **Upload photo** for a still portrait. For camera access, allow the browser permission. Use Chrome or Edge for the WebGL delegate. If the GPU delegate is rejected, the app falls back to CPU and shows a warning; the reading still works, the mesh is slower.

## Repository layout

Tracked in Git (the app runs from a fresh clone with just `npm install` + `npm run setup:assets`):

| Path | What it is |
| --- | --- |
| `src/` | App router pages, components, colour/skin engine, API routes |
| `tests/` | Vitest suites for colour maths, skin analysis and the API engine |
| `scripts/` | Scraper, catalogue index builder, design-comparison harness |
| `public/catalog/shades.json` | Generated 5,498-shade search index — needed at runtime, so it is committed |
| `public/demo/`, `public/fonts/`, `public/auriga-assets/` | Demo portraits, webfonts, landing imagery |
| `auriga.pen`, `auriga-assets/` | Design source of truth for the landing page |
| `*.md` | README, colour research, agent handoff specs |

Deliberately **not** in Git (generated, large or local):

| Path | Size | Rebuild with |
| --- | --- | --- |
| `node_modules/` | ~500 MB | `npm install` |
| `library/` | ~1.3 GB | `npm run scrape:all` (store photography — do not republish) |
| `data/` | ~208 MB | `npm run scrape:all` (raw scrape JSON + logs) |
| `public/models/`, `public/mediapipe/wasm/` | ~58 MB | `npm run setup:assets` |
| `.next/`, `*.tsbuildinfo` | — | `npm run build` |
| `.screens/`, `out/` | — | local scratch only |

If `library/` is missing, the search index still loads but the product photography behind each colour will 404. Point `AURIGA_LIBRARY_DIR` (see `.env.example`) at a mounted copy on a server.

## Deploy to Vercel

Live now: **https://shadematcher.vercel.app** (public beta). The Vercel project is linked to this repository, so every push to `main` builds and deploys automatically — no dashboard step needed.

The project runs the Next.js preset with the build command from `vercel.json`: `npm run setup:assets -- --strict && next build`. The strict flag matters — without it the build would succeed with no face model and the app would fail to read a face.

Set these environment variables in Vercel → Settings → Environment Variables (all optional — the app runs with none of them set):

| Variable | Effect |
| --- | --- |
| `NEXT_PUBLIC_BETA_MODE=1` | Beta banner, feedback form, `noindex` + `robots.txt` disallow. Set to `0` (or remove) at launch. |
| `NEXT_PUBLIC_SHOW_PHOTOS=0` | Product photos off by default in production — the scraped library is not deployable. Swatches fall back to the measured hex. |
| `FOUNDATIONS_ENABLED=0` | Foundation matches off in production: the atlas is a generated reference grid, not retail data. |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Vercel KV or Upstash Redis. Enables rate limiting that works across serverless instances; without it the limiter is per-instance. This project has its **own** Upstash database (`shadematcher-kv`, pay-as-you-go) — it is not shared with any other project. |
| `FEEDBACK_WEBHOOK_URL` | Optional webhook that receives beta feedback and client error reports. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Optional contact address shown on `/privacy`. |
| `NEXT_PUBLIC_FEEDBACK_URL` | Optional external feedback form instead of the built-in one. |
| `NEXT_PUBLIC_ANALYTICS=1` | Vercel Web Analytics (also enable it in the Vercel dashboard). Off by default because the script only exists on Vercel. |

`NEXT_PUBLIC_*` values are inlined into the browser bundle at build time — set them before the deployment builds, not after.

Verify a deployment with the smoke test:

```bash
BASE_URL=https://your-deployment.vercel.app npm run smoke
```

It checks that the pages render, the model assets are present, the **full** catalogue is bundled (not the demo fallback) and `/api/v1/match` answers.

### What a deployment cannot have

- **Product photography.** `library/` is 1.3 GB of third-party store photography and is not in Git. On the public beta the swatches fall back to the measured hex. For a private deployment, `npm run library:subset` copies a subset into `public/photos/`, which the app serves as a fallback. Do not commit it.
- **Foundation recommendations** until real brand data replaces the generated atlas.

## Public testing (beta mode)

With `NEXT_PUBLIC_BETA_MODE=1` the build:

- shows a dismissible beta banner with a feedback form that posts to `POST /api/v1/feedback` (server log, or `FEEDBACK_WEBHOOK_URL`);
- reports uncaught client errors to the same endpoint;
- keeps the site out of search results (`noindex` + `robots.txt` disallow);
- serves `/privacy`, which states what stays on the device, what leaves it and what the server keeps.

Rate limiting is shared across serverless instances through this project's own Upstash database (`shadematcher-kv`): 40 requests per minute per IP on `POST /api/v1/match`, 8 per 10 minutes on `POST /api/v1/feedback`.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Atelier landing page: hero, sample colour box, reading breakdown, collection, how it works, FAQ and CTA |
| `/read` | Open catalogue app: live camera or uploaded photo, tone reading, 5,498-shade search, colour box above the frame, API call |
| `/lab` | Raw capability: face mesh overlay, sample regions, compute timings, handoff JSON |
| `/studio` | Experimental fuller panel (colour list, garment check, foundation list). Not linked from `/`. |
| `POST /api/v1/match` | The all-in-one endpoint: face samples + optional garment → skin profile, ranked colours, garment verdict, foundation matches |
| `GET /api/v1/catalog` | Demo fallback fabrics + foundation shades + season palettes, plus the catalogue meta (count, stores, source) |
| `GET /api/v1/health` | Model/asset readiness and endpoint list |
| `GET /privacy` | What stays on the device, what leaves it, what the server keeps |
| `POST /api/v1/feedback` | Beta feedback and client error reports (server log or webhook) |

## What `/read` does

1. **Camera or photo** — `getUserMedia` for live, or upload a front-facing portrait. Both use the same face mesh and sampling path.
2. **Face mesh** — MediaPipe `FaceLandmarker`, 478 landmarks, in the browser.
3. **Sample** — forehead, both cheeks, nose, jaw, neck; eyes/brows/lips/nostrils excluded; sclera white reference; median + CIEDE2000 outlier rejection; lit-skin band at the 70th lightness percentile so shadows do not drag the reading down.
4. **Read** — sRGB → linear → XYZ → CIELAB (D65). ITA° for depth, hue/chroma for undertone, confidence from sample count, region agreement, lighting, evenness, face size and pose. The tone then **locks** after three close, confident readings and holds; only genuinely different light unlocks it.
5. **Rank** — garment score weights: lightness separation 40%, chroma 25%, temperature 20%, hue 15%, plus a small season-affinity bonus. `ΔE00` with `kL=1.5` for fabrics.
6. **Search** — every measured textile colour in the scraped catalogue is scored against the reading. The shade sheet shows a diversified shortlist with product images, store, fabric, score and a link to the product. Search by colour, fabric, store or hex; filter by category, family or store; sort by match, lightness, hue or name.
7. **Show** — the top six colours appear in the box above the frame; the active catalogue colour gets the large field. Nothing is drawn on the head.
8. **Prove the engine** — “Check with server” posts the reading to `POST /api/v1/match` and scores the same catalogue server-side.

### Reading progress

A reading is four steps, and the page always says where you are:

| Step | What it means |
| --- | --- |
| 01 Find your face | The guide has not locked onto a face yet |
| 02 Read the light | Readings are being taken; the meter counts to three |
| 03 Lock the tone | Three close readings agree, the tone is held |
| 04 Rank your colours | The shortlist is scored against your tone |

- The stepper sits above the camera and the current step carries a progress meter.
- A readout in the sticky top bar (`TONE LOCKED` / `READING 2/3`) keeps the state visible from any scroll position.
- When the tone locks, a **See your six colours** button appears and scrolls to the collection.
- The scan's own colour card travels down with the collection, so the locked tone and the colours it produced sit in one place.

## Scroll behaviour

`/` and `/read` use [Lenis](https://github.com/darkroomengineering/lenis) for interpolated scrolling.
The provider lives in `src/components/SmoothScroll.tsx` and is mounted in the root layout.

- The landing nav and the reading top bar **hide while scrolling down** and come back the moment you scroll up.
- The landing nav gets a paper surface once it passes the hero, so it stays legible over the page.
- Same-page anchors are handled by the provider so a jump is measured after the layout settles instead of landing short.
- Panels that scroll on their own (the colour list, the JSON dump) carry `data-lenis-prevent` and keep native scrolling.
- `/lab` and `/studio` keep native scrolling: they have code panels and long diagnostic lists.

## Rebuild the scraped catalogue

The search index is generated from the scraped storefront library:

```bash
npm run library:catalog
```

This reads `library/catalog.json` and writes `public/catalog/shades.json`:

- **5,498 textile colourways** after the same gallery filter used by `library/print-flow.html`
- **15 stores**, one row per actual product photo
- measured dominant hex, family, finish, store, category, fabric, price and product URL
- no image copying: `/library/...` serves the local photography through a typed route

The catalogue is loaded once by a Web Worker and scored on-device. The face mesh still uses
MediaPipe WASM with a GPU delegate and automatic CPU fallback.

## How it finds matches

The catalogue is built offline and ranked on-device. Nothing about the search needs the server.

### 1. Collect — `scripts/scrape-library.mjs`

`data/sources.json` is the registry: 15 Shopify storefronts, each with a role (reference brand,
hijab brand, fabric reference) and a per-store cap on products and images so the crawl stays
bounded and polite. Every store exposes a public `/products.json` feed, which the scraper pages
through 250 products at a time and caches to `data/raw/<slug>-products.json` — 208 MB of raw
payload across 20 files, the largest being Zelouf Fabrics at 55 MB.

Each product image is downloaded with sharp, resized to 900 px wide, and filed as
`library/<store>/<category>/<fabric>/<family>/<colour>/NN.jpg`.

### 2. Measure — the shade is read from the photograph

For every photo, sharp crops the **centre band** (50 % of the width, starting a quarter of the
way down) to skip the white studio backdrop and the model or hanger, downsamples it to 40×40,
and throws away near-white pixels (backdrop) and near-black pixels (shadow). The shade is the
**median** remaining pixel — not the mean — so one bright highlight or one deep fold cannot
drag the colour. Each photo also records its variance (which becomes Matte or Shiny), a
three-bucket light/mid/dark palette, and a gradient measure for the gradient-heavy stores.

Text does the classification: colour words in the title and tags map to eight canonical
families, fabric words to a canonical fabric, the Shopify product type to a category. Where a
product carries no usable colour word, the measured hex decides the family instead.

Every product keeps a `meta.json` and every store a `manifest.json`, with a library-wide
`library/index.json` recording what was collected.

**What that run produced** — from `library/index.json`, scraped 2026-10-24 between 07:45 and
08:41 UTC, about 56 minutes wall clock:

| | Count |
| --- | --- |
| Stores | 15 |
| Products | 7,441 |
| Images | 12,310 |

The biggest contributors were Vela Scarves (769 products, 2,716 images), Fabric Wholesale
Direct (1,405), Try Modest (1,368), Zelouf Fabrics (1,154), Unique Hijabs (500), Modish Hijab
(400), Kabayare Fashion (400) and Voile Chic (411).

### 3. Flatten — `scripts/build-index.mjs`

Writes `library/catalog.json` (one row per colourway, 8.2 MB), `library/colors.csv` (4.3 MB),
`library/gallery.html`, and `src/lib/library.generated.ts` — the hex-deduplicated fallback the
server uses when the index is not present.

### 4. Publish — `scripts/build-catalog-index.mjs`

Applies the same textile filter as the print-flow gallery (textiles only — no accessories,
gifts or beauty — and one row per actual product photo) and writes `public/catalog/shades.json`:
**5,498 colourways, 15 stores, 2.6 MB**, generated 2026-10-25.

| Families | | Categories | | Stores | |
| --- | --- | --- | --- | --- | --- |
| Neutral | 2,611 | apparel | 1,974 | Try Modest | 1,159 |
| Orange | 697 | scarves | 2,263 | Fabric Wholesale Direct | 1,141 |
| Blue | 570 | fabric | 672 | Vela Scarves | 631 |
| Green | 492 | specialised | 589 | Unique Hijabs | 459 |
| Red | 364 | | | Zelouf Fabrics | 452 |
| Pink | 360 | | | Modish Hijab | 392 |
| Yellow | 218 | | | Kabayare Fashion | 359 |
| Purple | 186 | | | Voile Chic | 238 |

### 5. Rank — in a Web Worker, on the user's machine

The browser downloads `shades.json` once and hands it to `src/components/shade/catalogue.worker.ts`,
which holds the 5,498 rows in memory with a lookup map by id. A search filters by family, store,
category, face-framing relevance and free text, then scores the survivors with
`recommendFabrics` — **the same engine the server uses**: lightness separation 40 %, chroma
25 %, temperature 20 %, hue 15 %, plus a small season-affinity bonus, with ΔE00 at kL = 1.5.

The shortlist is then **diversified** so the six picks are six different looks rather than six
shades of the same colour: at most two per family, a candidate rejected when it is within ΔE00 7
of an already-picked colour, relaxed to ΔE00 5 and then filled in order if the list is still
short.

Because all of this runs in a worker, the camera keeps its frame rate while the search happens,
and no colourway, product or price ever leaves the browser. `POST /api/v1/match` then runs the
same ranking against the same bundled index, which is why **Check with server** returns the same
top colour as the screen.

## The one endpoint

```bash
curl -X POST http://localhost:3000/api/v1/match \
  -H "Content-Type: application/json" \
  -d '{
    "face": {
      "samples": [
        { "lab": { "l": 40, "a": 12, "b": 15 }, "region": "leftCheek" },
        { "lab": { "l": 41, "a": 12, "b": 15 }, "region": "rightCheek" },
        { "lab": { "l": 42, "a": 11, "b": 14 }, "region": "forehead" }
      ],
      "quality": { "lighting": 0.72, "evenness": 0.7, "faceSize": 0.34 }
    },
    "garment": { "hex": "#7C2433", "name": "Pomegranate" },
    "options": { "category": "hijab", "catalogue": "face", "limit": 6, "includeFoundations": true }
  }'
```

You can also send:

- `face.landmarks` (478 `{x,y}` points) + `image` (base64 data URL): the server samples the image itself.
- `image` alone: a centred-face heuristic, returned with a low-confidence warning.
- `garment.image` + `image`: server-side palette extraction.
- `garment.hex`: exact-colour evaluation and better pairings.

Response shape (abridged):

```json
{
  "ok": true,
  "skin": {
    "hex": "#7A5A42",
    "lab": { "l": 40.1, "a": 12.2, "b": 15.1 },
    "ita": -29.1,
    "depth": "tan",
    "undertone": "olive",
    "season": { "name": "Deep Autumn" },
    "confidence": { "score": 72, "label": "good" }
  },
  "colour": {
    "best": [
      { "colour": { "name": "Camel", "hex": "#B08A5E" }, "score": 99, "verdict": "signature" }
    ],
    "avoid": []
  },
  "garment": {
    "input": { "hex": "#7C2433" },
    "score": 71.8,
    "headline": "A reliable choice, with one small caveat.",
    "pairings": []
  },
  "foundation": [],
  "warnings": [],
  "disclaimer": "Visualization only…"
}
```

The full schema is in `src/lib/api/schema.ts`; the orchestration is in `src/lib/api/engine.ts`.

## Why the live route is on-device

- **No frame upload, no per-frame cost.** The browser runs the mesh and colour maths.
- **Measured on the test machine:** ~21–28 fps with the GPU delegate; detect ~25–50 ms, sample ~6–8 ms, analysis ~2 ms.
- **CPU fallback:** MediaPipe falls back to CPU; the UI shows the delegate and a warning. Inference becomes ~150 ms+/frame and the reading updates around 1 Hz. That is still enough for a photo/colour read, not for smooth live tracking.
- **A GPU worker is not needed for this MVP.** The 5,498-row catalogue search runs in a CPU Web Worker; moving that to a GPU kernel would add round-trip overhead. A GPU worker becomes useful for photoreal rendering, heavier hair/head segmentation, low-end phones, or much larger catalogues. The `/api/v1/match` JSON contract is the seam: swap the engine behind it without changing the UI.

## What is deliberately not claimed

- **Not a fit or drape guarantee.** A made-to-measure hijab needs measurements, pattern geometry and fabric mechanics. This MVP is a colour visualization.
- **Not a dermatology or Fitzpatrick assessment.** Fitzpatrick is estimated from ITA° and labelled with a tilde; ITA is not a clinical diagnosis.
- **Foundations are a demo atlas.** `Auriga Atlas` is a generated 60-shade reference grid, not retail product data. Import a brand catalogue before making purchase claims.
- **No LLM call.** The “handoff JSON” is the input an agent can consume later. The live path is deterministic and local.
- **No accounts, no persistence.** Camera frames stay in the tab. The API call sends colour samples/landmarks, not the image, from `/`.
- **Catalogue hex is photographic.** It is the measured dominant shade of a product photo, not a studio spectrophotometer reading. Screen and dye variation still apply.
- **The search is local.** The 5,498-row index is loaded once by a Web Worker. The face mesh uses MediaPipe WASM with GPU/CPU fallback.

## Project map

```
src/app/page.tsx                 Atelier landing page
src/app/read/page.tsx            open catalogue shade studio
src/components/landing/*         landing page sections
src/components/SmoothScroll.tsx  Lenis provider + scroll state
src/app/landing.css              landing page styles
src/app/lab/page.tsx             raw capability
src/app/studio/page.tsx          experimental full panel
src/app/api/v1/match/route.ts    one endpoint
src/app/library/[...path]/route.ts  local scraped image serving
src/components/shade/*           studio UI, catalogue hook, search worker
src/lib/library.ts               catalogue types + FabricColour adapter
src/lib/server/library.ts        server-side catalogue loader
public/catalog/shades.json       generated 5,498-shade search index
scripts/build-catalog-index.mjs  catalogue index generator
scripts/design-check/            design vs. site comparison harness
src/lib/color.ts                 sRGB/Lab, CIEDE2000, ITA
src/lib/skin.ts                  sampling analysis, confidence, palettes
src/lib/match.ts                 fabric + foundation scoring
src/lib/face/landmarks.ts        478 landmarks, face oval, skin sampling
src/lib/face/vision.ts           MediaPipe loaders, detection, segmentation
src/lib/face/mesh.ts             diagnostic mesh renderer
src/lib/api/engine.ts            request orchestration
src/lib/catalog.ts               demo fallback catalogue
src/components/lab/useToneLab.ts camera + mesh + reading loop
src/app/privacy/page.tsx         what stays on device, what leaves it
src/app/api/v1/feedback/route.ts beta feedback + client error reports
src/components/BetaBanner.tsx    beta notice and feedback form
src/lib/beta.ts                  feature flags (beta, photos, foundations)
src/lib/server/rate-limit.ts     KV/Upstash limiter with local fallback
scripts/smoke.mjs                post-deploy verification
scripts/build-public-library.mjs optional photo subset for private hosting
.vercelignore                    keeps the 1.5 GB library out of the upload
.github/workflows/ci.yml         test + typecheck + build on every push
```

## Tests

```bash
npm test
```

56 tests cover colour conversions, 34 CIEDE2000 reference pairs, robust skin analysis, fabric scoring, foundation matching, the API engine, the rate limiter and the feature flags.

## Research note

Perfect Corp / YouCam does **not** expose a public “Foundation Shade Finder” endpoint. Its public stack is AI Facial Color Tones Analyzer (20 units) + your own shade database + Makeup VTO (1 unit); scarf VTO is an async generative photo render (2 units, 896×1152), not live drape. The intelligence layer — shade catalogue, undertone logic, ΔE00 ranking, garment evaluation, pairing — is the part you build. This repo is that layer, kept intentionally small.

Demo portraits: Unsplash (`photo-1494790108377-be9c29b29330`, `photo-1531123897727-8f129e1688ce`, `photo-1544005313-94ddf0286df2`). Replace them with your own consented test images before a public launch — see `public/demo/README.md`.

## Library / gallery

The scraped fabric library lives in `library/` and is **not in Git** — it is ~1.3 GB of store photography. It holds 7,441 colourways and ~12k images across 15 stores, and `/read` serves those images through `src/app/library/[...path]/route.ts` while the colour data itself comes from the committed `public/catalog/shades.json`.

- `library/print-flow.html` — one flowing, hue-sorted collage of 5,498 actual print/fabric photos. Click any tile for the 900px product photo; “Expand full collage” opens the full JPEG.
- `library/gallery.html` — the colourway card index; it links to the print flow.
- `library/README.md` — scrape provenance, caveats and licensing.
- Rebuild the library with `npm run scrape:all`, the index with `npm run library:catalog`, the flow with `npm run print-flow`.

The photography belongs to each store; internal colour research only. Do not republish it.

## Next, in order

1. Replace the demo portraits with consented test images and publish a `/terms` + contact route.
2. Calibrate sampling against a grey card / ColorChecker and add a “lock white balance” mode.
3. Replace the demo foundation atlas with a real brand catalogue and oxidation data.
4. Add a garment image upload to `/` (the server palette extraction already exists).
5. Add a GPU worker only for a photoreal “render this look” path, clearly labelled as an illustration.
6. Separate research track: multi-angle measurements + pattern/cloth simulation for fit and drape.
