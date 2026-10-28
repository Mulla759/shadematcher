/**
 * Feature flags shared by the server and the browser bundle.
 *
 * `NEXT_PUBLIC_*` values are inlined into the client bundle at build time, so
 * they must be set in the deploy environment (Vercel → Settings → Environment
 * Variables) before the build runs — not just at runtime. The same variable is
 * readable on the server at runtime, which keeps the server routes and the
 * browser in agreement.
 */

/** Public beta: adds the beta banner, the feedback form and keeps search engines out. */
export const BETA_MODE =
  (process.env.NEXT_PUBLIC_BETA_MODE ?? process.env.BETA_MODE ?? "") === "1";

/**
 * Product photography. The scraped library is not in Git and cannot be served
 * from a serverless deployment, so photos are opt-in in production: the colour
 * swatches still work, they just show the measured hex instead of a photo.
 * Local development keeps them on because the library is on disk.
 */
export const SHOW_PHOTOS =
  process.env.NEXT_PUBLIC_SHOW_PHOTOS === "1" || process.env.NODE_ENV === "development";

/** Optional external feedback form. When empty, the built-in form is used. */
export const FEEDBACK_URL = process.env.NEXT_PUBLIC_FEEDBACK_URL ?? "";

/**
 * Foundation matches. The atlas is a generated reference grid, not retail
 * product data, so it is off in production unless it is explicitly enabled.
 * Local development keeps it on.
 *
 * Read at call time so the flag can change without a rebuild.
 */
export function foundationsEnabled(): boolean {
  const flag = process.env.FOUNDATIONS_ENABLED;
  if (flag === "1") return true;
  if (flag === "0") return false;
  return process.env.NODE_ENV === "development";
}

/** Where the built-in feedback form posts to. */
export const FEEDBACK_ENDPOINT = "/api/v1/feedback";
