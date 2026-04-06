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

    // tcgcsv sometimes bulk-updates old set metadata and stamps them with a
    // migration timestamp (e.g. "2026-04-05T20:00:05"). Detect these as
    // "dirty" dates and treat them as null for display purposes so we don't
    // show ancient sets as if they released today.
    const DIRTY_SUFFIX = "T20:00:05";

    function cleanDate(iso: string | null): string | null {
      if (!iso) return null;
      if (iso.endsWith(DIRTY_SUFFIX)) return null;
      return iso;
    }

    // Sort: newest first by cleanDate, then by groupId descending as tiebreaker
    const sorted = [...groups].sort((a, b) => {
      const da = cleanDate(a.publishedOn);
      const db = cleanDate(b.publishedOn);
      if (!da && !db) return b.groupId - a.groupId;
      if (!da) return 1;
      if (!db) return -1;
      const cmp = db.localeCompare(da);
      return cmp !== 0 ? cmp : b.groupId - a.groupId;
    });

    const sets: SetInfo[] = sorted.map(g => ({
      groupId:     g.groupId,
      name:        g.name,
      publishedOn: cleanDate(g.publishedOn),
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
