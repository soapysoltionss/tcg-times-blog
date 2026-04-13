import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getSession } from "@/lib/session";
import { getUserById } from "@/lib/db";

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  return neon(url);
}

/**
 * PATCH /api/orders/[id]
 *   Cancel an open order. Only the owner (or admin) can cancel.
 *   Body: {} — action is always "cancel"
 *
 * GET /api/orders/[id]
 *   Return a single order by id.
 */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const sql = db();
    const rows: Record<string, unknown>[] = await sql`
      SELECT o.*, u.data->>'username' AS username
      FROM   orders o
      JOIN   users  u ON u.id = o.user_id
      WHERE  o.id = ${id}
      LIMIT  1
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    return NextResponse.json({ order: rows[0] });
  } catch (e) {
    console.error("[api/orders/[id] GET]", e);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const sql = db();
    const rows: Record<string, unknown>[] = await sql`
      SELECT user_id, status FROM orders WHERE id = ${id} LIMIT 1
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const order = rows[0];
    const user = await getUserById(session.userId);
    const isAdmin = user?.role === "admin";
    const isOwner = order.user_id === session.userId;

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (order.status !== "open") {
      return NextResponse.json({ error: "Only open orders can be cancelled." }, { status: 409 });
    }

    await sql`
      UPDATE orders
      SET    status     = 'cancelled',
             updated_at = now()
      WHERE  id = ${id}
    `;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/orders/[id] PATCH]", e);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
