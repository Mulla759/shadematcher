# design-check

Compares the `auriga.pen` design file against the running site so the two can be
kept in sync.

## Setup

```bash
npm i -D playwright-core sharp   # or install inside this folder
```

Playwright drives the system Google Chrome (`playwright-core` + `executablePath`),
so no browser download is needed.

## Workflow

1. Export the design frame to PNG and HTML from pen.dev:

   ```
   Export(["a3QQc"], "png",    "<out>/pen",       { scale: 1 })
   Export(["a3QQc"], "html-css", "<out>/design.html", { scale: 1 })
   ```

   Rename the per-section exports to `hero.png`, `intro.png`, `compare.png`,
   `analysis.png`, `collection.png`, `how.png`, `faq.png`, `cta.png`,
   `footer.png` inside `<out>/pen`.

2. Run the pixel diff (design vs. live, section by section):

   ```bash
   URL=http://localhost:3000/ OUT=./out PEN_DIR=./pen node compare.mjs
   ```

   Writes `out/sheet-<section>.png` (live | design | diff), `out/diff-*.png`
   (heatmap) and `out/live-full.png`. Prints mean channel difference and the
   percentage of pixels differing by more than 90.

3. Run the per-layer geometry diff. It loads the exported HTML and the live DOM
   side by side and matches layers by `data-pencil-name` against a selector map:

   ```bash
   URL=http://localhost:3000/ DESIGN=./design.html JSON_OUT=./rows.json node nodes.mjs
   python3 show.py rows.json "A2 Hero"   # filter by layer name
   ```

   `show.py` prints live vs. design `x,y,w,h` and the delta for every layer.
