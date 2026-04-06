import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

/**
 * GET /api/pokemon-price-history?cardId=sv9-1
 *
 * 1. Fetches the card's current price from pokemontcg.io
 * 2. Writes today's snapshot to price_snapshots if not already there
 * 3. Reads all snapshots for this card from the DB (real history since we
 *    started recording)
 * 4. If DB history < 30 days, backfills synthetic points using cardmarket
 *    avg1/avg7/avg30 data so the graph always shows a meaningful trend
 *
 * Returns: { cardId, cardName, releaseDate, history: PricePoint[] }
 * where PricePoint = { date: "YYYY-MM-DD", priceCents: number, synthetic?: true }
 */

const POKEMON_API = "https://api.pokemontcg.io/v2";

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

function toCents(v: number | null | undefined): number | null {
  return v != null && v > 0 ? Math.round(v * 100) : null;
}

export async function GET(req: NextRequest) {
  const cardId = req.nextUrl.searchParams.get("cardId") ?? "";
  if (!cardId) {
    return NextResponse.json({ error: "cardId is required" }, { status: 400 });
  }

  const apiHeaders: Record<string, string> = { "User-Agent": "tcgtimes-blog/1.0" };
  const apiKey = process.env.POKEMON_TCG_API_KEY;
  if (apiKey) apiHeaders["X-Api-Key"] = apiKey;

  // ── 1. Fetch card from pokemontcg.io ─────────────────────────────────────
  const cardRes = await fetch(
    `${POKEMON_API}/cards/${encodeURIComponent(cardId)}?select=id,name,tcgplayer,cardmarket,set`,
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
      updatedAt?: string;
      prices?: Record<string, { market?: number | null; mid?: number | null }>;
    };
    cardmarket?: {
      prices?: {
        averageSellPrice?: number | null;
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
    };
  };

  // Pick best TCGPlayer market price (same priority as pokemon-set)
  const TIER_PREF = [
    "specialIllustrationRare","illustrationRare","hyperRare","rainbowRare",
    "shinyHoloRare","holoRare","reverseHolofoil","1stEditionHolofoil","normal",
  ];
  let todayPriceCents: number | null = null;
  const tp = cardData.tcgplayer?.prices;
  if (tp) {
    for (const tier of TIER_PREF) {
      if (tp[tier]?.market != null) {
        todayPriceCents = Math.round(tp[tier].market! * 100);
        break;
      }
    }
    if (todayPriceCents == null) {
      for (const p of Object.values(tp)) {
        if (p?.market != null) { todayPriceCents = Math.round(p.market * 100); break; }
      }
    }
  }

  const releaseDate = cardData.set.releaseDate.replace(/\//g, "-");

  // ── 2. Write today's snapshot if we have a price ──────────────────────────
  if (todayPriceCents != null && process.env.DATABASE_URL) {
    try {
      const db = sql();
      const safe = (s: string) => s.replace(/'/g, "''");
      await db.query(`
        INSERT INTO price_snapshots (game, card_name, tcgplayer_id, price_cents, recorded_date)
        VALUES ('pokemon', '${safe(cardData.name)}', NULL, ${todayPriceCents}, '${todayStr()}')
        ON CONFLICT (lower(game), lower(card_name), recorded_date) DO NOTHING
      `);
    } catch (e) {
      console.warn("[pokemon-price-history] snapshot write failed:", e);
    }
  }

  // ── 3. Read all DB snapshots ──────────────────────────────────────────────
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

  // ── 4. Build price history array ─────────────────────────────────────────
  // Start with whatever DB has (real recorded data)
  const points: Array<{ date: string; priceCents: number; synthetic?: boolean }> =
    dbHistory.map(r => ({ date: r.date, priceCents: r.price_cents }));

  // If we have fewer than 30 days of real history, prepend synthetic points
  // using cardmarket avg data (avg1, avg7, avg30) which shows European trend
  const cm = cardData.cardmarket?.prices;
  const earliestReal = points[0]?.date ?? todayStr();

  if (cm && points.length < 30) {
    // We use the market-price ratio to convert cardmarket EUR to USD-relative values.
    // If we have a TCGPlayer price, compute a USD/EUR ratio from today's data;
    // otherwise just use the raw cardmarket value * 100 (EUR cents, shows the trend shape).
    const cmToday = toCents(cm.averageSellPrice ?? cm.trendPrice);
    const ratio = (cmToday && todayPriceCents) ? (todayPriceCents / cmToday) : 1.0;

    const syntheticCandidates: Array<{ date: string; priceCents: number; synthetic: boolean }> = [];

    const addSynthetic = (daysBack: number, cmVal: number | null | undefined) => {
      const cents = toCents(cmVal);
      if (cents == null) return;
      const date = daysAgo(daysBack);
      if (date >= releaseDate && date < earliestReal) {
        syntheticCandidates.push({ date, priceCents: Math.round(cents * ratio), synthetic: true });
      }
    };

    addSynthetic(1,  cm.avg1);
    addSynthetic(7,  cm.avg7);
    addSynthetic(30, cm.avg30);

    // De-duplicate and sort
    const existingDates = new Set(points.map(p => p.date));
    const newSynthetic = syntheticCandidates.filter(p => !existingDates.has(p.date));
    points.unshift(...newSynthetic.sort((a, b) => a.date.localeCompare(b.date)));
  }

  // Always ensure today is present
  const todayEntry = points.find(p => p.date === todayStr());
  if (!todayEntry && todayPriceCents != null) {
    points.push({ date: todayStr(), priceCents: todayPriceCents });
  }

  return NextResponse.json(
    {
      cardId:      cardData.id,
      cardName:    cardData.name,
      releaseDate,
      history:     points.sort((a, b) => a.date.localeCompare(b.date)),
    },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300" } }
  );
}
