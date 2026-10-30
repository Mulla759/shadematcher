/**
 * Post-deploy smoke test.
 *
 *   BASE_URL=https://your-deployment.vercel.app npm run smoke
 *
 * Checks the pages render, the model assets are present, the full catalogue is
 * bundled (not the demo fallback) and the match endpoint answers.
 */
const base = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

const checks = [];
let failures = 0;

async function check(name, fn) {
  try {
    const detail = await fn();
    checks.push({ name, ok: true, detail: detail ?? "" });
  } catch (error) {
    failures += 1;
    checks.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await check("GET / renders", async () => {
  const response = await fetch(`${base}/`);
  assert(response.ok, `status ${response.status}`);
  return `status ${response.status}`;
});

await check("GET /read renders", async () => {
  const response = await fetch(`${base}/read`);
  assert(response.ok, `status ${response.status}`);
  return `status ${response.status}`;
});

await check("GET /privacy renders", async () => {
  const response = await fetch(`${base}/privacy`);
  assert(response.ok, `status ${response.status}`);
  return `status ${response.status}`;
});

await check("GET /gallery renders", async () => {
  const response = await fetch(`${base}/gallery`);
  assert(response.ok, `status ${response.status}`);
  const html = await response.text();
  assert(html.includes("Fabric gallery"), "the gallery heading is missing");
  return `status ${response.status}`;
});

await check("GET /catalog/shades.json carries the published index", async () => {
  const response = await fetch(`${base}/catalog/shades.json`);
  assert(response.ok, `status ${response.status}`);
  const index = await response.json();
  assert((index.rows?.length ?? 0) > 1000, `index has ${index.rows?.length} rows`);
  assert(index.measurement?.method, "the index does not publish how the colour was read");
  assert(index.traitCoverage, "the index does not publish its trait coverage");
  return `${index.rows.length} rows · traits ${JSON.stringify(index.traitCoverage)}`;
});

await check("GET /api/v1/health is ready", async () => {
  const response = await fetch(`${base}/api/v1/health`);
  const body = await response.json();
  assert(response.ok, `status ${response.status}`);
  assert(body.ok === true, "health reported not ready");
  for (const [name, present] of Object.entries(body.assets ?? {})) {
    assert(present === true, `asset missing: ${name}`);
  }
  return `assets ${Object.keys(body.assets ?? {}).length}/3 · rate limit ${body.features?.rateLimit}`;
});

await check("GET /api/v1/catalog serves the full catalogue", async () => {
  const response = await fetch(`${base}/api/v1/catalog`);
  const body = await response.json();
  assert(response.ok, `status ${response.status}`);
  const catalogue = body.meta?.catalogue ?? {};
  assert(
    catalogue.source === "scraped textile catalogue",
    `catalogue source is "${catalogue.source}" — the server fell back to the demo catalogue`,
  );
  assert((catalogue.count ?? 0) > 1000, `catalogue count is ${catalogue.count}`);
  return `${catalogue.count} colourways · ${catalogue.stores} stores`;
});

await check("POST /api/v1/match answers", async () => {
  const response = await fetch(`${base}/api/v1/match`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      face: {
        samples: [
          { lab: { l: 40, a: 12, b: 15 }, region: "leftCheek" },
          { lab: { l: 41, a: 12, b: 15 }, region: "rightCheek" },
          { lab: { l: 42, a: 11, b: 14 }, region: "forehead" },
        ],
        quality: { lighting: 0.72, evenness: 0.7, faceSize: 0.34 },
      },
      options: { category: "hijab", catalogue: "face", limit: 6, includeFoundations: false },
    }),
  });
  const body = await response.json();
  assert(response.ok, `status ${response.status} ${JSON.stringify(body.error ?? {})}`);
  assert(body.ok === true, "match did not return ok");
  assert((body.colour?.best ?? []).length > 0, "no colour recommendations returned");
  return `${body.colour.best.length} recommendations · ${body.latencyMs}ms · catalogue ${body.meta?.catalogue?.source}`;
});

for (const entry of checks) {
  console.log(`${entry.ok ? "PASS" : "FAIL"}  ${entry.name}${entry.detail ? ` — ${entry.detail}` : ""}`);
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
