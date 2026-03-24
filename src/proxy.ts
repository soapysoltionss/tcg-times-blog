import { NextRequest, NextResponse } from "next/server";

// Paths that are always public — the lock page itself, its API, and auth routes
const PUBLIC_PATHS = [
  "/coming-soon",
  "/api/unlock",
  "/api/auth",
  "/login",
  "/register",
  "/forgot-password",
];

export function proxy(req: NextRequest) {
  // If the site isn't locked, do nothing
  if (process.env.SITE_LOCKED !== "true") {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

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
