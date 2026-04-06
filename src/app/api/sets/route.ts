import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/sets?game=pokemon|grand-archive|flesh-and-blood|one-piece
 *
 * pokemon    → pokemontcg.io  (accurate dates, card counts, hi-res images, daily prices)
 * all others → tcgcsv.com     (public TCGPlayer mirror)
 *
 * Response: { game, sets: SetInfo[] }
 * SetInfo.groupId = pokemontcg.io set id (e.g. "sv9") for pokemon,
 *                   tcgcsv numeric groupId as string for others.
 */

// ---------------------------------------------------------------------------
// Shared type
// ---------------------------------------------------------------------------

export interface SetInfo {
  groupId: string;
  name: string;
  publishedOn: string | null;
  categoryId: number;
  totalCards?: number;
  setSymbolUrl?: string;
}

// ---------------------------------------------------------------------------
// Pokémon — pokemontcg.io
// ---------------------------------------------------------------------------

const POKEMON_API = "https://api.pokemontcg.io/v2";

interface PkmnSet {
  id: string;
  name: string;
  total: number;
  releaseDate: string;
  images: { symbol: string; logo: string };
}

async function getPokemonSets(): Promise<SetInfo[]> {
  const headers: Record<string, string> = { "User-Agent": "tcgtimes-blog/1.0" };
  const apiKey = process.env.POKEMON_TCG_API_KEY;
  if (apiKey) headers["X-Api-Key"] = apiKey;

  // Max pageSize is 250 — paginate if needed
  const allSets: PkmnSet[] = [];
  let page = 1;
  while (true) {
    const res = await fetch(
      `${POKEMON_API}/sets?orderBy=-releaseDate&pageSize=250&page=${page}`,
      { headers, signal: AbortSignal.timeout(15_000), cache: "no-store" }
    );
    if (!res.ok) throw new Error(`pokemontcg.io sets: ${res.status}`);
    const data = await res.json() as {
      data: PkmnSet[];
      totalCount: number;
    };
    allSets.push(...data.data);
    if (allSets.length >= data.totalCount) break;
    page++;
  }

  return allSets.map(s => ({
    groupId:      s.id,
    name:         s.name,
    publishedOn:  s.releaseDate ? s.releaseDate.replace(/\//g, "-") : null,
    categoryId:   3,
    totalCards:   s.total,
    setSymbolUrl: s.images?.symbol ?? undefined,
  }));
}

// ---------------------------------------------------------------------------
// Non-pokemon — tcgcsv.com
// ---------------------------------------------------------------------------

const TCGCSV = "https://tcgcsv.com/tcgplayer";

const CATEGORY_ID: Record<string, number> = {
  "flesh-and-blood": 62,
  "grand-archive":   74,
  "one-piece":       68,
};

const KNOWN_DATES: Record<number, string> = {
  1422: "2006-08-01", 1447: "2006-10-01", 1442: "2006-11-01",
  1452: "2007-02-01", 1439: "2007-08-01", 1432: "2008-03-01",
  1414: "2008-08-01", 1450: "2008-10-01", 1446: "2009-03-01",
  1542: "2004-08-01", 1543: "2004-08-01", 1423: "2003-01-01",
};

const DIRTY_MARKER = "T20:00:05";

function cleanDate(groupId: number, iso: string | null): string | null {
  if (KNOWN_DATES[groupId]) return KNOWN_DATES[groupId];
  if (!iso) return null;
  if (iso.includes(DIRTY_MARKER)) return null;
  return iso.split("T")[0];
}

interface TcgCsvGroup {
  groupId: number;
  name: string;
  publishedOn: string | null;
  categoryId: number;
}

async function getTcgCsvSets(categoryId: number): Promise<SetInfo[]> {
  const res = await fetch(`${TCGCSV}/${categoryId}/groups`, {
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`tcgcsv returned ${res.status}`);

  const data = await res.json() as { results: TcgCsvGroup[] };
  const groups: TcgCsvGroup[] = data.results ?? [];

  const sorted = [...groups].sort((a, b) => {
    const da = cleanDate(a.groupId, a.publishedOn);
    const db = cleanDate(b.groupId, b.publishedOn);
    if (!da && !db) return b.groupId - a.groupId;
    if (!da) return 1;
    if (!db) return -1;
    const cmp = db.localeCompare(da);
    return cmp !== 0 ? cmp : b.groupId - a.groupId;
  });

  return sorted.map(g => ({
    groupId:     String(g.groupId),
    name:        g.name,
    publishedOn: cleanDate(g.groupId, g.publishedOn),
    categoryId:  g.categoryId ?? categoryId,
  }));
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const game = req.nextUrl.searchParams.get("game") ?? "";

  try {
    let sets: SetInfo[];

    if (game === "pokemon") {
      sets = await getPokemonSets();
    } else {
      const categoryId = CATEGORY_ID[game];
      if (!categoryId) {
        return NextResponse.json(
          { error: `Unknown game: ${game}. Valid: pokemon, ${Object.keys(CATEGORY_ID).join(", ")}` },
          { status: 400 }
        );
      }
      sets = await getTcgCsvSets(categoryId);
    }

    return NextResponse.json(
      { game, sets },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300" } }
    );
  } catch (err) {
    console.error("[api/sets]", err);
    return NextResponse.json({ error: "Failed to fetch sets" }, { status: 500 });
  }
}
