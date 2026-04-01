import { NextRequest, NextResponse } from "next/server";
import { getNewsItems } from "@/lib/db";
import type { NewsGame, NewsTag } from "@/types/post";

/**
 * GET /api/news
 * Returns paginated news items from the news_items table.
 *
 * Query params:
 *   game  — "all" | "fab" | "grand-archive" | "one-piece" | "pokemon" | "general"
 *   tag   — "ban" | "rotation" | "tournament" | "new-set"
 *   limit — number (default 50, max 100)
 *   offset — number (default 0)
 *
 * Public, CDN-cacheable for 5 minutes.
 */

const VALID_GAMES = new Set(["all", "fab", "grand-archive", "one-piece", "pokemon", "general"]);
const VALID_TAGS  = new Set(["ban", "rotation", "tournament", "new-set"]);

export async function GET(req: NextRequest) {
  const sp     = req.nextUrl.searchParams;
  const game   = sp.get("game") ?? "all";
  const tag    = sp.get("tag") ?? null;
  const limit  = Math.min(parseInt(sp.get("limit") ?? "50", 10), 100);
  const offset = parseInt(sp.get("offset") ?? "0", 10);

  if (!VALID_GAMES.has(game)) {
    return NextResponse.json({ error: "Invalid game filter." }, { status: 400 });
  }
  if (tag && !VALID_TAGS.has(tag)) {
    return NextResponse.json({ error: "Invalid tag filter." }, { status: 400 });
  }

  const items = await getNewsItems({
    game: game as NewsGame | "all",
    tag: tag as NewsTag | undefined,
    limit,
    offset,
  });

  return NextResponse.json(
    { items, count: items.length },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}
