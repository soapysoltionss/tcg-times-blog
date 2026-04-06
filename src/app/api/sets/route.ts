import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/sets?game=pokemon|grand-archive|flesh-and-blood|one-piece
 *
 * Returns all sets (groups) for a given TCG from tcgcsv.com (public TCGPlayer mirror).
 * Cached at the edge for 24 hours — set lists change rarely.
 *
 * Response: { game, sets: SetInfo[] }
 */

const TCGCSV = "https://tcgcsv.com/tcgplayer";

const CATEGORY_ID: Record<string, number> = {
  "flesh-and-blood": 62,
  "grand-archive":   74,
  "one-piece":       68,
  "pokemon":          3,
};

export interface SetInfo {
  groupId: number;
  name: string;
  publishedOn: string | null;
  categoryId: number;
}

interface TcgCsvGroup {
  groupId: number;
  name: string;
  publishedOn: string | null;
  isSupplemental: boolean;
  categoryId: number;
}

export async function GET(req: NextRequest) {
  const game = req.nextUrl.searchParams.get("game") ?? "";

  const categoryId = CATEGORY_ID[game];
  if (!categoryId) {
    return NextResponse.json({ error: `Unknown game: ${game}. Valid: ${Object.keys(CATEGORY_ID).join(", ")}` }, { status: 400 });
  }

  try {
    const res = await fetch(`${TCGCSV}/${categoryId}/groups`, {
      signal: AbortSignal.timeout(15_000),
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      return NextResponse.json({ error: `tcgcsv returned ${res.status}` }, { status: 502 });
    }

    const data = await res.json() as { results: TcgCsvGroup[] };
    const groups: TcgCsvGroup[] = data.results ?? [];

    // Sort: newest first (by publishedOn, nulls last)
    const sorted = [...groups].sort((a, b) => {
      if (!a.publishedOn && !b.publishedOn) return 0;
      if (!a.publishedOn) return 1;
      if (!b.publishedOn) return -1;
      return b.publishedOn.localeCompare(a.publishedOn);
    });

    const sets: SetInfo[] = sorted.map(g => ({
      groupId:     g.groupId,
      name:        g.name,
      publishedOn: g.publishedOn ?? null,
      categoryId:  g.categoryId ?? categoryId,
    }));

    return NextResponse.json(
      { game, categoryId, sets },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600" } },
    );
  } catch (err) {
    console.error("[api/sets]", err);
    return NextResponse.json({ error: "Failed to fetch sets" }, { status: 500 });
  }
}
