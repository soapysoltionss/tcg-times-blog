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
const TCGCSV = "https://tcgcsv.com/tcgplayer";
const POKEMON_CATEGORY_ID = 3;

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

interface PkmnCardMarket {
  url?: string;
  updatedAt?: string;
  prices?: {
    averageSellPrice?: number | null;
    lowPrice?: number | null;
    trendPrice?: number | null;
    avg1?: number | null;
    avg7?: number | null;
    avg30?: number | null;
    reverseHoloSell?: number | null;
    reverseHoloTrend?: number | null;
    reverseHoloAvg1?: number | null;
    reverseHoloAvg7?: number | null;
    reverseHoloAvg30?: number | null;
  };
}

interface PkmnCard {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  subtypes?: string[];
  images: PkmnCardImages;
  tcgplayer?: PkmnTcgPlayer;
  cardmarket?: PkmnCardMarket;
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
// TCGPlayer (tcgcsv) price fallback for old sets
// ---------------------------------------------------------------------------

/**
 * Find a tcgcsv group for Pokémon whose name matches the given set name.
 * Returns the groupId or null if not found.
 */
async function findTcgCsvGroupId(setName: string): Promise<number | null> {
  try {
    const res = await fetch(`${TCGCSV}/${POKEMON_CATEGORY_ID}/groups`, {
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json() as { results: Array<{ groupId: number; name: string }> };
    const lower = setName.toLowerCase().trim();
    // Exact match first, then partial
    const exact = data.results.find(g => g.name.toLowerCase().trim() === lower);
    if (exact) return exact.groupId;
    const partial = data.results.find(g =>
      g.name.toLowerCase().includes(lower) || lower.includes(g.name.toLowerCase())
    );
    return partial?.groupId ?? null;
  } catch {
    return null;
  }
}

interface TcgCsvPriceEntry {
  marketPriceCents: number | null;
  allPriceTiers: { label: string; marketCents: number | null; midCents: number | null }[];
}

/**
 * Fetch TCGPlayer market prices from tcgcsv for a specific group.
 * Returns a Map<cardNumber, TcgCsvPriceEntry> keyed by card number (e.g. "007/217").
 * Falls back to name-based matching for cards where number is unavailable.
 */
async function fetchTcgCsvPrices(groupId: number): Promise<{
  byNumber: Map<string, TcgCsvPriceEntry>;
  byName: Map<string, TcgCsvPriceEntry>;
}> {
  const byNumber = new Map<string, TcgCsvPriceEntry>();
  const byName = new Map<string, TcgCsvPriceEntry>();
  try {
    const [productsRes, pricesRes] = await Promise.all([
      fetch(`${TCGCSV}/${POKEMON_CATEGORY_ID}/${groupId}/products`, {
        signal: AbortSignal.timeout(15_000), cache: "no-store",
      }),
      fetch(`${TCGCSV}/${POKEMON_CATEGORY_ID}/${groupId}/prices`, {
        signal: AbortSignal.timeout(15_000), cache: "no-store",
      }),
    ]);
    if (!productsRes.ok || !pricesRes.ok) return { byNumber, byName };

    const productsData = await productsRes.json() as {
      results: Array<{
        productId: number;
        cleanName: string;
        name: string;
        extendedData?: Array<{ name: string; value: string }>;
      }>
    };
    const pricesData = await pricesRes.json() as {
      results: Array<{ productId: number; marketPrice: number | null; midPrice: number | null; subTypeName: string }>
    };

    // Build productId -> { cardNumber, cleanName } map
    // Only include actual card products (those with a "Number" extendedData field)
    const productInfo = new Map<number, { cardNumber: string | null; cleanName: string }>();
    for (const p of productsData.results ?? []) {
      const numberField = p.extendedData?.find(d => d.name === "Number");
      const cardNumber = numberField?.value ?? null; // e.g. "007/217"
      const cleanName = (p.cleanName ?? p.name).toLowerCase();
      productInfo.set(p.productId, { cardNumber, cleanName });
    }

    // Group prices by productId, collecting all subtype variants
    const SUBTYPE_LABEL: Record<string, string> = {
      "Holofoil":             "Holofoil",
      "1st Edition Holofoil": "1st Ed Holofoil",
      "Reverse Holofoil":     "Reverse Holo",
      "Normal":               "Normal",
    };
    const PREF_ORDER = ["Holofoil", "1st Edition Holofoil", "Reverse Holofoil", "Normal"];

    const allPrices = new Map<number, { subType: string; marketCents: number | null; midCents: number | null }[]>();
    for (const row of pricesData.results ?? []) {
      if (!allPrices.has(row.productId)) allPrices.set(row.productId, []);
      const marketCents = row.marketPrice && row.marketPrice > 0 ? Math.round(row.marketPrice * 100) : null;
      const midCents = row.midPrice && row.midPrice > 0 ? Math.round(row.midPrice * 100) : null;
      if (marketCents != null || midCents != null) {
        allPrices.get(row.productId)!.push({ subType: row.subTypeName, marketCents, midCents });
      }
    }

    for (const [pid, entries] of allPrices) {
      const info = productInfo.get(pid);
      if (!info) continue;

      // Build allPriceTiers
      const allPriceTiersForCard = entries.map(e => ({
        label:       SUBTYPE_LABEL[e.subType] ?? e.subType,
        marketCents: e.marketCents,
        midCents:    e.midCents,
      }));

      // Pick best marketPrice: prefer Holofoil > 1st Ed Holofoil > Reverse Holofoil > Normal
      let bestMarket: number | null = null;
      for (const pref of PREF_ORDER) {
        const match = entries.find(e => e.subType === pref && e.marketCents != null);
        if (match) { bestMarket = match.marketCents; break; }
      }
      if (bestMarket == null) {
        bestMarket = entries.find(e => e.marketCents != null)?.marketCents ?? null;
      }

      const entry: TcgCsvPriceEntry = { marketPriceCents: bestMarket, allPriceTiers: allPriceTiersForCard };

      // Index by card number — stored under multiple key formats so we match
      // pokemontcg.io (which uses bare numbers like "272") and other formats.
      if (info.cardNumber) {
        // Full key as-is: "007/217"
        byNumber.set(info.cardNumber, entry);

        // Leading-zero-stripped full key: "7/217"
        const normFull = info.cardNumber.replace(/^0+(\d)/, "$1");
        if (normFull !== info.cardNumber) byNumber.set(normFull, entry);

        // Base number only (before the slash): "007" → also "7"
        // pokemontcg.io sends c.number = "272" with no leading zeros and no "/217"
        const baseNum = info.cardNumber.split("/")[0]; // "007"
        if (baseNum && !byNumber.has(baseNum)) byNumber.set(baseNum, entry);
        const baseNumNorm = baseNum.replace(/^0+(\d)/, "$1"); // "7"
        if (baseNumNorm !== baseNum && !byNumber.has(baseNumNorm)) byNumber.set(baseNumNorm, entry);
      }

      // Index by clean name (lowercase) as a secondary fallback
      if (info.cleanName) {
        // Only store if not already set (first product with this name wins)
        if (!byName.has(info.cleanName)) byName.set(info.cleanName, entry);
      }
    }
  } catch {
    // silent — best effort
  }
  return { byNumber, byName };
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
    // First request — get totalCount, then fetch remaining pages in parallel.
    // NOTE: Do NOT use orderBy=number — pokemontcg.io sorts it lexicographically
    // which causes non-deterministic pagination (duplicates + missing cards).
    // We sort numerically ourselves after fetching all pages.
    const PAGE_SIZE = 100;
    const makeUrl = (page: number) =>
      `${POKEMON_API}/cards?q=set.id:${encodeURIComponent(setId)}&pageSize=${PAGE_SIZE}&page=${page}&select=id,name,number,rarity,subtypes,images,tcgplayer,cardmarket,set`;

    const firstRes = await fetch(makeUrl(1), {
      headers, signal: AbortSignal.timeout(20_000), cache: "no-store",
    });
    if (!firstRes.ok) {
      if (firstRes.status === 404) {
        return NextResponse.json({ error: `Set '${setId}' not found` }, { status: 404 });
      }
      throw new Error(`pokemontcg.io cards: ${firstRes.status}`);
    }
    const firstData = await firstRes.json() as { data: PkmnCard[]; totalCount: number };
    const rawCards: PkmnCard[] = [...firstData.data];
    const totalCount = firstData.totalCount;
    let setMeta: PkmnCard["set"] | null = rawCards[0]?.set ?? null;

    // Fetch remaining pages in parallel if needed
    if (totalCount > PAGE_SIZE) {
      const extraPageCount = Math.ceil((totalCount - PAGE_SIZE) / PAGE_SIZE);
      const extraResults = await Promise.all(
        Array.from({ length: extraPageCount }, (_, i) =>
          fetch(makeUrl(i + 2), { headers, signal: AbortSignal.timeout(20_000), cache: "no-store" })
            .then(r => r.json() as Promise<{ data: PkmnCard[] }>)
        )
      );
      for (const result of extraResults) rawCards.push(...result.data);
    }

    // Deduplicate by card ID (unstable pagination can return the same card twice)
    const seen = new Set<string>();
    const uniqueCards = rawCards.filter(c => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });

    // Sort numerically by card number, then lexicographically for promo suffixes (e.g. "001a")
    const allCards = uniqueCards.sort((a, b) => {
      const na = parseInt(a.number, 10);
      const nb = parseInt(b.number, 10);
      if (na !== nb) return na - nb;
      return a.number.localeCompare(b.number);
    });

    // Map to the same shape as /api/market-set
    let mappedCards = allCards.map(c => {
      const price = bestPrice(c.tcgplayer?.prices);
      const cm = c.cardmarket?.prices;

      // Build all TCGPlayer price tiers for display
      const TIER_LABELS: Record<string, string> = {
        normal:                     "Normal",
        reverseHolofoil:            "Reverse Holo",
        holoRare:                   "Holo Rare",
        rainbowRare:                "Rainbow Rare",
        hyperRare:                  "Hyper Rare",
        illustrationRare:           "Illustration Rare",
        specialIllustrationRare:    "Special Illus. Rare",
        shinyHoloRare:              "Shiny Holo Rare",
        "1stEditionHolofoil":       "1st Ed Holofoil",
        "1stEditionNormal":         "1st Ed Normal",
        unlimitedHolofoil:          "Unlimited Holofoil",
        unlimitedNormal:            "Unlimited Normal",
      };
      const allPriceTiers = Object.entries(c.tcgplayer?.prices ?? {})
        .map(([key, tier]) => ({
          label:       TIER_LABELS[key] ?? key,
          marketCents: tier.market != null ? Math.round(tier.market * 100) : null,
          midCents:    tier.mid    != null ? Math.round(tier.mid    * 100) : null,
        }))
        .filter(t => t.marketCents != null || t.midCents != null);

      const cmAvg: Record<string, number | null> = {
        avg1:  cm?.avg1  ?? null,
        avg7:  cm?.avg7  ?? null,
        avg30: cm?.avg30 ?? null,
        trend: cm?.trendPrice ?? null,
        sell:  cm?.averageSellPrice ?? null,
        rhAvg1:  cm?.reverseHoloAvg1  ?? null,
        rhAvg7:  cm?.reverseHoloAvg7  ?? null,
        rhAvg30: cm?.reverseHoloAvg30 ?? null,
        rhTrend: cm?.reverseHoloTrend ?? null,
      };

      return {
        productId:        c.id,
        name:             c.name,
        cleanName:        c.name,
        number:           c.number,
        rarity:           c.rarity ?? null,
        subtypes:         c.subtypes ?? [],
        imageUrl:         c.images?.large ?? c.images?.small ?? null,
        marketPriceCents: price.marketPriceCents,
        midPriceCents:    price.midPriceCents,
        subTypeName:      price.subTypeName,
        allPriceTiers,
        priceUpdatedAt:   c.tcgplayer?.updatedAt ?? null,
        cardmarketAvg:    cmAvg,
      };
    });

    // ── TCGPlayer price fallback via tcgcsv ──────────────────────────────────
    // pokemontcg.io doesn't always carry current TCGPlayer prices (older sets
    // or newly released sets like ME: Ascended Heroes). If ANY cards are missing
    // a price, attempt to fill them in from tcgcsv.
    const pricedCount = mappedCards.filter(c => c.marketPriceCents != null).length;
    const pricedRatio = mappedCards.length > 0 ? pricedCount / mappedCards.length : 1;
    const hasMissingPrices = pricedRatio < 1.0;

    if (hasMissingPrices && setMeta?.name) {
      const tcgGroupId = await findTcgCsvGroupId(setMeta.name);
      if (tcgGroupId) {
        const { byNumber, byName } = await fetchTcgCsvPrices(tcgGroupId);
        if (byNumber.size > 0 || byName.size > 0) {
          mappedCards = mappedCards.map(c => {
            if (c.marketPriceCents != null) return c; // keep existing price

            // Try matching by card number first (most reliable), then by name.
            // pokemontcg.io gives c.number as a bare integer string ("272", "7", etc.)
            // tcgcsv stores numbers as "272/217" but we also index the bare base ("272").
            const numKey = c.number; // e.g. "272" or "7"
            const numKeyPadded = numKey.padStart(3, "0"); // "007" — tcgcsv sometimes uses padded
            const fallback =
              byNumber.get(numKey) ??
              byNumber.get(numKeyPadded) ??
              byName.get(c.name.toLowerCase().replace(/['']/g, "").replace(/\s+/g, " ").trim()) ??
              null;

            if (!fallback) return c;
            return {
              ...c,
              marketPriceCents: fallback.marketPriceCents,
              allPriceTiers: fallback.allPriceTiers.length > 0 ? fallback.allPriceTiers : c.allPriceTiers,
            };
          });
        }
      }
    }

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
        cards: mappedCards,
      },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300" } }
    );

  } catch (err) {
    console.error("[api/pokemon-set]", err);
    return NextResponse.json({ error: "Failed to fetch set cards" }, { status: 500 });
  }
}
