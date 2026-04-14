/**
 * Catch-all route — serves the Vite SPA shell for every sub-path under
 * /quant-lab-.../  (e.g. /playground, /calculator, /chapter/01, etc.)
 *
 * React Router handles the actual client-side routing once the HTML loads.
 * Access is gated by the proxy middleware (role=admin only).
 */
import { readFileSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";

export async function GET() {
  const html = readFileSync(
    join(
      process.cwd(),
      "public/quant-lab-c4612f66b3d3a152268cb78678169119/index.html"
    ),
    "utf-8"
  );
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}
