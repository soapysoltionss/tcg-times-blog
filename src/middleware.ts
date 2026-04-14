import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/session";
import { getUserById } from "@/lib/db";

// The hidden path prefix for the learning-quant SPA.
// Keep this in sync with vite.config.ts `base` and the public/ folder name.
const QUANT_PATH = "/quant-lab-c4612f66b3d3a152268cb78678169119";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only intercept requests to the quant-lab path
  if (!pathname.startsWith(QUANT_PATH)) {
    return NextResponse.next();
  }

  // Read the session cookie
  const token = req.cookies.get("tcgt_session")?.value;
  if (token) {
    const session = await verifySession(token);
    if (session?.userId) {
      // Verify the user actually has role=admin in the DB
      const user = await getUserById(session.userId);
      if (user?.role === "admin") {
        return NextResponse.next();
      }
    }
  }

  // Not admin — return a hard 404 (not a redirect, so the path stays secret)
  return new NextResponse(null, { status: 404 });
}

export const config = {
  // Match the quant-lab path and all its static assets
  matcher: ["/quant-lab-c4612f66b3d3a152268cb78678169119/:path*"],
};
