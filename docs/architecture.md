# Architecture

Three diagrams for explaining Auriga: the container view, the reading sequence, and the
offline build pipeline. All Mermaid — paste into GitHub, Notion, `mermaid.live`, or slides.

---

## 1. Container view — what runs where

```mermaid
flowchart TB
  classDef person fill:#f2ece1,stroke:#191410,stroke-width:2px,color:#191410
  classDef client fill:#e9e0d2,stroke:#453a30,color:#191410
  classDef server fill:#ded2bf,stroke:#191410,stroke-width:2px,color:#191410
  classDef data fill:#faf6ee,stroke:#6d1f2b,color:#191410
  classDef outside fill:#f2ece1,stroke:#6e6154,stroke-dasharray:4 3,color:#453a30

  T(["Tester<br/>camera or photo"]):::person

  subgraph Browser["Browser — on device, nothing uploaded"]
    direction TB
    PAGES["Pages<br/>/ landing · /read studio<br/>/lab raw · /studio legacy"]:::client
    CAP["Capture + reading loop<br/>useToneLab"]:::client
    MESH["MediaPipe FaceLandmarker<br/>478 landmarks · GPU with CPU fallback"]:::client
    ENGINE["Colour engine<br/>color · skin · match"]:::client
    WORKER["Catalogue worker<br/>5,498 rows scored in a Web Worker"]:::client
  end

  subgraph Fn["Vercel serverless functions"]
    direction TB
    MATCH["POST /api/v1/match<br/>api/engine.ts"]:::server
    CATALOG["GET /api/v1/catalog"]:::server
    HEALTH["GET /api/v1/health"]:::server
    FEEDBACK["POST /api/v1/feedback"]:::server
    PHOTOS["GET /library/*<br/>local photo route"]:::server
  end

  INDEX[("public/catalog/shades.json<br/>5,498 colourways — committed")]:::data
  REDIS[("Upstash Redis<br/>rate-limit counters<br/>dedicated to this app")]:::data
  LOGS[("Vercel logs<br/>feedback + client errors")]:::data
  CDN["MediaPipe models<br/>downloaded at build time"]:::outside

  T -->|"opens"| PAGES
  PAGES --> CAP --> MESH --> ENGINE --> WORKER
  WORKER -->|"reads"| INDEX
  PAGES -->|"colour values only"| MATCH
  PAGES -->|"message"| FEEDBACK
  PAGES -.->|"photo, local dev only"| PHOTOS
  MATCH -->|"scores the same catalogue"| INDEX
  CATALOG --> INDEX
  HEALTH --> INDEX
  MATCH -->|"counts"| REDIS
  FEEDBACK -->|"counts"| REDIS
  FEEDBACK --> LOGS
  CDN -.->|"postinstall"| MESH
```

**The one rule:** frames, video and photos never leave the browser. The only thing that crosses
the network is CIELAB colour samples, and only when the tester presses **Check with server**.

---

## 2. Sequence — one reading, then the server check

```mermaid
sequenceDiagram
  autonumber
  actor Tester
  participant UI as /read page
  participant Mesh as MediaPipe mesh
  participant Engine as Colour engine
  participant Worker as Catalogue worker
  participant API as POST /api/v1/match
  participant KV as Upstash Redis

  Tester->>UI: Start camera or upload a photo
  UI->>Mesh: video frame or image
  Mesh-->>UI: 478 landmarks plus sampled Lab values
  UI->>Engine: samples and quality metrics
  Engine-->>UI: ITA depth, undertone, season, confidence
  loop until three close readings agree
    UI-->>Tester: reading 1 of 3, then 2 of 3
  end
  UI->>Worker: rank the catalogue against the reading
  Worker-->>UI: top six colourways with reasons
  Tester->>UI: Check with server
  UI->>API: colour samples only, never the image
  API->>KV: INCR plus expiry on the client IP
  KV-->>API: hit count
  API->>API: runMatch — the same engine, server side
  API-->>UI: same top colour, warnings, disclaimer
```

---

## 3. Offline pipeline — how the catalogue and models get built

```mermaid
flowchart LR
  classDef step fill:#e9e0d2,stroke:#453a30,color:#191410
  classDef artifact fill:#faf6ee,stroke:#6d1f2b,color:#191410

  subgraph Offline["Offline — 1.3 GB, never in Git"]
    SCRAPE["scrape-library.mjs<br/>15 storefronts"]:::step
    LIB[("library/<br/>photos and colourways")]:::artifact
    INDEXER["build-index.mjs"]:::step
    GENERATED["src/lib/library.generated.ts<br/>demo fallback"]:::artifact
    CATALOGER["build-catalog-index.mjs"]:::step
    PUBLISHED[("public/catalog/shades.json<br/>5,498 colourways")]:::artifact
    SETUP["setup-assets.mjs<br/>runs on postinstall"]:::step
    MODELS[("public/models<br/>public/mediapipe/wasm")]:::artifact
  end

  SCRAPE --> LIB
  LIB --> INDEXER --> GENERATED
  LIB --> CATALOGER --> PUBLISHED
  SETUP --> MODELS

  PUBLISHED --> BUNDLE["server bundle<br/>and browser worker"]:::artifact
  GENERATED --> BUNDLE
  MODELS --> BUNDLE
```

---

## Module map

| Layer | Files | Responsibility |
| --- | --- | --- |
| Pages | `src/app/**/page.tsx` | Landing, `/read`, `/lab`, `/studio`, `/privacy` |
| UI | `src/components/**` | Studio UI, catalogue hook and worker, Lenis scroll, beta banner |
| Capture | `src/components/lab/useToneLab.ts`, `src/lib/face/*` | Camera, photo, 478-point mesh, skin sampling |
| Colour engine | `src/lib/color.ts`, `src/lib/skin.ts`, `src/lib/match.ts` | sRGB to CIELAB, ITA, confidence, ranking, foundations |
| API | `src/app/api/v1/**`, `src/lib/api/*` | Zod contract, orchestration, disclaimer, warnings |
| Server support | `src/lib/server/*` | Catalogue loader, image decode, rate limiting |
| Data | `public/catalog/shades.json`, `src/lib/library.generated.ts` | Scraped index, demo fallback |
| Build | `scripts/*.mjs` | Scrape, index, catalogue, assets, smoke test |
