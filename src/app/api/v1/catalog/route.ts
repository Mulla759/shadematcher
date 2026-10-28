import { NextResponse } from "next/server";
import { CATALOG_META, FABRICS, FOUNDATIONS } from "@/lib/catalog";
import { getLibrary } from "@/lib/server/library";
import { SEASONS } from "@/lib/skin";

export const runtime = "nodejs";
// The response varies by query string, so it cannot be prerendered.
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const family = searchParams.get("family");
  const depth = searchParams.get("depth");
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? 200)));

  const fabrics = family
    ? FABRICS.filter((fabric) => fabric.family.toLowerCase() === family.toLowerCase())
    : FABRICS;
  const foundations = depth
    ? FOUNDATIONS.filter((shade) => shade.depth === depth)
    : FOUNDATIONS;
  const library = await getLibrary();

  return NextResponse.json(
    {
      ok: true,
      meta: {
        ...CATALOG_META,
        catalogue: {
          count: library.count,
          stores: library.stores,
          source: library.source,
        },
      },
      fabrics: fabrics.slice(0, limit),
      foundations: foundations.slice(0, limit),
      seasons: Object.values(SEASONS),
    },
    { headers: { ...CORS, "Cache-Control": "public, max-age=300" } },
  );
}
