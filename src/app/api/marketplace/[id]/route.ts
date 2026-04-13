import { NextRequest, NextResponse } from "next/server";
import { getListingById, deleteListing, markListingSold } from "@/lib/db";
import { getSession } from "@/lib/session";
import { neon } from "@neondatabase/serverless";

type Props = { params: Promise<{ id: string }> };

// GET /api/marketplace/[id]
export async function GET(_req: NextRequest, { params }: Props) {
  const { id } = await params;
  const listing = await getListingById(id);
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ listing });
}

// DELETE /api/marketplace/[id] — seller only
export async function DELETE(_req: NextRequest, { params }: Props) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const listing = await getListingById(id);
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (listing.sellerId !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await deleteListing(id, session.userId);
  return NextResponse.json({ ok: true });
}

// PATCH /api/marketplace/[id] — mark as sold (seller only)
export async function PATCH(_req: NextRequest, { params }: Props) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const listing = await getListingById(id);
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (listing.sellerId !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await markListingSold(id, session.userId);

  // Record completed transaction for price discovery (Problem 8a)
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      const sql = neon(dbUrl);
      const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await sql`
        INSERT INTO transactions
          (id, listing_id, card_name, set_name, game, condition, price_cents, quantity, seller_id, seller_region, completed_at)
        VALUES
          (${txId}, ${id},
           ${listing.cardName}, ${listing.setName ?? ""},
           ${listing.game},     ${listing.condition},
           ${listing.priceCents}, ${listing.quantity ?? 1},
           ${listing.sellerId}, ${listing.sellerRegion ?? null},
           now())
        ON CONFLICT DO NOTHING
      `;
    }
  } catch (e) {
    // Non-fatal — marking sold succeeds even if transaction insert fails
    console.warn("[marketplace PATCH] transaction insert failed:", e);
  }

  return NextResponse.json({ ok: true });
}
