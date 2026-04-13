import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getSession } from "@/lib/session";
import { getUserById } from "@/lib/db";

/**
 * GET  /api/orders?cardName=X&game=Y[&condition=NM]
 *   Returns all open bids + asks for a card, plus spread summary.
 *   { bids[], asks[], spread, midpoint, bestBid, bestAsk }
 *
 * POST /api/orders
 *   Body: { cardName, game, setName?, condition?, type, priceCents, quantity?, note?, expiresInDays? }
 *   Places a new bid or ask. Auth required.
 *   After placing an ask, attempts immediate match against open bids (and vice-versa).
 *
 * PATCH /api/orders/:id  (via /api/orders/[id]/route.ts)
 *   Handled in [id] sub-route below.
 *
 * DELETE /api/orders/:id (via /api/orders/[id]/route.ts)
 *   Handled in [id] sub-route below.
 */

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  return neon(url);
}

// ── GET ───────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const cardName  = searchParams.get("cardName") ?? "";
  const game      = searchParams.get("game") ?? "";
  const condition = searchParams.get("condition") ?? "";
  const userId    = searchParams.get("userId") ?? "";

  // User-specific order history
  if (userId) {
    const session = await getSession();
    if (!session?.userId || session.userId !== userId) {
      const user = session ? await getUserById(session.userId) : null;
      if (user?.role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    try {
      const sql = db();
      const rows: Record<string, unknown>[] = await sql`
        SELECT id, card_name, game, set_name, condition, type, price_cents,
               quantity, quantity_filled, status, note, region, expires_at, created_at
        FROM   orders
        WHERE  user_id = ${userId}
        ORDER  BY created_at DESC
        LIMIT  50
      `;
      return NextResponse.json({ orders: rows });
    } catch (e) {
      console.error("[api/orders GET user]", e);
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }
  }

  if (!cardName || !game) {
    return NextResponse.json(
      { error: "cardName and game are required (or userId for user history)" },
      { status: 400 }
    );
  }

  try {
    const sql = db();

    // Expire stale orders first (best-effort, non-fatal)
    try {
      await sql`
        UPDATE orders SET status = 'expired', updated_at = now()
        WHERE  status = 'open'
          AND  expires_at IS NOT NULL
          AND  expires_at < now()
      `;
    } catch { /* ignore */ }

    const bids: Record<string, unknown>[] = condition ? await sql`
      SELECT o.id, o.price_cents, o.quantity, o.quantity_filled,
             o.condition, o.note, o.region, o.expires_at, o.created_at,
             u.data->>'username' AS username
      FROM   orders o
      JOIN   users  u ON u.id = o.user_id
      WHERE  lower(o.game)      = lower(${game})
        AND  lower(o.card_name) = lower(${cardName})
        AND  lower(o.condition) = lower(${condition})
        AND  o.type   = 'bid'
        AND  o.status = 'open'
      ORDER  BY o.price_cents DESC, o.created_at ASC
      LIMIT  50
    ` : await sql`
      SELECT o.id, o.price_cents, o.quantity, o.quantity_filled,
             o.condition, o.note, o.region, o.expires_at, o.created_at,
             u.data->>'username' AS username
      FROM   orders o
      JOIN   users  u ON u.id = o.user_id
      WHERE  lower(o.game)      = lower(${game})
        AND  lower(o.card_name) = lower(${cardName})
        AND  o.type   = 'bid'
        AND  o.status = 'open'
      ORDER  BY o.price_cents DESC, o.created_at ASC
      LIMIT  50
    `;

    const asks: Record<string, unknown>[] = condition ? await sql`
      SELECT o.id, o.price_cents, o.quantity, o.quantity_filled,
             o.condition, o.note, o.region, o.expires_at, o.created_at,
             u.data->>'username' AS username
      FROM   orders o
      JOIN   users  u ON u.id = o.user_id
      WHERE  lower(o.game)      = lower(${game})
        AND  lower(o.card_name) = lower(${cardName})
        AND  lower(o.condition) = lower(${condition})
        AND  o.type   = 'ask'
        AND  o.status = 'open'
      ORDER  BY o.price_cents ASC, o.created_at ASC
      LIMIT  50
    ` : await sql`
      SELECT o.id, o.price_cents, o.quantity, o.quantity_filled,
             o.condition, o.note, o.region, o.expires_at, o.created_at,
             u.data->>'username' AS username
      FROM   orders o
      JOIN   users  u ON u.id = o.user_id
      WHERE  lower(o.game)      = lower(${game})
        AND  lower(o.card_name) = lower(${cardName})
        AND  o.type   = 'ask'
        AND  o.status = 'open'
      ORDER  BY o.price_cents ASC, o.created_at ASC
      LIMIT  50
    `;

    const bestBid = bids[0] ? Number(bids[0].price_cents) : null;
    const bestAsk = asks[0] ? Number(asks[0].price_cents) : null;
    const spread  = bestBid != null && bestAsk != null ? bestAsk - bestBid : null;
    const midpoint =
      bestBid != null && bestAsk != null
        ? Math.round((bestBid + bestAsk) / 2)
        : bestBid ?? bestAsk ?? null;

    return NextResponse.json(
      { bids, asks, bestBid, bestAsk, spread, midpoint },
      { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=10" } }
    );
  } catch (e) {
    console.error("[api/orders GET]", e);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Sign in to place an order." }, { status: 401 });
  }

  const body = await req.json() as {
    cardName?: string;
    game?: string;
    setName?: string;
    condition?: string;
    type?: string;
    priceCents?: number;
    quantity?: number;
    note?: string;
    expiresInDays?: number;
  };

  const {
    cardName, game,
    setName    = "",
    condition  = "Near Mint",
    type, priceCents, quantity = 1,
    note, expiresInDays,
  } = body;

  if (!cardName || !game || !type || !priceCents) {
    return NextResponse.json(
      { error: "cardName, game, type, and priceCents are required." },
      { status: 400 }
    );
  }
  if (!["bid", "ask"].includes(type)) {
    return NextResponse.json({ error: "type must be bid or ask." }, { status: 400 });
  }
  if (priceCents < 1 || priceCents > 10_000_00) {
    return NextResponse.json({ error: "Price out of range." }, { status: 400 });
  }
  if (quantity < 1 || quantity > 100) {
    return NextResponse.json({ error: "Quantity must be 1–100." }, { status: 400 });
  }

  try {
    const sql = db();
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Get user region for the order
    const userRows: Record<string, unknown>[] = await sql`
      SELECT data->>'region' AS region FROM users WHERE id = ${session.userId} LIMIT 1
    `;
    const region = (userRows[0]?.region as string) ?? null;

    const expiresAt =
      expiresInDays && expiresInDays > 0
        ? new Date(Date.now() + expiresInDays * 86_400_000).toISOString()
        : null;

    await sql`
      INSERT INTO orders
        (id, user_id, card_name, set_name, game, condition, type,
         price_cents, quantity, region, note, expires_at, created_at, updated_at)
      VALUES
        (${orderId}, ${session.userId}, ${cardName}, ${setName}, ${game},
         ${condition}, ${type}, ${priceCents}, ${quantity},
         ${region}, ${note ?? null}, ${expiresAt}, now(), now())
    `;

    // ── Attempt matching ────────────────────────────────────────────────
    // A new bid can match against open asks (lowest ask first).
    // A new ask can match against open bids (highest bid first).
    try {
      await matchOrder({ sql, orderId, cardName, game, condition, type, priceCents, userId: session.userId });
    } catch (matchErr) {
      console.warn("[api/orders POST] match failed (non-fatal):", matchErr);
    }

    // Re-fetch the order to return its current state
    const rows: Record<string, unknown>[] = await sql`
      SELECT id, type, price_cents, quantity, quantity_filled, status FROM orders WHERE id = ${orderId}
    `;
    return NextResponse.json({ ok: true, order: rows[0] }, { status: 201 });
  } catch (e) {
    console.error("[api/orders POST]", e);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}

// ── Matching engine ────────────────────────────────────────────────────────
/**
 * Simple greedy matcher — fill as much of `orderId` as possible against
 * the best available counterpart orders. Inserts a transaction row for
 * each fill. This is best-effort and non-atomic (no SELECT FOR UPDATE),
 * which is fine for a low-volume marketplace.
 */
async function matchOrder(opts: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sql: any;
  orderId: string;
  cardName: string;
  game: string;
  condition: string;
  type: string;
  priceCents: number;
  userId: string;
}) {
  const { sql, orderId, cardName, game, condition, type, priceCents, userId } = opts;

  // Find counterpart orders that cross the spread
  const counterparts = (type === "bid"
    ? await sql`
        SELECT id, user_id, price_cents, quantity, quantity_filled
        FROM   orders
        WHERE  lower(game)      = lower(${game})
          AND  lower(card_name) = lower(${cardName})
          AND  lower(condition) = lower(${condition})
          AND  type   = 'ask'
          AND  status = 'open'
          AND  user_id <> ${userId}
          AND  price_cents <= ${priceCents}
        ORDER  BY price_cents ASC, created_at ASC
        LIMIT  10
      `
    : await sql`
        SELECT id, user_id, price_cents, quantity, quantity_filled
        FROM   orders
        WHERE  lower(game)      = lower(${game})
          AND  lower(card_name) = lower(${cardName})
          AND  lower(condition) = lower(${condition})
          AND  type   = 'bid'
          AND  status = 'open'
          AND  user_id <> ${userId}
          AND  price_cents >= ${priceCents}
        ORDER  BY price_cents DESC, created_at ASC
        LIMIT  10
      `
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as Record<string, any>[];

  if (counterparts.length === 0) return;

  // Re-fetch the new order's remaining quantity
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newOrderRows = (await sql`
    SELECT quantity, quantity_filled FROM orders WHERE id = ${orderId}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  `) as Record<string, any>[];
  if (newOrderRows.length === 0) return;

  let remaining =
    Number(newOrderRows[0].quantity) - Number(newOrderRows[0].quantity_filled);

  for (const cp of counterparts) {
    if (remaining <= 0) break;

    const cpRemaining =
      Number(cp.quantity) - Number(cp.quantity_filled);
    const fillQty = Math.min(remaining, cpRemaining);
    if (fillQty <= 0) continue;

    // Fill price = counterpart's price (price improvement goes to the aggressor)
    const fillPrice = Number(cp.price_cents);
    const cpNewFilled = Number(cp.quantity_filled) + fillQty;
    const cpNewStatus = cpNewFilled >= Number(cp.quantity) ? "filled" : "open";

    // Update counterpart
    await sql`
      UPDATE orders
      SET    quantity_filled = ${cpNewFilled},
             status          = ${cpNewStatus},
             updated_at      = now()
      WHERE  id = ${cp.id as string}
    `;

    // Update the new order
    const newOrderFilled =
      (Number(newOrderRows[0].quantity_filled) + (fillQty)) +
      (remaining - cpRemaining < 0 ? 0 : 0); // recalc below
    remaining -= fillQty;
    const newQtyFilled =
      Number(newOrderRows[0].quantity) - remaining;
    const newStatus = remaining <= 0 ? "filled" : "open";

    await sql`
      UPDATE orders
      SET    quantity_filled = ${newQtyFilled},
             status          = ${newStatus},
             updated_at      = now()
      WHERE  id = ${orderId}
    `;

    // Insert transaction record
    const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const buyerId  = type === "bid" ? userId : (cp.user_id as string);
    const sellerId = type === "ask" ? userId : (cp.user_id as string);

    await sql`
      INSERT INTO transactions
        (id, card_name, game, condition, price_cents, quantity, buyer_id, seller_id, completed_at)
      VALUES
        (${txId}, ${cardName}, ${game}, ${condition}, ${fillPrice}, ${fillQty},
         ${buyerId}, ${sellerId}, now())
      ON CONFLICT DO NOTHING
    `;
  }
}
