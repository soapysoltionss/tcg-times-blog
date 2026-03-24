import { NextRequest, NextResponse } from "next/server";
import { upsertOAuthUser } from "@/lib/db";
import { signSession, setSessionCookie } from "@/lib/session";

/**
 * GET /api/auth/complete
 *
 * Called by NextAuth's redirect callback after a successful OAuth sign-in.
 *
 * WHY NOT auth(): The NextAuth session cookie is SameSite=Lax. It gets set in
 * the /api/auth/callback/google response, which then immediately 302s here.
 * The freshly-set cookie is NOT sent on that same navigation chain in most
 * browsers — so auth() sees no session and returns null.
 *
 * FIX: Read the NextAuth JWE cookie directly from the request and decode it
 * ourselves. NextAuth v5 (authjs) encrypts the session as a JWE using
 * AES-CBC-256 with a key derived via HKDF-SHA256 from AUTH_SECRET.
 */
export async function GET(req: NextRequest) {
  try {
    // ── 1. Read the NextAuth session cookie ──────────────────────────────────
    // Prod (https) uses __Secure- prefix; dev uses plain name
    const rawToken =
      req.cookies.get("__Secure-authjs.session-token")?.value ??
      req.cookies.get("authjs.session-token")?.value;

    if (!rawToken) {
      console.error(
        "[complete] No NextAuth session cookie found. Present cookies:",
        req.cookies.getAll().map((c) => c.name)
      );
      return NextResponse.redirect(new URL("/login?error=OAuthCallback", req.url));
    }

    // ── 2. Decode the NextAuth JWE ────────────────────────────────────────────
    // NextAuth v5 (@auth/core) encrypts the session as a JWE.
    // decode() takes { token, secret, salt } where salt = cookie name.
    // The prod cookie is __Secure-authjs.session-token; dev is authjs.session-token.
    let payload: Record<string, unknown> | null = null;
    try {
      const { decode } = await import("@auth/core/jwt");
      const isSecure = rawToken === req.cookies.get("__Secure-authjs.session-token")?.value;
      const salt = isSecure
        ? "__Secure-authjs.session-token"
        : "authjs.session-token";

      payload = (await decode({
        token: rawToken,
        secret: process.env.AUTH_SECRET!,
        salt,
      })) as Record<string, unknown> | null;
    } catch (decodeErr) {
      console.error("[complete] JWT decode failed:", decodeErr);
      return NextResponse.redirect(new URL("/login?error=OAuthCallback", req.url));
    }

    if (!payload) {
      console.error("[complete] Empty payload after decode");
      return NextResponse.redirect(new URL("/login?error=OAuthCallback", req.url));
    }

    const email = (payload.email as string) || "";
    const name = (payload.name as string) || "User";
    const image =
      (payload.picture as string) || (payload.image as string) || undefined;
    const provider = (payload.provider as string) || "google";
    const providerAccountId =
      (payload.providerAccountId as string) || email;

    if (!email) {
      console.error("[complete] No email in NextAuth payload:", payload);
      return NextResponse.redirect(new URL("/login?error=OAuthCallback", req.url));
    }

    // ── 3. Upsert user into our DB ────────────────────────────────────────────
    // Always upsert — this is the authoritative write point. events.signIn may
    // have already written the user, but on Vercel each serverless invocation
    // gets its own /tmp, so the two handlers may hit different instances.
    const dbUser = upsertOAuthUser({
      provider,
      providerAccountId,
      email,
      name,
      image,
    });

    // ── 4. Mint our tcgt_session cookie and redirect ──────────────────────────
    const token = await signSession({ userId: dbUser.id, username: dbUser.username });
    const destination = dbUser.needsUsername ? "/set-username" : "/profile";
    const res = NextResponse.redirect(new URL(destination, req.url));
    setSessionCookie(res, token);
    return res;
  } catch (err) {
    console.error("[complete] error:", err);
    return NextResponse.redirect(new URL("/login?error=OAuthCallback", req.url));
  }
}
