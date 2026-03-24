import { NextResponse } from "next/server";

/** Returns which OAuth providers are currently configured via env vars. */
export async function GET() {
  return NextResponse.json({
    google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    patreon: !!(process.env.PATREON_CLIENT_ID && process.env.PATREON_CLIENT_SECRET),
  });
}
