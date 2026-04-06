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

// Hardcoded correct release dates for sets whose tcgcsv publishedOn has been
// permanently corrupted by a bulk-metadata migration. keyed by groupId.
// Sources: Bulbapedia / official TCG release history.
const KNOWN_DATES: Record<number, string> = {
  // POP Series (Nintendo promotional sets, 2004–2008)
  1422: "2006-08-01", // POP Series 1  — released Aug 2006
  1447: "2006-10-01", // POP Series 2  — released Oct 2006
  1442: "2006-11-01", // POP Series 3  — released Nov 2006
  1452: "2007-02-01", // POP Series 4  — released Feb 2007
  1439: "2007-08-01", // POP Series 5  — released Aug 2007
  1432: "2008-03-01", // POP Series 6  — released Mar 2008
  1414: "2008-08-01", // POP Series 7  — released Aug 2008
  1450: "2008-10-01", // POP Series 8  — released Oct 2008
  1446: "2009-03-01", // POP Series 9  — released Mar 2009
  // EX Trainer Kits (2004)
  1542: "2004-08-01", // EX Trainer Kit 2: Plusle & Minun
  1543: "2004-08-01", // EX Trainer Kit 1: Latias & Latios
  // Nintendo Promos
  1423: "2003-01-01",
};

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
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: `tcgcsv returned ${res.status}` }, { status: 502 });
    }

    const data = await res.json() as { results: TcgCsvGroup[] };
    const groups: TcgCsvGroup[] = data.results ?? [];

    // tcgcsv sometimes bulk-updates old set metadata and stamps them with a
    // migration timestamp (e.g. "2026-04-05T20:00:05.5929925Z"). Detect these as
    // "dirty" dates and treat them as null for display so ancient sets don't
    // float to the top as if they released today.
    const DIRTY_MARKER = "T20:00:05";

    function cleanDate(groupId: number, iso: string | null): string | null {
      // Use hardcoded known date first (overrides corrupted tcgcsv data)
      if (KNOWN_DATES[groupId]) return KNOWN_DATES[groupId];
      if (!iso) return null;
      if (iso.includes(DIRTY_MARKER)) return null;
      return iso;
    }

    // Sort: newest first by cleanDate, then by groupId descending as tiebreaker
    const sorted = [...groups].sort((a, b) => {
      const da = cleanDate(a.groupId, a.publishedOn);
      const db = cleanDate(b.groupId, b.publishedOn);
      if (!da && !db) return b.groupId - a.groupId;
      if (!da) return 1;
      if (!db) return -1;
      const cmp = db.localeCompare(da);
      return cmp !== 0 ? cmp : b.groupId - a.groupId;
    });

    const sets: SetInfo[] = sorted.map(g => ({
      groupId:     g.groupId,
      name:        g.name,
      publishedOn: cleanDate(g.groupId, g.publishedOn),
      categoryId:  g.categoryId ?? categoryId,
    }));

    return NextResponse.json(
      { game, categoryId, sets },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300" } },
    );
  } catch (err) {
    console.error("[api/sets]", err);
    return NextResponse.json({ error: "Failed to fetch sets" }, { status: 500 });
  }
}
