import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUserById } from "@/lib/db";

/**
 * GET /api/auth/debug
 * GET /api/auth/debug?step=signin  — fetches the Google signin URL and follows it
 * GET /api/auth/debug?step=subscriber — shows raw session + DB subscription for current user
 *
 * Temporary diagnostic endpoint — remove after OAuth is confirmed working.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // --- step=subscriber: show raw session + DB subscription data ---
  if (searchParams.get("step") === "subscriber") {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ session: null, note: "not logged in - no tcgt_session cookie found" });
    }
    const user = await getUserById(session.userId);
    return NextResponse.json({
      session,
      dbSubscription: user?.subscription ?? null,
      dbTasksRelatedToSubscribe: user?.tasks.filter((t) => t.id === "subscribe") ?? [],
      isSubscriberComputed:
        user?.subscription?.status === "active" ||
        user?.subscription?.status === "declined",
    });
  }

  // --- step=rawuser: dump raw DB user by username (no session needed) ---
  if (searchParams.get("step") === "rawuser") {
    const username = searchParams.get("u") ?? "tcgtimes";
    const { getUserByUsername } = await import("@/lib/db");
    const user = await getUserByUsername(username);
    if (!user) return NextResponse.json({ error: "user not found", username });
    // Omit password hash
    const { passwordHash: _, ...safe } = user;
    return NextResponse.json({ username, user: safe });
  }

  // --- step=signin: fetch the NextAuth signin endpoint and return what it does ---
  if (searchParams.get("step") === "signin") {
    const base = process.env.NEXTAUTH_URL ?? `https://${req.headers.get("host")}`;
    const signinUrl = `${base}/api/auth/signin/google?callbackUrl=/profile`;

    let status = 0;
    let redirectedTo = "(none)";
    let fetchError: string | null = null;

    try {
      const r = await fetch(signinUrl, { redirect: "manual" });
      status = r.status;
      redirectedTo = r.headers.get("location") ?? "(no location header)";
    } catch (e) {
      fetchError = e instanceof Error ? e.message : String(e);
    }

    return NextResponse.json({ signinUrl, status, redirectedTo, fetchError });
  }

  // --- default: env var check ---
  return NextResponse.json({
    hasAuthSecret: !!process.env.AUTH_SECRET,
    authSecretLength: process.env.AUTH_SECRET?.length ?? 0,
    authSecretPreview: process.env.AUTH_SECRET
      ? process.env.AUTH_SECRET.slice(0, 4) + "..."
      : "(missing)",
    hasJwtSecret: !!process.env.JWT_SECRET,
    hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
    googleClientIdPreview: process.env.GOOGLE_CLIENT_ID
      ? process.env.GOOGLE_CLIENT_ID.slice(0, 8) + "..."
      : "(missing)",
    hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    nextauthUrl: process.env.NEXTAUTH_URL ?? "(not set)",
    nodeEnv: process.env.NODE_ENV,
    // Actual host header arriving at the server
    requestHost: req.headers.get("host"),
    requestUrl: req.url,
    // What Google callback URL NextAuth will use
    expectedCallbackUrl: `${process.env.NEXTAUTH_URL}/api/auth/callback/google`,
  });
}
