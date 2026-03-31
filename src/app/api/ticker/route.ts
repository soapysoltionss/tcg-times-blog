import { NextResponse } from "next/server";
import { getListings } from "@/lib/db";

/**
 * GET /api/ticker
 *
 * Returns a flat list of ticker events for the MarketTicker bulletin strip.
 * Combines:
 *   1. Recent community/store listings (new → "LISTED")
 *   2. Recently sold listings            (sold → "SOLD")
 *   3. Price movers from Pokémon TCG API (popular cards → price data)
 *
 * Cached at the edge for 60 s so the ticker refreshes frequently without
 * hammering the DB on every page load.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type TickerEventKind = "listed" | "sold" | "price";

export interface TickerEvent {
  id: string;
  kind: TickerEventKind;
  cardName: string;
  game: string;
  /** e.g. "Near Mint" or "$12.99" */
  label: string;
  priceCents: number | null;
  /** +/- percent change — only set for kind="price" */
  changePct?: number;
  imageUrl?: string;
  listingId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GAME_EMOJI: Record<string, string> = {
  "flesh-and-blood": "⚔️",
  "grand-archive":   "📜",
  "one-piece":       "🏴‍☠️",
  pokemon:           "🎮",
  "magic":           "🧙",
  other:             "🃏",
};

function gameEmoji(game: string): string {
  return GAME_EMOJI[game] ?? GAME_EMOJI.other;
}

interface PokemonPriceMover {
  name: string;
  setName: string;
  priceCents: number;
  changePct: number;
  imageUrl: string | null;
}

/** Fetch the top ~30 recent Pokémon cards with market prices from the TCG API */
async function fetchPokemonMovers(): Promise<PokemonPriceMover[]> {
  const POKEMON_API = "https://api.pokemontcg.io/v2";

  // Query popular/iconic cards that almost always have pricing
  const queries = [
    'name:"Charizard"',
    'name:"Pikachu"',
    'name:"Mewtwo"',
    'name:"Umbreon"',
    'name:"Rayquaza"',
    'name:"Gengar"',
    'name:"Lugia"',
    'name:"Eevee"',
  ];

  const headers: Record<string, string> = { Accept: "application/json" };
  const apiKey = process.env.POKEMON_TCG_API_KEY;
  if (apiKey) headers["X-Api-Key"] = apiKey;

  const results: PokemonPriceMover[] = [];

  for (const q of queries) {
    try {
      const url = `${POKEMON_API}/cards?q=${encodeURIComponent(q)}&pageSize=4&orderBy=-set.releaseDate`;
      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(5_000),
        next: { revalidate: 3600 },
      });
      if (!res.ok) continue;

      type RawCard = {
        id: string;
        name: string;
        set: { name: string };
        images: { small: string; large: string };
        cardmarket?: { prices?: { averageSellPrice?: number; avg30?: number; avg7?: number } };
        tcgplayer?: { prices?: { holofoil?: { market?: number }; normal?: { market?: number } } };
      };

      const data: { data: RawCard[] } = await res.json();

      for (const card of data.data) {
        const cm = card.cardmarket?.prices;
        const tcp = card.tcgplayer?.prices;

        const current =
          (cm?.averageSellPrice ?? 0) > 0 ? Math.round(cm!.averageSellPrice! * 100) :
          (tcp?.holofoil?.market ?? 0) > 0 ? Math.round(tcp!.holofoil!.market! * 100) :
          (tcp?.normal?.market ?? 0) > 0    ? Math.round(tcp!.normal!.market! * 100) :
          null;

        if (!current || current < 100) continue; // skip < $1

        // Simulate a price change using avg7 vs avg30 from cardmarket if available
        const avg7  = cm?.avg7  ? Math.round(cm.avg7  * 100) : null;
        const avg30 = cm?.avg30 ? Math.round(cm.avg30 * 100) : null;
        const base  = avg30 ?? avg7;
        const changePct = base && base > 0 ? ((current - base) / base) * 100 : 0;

        results.push({
          name:       card.name,
          setName:    card.set.name,
          priceCents: current,
          changePct:  Math.round(changePct * 10) / 10,
          imageUrl:   card.images.small ?? null,
        });

        if (results.length >= 20) break;
      }
    } catch {
      // ignore individual card failures
    }
    if (results.length >= 20) break;
  }

  return results;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const events: TickerEvent[] = [];

  // ── 1. Recent community + store listings ────────────────────────────────
  try {
    const [newListings, soldListings] = await Promise.all([
      getListings({ includeSold: false }),
      getListings({ includeSold: true }),
    ]);

    // New listings — up to 20 most recent
    for (const l of newListings.slice(0, 20)) {
      if (l.sold) continue;
      events.push({
        id:       `listed-${l.id}`,
        kind:     "listed",
        cardName: l.cardName,
        game:     l.game,
        label:    `${gameEmoji(l.game)} ${l.cardName} · ${l.condition} · $${(l.priceCents / 100).toFixed(2)}`,
        priceCents: l.priceCents,
        imageUrl:   l.imageUrl,
        listingId:  l.id,
      });
    }

    // Recently sold — those with sold=true in the last 40 results
    const recentlySold = soldListings.filter(l => l.sold).slice(0, 20);
    for (const l of recentlySold) {
      events.push({
        id:       `sold-${l.id}`,
        kind:     "sold",
        cardName: l.cardName,
        game:     l.game,
        label:    `${gameEmoji(l.game)} ${l.cardName} · SOLD · $${(l.priceCents / 100).toFixed(2)}`,
        priceCents: l.priceCents,
        imageUrl:   l.imageUrl,
        listingId:  l.id,
      });
    }
  } catch (err) {
    console.warn("[ticker] DB error:", err);
  }

  // ── 2. Pokémon price movers ───────────────────────────────────────────────
  try {
    const movers = await fetchPokemonMovers();
    for (const m of movers) {
      events.push({
        id:        `price-${m.name.replace(/\s+/g, "-").toLowerCase()}-${m.priceCents}`,
        kind:      "price",
        cardName:  m.name,
        game:      "pokemon",
        label:     `🎮 ${m.name} · ${m.setName} · $${(m.priceCents / 100).toFixed(2)}`,
        priceCents: m.priceCents,
        changePct:  m.changePct,
        imageUrl:   m.imageUrl ?? undefined,
      });
    }
  } catch (err) {
    console.warn("[ticker] Pokémon movers error:", err);
  }

  // Shuffle listed/sold/price events together so the strip feels live
  // Simple interleave: listed, price, sold, listed, price, sold …
  const listed = events.filter(e => e.kind === "listed");
  const sold   = events.filter(e => e.kind === "sold");
  const prices = events.filter(e => e.kind === "price");

  const merged: TickerEvent[] = [];
  const max = Math.max(listed.length, sold.length, prices.length);
  for (let i = 0; i < max; i++) {
    if (listed[i])  merged.push(listed[i]);
    if (prices[i])  merged.push(prices[i]);
    if (sold[i])    merged.push(sold[i]);
  }

  // Fallback: if we have nothing from the DB yet, keep just price movers
  const final = merged.length > 0 ? merged : events;

  return NextResponse.json(
    { events: final },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
      },
    }
  );
}
