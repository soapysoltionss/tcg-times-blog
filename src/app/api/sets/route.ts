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
  /** "tcgcsv" means this set should use /api/market-set even for game=pokemon */
  source?: "pokemontcg" | "tcgcsv";
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

// tcgcsv Pokémon promo groups that pokemontcg.io doesn't carry yet.
// These are fetched from tcgcsv and merged into the Pokémon set list.
// Key = groupId, value = display label override (use group name if omitted).
const POKEMON_TCGCSV_PROMO_GROUPS: Record<number, { label?: string; date: string }> = {
  22872: { label: "SV: Black Star Promos",           date: "2023-03-31" },
  24451: { label: "Mega Evolution Promos",            date: "2025-09-26" },
  24529: { label: "Player Placement Trainer Promos",  date: "2026-01-02" },
  2545:  { label: "SWSH: Black Star Promos",          date: "2019-11-15" },
  1861:  { label: "SM Promos",                        date: "2016-12-14" },
  1451:  { label: "XY Promos",                        date: "2013-12-16" },
  1407:  { label: "Black and White Promos",           date: "2011-04-25" },
  1453:  { label: "HGSS Promos",                      date: "2010-02-01" },
  1421:  { label: "Diamond and Pearl Promos",         date: "2007-05-01" },
  24584: { label: "First Partner Collection 2026",    date: "2026-03-30" },
  2776:  { label: "First Partner Pack",               date: "2021-02-26" },
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

// Fetch the specific tcgcsv promo groups we want to blend into the Pokémon list.
// Returns SetInfo entries flagged with `source: "tcgcsv"` for routing purposes.
async function getPokemonPromoSets(): Promise<SetInfo[]> {
  const result: SetInfo[] = [];
  for (const [gid, meta] of Object.entries(POKEMON_TCGCSV_PROMO_GROUPS)) {
    result.push({
      groupId:     gid,          // numeric tcgcsv groupId as string
      name:        meta.label ?? `Pokémon Promos (${gid})`,
      publishedOn: meta.date,
      categoryId:  3,
      source:      "tcgcsv",     // tells gallery page to use /api/market-set
    });
  }
  // Sort by date descending
  return result.sort((a, b) => (b.publishedOn ?? "").localeCompare(a.publishedOn ?? ""));
}

// ---------------------------------------------------------------------------
// Card search helpers
// ---------------------------------------------------------------------------

interface CardSearchResult {
  productId: number | string;
  name: string;
  imageUrl?: string | null;
  marketPriceCents?: number | null;
  rarity?: string;
  setName?: string;
  groupId?: string | number;
}

async function searchPokemonCards(q: string): Promise<CardSearchResult[]> {
  const headers: Record<string, string> = { "User-Agent": "tcgtimes-blog/1.0" };
  const apiKey = process.env.POKEMON_TCG_API_KEY;
  if (apiKey) headers["X-Api-Key"] = apiKey;

  const res = await fetch(
    `${POKEMON_API}/cards?q=name:"${encodeURIComponent(q)}*"&select=id,name,rarity,images,tcgplayer,set&pageSize=18`,
    { headers, signal: AbortSignal.timeout(10_000), cache: "no-store" }
  );
  if (!res.ok) return [];
  const data = await res.json() as { data: Array<{
    id: string; name: string; rarity?: string;
    images: { small: string };
    tcgplayer?: { prices?: Record<string, { market?: number }> };
    set: { id: string; name: string };
  }> };

  return (data.data ?? []).map(c => {
    const prices = c.tcgplayer?.prices ?? {};
    const pref = ["holofoil","reverseHolofoil","normal","1stEditionHolofoil"];
    let market: number | null = null;
    for (const k of pref) {
      const v = prices[k]?.market;
      if (v != null && v > 0) { market = v; break; }
    }
    if (!market) {
      const vals = Object.values(prices).map(p => p.market).filter((v): v is number => !!v && v > 0);
      if (vals.length) market = Math.max(...vals);
    }
    return {
      productId:        c.id,
      name:             c.name,
      imageUrl:         c.images?.small ?? null,
      marketPriceCents: market ? Math.round(market * 100) : null,
      rarity:           c.rarity,
      setName:          c.set?.name,
      groupId:          c.set?.id,
    };
  });
}

async function searchTcgCsvCards(categoryId: number, q: string): Promise<CardSearchResult[]> {
  // tcgcsv has no cross-group search — fetch groups list, then search products
  // from the most recent 20 groups in parallel and filter by name.
  const groupsRes = await fetch(`${TCGCSV}/${categoryId}/groups`, {
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!groupsRes.ok) return [];

  const groupsData = await groupsRes.json() as { results: Array<{ groupId: number; name: string }> };
  const groups = (groupsData.results ?? []).slice(0, 20); // most recent 20

  const lower = q.toLowerCase();

  // Fetch products from all groups in parallel
  const fetches = groups.map(async (g) => {
    try {
      const res = await fetch(`${TCGCSV}/${categoryId}/${g.groupId}/products`, {
        signal: AbortSignal.timeout(8_000),
        cache: "no-store",
      });
      if (!res.ok) return [];
      const data = await res.json() as { results?: Array<{
        productId: number;
        name: string;
        imageUrl?: string;
        extendedData?: Array<{ name: string; value: string }>;
      }> };
      return (data.results ?? [])
        .filter(p => p.name.toLowerCase().includes(lower))
        .map(p => {
          const ext: Record<string, string> = {};
          for (const e of p.extendedData ?? []) ext[e.name] = e.value;
          // Only actual cards (have HP or Number)
          if (!ext["HP"] && !ext["Number"] && !ext["Pitch"]) return null;
          return {
            productId: p.productId as number | string,
            name:      p.name,
            imageUrl:  `https://tcgplayer-cdn.tcgplayer.com/product/${p.productId}_200w.jpg`,
            rarity:    ext["Rarity"] ?? undefined,
            setName:   g.name,
            groupId:   g.groupId,
          } as CardSearchResult;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
    } catch {
      return [];
    }
  });

  const nested = await Promise.all(fetches);
  const all = nested.flat();

  // Deduplicate by name (keep first/highest groupId hit), limit to 18
  const seen = new Set<string>();
  const unique: CardSearchResult[] = [];
  for (const c of all) {
    const key = c.name.toLowerCase();
    if (!seen.has(key)) { seen.add(key); unique.push(c); }
    if (unique.length >= 18) break;
  }
  return unique;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const game = req.nextUrl.searchParams.get("game") ?? "";
  const cardSearch = req.nextUrl.searchParams.get("cardSearch") ?? "";

  // ── Card search mode ──────────────────────────────────────────────────────
  if (cardSearch.trim()) {
    try {
      let cards: CardSearchResult[];
      if (game === "pokemon") {
        cards = await searchPokemonCards(cardSearch.trim());
      } else {
        const categoryId = CATEGORY_ID[game];
        if (!categoryId) return NextResponse.json({ cards: [] });
        cards = await searchTcgCsvCards(categoryId, cardSearch.trim());
      }
      return NextResponse.json({ cards });
    } catch (err) {
      console.error("[api/sets cardSearch]", err);
      return NextResponse.json({ cards: [] });
    }
  }

  // ── Sets list mode (original) ─────────────────────────────────────────────
  try {
    let sets: SetInfo[];

    if (game === "pokemon") {
      // Merge pokemontcg.io sets + tcgcsv promo groups in one list
      const [pkmnSets, promoSets] = await Promise.all([
        getPokemonSets(),
        getPokemonPromoSets(),
      ]);
      // Merge and sort by date descending
      sets = [...pkmnSets, ...promoSets].sort((a, b) => {
        const da = a.publishedOn ?? "";
        const db = b.publishedOn ?? "";
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return db.localeCompare(da);
      });
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
