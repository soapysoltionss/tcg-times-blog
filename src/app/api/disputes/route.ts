import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUserById, openDispute, getListingById, getDisputesByListing } from "@/lib/db";
import { nanoid } from "nanoid";

/**
 * POST /api/disputes
 * Buyer opens a dispute on a sold listing within 7 days of sale.
 *
 * GET /api/disputes?listingId=XXX
 * Fetch disputes for a listing (buyer or seller can view their own).
 */

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const listingId = req.nextUrl.searchParams.get("listingId");
  if (!listingId) return NextResponse.json({ error: "listingId required." }, { status: 400 });

  const listing = await getListingById(listingId);
  if (!listing) return NextResponse.json({ error: "Listing not found." }, { status: 404 });

  // Only the buyer or seller can see disputes
  const user = await getUserById(session.userId);
  const isAdmin = user?.role === "admin";
  const isParty = listing.sellerId === session.userId;
  if (!isAdmin && !isParty) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const disputes = await getDisputesByListing(listingId);
  return NextResponse.json({ disputes });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body." }, { status: 400 });

  const { listingId, reason } = body as { listingId?: string; reason?: string };
  if (!listingId || !reason?.trim()) {
    return NextResponse.json({ error: "listingId and reason are required." }, { status: 400 });
  }
  if (reason.trim().length > 1000) {
    return NextResponse.json({ error: "Reason too long (max 1000 chars)." }, { status: 400 });
  }

  const listing = await getListingById(listingId);
  if (!listing) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  if (!listing.sold) return NextResponse.json({ error: "Can only dispute a sold listing." }, { status: 400 });
  if (listing.sellerId === session.userId) {
    return NextResponse.json({ error: "Sellers cannot dispute their own listings." }, { status: 400 });
  }

  // Enforce 7-day window
  const soldDate = new Date(listing.createdAt);
  const daysSinceSold = (Date.now() - soldDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceSold > 7) {
    return NextResponse.json({ error: "Dispute window has closed (7 days after sale)." }, { status: 400 });
  }

  const dispute = await openDispute({
    id: nanoid(),
    listingId,
    buyerId: session.userId,
    sellerId: listing.sellerId,
    reason: reason.trim(),
  });

  return NextResponse.json({ dispute }, { status: 201 });
}
