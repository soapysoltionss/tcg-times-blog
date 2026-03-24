import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/auth/debug
 * GET /api/auth/debug?step=signin  — fetches the Google signin URL and follows it
 *
 * Temporary diagnostic endpoint — remove after OAuth is confirmed working.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

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
