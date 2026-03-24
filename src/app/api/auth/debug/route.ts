import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * GET /api/auth/debug
 *
 * Temporary diagnostic endpoint — remove after OAuth is confirmed working.
 * Shows which env vars are present at runtime (values masked).
 */
export async function GET() {
  let nextAuthSession: unknown = null;
  let nextAuthError: string | null = null;

  try {
    nextAuthSession = await auth();
  } catch (e) {
    nextAuthError = e instanceof Error ? e.message : String(e);
  }

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
    hasPatreonClientId: !!process.env.PATREON_CLIENT_ID,
    hasPatreonClientSecret: !!process.env.PATREON_CLIENT_SECRET,
    nextauthUrl: process.env.NEXTAUTH_URL ?? "(not set)",
    nodeEnv: process.env.NODE_ENV,
    // Try initialising NextAuth to surface any startup errors
    nextAuthSession,
    nextAuthError,
  });
}
