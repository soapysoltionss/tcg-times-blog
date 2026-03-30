/**
 * GET /api/jeux/credits?email=...
 *
 * Returns the Jeux Kingdom store credit balance for the logged-in user
 * (matched by their TCG Times account email).
 *
 * Returns { enabled: false } when JEUX_SHOPIFY_ADMIN_TOKEN is not set —
 * the frontend uses this to hide the credits UI gracefully.
 *
 * Requires JEUX_SHOPIFY_ADMIN_TOKEN env var with read_customers scope.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getJeuxCredit, jeuxAdminEnabled } from "@/lib/jeux";
import { getUserById } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  // Feature flag — return disabled state when admin token not configured
  if (!jeuxAdminEnabled()) {
    return NextResponse.json({ enabled: false, creditSGD: 0 });
  }

  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = await getUserById(session.userId);
  if (!user?.email) {
    return NextResponse.json({ error: "No email on account" }, { status: 400 });
  }

  const credit = await getJeuxCredit(user.email);
  if (!credit) {
    // No Jeux account found for this email — not an error, just 0 credit
    return NextResponse.json({ enabled: true, creditSGD: 0, found: false });
  }

  return NextResponse.json({
    enabled: true,
    creditSGD: credit.creditSGD,
    found: true,
    customerId: credit.customerId,
  });
}
