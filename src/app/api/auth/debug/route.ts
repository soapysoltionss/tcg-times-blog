import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUserById, getUserByUsername } from "@/lib/db";

/**
 * GET /api/auth/debug                        — env var check
 * GET /api/auth/debug?step=subscriber        — session + DB subscription for logged-in user
 * GET /api/auth/debug?step=rawuser&u=NAME    — raw DB user by username (no login needed)
 * GET /api/auth/debug?step=signin            — fetches the Google signin URL
 */
export async function GET(req: NextRequest) {
  const step = req.nextUrl.searchParams.get("step");

  // --- step=subscriber: show raw session + DB subscription data ---
  if (step === "subscriber") {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({
        session: null,
        note: "not logged in — no tcgt_session cookie found",
        rawSearch: req.nextUrl.search,
      });
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
  if (step === "rawuser") {
    const username = req.nextUrl.searchParams.get("u") ?? "tcgtimes";
    const user = await getUserByUsername(username);
    if (!user) return NextResponse.json({ error: "user not found", username });
    const { passwordHash: _, ...safe } = user;
    return NextResponse.json({ username, user: safe });
  }

  // --- step=signin: fetch the NextAuth signin endpoint and return what it does ---
  if (step === "signin") {
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

  // --- default: env var check (also shows parsed step for diagnostics) ---
  return NextResponse.json({
    step,
    rawSearch: req.nextUrl.search,
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
    requestHost: req.headers.get("host"),
    requestUrl: req.url,
    expectedCallbackUrl: `${process.env.NEXTAUTH_URL}/api/auth/callback/google`,
  });
}
