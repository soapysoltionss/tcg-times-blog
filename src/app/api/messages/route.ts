import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { sendMessage, getMessageThread, markThreadRead, getListingById } from "@/lib/db";
import { nanoid } from "nanoid";

/**
 * GET  /api/messages?listingId=XXX  — fetch thread for a listing (marks incoming as read)
 * POST /api/messages                — send a message
 */

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const listingId = req.nextUrl.searchParams.get("listingId");
  if (!listingId) return NextResponse.json({ error: "listingId required." }, { status: 400 });

  await markThreadRead(listingId, session.userId);
  const messages = await getMessageThread(listingId, session.userId);
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body." }, { status: 400 });

  const { listingId, body: msgBody, toUserId: explicitTo } = body as {
    listingId?: string;
    body?: string;
    toUserId?: string;
  };

  if (!listingId || !msgBody?.trim()) {
    return NextResponse.json({ error: "listingId and body are required." }, { status: 400 });
  }
  if (msgBody.trim().length > 2000) {
    return NextResponse.json({ error: "Message too long (max 2000 chars)." }, { status: 400 });
  }

  const listing = await getListingById(listingId);
  if (!listing) return NextResponse.json({ error: "Listing not found." }, { status: 404 });

  // Buyer → seller automatically; seller replying must supply toUserId
  const toUserId: string | undefined =
    listing.sellerId !== session.userId ? listing.sellerId : explicitTo;

  if (!toUserId || toUserId === session.userId) {
    return NextResponse.json({ error: "Cannot send a message to yourself." }, { status: 400 });
  }

  const message = await sendMessage({
    id: nanoid(),
    listingId,
    fromUserId: session.userId,
    toUserId,
    body: msgBody.trim(),
  });

  return NextResponse.json({ message }, { status: 201 });
}
