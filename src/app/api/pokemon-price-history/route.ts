import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

/**
 * GET /api/pokemon-price-history?cardId=<pokemontcg_card_id>
 *
 * 1. Fetches the card from pokemontcg.io (name, tcgplayer productId, current price)
 * 2. Fetches full price history from TCGPlayer Infinite API (weekly, alltime)
 * 3. Writes today's snapshot to price_snapshots (UPSERT)
 * 4. Reads all our DB snapshots for this card
 * 5. Merges: DB snapshots (daily, authoritative) override TCGPlayer points on
 *    overlapping dates; TCGPlayer fills in all older weekly history
 *
 * Returns: { cardId, cardName, releaseDate, history: PricePoint[] }
 * where PricePoint = { date: "YYYY-MM-DD", priceCents: number, synthetic?: true }
 */

const POKEMON_API = "https://api.pokemontcg.io/v2";
const TCG_INFINITE_API = "https://infinite-api.tcgplayer.com";
const TCGCSV = "https://tcgcsv.com/tcgplayer";
const POKEMON_CATEGORY_ID = 3;

// Browser-like headers required — TCGPlayer Infinite 403s without Origin/Referer
const TCG_INFINITE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Origin": "https://www.tcgplayer.com",
  "Referer": "https://www.tcgplayer.com/",
  "Accept": "application/json",
};

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function toCents(v: number | null | undefined): number | null {
  return v != null && v > 0 ? Math.round(v * 100) : null;
}

// ── TCGPlayer Infinite price history ────────────────────────────────────────
interface TcgInfiniteVariant {
  averageSalesPrice: string;
  marketPrice: string;
  quantity: string;
  variant: string;
}
interface TcgInfinitePoint {
  date: string; // "YYYY-MM-DD"
  variants: TcgInfiniteVariant[];
}

// Pick the best variant from a TCGPlayer Infinite data point.
// Priority mirrors the tier preference used throughout the app.
const VARIANT_PREF = [
  "Special Illustration Rare",
  "Illustration Rare",
  "Hyper Rare",
  "Rainbow Rare",
  "Shiny Holo Rare",
  "Holo Foil",
  "Holofoil",
  "1st Edition Holofoil",
  "Reverse Holofoil",
  "Normal",
];

function pickVariantPrice(variants: TcgInfiniteVariant[]): number | null {
  // Try each preferred variant name (case-insensitive)
  for (const pref of VARIANT_PREF) {
    const v = variants.find(vv => vv.variant.toLowerCase() === pref.toLowerCase());
    if (v) {
      const mp = parseFloat(v.marketPrice);
      if (mp > 0) return Math.round(mp * 100);
    }
  }
  // Fallback: pick the variant with the highest non-zero market price
  let best: number | null = null;
  for (const v of variants) {
    const mp = parseFloat(v.marketPrice);
    if (mp > 0 && (best == null || mp * 100 > best)) {
      best = Math.round(mp * 100);
    }
  }
  return best;
}

async function fetchTcgInfiniteHistory(
  tcgplayerId: string | number
): Promise<Array<{ date: string; priceCents: number }>> {
  try {
    const res = await fetch(
      `${TCG_INFINITE_API}/price/history/${tcgplayerId}?range=alltime`,
      {
        headers: TCG_INFINITE_HEADERS,
        signal: AbortSignal.timeout(12_000),
        cache: "no-store",
      }
    );
    if (!res.ok) return [];
    const data = await res.json() as { result?: TcgInfinitePoint[] };
    const result = data.result ?? [];
    const points: Array<{ date: string; priceCents: number }> = [];
    for (const pt of result) {
      const cents = pickVariantPrice(pt.variants);
      if (cents != null && cents > 0) {
        points.push({ date: pt.date, priceCents: cents });
      }
    }
    return points;
  } catch {
    return [];
  }
}

// ── TCGCSv helpers — find numeric TCGPlayer productId from card name + set ──
async function findTcgCsvGroupId(setName: string): Promise<number | null> {
  try {
    const res = await fetch(`${TCGCSV}/${POKEMON_CATEGORY_ID}/groups`, {
      signal: AbortSignal.timeout(8_000),
      cache: "force-cache", // groups list rarely changes
    });
    if (!res.ok) return null;
    const data = await res.json() as { results: Array<{ groupId: number; name: string }> };
    const lower = setName.toLowerCase().trim();
    const exact = data.results.find(g => g.name.toLowerCase().trim() === lower);
    if (exact) return exact.groupId;
    const partial = data.results.find(
      g => g.name.toLowerCase().includes(lower) || lower.includes(g.name.toLowerCase())
    );
    return partial?.groupId ?? null;
  } catch {
    return null;
  }
}

async function findTcgCsvProductId(groupId: number, cardName: string): Promise<number | null> {
  try {
    const res = await fetch(`${TCGCSV}/${POKEMON_CATEGORY_ID}/${groupId}/products`, {
      signal: AbortSignal.timeout(10_000),
      cache: "force-cache", // product lists are stable
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      results: Array<{ productId: number; name: string; cleanName?: string }>;
    };
    const lowerTarget = cardName.toLowerCase().replace(/['']/g, "'").trim();
    // Exact match on cleanName first (cleanName strips special chars)
    const exactClean = data.results.find(
      r => (r.cleanName ?? r.name).toLowerCase().replace(/['']/g, "'").trim() === lowerTarget
    );
    if (exactClean) return exactClean.productId;
    // Fallback: exact match on name
    const exactName = data.results.find(
      r => r.name.toLowerCase().replace(/['']/g, "'").trim() === lowerTarget
    );
    if (exactName) return exactName.productId;
    return null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const cardId = req.nextUrl.searchParams.get("cardId") ?? "";
  if (!cardId) {
    return NextResponse.json({ error: "cardId is required" }, { status: 400 });
  }

  // Optional: the caller can pass the price they already have displayed so the
  // DB snapshot and the graph's "today" point match what the user sees exactly.
  const callerPriceCents = (() => {
    const v = req.nextUrl.searchParams.get("priceCents");
    if (!v) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  })();

  // Optional: caller can pass tcgplayerId (numeric productId) directly to
  // skip the pokemontcg.io lookup for the TCGPlayer Infinite fetch.
  const callerTcgplayerId = req.nextUrl.searchParams.get("tcgplayerId") ?? null;
  // Optional: caller can pass the set name to speed up the tcgcsv group lookup.
  const callerSetName = req.nextUrl.searchParams.get("setName") ?? null;

  const apiHeaders: Record<string, string> = { "User-Agent": "tcgtimes-blog/1.0" };
  const apiKey = process.env.POKEMON_TCG_API_KEY;
  if (apiKey) apiHeaders["X-Api-Key"] = apiKey;

  // ── 1. Fetch card from pokemontcg.io ─────────────────────────────────────
  const cardRes = await fetch(
    `${POKEMON_API}/cards/${encodeURIComponent(cardId)}?select=id,name,tcgplayer,set`,
    { headers: apiHeaders, signal: AbortSignal.timeout(10_000), cache: "no-store" }
  );
  if (!cardRes.ok) {
    return NextResponse.json({ error: `Card '${cardId}' not found` }, { status: cardRes.status });
  }
  const cardData = (await cardRes.json()).data as {
    id: string;
    name: string;
    set: { releaseDate: string; name: string };
    tcgplayer?: {
      url?: string;
      updatedAt?: string;
      prices?: Record<string, { market?: number | null; mid?: number | null }>;
    };
  };

  // Extract TCGPlayer productId from tcgplayer.url if available.
  // URL format: https://prices.pokemontcg.io/tcgplayer/{setCode}-{num}
  // or the actual TCGPlayer URL: https://www.tcgplayer.com/product/{id}/...
  // The caller may also pass it directly as tcgplayerId param.
  let tcgplayerId: string | null = callerTcgplayerId;
  if (!tcgplayerId && cardData.tcgplayer?.url) {
    // Try to extract numeric productId from TCGPlayer URL
    const tcgMatch = cardData.tcgplayer.url.match(/\/product\/(\d+)/);
    if (tcgMatch) tcgplayerId = tcgMatch[1];
  }
  // If still not found, look it up via tcgcsv (pokemontcg.io doesn't expose
  // the numeric productId directly but tcgcsv does, and it's the same ID used
  // by TCGPlayer Infinite for historical price charts).
  if (!tcgplayerId) {
    const setNameToLookup = callerSetName ?? cardData.set?.name ?? null;
    if (setNameToLookup) {
      const groupId = await findTcgCsvGroupId(setNameToLookup);
      if (groupId) {
        const numericId = await findTcgCsvProductId(groupId, cardData.name);
        if (numericId) tcgplayerId = String(numericId);
      }
    }
  }

  // Pick best TCGPlayer market price (same priority as pokemon-set)
  const TIER_PREF = [
    "specialIllustrationRare","illustrationRare","hyperRare","rainbowRare",
    "shinyHoloRare","holoRare","reverseHolofoil","1stEditionHolofoil","normal",
  ];
  let apiPriceCents: number | null = null;
  const tp = cardData.tcgplayer?.prices;
  if (tp) {
    for (const tier of TIER_PREF) {
      if (tp[tier]?.market != null) {
        apiPriceCents = Math.round(tp[tier].market! * 100);
        break;
      }
    }
    if (apiPriceCents == null) {
      for (const p of Object.values(tp)) {
        if (p?.market != null) { apiPriceCents = Math.round(p.market * 100); break; }
      }
    }
  }

  // Prefer the caller-supplied price (matches what the user sees) over the
  // independently re-fetched API price, which may differ due to cache timing.
  const todayPriceCents = callerPriceCents ?? apiPriceCents;

  const releaseDate = cardData.set.releaseDate.replace(/\//g, "-");

  // ── 2. Fetch TCGPlayer Infinite price history (real historical data) ──────
  // This is the same source TCGPlayer uses for their own price charts.
  // Returns weekly data points going back to ~2021 (or card release if newer).
  // If tcgplayerId is unavailable, this returns [] and we fall back to DB only.
  const tcgInfiniteHistory = tcgplayerId
    ? await fetchTcgInfiniteHistory(tcgplayerId)
    : [];

  // ── 3. Write today's snapshot (UPSERT — update if price changed) ─────────
  if (todayPriceCents != null && process.env.DATABASE_URL) {
    try {
      const db = sql();
      const safe = (s: string) => s.replace(/'/g, "''");
      const tid = tcgplayerId ? `'${tcgplayerId}'` : "NULL";
      await db.query(`
        INSERT INTO price_snapshots (game, card_name, tcgplayer_id, price_cents, recorded_date)
        VALUES ('pokemon', '${safe(cardData.name)}', ${tid}, ${todayPriceCents}, '${todayStr()}')
        ON CONFLICT (lower(game), lower(card_name), recorded_date)
        DO UPDATE SET price_cents = EXCLUDED.price_cents,
                      tcgplayer_id = COALESCE(EXCLUDED.tcgplayer_id, price_snapshots.tcgplayer_id)
      `);
    } catch (e) {
      console.warn("[pokemon-price-history] snapshot write failed:", e);
    }
  }

  // ── 4. Read all DB snapshots ──────────────────────────────────────────────
  interface DbRow { date: string; price_cents: number }
  let dbHistory: DbRow[] = [];
  if (process.env.DATABASE_URL) {
    try {
      const db = sql();
      const rows = await db`
        SELECT recorded_date::text AS date, price_cents
        FROM price_snapshots
        WHERE lower(game) = 'pokemon'
          AND lower(card_name) = lower(${cardData.name})
        ORDER BY recorded_date ASC
      `;
      dbHistory = rows as DbRow[];
    } catch (e) {
      console.warn("[pokemon-price-history] snapshot read failed:", e);
    }
  }

  // ── 5. Merge histories ───────────────────────────────────────────────────
  // Build a date-keyed map, starting with TCGPlayer Infinite (weekly, older).
  // DB snapshots (daily, authoritative) override on matching dates.
  // This gives us years of history for older cards while keeping our more
  // accurate daily snapshots for the recent period we've been recording.
  const merged = new Map<string, number>();

  for (const pt of tcgInfiniteHistory) {
    merged.set(pt.date, pt.priceCents);
  }

  for (const row of dbHistory) {
    merged.set(row.date, row.price_cents); // DB always wins
  }

  // Ensure today is always present using the authoritative price
  if (todayPriceCents != null) {
    merged.set(todayStr(), todayPriceCents);
  }

  const sorted = Array.from(merged.entries())
    .map(([date, priceCents]) => ({ date, priceCents }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json(
    {
      cardId:      cardData.id,
      cardName:    cardData.name,
      releaseDate,
      history:     sorted,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
