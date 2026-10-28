# The Tone-Matching Colour Box

The tool that lives at **`/`** in this repo: a webcam (or uploaded photo) is read for skin tone, and the six best face-framing colours are ranked and shown in a **colour box above the video** — not painted onto your head.

```
webcam / photo → 478-point face mesh → CIELAB skin reading → ranked fabric colours
                                                                       ↓
                                     ┌──────────────────────────────────┐
                                     │ Saffron  #C8892B · 91/100        │  ← the colour box
                                     │ [6 swatches, tap to compare]     │
                                     ├──────────────────────────────────┤
                                     │                                  │
                                     │        live video frame          │
                                     │                                  │
                                     └──────────────────────────────────┘
```

Nothing is drawn over the face by default. The comparison box sits above the frame so you can judge a colour against your actual face, hair and lighting instead of a rendered hood. A diagnostic mesh overlay is available via **Show mesh**.

---

## 1. What it is

| | |
| --- | --- |
| Route | `/` (`src/app/page.tsx` → `src/components/mvp/MvpTester.tsx`) |
| Input | `getUserMedia` camera stream, or an uploaded still portrait |
| Engine | MediaPipe `FaceLandmarker` 1.1.1 (478 landmarks), on-device WASM/WebGL |
| Colour space | sRGB → linear → XYZ → **CIELAB (D65)**; **CIEDE2000** for differences |
| Output | Skin profile + top 6 fabric colours + copyable handoff JSON |
| Server | Optional `POST /api/v1/match` for the same ranking server-side |
| Persistence | None. Frames stay in the tab; nothing is uploaded |

Two entry points share one reading loop:

- **Start camera** — continuous reading, ~1 Hz updates after lock.
- **Upload photo** — one-shot reading, lock held at 100%.

---

## 2. UI anatomy

The colour box is `.mvp-colour-box` in `src/app/globals.css`:

1. **Main card** (`.mvp-colour-main`) — the active colour as a full-bleed background, its name in the display face, and `hex · score/100`. Text colour is chosen by `readableInk(hex)`, which picks near-black or off-white by WCAG contrast ratio (≥ 4.5:1).
2. **Swatch row** (`.mvp-colour-row`) — a six-column grid of the ranked colours. Each swatch (`.mvp-swatch`) shows the colour, its name, and score. The active one gets a 2 px inset outline (`[data-active="true"]`).
3. **Before any reading** the row is filled with six fixed demo colours — Saffron, Oxblood, Teal, Sage, Navy, Dusty rose — each labelled `——` instead of a score, so the layout never collapses.
4. **A new top match resets the selection.** When the top colour changes, `activeHex` clears, so a stale manual pick never masks a fresh reading.

Below the frame: source controls, **Run API match**, **Copy JSON**, **Reset**, **Show mesh**, and a live status line (`Tone locked`, `Stabilising 2/3…`, `Light changed · 4/5`).

To the right, the readout panel shows the measured skin swatch, undertone/depth, `L* a* b* C* h° ITA°`, season, estimated Fitzpatrick, ΔE spread, confidence, timings, and the raw `reading.json`.

**Photo mode** hides the `<video>` and shows a `<img>` of the upload; the overlay canvas is marked `.static` so it aligns to the image rather than the stream.

---

## 3. The reading pipeline

### 3.1 Detect (browser)

- `loadFaceLandmarker()` loads the model; the delegate is reported as **GPU** or **CPU**.
- Detection runs at most every **33 ms** on a `requestAnimationFrame` loop.
- Landmarks are smoothed with a 0.5 blend (`smoothLandmarks`) before sampling, which removes jitter without lagging real movement.

### 3.2 Sample (`src/lib/face/landmarks.ts`)

- Face oval = 36-point ring shrunk to **91%**, so the edge and hairline are excluded.
- Eyes, brows, lips and nostrils are cut out by polygon test.
- Pixels are stepped across the oval (step ≈ face width / 30) and each point is averaged over a 3×3 patch.
- A broad plausibility gate rejects near-black, blown highlights, and low-chroma dark pixels. There is **no skin-tone prior** — geometry and clustering decide.
- Region weights: cheeks **1.3**, forehead **1.0**, jaw **0.85**, neck **0.8**, nose **0.5**, unknown **0.6**.
- A four-point neck patch below the chin is added when visible (useful for foundation matching).
- **White point**: the brightest, least chromatic sclera pixels (top 3) become a soft reference for `applyWhiteBalance` at 0.55 strength.
- **Quality metrics** derived from the oval: lighting (mean luma vs 0.6), evenness (luma std-dev), sharpness (Laplacian variance), face size, yaw, pitch, roll.

### 3.3 Analyse (`src/lib/skin.ts` → `analyzeSkin`)

1. Normalise samples (white balance applied to RGB inputs).
2. Weighted **median** Lab for the initial estimate.
3. CIEDE2000 outlier rejection — threshold `max(6, 2.6 × MAD)`, kept only if ≥ 35% survive.
4. **Lit-skin band**: re-median the samples within ±4 L* of the 70th lightness percentile. Shadows are illumination, not pigment, so they must not drag the reading darker. Median is the fallback for tiny samples.
5. Derive `ITA°`, chroma, hue, and depth band:

   | ITA° | Depth |
   | --- | --- |
   | > 55 | Very light |
   | 41–55 | Light |
   | 28–41 | Light medium |
   | 10–28 | Medium |
   | −30–10 | Tan / deep |
   | ≤ −30 | Rich / deep (or Tan if L* ≥ 38) |

6. Undertone from warmth `(hue − 52)/16` plus an olive lean (hue, low chroma, low a*). Olive wins above 0.52 with warm-neutral hue; otherwise warm > 0.18, cool < −0.18, else neutral.
7. Season mapping (Light/True Spring, Light/Cool Summer, Soft/Deep Autumn, Deep/Bright Winter).
8. **Confidence** = weighted sum of sample count (20%), ΔE agreement (26%), region coverage (10%), lighting (15%), evenness (10%), face size (9%), sharpness (10%), minus a yaw/pitch pose penalty (12%). Labels: high ≥ 82, good ≥ 66, fair ≥ 45, low below.
9. Warnings surface the first real problem only — small patch, mixed light, under-lit, hot highlights, uneven light, small face, turned or tilted head, low colour signal.

### 3.4 Rank (`src/lib/match.ts`)

Each fabric in the demo catalogue (72 colourways) is scored as a face-framing colour:

| Component | Weight | Fit function |
| --- | --- | --- |
| Lightness separation | **0.40** | plateau at 15–35 L* gap, soft falloff 9 |
| Chroma ratio | **0.25** | plateau at 0.8–1.8× skin chroma, soft 0.5 |
| Temperature | **0.20** | `1 − 0.52·|fabric − skin warmth|` |
| Hue harmony | **0.15** | 1 within 30°, 0.72–0.82 near-complementary, 0.48 elsewhere |

- Category coverage scales the lightness/chroma weights: hijab 0.95, scarf 0.85, top 0.65, dress 0.45.
- **Season affinity** adds up to +4 points; it is a bonus, never a gate.
- Score is compressed (`raw^1.22 × 100`) and clamped to **99** so "good" and "excellent" separate visually.
- Verdicts: **Signature** ≥ 84, **Easy to wear** ≥ 72, **Considered** ≥ 60, **Harder to wear** below.
- `diversify()` picks up to two per colour family and rejects anything within ΔE 7 of a chosen pick, then relaxes to ΔE 5, then fills.

Every match carries up to four human reasons — the lightness gap, the chroma ratio, the temperature relationship, and season membership — which is what the `title` on each swatch and the handoff JSON expose.

### 3.5 Lock (`useToneLab` state machine)

Live readings flicker. A tone is accepted only after agreement:

```
reading ─┬─ confidence < 42 or spread > 12 ──→ show, do not lock
         ├─ drift from candidate > 1.8 ΔE ────→ restart count at 1/3
         └─ 3 close readings ─────────────────→ LOCKED
locked  ─┬─ drift ≤ 1.8 ΔE ───────────────────→ hold the lock
         └─ 5 consecutive confident, clean far readings → re-lock
```

| Constant | Value | Meaning |
| --- | --- | --- |
| `LOCK_SAMPLES` | 3 | readings needed to lock |
| `LOCK_DELTA` | 1.8 ΔE | maximum drift to count as "same" |
| `LOCK_MIN_CONFIDENCE` | 42 | below this, never lock |
| `LOCK_MAX_SPREAD` | 12 ΔE | above this, mixed lighting |
| `UNLOCK_AFTER` | 5 | far readings before re-locking |

Locking is what makes the scores stop jumping. Once locked, the ranked six stay put until the light genuinely changes — the status line narrates each stage instead of leaving you guessing.

---

## 4. The reading panel

| Field | Source | Notes |
| --- | --- | --- |
| Skin swatch + hex | `labToHex(lab)` | The measured colour, not a cosmetic shade |
| Depth · undertone | ITA band + warmth/olive | "Tan / deep · Olive" |
| `L* a* b*` | CIELAB D65 | The raw measurement |
| `C*`, `h°` | chroma / hue angle | Undertone evidence |
| `ITA°` | `atan((L*−50)/b*)` | An angle, **not** the 0–100 confidence score |
| Season | depth × undertone | 8 named palettes, 10 colours each |
| Fitzpatrick | ITA + L* estimate | Prefixed with `~`; not a clinical assessment |
| Spread | weighted mean ΔE to the final Lab | < 8 ΔE is consistent |
| Quality | lighting / evenness / face size / sharpness / pose | Shown as timings in photo mode |
| Confidence | composite score | Badge at the top of the panel |

---

## 5. Proving the API

**Run API match** posts the current reading to the server and shows latency, the top colour, and a short request id. It sends three synthetic samples at the measured Lab (left cheek, right cheek, forehead, weight 1) plus the quality metrics — **not** the image.

```http
POST /api/v1/match
Content-Type: application/json
```

```json
{
  "face": {
    "samples": [
      { "lab": { "l": 40, "a": 12, "b": 15 }, "region": "leftCheek", "weight": 1 },
      { "lab": { "l": 40, "a": 12, "b": 15 }, "region": "rightCheek", "weight": 1 },
      { "lab": { "l": 40, "a": 12, "b": 15 }, "region": "forehead", "weight": 1 }
    ],
    "quality": { "lighting": 0.72, "evenness": 0.7, "faceSize": 0.34, "sharpness": 0.6, "yaw": 2 }
  },
  "options": {
    "category": "hijab",
    "limit": 6,
    "foundationLimit": 5,
    "includeFoundations": true,
    "includePreview": false
  }
}
```

Abridged response:

```json
{
  "ok": true,
  "version": "0.1.0",
  "requestId": "0f3c…",
  "latencyMs": 6,
  "source": { "face": "samples", "garment": "none" },
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
    "category": "hijab",
    "best": [
      { "colour": { "id": "f28", "name": "Saffron", "hex": "#C8892B" }, "score": 91.2, "verdict": "signature" }
    ],
    "avoid": [],
    "palette": [{ "name": "Rust", "hex": "#A34E2A" }]
  },
  "foundation": [],
  "warnings": [],
  "meta": { "engine": "auriga-colour-engine/0.1.0" }
}
```

Contract notes:

- **Rate limit** 40 requests / 60 s per `x-forwarded-for` / `x-real-ip` key; `429` carries `Retry-After`.
- **Payload ceiling** 12 MB at the route; the schema caps inline images at 9 MB (JPEG under ~6 MB recommended).
- **CORS** open (`*`) on `POST` and `OPTIONS` so the box can be embedded elsewhere.
- **Headers** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-Engine`, `Server-Timing`.
- Errors are `{ ok: false, requestId, error: { code, message } }` with codes like `no_skin_samples`, `skin_analysis_failed`, `invalid_request`, `payload_too_large`.
- The server can also sample for you: send `face.landmarks` + `image`, or `image` alone (centred-face heuristic + warning).

---

## 6. Handoff JSON

**Copy JSON** puts the same snapshot in the clipboard — deliberately the input another agent or renderer would need:

```json
{
  "engine": "MediaPipe FaceLandmarker 1.1.1 · on-device WASM/WebGL",
  "source": "camera",
  "capturedAt": "2026-10-25T09:12:44.118Z",
  "faceDetected": true,
  "fps": 24,
  "samples": 486,
  "toneLocked": true,
  "stability": 1,
  "stableSamples": 3,
  "skin": {
    "hex": "#7A5A42",
    "lab": { "l": 40.1, "a": 12.2, "b": 15.1 },
    "ita": -29.1,
    "depth": "tan",
    "undertone": "olive",
    "undertoneNote": "Neutral-warm with a green-grey lean",
    "chroma": 18.4,
    "hue": 51.2,
    "fitzpatrick": "V",
    "season": "Deep Autumn",
    "seasonPalette": ["#A34E2A", "#4E3328", "…"],
    "confidence": { "score": 72, "label": "good", "factors": { "…": {} } }
  },
  "quality": { "lighting": 0.72, "evenness": 0.7, "faceSize": 0.34 },
  "recommended": [
    {
      "name": "Saffron",
      "hex": "#C8892B",
      "score": 91,
      "verdict": "signature",
      "reason": "18° of lightness separation gives the face definition without shouting."
    }
  ]
}
```

---

## 7. Controls reference

| Control | Behaviour |
| --- | --- |
| **Start camera** | Loads the landmarker, requests 1280×960 front camera, starts the loop |
| **Upload photo** | Decodes the file, resizes to 1200 px max edge, detects, samples once, locks at 100% |
| **Stop** | Stops tracks, cancels the RAF loop, clears the overlay, drops the lock |
| **Use camera** | In photo mode, switches back to the live stream |
| **Run API match** | Posts the reading; disabled until a skin profile exists |
| **Copy JSON** | Clipboard handoff snapshot; "Copied" for 1.6 s |
| **Reset** | Stops everything and clears the reading |
| **Show mesh** | Toggles the diagnostic 478-point overlay (fill + dots); off by default |
| **Swatch click** | Promotes that colour to the main card without changing the ranking |

Errors are written for a person, not a stack trace:

- `NotAllowedError` → allow camera for localhost in browser settings.
- `NotFoundError` → no camera found, upload a photo instead.
- `NotReadableError` → the camera is busy (Zoom / Photo Booth).
- No face in a photo → use a front-facing portrait with the face large in frame.
- Too little visible skin → avoid heavy shadow.

---

## 8. Performance

Measured on the test machine with the GPU delegate: **~21–28 fps**, detect ~25–50 ms, sample ~6–8 ms, analysis ~2 ms.

- Detection is throttled to 33 ms and sampling to 720 ms, so the reading is cheap even when the mesh is not.
- If WebGL is rejected, MediaPipe falls back to CPU; the UI shows `CPU` and the frame rate drops to roughly 1 Hz. That is still fine for a photo or colour read, not for smooth tracking.
- Frames are downscaled to an 820 px max edge before `getImageData` — the sampling cost stays flat on a 4K camera.

---

## 9. What it deliberately does not claim

- **No fit or drape.** No hood, no cloth simulation, no measurement. It is a colour comparison.
- **No dermatology.** ITA° and Fitzpatrick here are estimates from colour maths, labelled as such.
- **No retail foundations.** The 60-shade atlas is generated reference points, not product data.
- **No persistence or accounts.** Camera frames never leave the tab from `/`.
- **No LLM.** The live path is deterministic; the handoff JSON is the seam for one later.
- **Screen-dependent.** Fabric, display calibration and ambient light change how any swatch reads.

---

## 10. Files

```
src/app/page.tsx                     route / and its metadata
src/components/mvp/MvpTester.tsx     the colour box, controls, readout, API button
src/components/lab/useToneLab.ts     camera, mesh loop, tone lock, snapshot
src/lib/face/landmarks.ts            oval, exclusions, sampling, quality, white point
src/lib/face/vision.ts               MediaPipe loader, delegate, detection, smoothing
src/lib/face/mesh.ts                 diagnostic overlay renderer
src/lib/skin.ts                      analyseSkin, ITA, undertone, season, confidence
src/lib/match.ts                     fabric scoring, diversify, verdicts, reasons
src/lib/color.ts                     Lab conversions, CIEDE2000, ITA, readableInk
src/lib/catalog.ts                   72 demo fabrics, 60 foundation shades
src/app/api/v1/match/route.ts        the endpoint (rate limit, CORS, errors)
src/lib/api/engine.ts                request orchestration
src/lib/api/schema.ts                Zod contract
src/app/globals.css                  .mvp-colour-box, .mvp-colour-main, .mvp-swatch
```

Tests: `npm test` — 47 cases across conversions, 34 CIEDE2000 reference pairs, robust skin analysis, fabric scoring, foundation matching and the API engine.

---

## 11. Quick start

```bash
npm install
npm run setup:assets     # face landmarker + segmentation models
npm run dev              # http://localhost:3000
```

Camera needs a secure context — `localhost` qualifies, plain `http://192.168.x.x` does not. Use Chrome or Edge for the WebGL delegate.

Want the raw view instead of the polished box? `/lab` exposes the overlay, sampling regions, timings and JSON without the presentation. `/studio` is the experimental full panel (colour list, garment check, foundations).
