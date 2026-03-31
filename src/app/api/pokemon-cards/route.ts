import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/pokemon-cards?q=QUERY[&set=SET_NAME][&limit=N]
 *
 * Searches Pokémon TCG cards via the free public API.
 * Data source: https://api.pokemontcg.io/v2/cards
 *
 * No API key required for basic use (rate-limited to 1,000 req/day without key).
 * Set POKEMON_TCG_API_KEY in env to raise the limit.
 *
 * Returns a shape compatible with CardAutocomplete's AnyCardResult.
 */

const POKEMON_API = "https://api.pokemontcg.io/v2";

export interface PokemonCardPrinting {
  label: string;
  setName: string;
  imageUrl: string;
}

export interface PokemonCardResult {
  identifier: string;       // Pokémon TCG card id, e.g. "sv3pt5-197"
  name: string;
  setName: string;
  imageUrl: string | null;  // high-res image from the API
  printings: PokemonCardPrinting[];
  /** cardmarket average sell price in USD cents, or null if unavailable */
  marketPriceCents: number | null;
}

// ── Pokémon TCG API types (subset) ──────────────────────────────────────────

interface PokemonSet {
  id: string;
  name: string;
  series: string;
  releaseDate: string;
}

interface PokemonCardPrices {
  averageSellPrice?: number;
  avg1?: number;
  low?: number;
  trend?: number;
}

interface PokemonCard {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  set: PokemonSet;
  images: {
    small: string;
    large: string;
  };
  cardmarket?: {
    prices: PokemonCardPrices;
  };
  tcgplayer?: {
    prices?: {
      normal?: { market?: number };
      holofoil?: { market?: number };
      reverseHolofoil?: { market?: number };
    };
  };
}

interface PokemonApiResponse {
  data: PokemonCard[];
  totalCount: number;
  page: number;
  pageSize: number;
  count: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getMarketPriceCents(card: PokemonCard): number | null {
  // 1. Try cardmarket average sell price (EUR-ish, but best available)
  const cm = card.cardmarket?.prices?.averageSellPrice;
  if (cm && cm > 0) return Math.round(cm * 100);

  // 2. Try TCGPlayer market price (USD)
  const tcp = card.tcgplayer?.prices;
  if (tcp) {
    const p =
      tcp.holofoil?.market ??
      tcp.normal?.market ??
      tcp.reverseHolofoil?.market;
    if (p && p > 0) return Math.round(p * 100);
  }

  return null;
}

function normalisePokemonCard(card: PokemonCard): PokemonCardResult {
  const printing: PokemonCardPrinting = {
    label: `${card.set.name} (#${card.number})`,
    setName: card.set.name,
    imageUrl: card.images.large ?? card.images.small,
  };

  return {
    identifier: card.id,
    name: card.name,
    setName: card.set.name,
    imageUrl: card.images.large ?? card.images.small ?? null,
    printings: [printing],
    marketPriceCents: getMarketPriceCents(card),
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const setFilter = req.nextUrl.searchParams.get("set")?.trim() ?? "";
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "20", 10), 50);

  if (q.length < 2) {
    return NextResponse.json({ cards: [] });
  }

  try {
    // Build query: name search + optional set filter
    let query = `name:"${q}*"`;
    if (setFilter) query += ` set.name:"${setFilter}"`;

    const url = `${POKEMON_API}/cards?q=${encodeURIComponent(query)}&pageSize=${limit}&orderBy=-set.releaseDate`;

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    const apiKey = process.env.POKEMON_TCG_API_KEY;
    if (apiKey) headers["X-Api-Key"] = apiKey;

    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10_000),
      next: { revalidate: 3600 }, // cache for 1 hour
    });

    if (!res.ok) {
      console.warn(`[pokemon-cards] API error ${res.status}`);
      return NextResponse.json({ cards: [] });
    }

    const data: PokemonApiResponse = await res.json();

    // Deduplicate by name — keep highest-priced printing as the "default"
    // but return all printings grouped under each unique name
    const byName = new Map<string, PokemonCardResult>();

    for (const raw of data.data) {
      const card = normalisePokemonCard(raw);
      const existing = byName.get(card.name);
      if (!existing) {
        byName.set(card.name, card);
      } else {
        // Add this printing to the existing entry
        existing.printings.push(...card.printings);
        // Use the best price
        if (
          card.marketPriceCents !== null &&
          (existing.marketPriceCents === null || card.marketPriceCents > existing.marketPriceCents)
        ) {
          existing.marketPriceCents = card.marketPriceCents;
          existing.imageUrl = card.imageUrl;
          existing.setName = card.setName;
        }
      }
    }

    const cards = Array.from(byName.values()).slice(0, 12);

    return NextResponse.json(
      { cards, total: data.totalCount },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300",
        },
      }
    );
  } catch (err) {
    console.error("[pokemon-cards]", err);
    return NextResponse.json({ cards: [], error: "network_error" });
  }
}
