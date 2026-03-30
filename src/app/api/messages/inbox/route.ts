import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getInboxThreads, getUnreadCount } from "@/lib/db";

/**
 * GET /api/messages/inbox
 *
 * Returns all message threads for the logged-in user, grouped by listing.
 * Also returns the total unread count for badge display.
 */
export async function GET() {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const [threads, unreadCount] = await Promise.all([
    getInboxThreads(session.userId),
    getUnreadCount(session.userId),
  ]);

  return NextResponse.json({ threads, unreadCount });
}
