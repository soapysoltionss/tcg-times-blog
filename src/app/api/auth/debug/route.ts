import { NextResponse } from "next/server";

/**
 * GET /api/auth/debug
 *
 * Temporary diagnostic endpoint — remove after OAuth is confirmed working.
 * Shows which env vars are present at runtime (values masked).
 */
export async function GET() {
  return NextResponse.json({
    hasAuthSecret: !!process.env.AUTH_SECRET,
    authSecretLength: process.env.AUTH_SECRET?.length ?? 0,
    hasJwtSecret: !!process.env.JWT_SECRET,
    hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
    hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    hasPatreonClientId: !!process.env.PATREON_CLIENT_ID,
    hasPatreonClientSecret: !!process.env.PATREON_CLIENT_SECRET,
    nextauthUrl: process.env.NEXTAUTH_URL ?? "(not set)",
    nodeEnv: process.env.NODE_ENV,
    // First 4 chars of AUTH_SECRET to confirm it matches your .env.local
    authSecretPreview: process.env.AUTH_SECRET
      ? process.env.AUTH_SECRET.slice(0, 4) + "..."
      : "(missing)",
  });
}
