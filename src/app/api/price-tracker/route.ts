import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getPostsByCardTag } from "@/lib/posts";

/**
 * GET /api/price-tracker?cardName=<name>&game=<game>
 *
 * Returns:
 *  - history: daily price snapshots from price_snapshots table
 *  - mentionedIn: posts that have this card in their frontmatter cardTags[]
 *  - latestPriceCents: most recent price in cents (null if no data)
 *  - dayChangePct: % change vs yesterday (null if insufficient data)
 *
 * game is optional — omitting it searches across all games.
 */

export const dynamic = "force-dynamic";

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const rawCard = searchParams.get("cardName")?.trim() ?? "";
  const game = searchParams.get("game")?.trim() ?? "";

  if (!rawCard) {
    return NextResponse.json({ error: "cardName is required" }, { status: 400 });
  }

  const db = sql();

  // ── 1. Fetch price history from price_snapshots ──────────────────────────
  const historyRows = game
    ? await db`
        SELECT recorded_date, price_cents
        FROM price_snapshots
        WHERE lower(card_name) = lower(${rawCard})
          AND lower(game) = lower(${game})
        ORDER BY recorded_date ASC
      `
    : await db`
        SELECT recorded_date, price_cents
        FROM price_snapshots
        WHERE lower(card_name) = lower(${rawCard})
        ORDER BY recorded_date ASC
      `;

  const history = historyRows.map((r) => ({
    date: (r.recorded_date as Date).toISOString().slice(0, 10),
    priceCents: r.price_cents as number,
  }));

  // ── 2. Derive latest price and day-over-day change ───────────────────────
  let latestPriceCents: number | null = null;
  let dayChangePct: number | null = null;

  if (history.length >= 1) {
    latestPriceCents = history[history.length - 1].priceCents;
  }
  if (history.length >= 2) {
    const prev = history[history.length - 2].priceCents;
    if (prev > 0) {
      dayChangePct = ((latestPriceCents! - prev) / prev) * 100;
    }
  }

  // ── 3. Fetch "mentioned in" articles ────────────────────────────────────
  const mentionedIn = await getPostsByCardTag(rawCard);

  return NextResponse.json(
    {
      cardName: rawCard,
      game: game || null,
      latestPriceCents,
      dayChangePct,
      history,
      mentionedIn: mentionedIn.map((p) => ({
        slug: p.slug,
        title: p.title,
        date: p.date,
        excerpt: p.excerpt,
        coverImage: p.coverImage ?? null,
        category: p.category,
      })),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    }
  );
}
