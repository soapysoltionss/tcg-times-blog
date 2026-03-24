import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, upsertOAuthUser } from "@/lib/db";
import { signSession, setSessionCookie } from "@/lib/session";
import { auth } from "@/auth";

/**
 * GET /api/auth/complete
 *
 * Called by NextAuth's redirect callback after a successful OAuth sign-in.
 * Email is the primary key — we look up by email, and re-upsert if the
 * ephemeral /tmp DB was wiped (Vercel cold start). The 30-day tcgt_session
 * cookie keeps the user logged in across visits.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      console.error("OAuth complete: no session email found");
      return NextResponse.redirect(new URL("/login?error=OAuthCallback", req.url));
    }

    const { email, name, image } = session.user;

    // Look up by email (primary key). If not found (e.g. Vercel /tmp wiped),
    // re-upsert from the NextAuth session — this is safe and idempotent.
    let dbUser = getUserByEmail(email);
    if (!dbUser) {
      const provider = (session as any).provider ?? "google";
      const providerAccountId = (session as any).providerAccountId ?? email;
      dbUser = upsertOAuthUser({
        provider,
        providerAccountId,
        email,
        name: name ?? "User",
        image: image ?? undefined,
      });
    }

    const token = await signSession({ userId: dbUser.id, username: dbUser.username });
    const destination = dbUser.needsUsername ? "/set-username" : "/profile";
    const res = NextResponse.redirect(new URL(destination, req.url));
    setSessionCookie(res, token);
    return res;
  } catch (err) {
    console.error("OAuth complete error:", err);
    return NextResponse.redirect(new URL("/login?error=OAuthCallback", req.url));
  }
}
