import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getSession } from "@/lib/session";
import { getUserById } from "@/lib/db";

/**
 * GET  /api/transactions?cardName=X&game=Y
 *   Returns price discovery stats for a card:
 *   { lastSoldCents, lastSoldAt, volume24h, volume7d, change7dPct, recentSales[] }
 *
 * GET  /api/transactions?mode=dashboard[&game=Y]
 *   Returns market overview:
 *   { topMovers[], mostTraded[], recentSales[], totalVolume7d, gameBreakdown[] }
 *
 * POST /api/transactions  { listingId }
 *   Called internally when a listing is marked sold.
 *   Inserts a transaction row copied from the listing.
 *   Only the listing's seller (or admin) can call this.
 */

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  return neon(url);
}

// ── GET ───────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const mode     = searchParams.get("mode") ?? "";
  const cardName = searchParams.get("cardName") ?? "";
  const game     = searchParams.get("game") ?? "";

  // ── Dashboard mode ────────────────────────────────────────────────────
  if (mode === "dashboard") {
    try {
      const sql = db();

      // Top movers and most traded — filter by game if provided
      // We run separate queries per game-filter variant using conditional WHERE
      const movers: Record<string, unknown>[] = game ? await sql`
        SELECT
          card_name,
          game,
          AVG(CASE WHEN completed_at >= now() - interval '7 days'  THEN price_cents END) AS avg_7d,
          AVG(CASE WHEN completed_at >= now() - interval '14 days'
                    AND completed_at <  now() - interval '7 days'  THEN price_cents END) AS avg_prev,
          COUNT(CASE WHEN completed_at >= now() - interval '7 days' THEN 1 END)::int     AS vol_7d,
          MAX(CASE WHEN completed_at >= now() - interval '7 days'  THEN price_cents END) AS last_price
        FROM transactions
        WHERE completed_at >= now() - interval '14 days'
          AND lower(game) = lower(${game})
        GROUP BY card_name, game
        HAVING COUNT(CASE WHEN completed_at >= now() - interval '7 days' THEN 1 END) >= 1
        ORDER BY ABS(
          COALESCE(
            (AVG(CASE WHEN completed_at >= now() - interval '7 days' THEN price_cents END) -
             AVG(CASE WHEN completed_at >= now() - interval '14 days'
                       AND completed_at < now() - interval '7 days' THEN price_cents END))
            / NULLIF(AVG(CASE WHEN completed_at >= now() - interval '14 days'
                              AND completed_at < now() - interval '7 days' THEN price_cents END), 0)
          , 0)
        ) DESC
        LIMIT 10
      ` : await sql`
        SELECT
          card_name,
          game,
          AVG(CASE WHEN completed_at >= now() - interval '7 days'  THEN price_cents END) AS avg_7d,
          AVG(CASE WHEN completed_at >= now() - interval '14 days'
                    AND completed_at <  now() - interval '7 days'  THEN price_cents END) AS avg_prev,
          COUNT(CASE WHEN completed_at >= now() - interval '7 days' THEN 1 END)::int     AS vol_7d,
          MAX(CASE WHEN completed_at >= now() - interval '7 days'  THEN price_cents END) AS last_price
        FROM transactions
        WHERE completed_at >= now() - interval '14 days'
        GROUP BY card_name, game
        HAVING COUNT(CASE WHEN completed_at >= now() - interval '7 days' THEN 1 END) >= 1
        ORDER BY ABS(
          COALESCE(
            (AVG(CASE WHEN completed_at >= now() - interval '7 days' THEN price_cents END) -
             AVG(CASE WHEN completed_at >= now() - interval '14 days'
                       AND completed_at < now() - interval '7 days' THEN price_cents END))
            / NULLIF(AVG(CASE WHEN completed_at >= now() - interval '14 days'
                              AND completed_at < now() - interval '7 days' THEN price_cents END), 0)
          , 0)
        ) DESC
        LIMIT 10
      `;

      const mostTraded: Record<string, unknown>[] = game ? await sql`
        SELECT
          card_name,
          game,
          SUM(quantity)::int         AS vol_7d,
          AVG(price_cents)::int      AS avg_price,
          MAX(completed_at)          AS last_sale_at
        FROM transactions
        WHERE completed_at >= now() - interval '7 days'
          AND lower(game) = lower(${game})
        GROUP BY card_name, game
        ORDER BY vol_7d DESC
        LIMIT 10
      ` : await sql`
        SELECT
          card_name,
          game,
          SUM(quantity)::int         AS vol_7d,
          AVG(price_cents)::int      AS avg_price,
          MAX(completed_at)          AS last_sale_at
        FROM transactions
        WHERE completed_at >= now() - interval '7 days'
        GROUP BY card_name, game
        ORDER BY vol_7d DESC
        LIMIT 10
      `;

      const recentFeed: Record<string, unknown>[] = game ? await sql`
        SELECT card_name, game, condition, price_cents, quantity, completed_at
        FROM   transactions
        WHERE  completed_at >= now() - interval '7 days'
          AND  lower(game) = lower(${game})
        ORDER  BY completed_at DESC
        LIMIT  20
      ` : await sql`
        SELECT card_name, game, condition, price_cents, quantity, completed_at
        FROM   transactions
        WHERE  completed_at >= now() - interval '7 days'
        ORDER  BY completed_at DESC
        LIMIT  20
      `;

      const gameBreakdown: Record<string, unknown>[] = await sql`
        SELECT
          game,
          SUM(quantity)::int             AS volume,
          SUM(price_cents * quantity)    AS gmv_cents
        FROM transactions
        WHERE completed_at >= now() - interval '7 days'
        GROUP BY game
        ORDER BY gmv_cents DESC
      `;

      const totalRows: Record<string, unknown>[] = game ? await sql`
        SELECT SUM(price_cents * quantity) AS total_gmv
        FROM   transactions
        WHERE  completed_at >= now() - interval '7 days'
          AND  lower(game) = lower(${game})
      ` : await sql`
        SELECT SUM(price_cents * quantity) AS total_gmv
        FROM   transactions
        WHERE  completed_at >= now() - interval '7 days'
      `;

      const toChangePct = (avg7d: number | null, avgPrev: number | null) => {
        if (!avg7d || !avgPrev || avgPrev === 0) return null;
        return Math.round(((avg7d - avgPrev) / avgPrev) * 1000) / 10;
      };

      return NextResponse.json(
        {
          topMovers: movers.map(r => ({
            cardName:    r.card_name,
            game:        r.game,
            lastPrice:   Number(r.last_price),
            volume7d:    Number(r.vol_7d),
            change7dPct: toChangePct(Number(r.avg_7d) || null, Number(r.avg_prev) || null),
          })),
          mostTraded: mostTraded.map(r => ({
            cardName:   r.card_name,
            game:       r.game,
            volume7d:   Number(r.vol_7d),
            avgPrice:   Number(r.avg_price),
            lastSaleAt: r.last_sale_at,
          })),
          recentFeed: recentFeed.map(r => ({
            cardName:    r.card_name,
            game:        r.game,
            condition:   r.condition,
            priceCents:  Number(r.price_cents),
            quantity:    Number(r.quantity),
            completedAt: r.completed_at,
          })),
          gameBreakdown: gameBreakdown.map(r => ({
            game:     r.game,
            volume:   Number(r.volume),
            gmvCents: Number(r.gmv_cents),
          })),
          totalGmvCents: Number(totalRows[0]?.total_gmv ?? 0),
        },
        { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60" } }
      );
    } catch (e) {
      console.error("[api/transactions GET dashboard]", e);
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }
  }

  // ── Per-card mode ─────────────────────────────────────────────────────
  if (!cardName || !game) {
    return NextResponse.json({ error: "cardName and game are required" }, { status: 400 });
  }

  try {
    const sql = db();

    // All transactions for this card in the last 90 days
    const rows = await sql`
      SELECT price_cents, quantity, completed_at
      FROM   transactions
      WHERE  lower(game)      = lower(${game})
        AND  lower(card_name) = lower(${cardName})
        AND  completed_at    >= now() - interval '90 days'
      ORDER  BY completed_at DESC
      LIMIT  100
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { lastSoldCents: null, lastSoldAt: null, volume24h: 0, volume7d: 0, change7dPct: null, recentSales: [] },
        { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" } }
      );
    }

    const now = Date.now();
    const ms24h = 86_400_000;
    const ms7d  = 7 * ms24h;
    const ms14d = 14 * ms24h;

    let volume24h = 0;
    let volume7d  = 0;

    // Price sum/count for 0-7d and 7-14d windows (for change %)
    let sum7d = 0, count7d = 0;
    let sum14d = 0, count14d = 0;

    for (const r of rows) {
      const age = now - new Date(r.completed_at as string).getTime();
      const qty = Number(r.quantity);
      const pc  = Number(r.price_cents);
      if (age <= ms24h) volume24h += qty;
      if (age <= ms7d)  { volume7d += qty; sum7d += pc; count7d++; }
      if (age > ms7d && age <= ms14d) { sum14d += pc; count14d++; }
    }

    const lastSold = rows[0];
    const avg7d    = count7d  > 0 ? sum7d  / count7d  : null;
    const avg14d   = count14d > 0 ? sum14d / count14d : null;
    const change7dPct =
      avg7d != null && avg14d != null && avg14d > 0
        ? Math.round(((avg7d - avg14d) / avg14d) * 1000) / 10  // 1 decimal
        : null;

    // Recent sales for sparkline / table (up to 20)
    const recentSales = rows.slice(0, 20).map(r => ({
      priceCents:  Number(r.price_cents),
      quantity:    Number(r.quantity),
      completedAt: r.completed_at,
    }));

    return NextResponse.json(
      {
        lastSoldCents: Number(lastSold.price_cents),
        lastSoldAt:    lastSold.completed_at,
        volume24h,
        volume7d,
        change7dPct,
        recentSales,
      },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" } }
    );
  } catch (e) {
    console.error("[api/transactions GET]", e);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { listingId?: string };
  const { listingId } = body;
  if (!listingId) {
    return NextResponse.json({ error: "listingId required" }, { status: 400 });
  }

  try {
    const sql = db();

    // Fetch the listing — verify it exists and caller is seller (or admin)
    const listingRows = await sql`
      SELECT l.*, u.data->>'role' AS seller_role
      FROM   listings l
      JOIN   users    u ON u.id = l.seller_id
      WHERE  l.id = ${listingId}
      LIMIT  1
    `;
    if (listingRows.length === 0) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const listing = listingRows[0];
    const user     = await getUserById(session.userId);
    const isAdmin  = user?.role === "admin";
    const isSeller = listing.seller_id === session.userId;
    if (!isSeller && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Idempotent — skip if a transaction for this listing already exists
    const existing = await sql`
      SELECT id FROM transactions WHERE listing_id = ${listingId} LIMIT 1
    `;
    if (existing.length > 0) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await sql`
      INSERT INTO transactions
        (id, listing_id, card_name, set_name, game, condition, price_cents, quantity, seller_id, seller_region, completed_at)
      VALUES
        (${txId}, ${listingId},
         ${listing.card_name as string}, ${listing.set_name as string},
         ${listing.game as string},      ${listing.condition as string},
         ${listing.price_cents as number}, ${listing.quantity as number},
         ${listing.seller_id as string}, ${(listing.seller_region ?? null) as string | null},
         now())
    `;

    return NextResponse.json({ ok: true, transactionId: txId });
  } catch (e) {
    console.error("[api/transactions POST]", e);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
