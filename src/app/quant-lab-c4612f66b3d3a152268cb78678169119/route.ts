/**
 * Serves the Vite-built quant-lab SPA's index.html as raw HTML.
 * Access is gated by the proxy middleware (role=admin only).
 *
 * Next.js doesn't auto-serve index.html for subdirectory URLs from public/,
 * so this route handler reads the file and returns it verbatim.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";

export async function GET() {
  const html = readFileSync(
    join(process.cwd(), "public/quant-lab-c4612f66b3d3a152268cb78678169119/index.html"),
    "utf-8"
  );
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}
