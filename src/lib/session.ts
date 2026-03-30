import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "tcg-times-dev-secret-change-in-production"
);

const COOKIE_NAME = "tcgt_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type SessionPayload = {
  userId: string;
  username: string;
  /** True when user has an active or declined (grace-period) Patreon subscription */
  isSubscriber?: boolean;
  /** Patreon tier name, e.g. "Monthly" or "Annual" */
  tierName?: string;
  /** Numeric tier level: 1 = Starter, 2 = Basic, 3 = Pro */
  tierLevel?: number;
  /**
   * ISO 3166-1 alpha-2 country code from user profile.
   * e.g. "SG", "US", "JP", "AU". Used to localise AI coaching responses.
   */
  regionCode?: string;
};

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(SECRET);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/** Read the session from cookies in a Server Component or API route. */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

/** Attach a session cookie to a NextResponse. */
export function setSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

/** Read session from a raw request (used in proxy/middleware). */
export async function getSessionFromRequest(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export { COOKIE_NAME };
