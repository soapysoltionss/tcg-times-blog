import { NextRequest, NextResponse } from "next/server";
import { getListingById, deleteListing, markListingSold } from "@/lib/db";
import { getSession } from "@/lib/session";

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
  return NextResponse.json({ ok: true });
}
