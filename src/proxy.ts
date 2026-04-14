import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/session";
import { getUserById } from "@/lib/db";

// Paths that are always public — the lock page itself and its API only.
// Everything else (including /login and /register) requires the site password.
const PUBLIC_PATHS = [
  "/coming-soon",
  "/api/unlock",
  "/api/interest",              // notify-me form
  "/api/comments/approve",      // Vercel Cron
  "/api/auth/patreon-webhook",  // Patreon server-to-server webhook
];

// Hidden path for the learning-quant SPA — only accessible by role=admin users.
const QUANT_PATH = "/quant-lab-c4612f66b3d3a152268cb78678169119";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Quant-lab gate: admin only, hard 404 for everyone else ──────────────
  if (pathname.startsWith(QUANT_PATH)) {
    const token = req.cookies.get("tcgt_session")?.value;
    if (token) {
      const session = await verifySession(token);
      if (session?.userId) {
        const user = await getUserById(session.userId);
        if (user?.role === "admin") {
          return NextResponse.next();
        }
      }
    }
    // Not admin → hard 404 (no redirect, keeps the path secret)
    return new NextResponse(null, { status: 404 });
  }

  // ── Site-lock gate ───────────────────────────────────────────────────────
  // If the site isn't locked, do nothing
  if (process.env.SITE_LOCKED !== "true") {
    return NextResponse.next();
  }

  // Always allow the lock page and unlock API through
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow Next.js internals (_next/static, _next/image, favicon, etc.)
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/icons")
  ) {
    return NextResponse.next();
  }

  // Check for the preview cookie
  const unlocked = req.cookies.get("site_preview")?.value === "1";
  if (unlocked) {
    return NextResponse.next();
  }

  // Redirect everything else to the coming-soon page
  const url = req.nextUrl.clone();
  url.pathname = "/coming-soon";
  return NextResponse.redirect(url);
}

export const config = {
  // Run on all routes except Next.js internals
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
