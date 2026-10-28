import type { MetadataRoute } from "next";
import { BETA_MODE } from "@/lib/beta";

/**
 * While the app is in public testing it stays out of search results. Flip
 * NEXT_PUBLIC_BETA_MODE to "0" (and rebuild) when the public launch happens.
 */
export default function robots(): MetadataRoute.Robots {
  if (BETA_MODE) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }
  return {
    rules: [{ userAgent: "*", allow: "/" }],
  };
}
