import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUserById, getUserByUsername, saveUser } from "@/lib/db";
import { signSession, setSessionCookie } from "@/lib/session";

/**
 * POST /api/auth/set-username
 *
 * Called after a brand-new OAuth user picks their username.
 * Validates uniqueness, saves to DB, clears needsUsername flag,
 * re-signs the session cookie (username is embedded in the token).
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const body = await req.json();
  const raw: string = (body.username ?? "").trim();

  // Validate
  if (!raw) {
    return NextResponse.json({ error: "Username is required." }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(raw)) {
    return NextResponse.json(
      { error: "3–20 characters, letters, numbers and underscores only." },
      { status: 400 }
    );
  }

  // Check uniqueness (case-insensitive), ignoring the user's current placeholder
  const existing = await getUserByUsername(raw);
  if (existing && existing.id !== user.id) {
    return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
  }

  // Save
  user.username = raw;
  user.needsUsername = false;
  user.updatedAt = new Date().toISOString();
  await saveUser(user);

  // Re-sign session with the new username
  const token = await signSession({ userId: user.id, username: user.username });
  const res = NextResponse.json({ ok: true, username: user.username });
  setSessionCookie(res, token);
  return res;
}
