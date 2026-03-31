/**
 * GET /api/jeux/products
 * Returns normalised Jeux Kingdom product listing, optionally filtered.
 *
 * Query params:
 *   game    — e.g. "flesh-and-blood" | "grand-archive" | "one-piece"
 *   query   — card name text search
 *   page    — pagination (default 1, 250 products per page)
 *
 * Response is cached by Next.js fetch for 5 minutes (revalidate=300).
 */
import { NextRequest, NextResponse } from "next/server";
import { getJeuxProducts } from "@/lib/jeux";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const game = searchParams.get("game") ?? undefined;
  const query = searchParams.get("query") ?? undefined;
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const listingTypeParam = searchParams.get("listingType");
  const listingType =
    listingTypeParam === "card" || listingTypeParam === "sealed"
      ? (listingTypeParam as "card" | "sealed")
      : undefined;
  // Hide sold-out by default; only show them when caller explicitly requests
  const hideSoldOut = searchParams.get("hideSoldOut") !== "false";

  try {
    const products = await getJeuxProducts({ game, query, page, revalidate: 300, listingType, hideSoldOut });
    return NextResponse.json(
      { products, source: "jeuxkingdom.com" },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
        },
      }
    );
  } catch (err) {
    console.error("[/api/jeux/products]", err);
    return NextResponse.json({ error: "Failed to fetch Jeux Kingdom products" }, { status: 502 });
  }
}
