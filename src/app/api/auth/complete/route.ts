import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/db";
import { signSession, setSessionCookie } from "@/lib/session";
import { auth } from "@/auth";

/**
 * GET /api/auth/complete
 *
 * Called by NextAuth's redirect callback after a successful OAuth sign-in.
 * By this point the `events.signIn` hook has already upserted the user into
 * our DB. We just read the NextAuth session to get their email, look up our
 * DB user, set our own tcgt_session cookie, and redirect to /profile.
 */
export async function GET(req: NextRequest) {
  try {
    // Read the NextAuth session (the user was just signed in)
    const session = await auth();

    if (!session?.user?.email) {
      console.error("OAuth complete: no session email found");
      return NextResponse.redirect(new URL("/login?error=OAuthCallback", req.url));
    }

    const dbUser = getUserByEmail(session.user.email);
    if (!dbUser) {
      console.error("OAuth complete: user not found in DB for", session.user.email);
      return NextResponse.redirect(new URL("/login?error=OAuthCallback", req.url));
    }

    const token = await signSession({ userId: dbUser.id, username: dbUser.username });
    // New OAuth users who haven't chosen a username yet go to /set-username first
    const destination = dbUser.needsUsername ? "/set-username" : "/profile";
    const res = NextResponse.redirect(new URL(destination, req.url));
    setSessionCookie(res, token);
    return res;
  } catch (err) {
    console.error("OAuth complete error:", err);
    return NextResponse.redirect(new URL("/login?error=OAuthCallback", req.url));
  }
}
