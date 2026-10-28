# Auriga — handoff

**Status:** working bare-bones MVP, tested end-to-end.  
**Last updated:** 2026-10-24  
**Dev URL at handoff:** http://localhost:3000  
**Repo:** `/Users/abdullahiabdi56000/null`

---

## 1. What this is

A minimal webcam / photo → skin-tone → colour-match test for Auriga.

It answers one question:

> Given my face, which hijab / garment colours actually work next to it?

It deliberately does **not** draw a hood on the face. The colour comparison is a **box above the video frame**. The face stays clean.

The same engine is exposed as one API endpoint:

```
POST /api/v1/match
```

---

## 2. What is live

| Route | What it does |
| --- | --- |
| `/` | Atelier landing page from `auriga.pen`: hero, sample colour box, reading breakdown, collection, how it works, FAQ, CTA. |
| `/read` | Open catalogue app. Camera **or** upload. 478-point face mesh, skin reading, 5,498-shade scraped textile search, colour box above the frame, one API call. |
| `/lab` | Raw capability / debug. Mesh overlay, sample regions, GPU/CPU timings, handoff JSON. |
| `/studio` | Older full panel. Colour list, garment check, foundation list. **Not linked** from `/`; experimental. |
| `POST /api/v1/match` | One endpoint: face samples/landmarks/image + optional garment → skin profile, ranked colours, garment verdict, pairings, foundation matches. |
| `GET /api/v1/catalog` | 72 demo fallback fabrics + 60 demo foundation shades + season palettes. The open search uses the scraped index instead. |
| `GET /api/v1/health` | Asset readiness + endpoint list. |

**Do not re-enable the hijab overlay by default.** The user explicitly rejected the hood. The drape renderer still exists (`src/lib/preview/hijab.ts`, `useFaceStudio`) but `/read` does not use it. If you add it back, make it opt-in and clearly labelled “visualization, not fit”.

---

## 3. Run it

```bash
cd /Users/abdullahiabdi56000/null
npm install
npm run setup:assets     # downloads face_landmarker.task + selfie_multiclass model
npm run dev
```

Open **http://localhost:3000**.

Camera requires `localhost` or HTTPS. A plain LAN IP (`http://192.168.x.x`) will not get camera permission.

If the camera fails:

- macOS → System Settings → Privacy & Security → Camera → allow the browser.
- Close Zoom / Photo Booth if they hold the camera.
- Use Chrome or Edge for the WebGL delegate.
- The app falls back to CPU and shows a warning; the reading still works, but the mesh is slow.

### Verify

```bash
npm test          # 47 tests pass
npm run typecheck
npm run build     # passes
```

### Last verified readings

| Input | Result |
| --- | --- |
| Upload `public/demo/portrait-02.jpg` | `#85694B` · Tan/deep · Warm · Deep Autumn · score 64/100 · spread 10.7 ΔE · top Oat 99 · API 16 ms |
| Live fake webcam (same portrait, 320×400 Y4M) | `#605438` · Tan/deep · Olive · score 61/100 · spread 9.9 ΔE · 21–28 FPS GPU |

The still-photo reading is the more trustworthy of the two; the fake webcam feed is compressed and mixed-light. Use a real camera in daylight for the real test.

---

## 4. What was built in this session

### MVP page (`/`)

- Live camera via `getUserMedia`, mirrored selfie view.
- **Upload photo** via hidden file input, also available in the camera-off overlay.
- Same face mesh + skin sampling for both sources.
- **No hood.** A colour board above the frame:
  - large active colour card
  - six ranked swatches with scores
  - click a swatch to change the active card
- Live reading panel:
  - hex, depth, undertone, season, score
  - L\*, a\*, b\*, C\*, h°, ITA°
  - Fitzpatrick estimate, spread
  - raw `reading.json`
- **Run API match** → calls `POST /api/v1/match`; shows latency + top result.
- **Copy JSON** → the LLM/agent handoff payload.
- **Show mesh** → optional 478-landmark diagnostic overlay, works on photos too.
- **Use camera** / **Upload photo** / **Reset**.

### Raw lab (`/lab`)

- Mesh overlay, sample region markers, face box.
- GPU/CPU delegate, detect/sample/analyse timings, FPS.
- JSON handoff.
- Warm-up / cold-start behaviour is visible here.

### Engine

- `src/lib/color.ts`: sRGB → linear → XYZ → CIELAB (D65), CIEDE2000, ITA°, hue/chroma.
- `src/lib/skin.ts`: robust sampling analysis, confidence, seasons, warnings.
- `src/lib/match.ts`: fabric harmony scoring, foundation matching, pairings, garment evaluation.
- `src/lib/face/landmarks.ts`: MediaPipe indices, face oval, skin sampling, quality.
- `src/lib/face/vision.ts`: FaceLandmarker + segmenter loaders, GPU→CPU fallback, hair coverage.
- `src/lib/api/engine.ts`: request orchestration.
- `src/lib/api/schema.ts`: Zod request schema.
- `src/app/api/v1/match/route.ts`: endpoint, CORS, rate limit, error mapping.

---

## 5. The one endpoint

### Request

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
    "options": { "category": "hijab", "limit": 6, "includeFoundations": true }
  }'
```

Other accepted inputs:

- `face.landmarks` (478 `{x,y}`) + `image` (base64 data URL): server samples the image.
- `image` only: centred-face heuristic, returned with a low-confidence warning.
- `garment.hex`: exact-colour evaluation + pairings.
- `garment.image` + `image`: palette extraction from the main image.

### Response shape (abridged)

```json
{
  "ok": true,
  "version": "0.1.0",
  "requestId": "...",
  "latencyMs": 18,
  "source": { "face": "samples", "garment": "hex" },
  "skin": {
    "hex": "#7A5A42",
    "lab": { "l": 40.1, "a": 12.2, "b": 15.1 },
    "ita": -29.1,
    "depth": "tan",
    "undertone": "olive",
    "season": { "name": "Deep Autumn" },
    "confidence": { "score": 72, "label": "good" },
    "warnings": []
  },
  "colour": {
    "best": [
      {
        "colour": { "name": "Camel", "hex": "#B08A5E" },
        "score": 99,
        "verdict": "signature",
        "reasons": ["..."]
      }
    ],
    "avoid": []
  },
  "garment": {
    "input": { "hex": "#7C2433" },
    "score": 71.8,
    "verdict": "easy",
    "headline": "A reliable choice, with one small caveat.",
    "pairings": []
  },
  "foundation": [],
  "disclaimer": "Visualization only..."
}
```

Rate limit: 40 requests/min/IP, in-memory. Replace with Redis/gateway for production.

Full schema: `src/lib/api/schema.ts`.  
Orchestration: `src/lib/api/engine.ts`.

---

## 6. How the reading works

1. **Face mesh** — MediaPipe `FaceLandmarker`, 478 landmarks, in the browser.
2. **Sampling** — forehead, both cheeks, nose, jaw, neck; eyes/brows/lips/nostrils excluded; sclera white reference; 3×3 patches.
3. **Robust median** — weighted median + CIEDE2000 outlier rejection.
4. **Lit-skin band** — the final tone comes from the 70th lightness percentile band, not the raw pixel median. Shadows are illumination, not pigment.
5. **LAB** — sRGB → linear → XYZ → CIELAB (D65).
6. **Depth/undertone** — ITA° + L\* cross-check; hue angle + chroma for undertone; season mapping.
7. **Confidence** — sample count, agreement (spread), region coverage, lighting, evenness, face size, sharpness, pose.
8. **Match** — fabric weights: lightness separation 40%, chroma 25%, temperature 20%, hue 15%; season affinity adds up to 4 points; score compressed with `raw^1.22` and capped at 99.
9. **Preview** — colour cards above the frame. No face overlay.

### Reading score

The **0–100 score** is confidence, not ITA.

| Score | Meaning |
| --- | --- |
| 82–100 | High |
| 66–81 | Good |
| 45–65 | Fair |
| < 45 | Low |

Weights: samples 20%, agreement 26%, region coverage 10%, lighting 15%, evenness 10%, face size 9%, sharpness 10%, minus pose penalty.

### Metric cheat sheet

| Metric | Meaning | Caveat |
| --- | --- | --- |
| **L\*** | Lightness, 0–100 | — |
| **a\*** | Red (+) ↔ green (−) | Redness can be lighting/makeup |
| **b\*** | Yellow (+) ↔ blue (−) | Low b\* pushes ITA deeper |
| **C\*** | Chroma / saturation = √(a²+b²) | Moderate ~15–25 typical |
| **h°** | Hue angle: 0 red, 90 yellow, 180 green, 270 blue | Skin ~50–60 typical |
| **ITA°** | `atan((L*−50)/b*)×180/π` | An angle, not a score; sensitive to b\* |
| **Spread** | Average ΔE00 of samples from the final tone | Ideal < 3–4; 8+ means mixed light |
| **Fitzpatrick** | Estimated from ITA + L\* | Not clinical; UV response, not colour |
| **Season** | Depth + undertone product taxonomy | Heuristic, not science |

**Example:** ITA −31.9, C 19.9, h 25.2° implies approximately L\* 44.7, a\* 18.0, b\* 8.5. That is medium-deep, red-rich, low-yellow. ITA says “dark” because b\* is low, but L\* says medium-deep. The engine now cross-checks L\* and labels it **Tan / deep**, Fitzpatrick **~V**, not ~VI. Season remains Deep Winter (deep + cool/rosy). A warning explains the discrepancy.

---

## 6b. Tone lock & motion (added 2026-10-25)

The live tone no longer drifts. `useToneLab` now has a temporal lock:

- Sample every 720 ms while settling, every 1.4 s once locked.
- A tone is accepted after **3 consecutive readings** within **ΔE00 1.8**, with confidence ≥ 42 and spread ≤ 12.
- The accepted profile is the **highest-confidence profile** among the three close readings.
- Once locked, the tone is held. Only **5 consecutive far readings** (> 1.8 ΔE) unlock it and start a re-lock.
- UI: `SETTLING n/3` → `TONE LOCKED`; **Re-read tone** clears the lock. **Run API match is disabled until locked.**
- Photo upload locks immediately because it is one deterministic reading.
- `reading.json` now includes `toneLocked`, `stability` and `stableSamples`.

Verified with the fake webcam:

- Settled `1/3` → `2/3` → `TONE LOCKED`
- Top colour **Camel** stayed unchanged for 14+ samples
- `Run API match` enabled after lock; API 3–6 ms
- Re-read cleared the API result and started settling again

Deliberate limitation: if the light never stabilises, the tone will not lock and the API button stays “Locking…”. The UI says “Need more even light to lock”. Re-read/Reset is the escape hatch. This is the trade-off for one stable tone.

Motion:

- Face mesh: animated dashed oval, pulsing sample dots, a scan line clipped to the face, breathing corner ticks, and a blue measuring ring when locked. Shown by default on `/`; **Hide mesh** toggles it. Respects `prefers-reduced-motion`.
- API match: a scan sweep, a “Matching 6 tones…” pill, a 700 ms minimum so the animation is perceptible, then the card/swatch reveal + result panel slide.
- `/` and `/lab` share `useToneLab`. `/studio` still uses the older `useFaceStudio` and does **not** have the lock.

## 6c. Reading progress, scroll and nav (added 2026-10-25)

Feedback after using `/read`: the reading felt like it was bogged down, the
progress was invisible, and the locked colour could not be seen once you
scrolled down to the collection.

### Reading progress

`/read` now shows four steps, always:

| Step | Meaning |
| --- | --- |
| 01 Find your face | The guide has not locked onto a face |
| 02 Read the light | Readings are being taken, the meter counts to three |
| 03 Lock the tone | Three close readings agree and the tone is held |
| 04 Rank your colours | The shortlist is scored against your tone |

- The stepper sits above the camera; the current step carries a progress meter.
- The sticky top bar carries a readout (`TONE LOCKED` / `READING 2/3` / `NO READING`)
  so the state is visible from any scroll position.
- When the tone locks, a **See your six colours** button appears in the tone
  section and scrolls to `#shades`.
- The scan's colour card (`BEST OF SIX` + the six swatches) **moved out of the
  tone section** and now sits at the top of the colours section, directly under
  “Your colours, from the real collection.” The locked tone and the colours it
  produced are now in one place instead of split across two sections.

### Scroll

`/` and `/read` use [Lenis](https://github.com/darkroomengineering/lenis) for
interpolated scrolling. The provider is `src/components/SmoothScroll.tsx`,
mounted in the root layout.

- The landing nav and the reading top bar **hide while scrolling down** and
  return on the way up.
- The landing nav is now `position: fixed` and gains a paper surface once it
  passes the hero, so it stays legible over the page.
- Same-page anchors are resolved by the provider *after* the layout settles.
  The browser jumps to the hash before the page has finished laying out and
  lands short; the provider re-anchors (and only while the reader has not
  scrolled on).
- Panels that scroll on their own carry `data-lenis-prevent`: the colour list
  and the JSON dump.
- `/lab` and `/studio` keep native scrolling.

### Landing CTA

The CTA now carries the same voice as the reading page: “Your colours, from the
real collection.” with “5,498 real colours · 15 shops” under it, and the camera
scan entry points beside it. The landing and the reading page stay separate
routes (`/` and `/read`); the CTA is the hand-off.

### Verified

- 47 tests pass, `npm run typecheck` and `npm run build` pass.
- Fake-webcam run: stepper advances 01 → 04, top bar shows `TONE LOCKED`, the
  ready panel appears, and the colour card is present in the colours section.
- Anchors land on target: `/read#shades` → 985 px (section top 1001 − 16 px
  scroll-margin), `#method` → 1969 px.
- Nav hides on scroll down (y = −80) and returns on scroll up (y = 0).
- Mobile (390 px) and tablet (820 px): no horizontal overflow; the stepper
  becomes a 2×2 grid under 660 px.

## 7. Key decisions / research

### REA repo

`morluto/rea` is a **reverse-engineering agent toolkit** (MCP tools for binaries/apps/websites), not a shade-matching engine. It did not provide a colour engine. No YouCam private API was reverse-engineered. The public docs were used; the implementation is original.

### YouCam / Perfect Corp

Public findings:

- There is **no dedicated public “Foundation Shade Finder” endpoint**.
- It is assembled from **AI Facial Color Tones Analyzer** (20 units) + your own shade database + **Makeup VTO** (1 unit).
- Scarf VTO is **async generative**, 2 units, 896×1152, no live drape, no fit guarantee.
- Fabric VTO does not accept custom textiles.
- Public Camera Kit is guided capture, not live AR.
- USD/unit pricing is not published.

Conclusion: build the intelligence layer (catalogue, undertone logic, ΔE00 ranking, garment evaluation, pairing) yourself. That is this repo.

### On-device vs GPU worker

Current route: **on-device browser** (MediaPipe WASM/WebGL).

- GPU test: **21–28 FPS**, detect ~25–50 ms, sample ~6–8 ms, analysis ~2 ms.
- CPU fallback: ~150 ms+/frame, ~1 Hz reading. UI shows `CPU` and a warning.
- A **GPU worker is not needed for this MVP**.
- Later uses for a GPU worker: photoreal rendering, heavier hair/head segmentation, low-end phones, batch catalogue work.
- The seam is the `POST /api/v1/match` JSON contract. Swap the engine without changing the UI.
- **Hybrid** is the recommended production shape: live landmarks + cards on-device; only the photoreal render goes to a GPU worker.

---

## 8. Known issues / caveats

1. **No fit or drape guarantee.** This is colour visualization only.
2. **Foundation atlas is fictional.** `Auriga Atlas` is a generated 60-shade reference grid, not retail product data. Import a real brand catalogue + oxidation data before purchase claims.
3. **Demo fabric catalogue is 72 colours.** The generated real hijab library exists but is not wired in — see §9.
4. **`/` API match sends the final Lab repeated as 3 samples**, not the raw sample population. This is a simplification for the MVP. To use the server’s full outlier logic, expose `samplesRef` from `useToneLab` and send the raw samples.
5. **`garment.image` uses the main image**, not a separate garment crop. A separate upload/crop is next.
6. **First inference can be cold.** One headless photo test measured ~20 s for the first detection; after warm-up, detect is ~25–50 ms on GPU. The photo UI now shows only sample time, not the cold detect time.
7. **Camera secure context.** `localhost` or HTTPS only.
8. **Hydration fix:** `reading.json` must use `capturedAt: null` until the first sample. Do not put `new Date()` in the initial snapshot.
9. **MediaPipe logs** an XNNPACK/GL banner through `console.error`; it is filtered in `useToneLab`. Real errors are still passed through.
10. **`/studio` is experimental** and not linked. It has the old full-panel UI and unused drape controls. Do not treat it as the MVP.
11. **No auth on the API.** Rate limit is in-memory. Add auth/abuse protection before public deployment.
12. **Undertone/season are heuristics.** A red-leaning low-b\* face can read deeper on ITA. The L\* cross-check helps, but calibration against a labelled dataset is the real fix.
13. **White balance is a sclera estimate**, not a grey card. Mixed lighting still causes spread warnings.
14. **Screen calibration** changes how the colour cards look. The physical fabric is the ground truth.

---

## 9. Parallel artifacts — do not delete blindly

These appeared in the workspace during the session (likely a parallel scraping agent):

```
src/lib/library.generated.ts     ~273 KB, ~1,500 real hijab/fabric colour rows
library/                         ~1.2 GB scraped catalogue, images, gallery.html
library/print-flow.html          one flowing, hue-sorted collage of 5,498 textile photos
library/print-flow.jpg           3200×16863 JPEG, ~10.7 MB
library/print-flow.webp          half-width screen preview, ~2.6 MB
library/print-flow.json          counts, stores and layout metadata
scripts/build-print-flow.mjs     builds the print/fabric flow
scripts/scrape-library.mjs       Shopify catalogue scraper
scripts/scrape-oneyard.mjs
scripts/build-index.mjs
scripts/make-swatches.mjs
scripts/score-pilot.mjs
```

The generated library is **not imported** by the MVP. It can replace the 72-colour demo catalogue. Before shipping:

- verify image/name licensing and retailer terms;
- verify data quality (some rows are dresses/magnets/gift cards, some colour families look misclassified);
- filter to actual hijab/scarf products;
- keep the source/provenance metadata.

### Print & fabric flow

`library/print-flow.html` is a standalone visual index: one justified, hue-sorted collage of the actual product photos for 5,498 scraped print/fabric textile colourways (2,217 print-labelled). It excludes accessories, gifts, beauty and tools; it includes scarves, apparel, fabric and fabric-like categories.

Open it directly: `open library/print-flow.html`. The page uses the half-width WebP for speed, makes every tile clickable (900px product photo + store/title/hex/product link), and links to the full JPEG via “Expand full collage”.

- Full image: `library/print-flow.jpg` — 3200×16863, ~10.7 MB.
- Screen preview: `library/print-flow.webp` — 1600×8433, ~2.6 MB.
- Metadata: `library/print-flow.json`.
- Rebuild: `npm run print-flow` or `node scripts/build-print-flow.mjs`.
- `library/gallery.html` now links to it; the generated gallery still caps at 900 colourway cards.

Photos belong to each store. Internal colour research only; do not republish the photography.

The package.json `scrape:*` and `library:*` scripts belong to that track. Leave them unless you intentionally remove the library.

---

## 10. Next steps, in order

1. **Calibrate the reading.** Add a grey-card / ColorChecker flow; lock white balance; test against labelled skin tones.
2. **Expose raw samples to `/` API match.** Right now `/` sends the final Lab repeated. Send the actual samples for canonical server scoring.
3. **Wire the real hijab library** (`src/lib/library.generated.ts`) after cleaning/filtering + licensing review. Replace the demo 72.
4. **Real foundation catalogue** with SKU, finish, coverage and oxidation notes.
5. **Separate garment crop upload** (currently `garment.image` uses the main image).
6. **Optional LLM layer.** The `reading.json` is ready. Add something like `POST /api/v1/explain` that takes the JSON and returns copy/palette explanations. Do not send the webcam frame.
7. **GPU worker only for photoreal rendering** or heavy segmentation, behind the same contract.
8. **Fit/drape research track.** Measurements, pattern panels, fabric mechanics, cloth simulation. Separate promise; do not mix it into the colour MVP.
9. **Production hardening.** Auth, durable rate limit, request logging, image size limits, CORS allowlist, privacy policy.

---

## 11. File map

```
src/app/page.tsx                     bare MVP
src/app/lab/page.tsx                 raw capability
src/app/studio/page.tsx              experimental full panel
src/app/api/v1/match/route.ts        one endpoint
src/app/api/v1/catalog/route.ts      catalogue
src/app/api/v1/health/route.ts       asset readiness
src/app/globals.css                  all styling (no Tailwind)
src/components/mvp/MvpTester.tsx     bare UI + upload + API call
src/components/lab/useToneLab.ts     camera/photo loop, sampling, JSON
src/components/lab/ToneLab.tsx       raw lab UI
src/components/studio/*              older full panel
src/lib/color.ts                     sRGB/Lab, CIEDE2000, ITA
src/lib/skin.ts                      analysis, confidence, seasons
src/lib/match.ts                     fabric/foundation scoring
src/lib/face/landmarks.ts            478 landmarks, face oval, sampling
src/lib/face/vision.ts               MediaPipe loaders/detection
src/lib/face/mesh.ts                 diagnostic mesh
src/lib/preview/hijab.ts             drape renderer (not used on /)
src/lib/catalog.ts                   72 demo fallback fabrics + 60 demo foundations
src/lib/library.ts                   scraped catalogue types + FabricColour adapter
src/lib/server/library.ts            server-side scraped catalogue loader
src/components/shade/*               open catalogue studio, hook, search worker
src/app/library/[...path]/route.ts   local scraped photo serving
public/catalog/shades.json           generated 5,498-shade search index
scripts/build-catalog-index.mjs      catalogue index generator
src/lib/api/engine.ts                request orchestration
src/lib/api/schema.ts                Zod schema
src/lib/server/image.ts              sharp decode, heuristic face, palette
src/lib/client/palette.ts            client k-means for garment images
tests/color.test.ts                  37 colour tests
tests/engine.test.ts                 10 engine tests
scripts/setup-assets.mjs             model/WASM download
README.md                            user-facing run/API notes
handoff.md                           this file
```

---

## 12. Environment

- Node.js 22.16
- Next.js 16.4.3 (App Router, Turbopack)
- React 19.3.1
- `@mediapipe/tasks-vision` 1.1.1
- `sharp` 0.35.5
- `zod` 4.6.7
- TypeScript 5.9.3
- Vitest 5.0.5
- No Tailwind/PostCSS in the current build
- Models are gitignored; run `npm run setup:assets` after clone
- `public/models/face_landmarker.task` ~3.6 MB
- `public/models/selfie_multiclass_256x256.tflite` ~15.6 MB
- `public/mediapipe/wasm` ~39 MB

---

## 13. Handoff checklist

- [ ] `npm install`
- [ ] `npm run setup:assets`
- [ ] `npm run dev`
- [ ] Open `/`; test **Start camera** and **Upload photo**
- [ ] Confirm the colour box is **above** the frame and no hood is drawn
- [ ] Test **Show mesh** on a photo
- [ ] Click **Run API match**; confirm latency + top colour
- [ ] Click **Copy JSON**; confirm `source`, `skin`, `recommended`
- [ ] Open `/lab`; confirm timings and delegate
- [ ] Open `library/print-flow.html`; confirm the print/fabric flow loads
- [ ] `npm run print-flow` if the library changed
- [ ] `npm test` → 47 passing
- [ ] `npm run build` → passing
- [ ] Decide: demo 72-colour catalogue vs cleaned real hijab library
- [ ] Decide auth / rate limit / deployment target
- [ ] Keep the hood **off** by default
- [ ] Do not commit model binaries or scraped images without a licensing review
