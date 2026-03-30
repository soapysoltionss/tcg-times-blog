import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUserById, saveUser } from "@/lib/db";

/**
 * PATCH /api/auth/verify-seller
 *
 * Admin-only endpoint. Sets or unsets the `verifiedSeller` flag on any user.
 *
 * Body: { userId: string, verified: boolean }
 */
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // Only admins may verify sellers
  const admin = await getUserById(session.userId);
  if (!admin || admin.role !== "admin") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await req.json();
  const { userId, verified } = body as { userId?: string; verified?: boolean };

  if (!userId || typeof verified !== "boolean") {
    return NextResponse.json(
      { error: "userId (string) and verified (boolean) are required." },
      { status: 400 }
    );
  }

  const user = await getUserById(userId);
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  user.verifiedSeller = verified;
  user.updatedAt = new Date().toISOString();
  await saveUser(user);

  return NextResponse.json({ ok: true, userId, verifiedSeller: verified });
}
