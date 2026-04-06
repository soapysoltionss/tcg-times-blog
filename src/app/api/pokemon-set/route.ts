import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/pokemon-set?setId=sv9
 *
 * Returns all cards + live TCGPlayer prices for a Pokémon TCG set.
 * Source: api.pokemontcg.io (requires POKEMON_TCG_API_KEY env var for
 * the paid-tier rate limits; free key = 20,000 req/day which is fine).
 *
 * Response shape matches /api/market-set so the gallery page works unchanged.
 */

const POKEMON_API = "https://api.pokemontcg.io/v2";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PkmnCardImages { small: string; large: string }

interface PkmnPriceTier {
  low?: number | null;
  mid?: number | null;
  high?: number | null;
  market?: number | null;
  directLow?: number | null;
}

interface PkmnTcgPlayer {
  url?: string;
  updatedAt?: string;
  prices?: Record<string, PkmnPriceTier>;
}

interface PkmnCard {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  images: PkmnCardImages;
  tcgplayer?: PkmnTcgPlayer;
  set: {
    id: string;
    name: string;
    total: number;
    releaseDate: string;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Pick the "best" price tier in order of preference
const PRICE_TIER_PREF = [
  "specialIllustrationRare",
  "illustrationRare",
  "hyperRare",
  "rainbowRare",
  "shinyHoloRare",
  "holoRare",
  "reverseHolofoil",
  "1stEditionHolofoil",
  "normal",
];

function bestPrice(prices: Record<string, PkmnPriceTier> | undefined): {
  marketPriceCents: number | null;
  midPriceCents: number | null;
  subTypeName: string;
} {
  if (!prices) return { marketPriceCents: null, midPriceCents: null, subTypeName: "Normal" };

  // Try preferred order first
  for (const tier of PRICE_TIER_PREF) {
    if (prices[tier]) {
      const p = prices[tier];
      if (p.market != null || p.mid != null) {
        return {
          marketPriceCents: p.market   != null ? Math.round(p.market * 100)  : null,
          midPriceCents:    p.mid      != null ? Math.round(p.mid    * 100)  : null,
          subTypeName:      tierLabel(tier),
        };
      }
    }
  }

  // Fallback: first tier that has any price
  for (const [tier, p] of Object.entries(prices)) {
    if (p.market != null || p.mid != null) {
      return {
        marketPriceCents: p.market != null ? Math.round(p.market * 100) : null,
        midPriceCents:    p.mid    != null ? Math.round(p.mid    * 100) : null,
        subTypeName:      tierLabel(tier),
      };
    }
  }

  return { marketPriceCents: null, midPriceCents: null, subTypeName: "Normal" };
}

function tierLabel(tier: string): string {
  const labels: Record<string, string> = {
    normal:                     "Normal",
    reverseHolofoil:            "Reverse Holofoil",
    holoRare:                   "Holo Rare",
    rainbowRare:                "Rainbow Rare",
    hyperRare:                  "Hyper Rare",
    illustrationRare:           "Illustration Rare",
    specialIllustrationRare:    "Special Illustration Rare",
    shinyHoloRare:              "Shiny Holo Rare",
    "1stEditionHolofoil":       "1st Edition Holofoil",
  };
  return labels[tier] ?? tier;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const setId = req.nextUrl.searchParams.get("setId") ?? "";
  if (!setId) {
    return NextResponse.json({ error: "setId is required" }, { status: 400 });
  }

  const headers: Record<string, string> = { "User-Agent": "tcgtimes-blog/1.0" };
  const apiKey = process.env.POKEMON_TCG_API_KEY;
  if (apiKey) headers["X-Api-Key"] = apiKey;

  try {
    // Fetch all pages of cards for this set
    const allCards: PkmnCard[] = [];
    let page = 1;
    let setMeta: PkmnCard["set"] | null = null;

    while (true) {
      const res = await fetch(
        `${POKEMON_API}/cards?q=set.id:${encodeURIComponent(setId)}&orderBy=number&pageSize=250&page=${page}`,
        { headers, signal: AbortSignal.timeout(20_000), cache: "no-store" }
      );
      if (!res.ok) {
        if (res.status === 404) {
          return NextResponse.json({ error: `Set '${setId}' not found` }, { status: 404 });
        }
        throw new Error(`pokemontcg.io cards: ${res.status}`);
      }
      const data = await res.json() as { data: PkmnCard[]; totalCount: number };
      if (data.data.length === 0) break;
      if (!setMeta && data.data[0]) setMeta = data.data[0].set;
      allCards.push(...data.data);
      if (allCards.length >= data.totalCount) break;
      page++;
    }

    // Map to the same shape as /api/market-set
    const cards = allCards.map(c => {
      const price = bestPrice(c.tcgplayer?.prices);
      return {
        productId:        c.id,           // string e.g. "sv9-1"
        name:             c.name,
        cleanName:        c.name,
        number:           c.number,
        rarity:           c.rarity ?? null,
        imageUrl:         c.images?.large ?? c.images?.small ?? null,
        marketPriceCents: price.marketPriceCents,
        midPriceCents:    price.midPriceCents,
        subTypeName:      price.subTypeName,
        // Extra fields pokemontcg.io gives us
        priceUpdatedAt:   c.tcgplayer?.updatedAt ?? null,
      };
    });

    const releaseDate = setMeta?.releaseDate
      ? setMeta.releaseDate.replace(/\//g, "-")
      : null;

    return NextResponse.json(
      {
        groupId:    setId,
        name:       setMeta?.name ?? setId,
        game:       "pokemon",
        categoryId: 3,
        publishedOn: releaseDate,
        totalCards: allCards.length,
        cards,
      },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300" } }
    );

  } catch (err) {
    console.error("[api/pokemon-set]", err);
    return NextResponse.json({ error: "Failed to fetch set cards" }, { status: 500 });
  }
}
