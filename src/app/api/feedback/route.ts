import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  getUserById,
  getListingById,
  createFeedback,
  getFeedbackBySeller,
  getFeedbackSummary,
  hasFeedback,
} from "@/lib/db";
import { nanoid } from "nanoid";
import type { FeedbackRating } from "@/types/post";

const VALID_RATINGS: FeedbackRating[] = ["positive", "neutral", "negative"];

/**
 * GET /api/feedback?sellerId=XXX
 * Returns all feedback for a seller plus a summary object.
 * Public — no auth required.
 */
export async function GET(req: NextRequest) {
  const sellerId = req.nextUrl.searchParams.get("sellerId");
  if (!sellerId) {
    return NextResponse.json({ error: "sellerId is required." }, { status: 400 });
  }
  const [items, summary] = await Promise.all([
    getFeedbackBySeller(sellerId),
    getFeedbackSummary(sellerId),
  ]);
  return NextResponse.json({ feedback: items, summary });
}

/**
 * POST /api/feedback
 * Buyer submits feedback on a sold listing.
 * Body: { listingId, rating: "positive"|"neutral"|"negative", note? }
 *
 * Rules:
 * - Must be authenticated
 * - Listing must exist and be sold
 * - Caller must not be the seller
 * - One feedback per (buyer, listing) pair
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body." }, { status: 400 });

  const { listingId, rating, note } = body as {
    listingId?: string;
    rating?: string;
    note?: string;
  };

  if (!listingId || !rating) {
    return NextResponse.json({ error: "listingId and rating are required." }, { status: 400 });
  }
  if (!VALID_RATINGS.includes(rating as FeedbackRating)) {
    return NextResponse.json({ error: "rating must be positive, neutral, or negative." }, { status: 400 });
  }
  if (note && note.length > 500) {
    return NextResponse.json({ error: "Note too long (max 500 chars)." }, { status: 400 });
  }

  const listing = await getListingById(listingId);
  if (!listing) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  if (!listing.sold) {
    return NextResponse.json({ error: "Can only leave feedback on a sold listing." }, { status: 400 });
  }
  if (listing.sellerId === session.userId) {
    return NextResponse.json({ error: "Sellers cannot leave feedback on their own listings." }, { status: 400 });
  }

  // Check for existing feedback
  const already = await hasFeedback(session.userId, listingId);
  if (already) {
    return NextResponse.json({ error: "You have already left feedback for this listing." }, { status: 409 });
  }

  // Optionally award a small XP bump to buyer for leaving feedback
  const user = await getUserById(session.userId);
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const feedback = await createFeedback({
    id: nanoid(),
    listingId,
    buyerId: session.userId,
    sellerId: listing.sellerId,
    rating: rating as FeedbackRating,
    note: note?.trim() || undefined,
  });

  return NextResponse.json({ feedback }, { status: 201 });
}
