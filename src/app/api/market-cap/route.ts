import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

/**
 * GET /api/market-cap?cardName=X&game=Y
 *
 * Returns:
 *  {
 *    lastSoldCents: number | null,
 *    supplyGlobal: number | null,
 *    supplyRegion: number | null,
 *    marketCapGlobal: number | null,   // lastSoldCents × supplyGlobal
 *    marketCapRegion: number | null,   // lastSoldCents × supplyRegion
 *    rarity: string | null,
 *  }
 *
 * Supply estimates come from the `supply_estimates` table.
 * If no supply data exists, supplyGlobal / supplyRegion / marketCap will be null.
 * lastSoldCents is always populated from `transactions` (last 90 days).
 *
 * 8d — Market cap calculation
 */

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  return neon(url);
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const cardName = searchParams.get("cardName") ?? "";
  const game     = searchParams.get("game") ?? "";

  if (!cardName || !game) {
    return NextResponse.json(
      { error: "cardName and game are required" },
      { status: 400 }
    );
  }

  try {
    const sql = db();

    // Last sold price (most recent transaction in last 90 days)
    const txRows: Record<string, unknown>[] = await sql`
      SELECT price_cents
      FROM   transactions
      WHERE  lower(game)      = lower(${game})
        AND  lower(card_name) = lower(${cardName})
        AND  completed_at    >= now() - interval '90 days'
      ORDER  BY completed_at DESC
      LIMIT  1
    `;

    const lastSoldCents = txRows.length > 0 ? Number(txRows[0].price_cents) : null;

    // Supply estimate from supply_estimates table
    const supplyRows: Record<string, unknown>[] = await sql`
      SELECT supply_global, supply_region, rarity
      FROM   supply_estimates
      WHERE  lower(game)      = lower(${game})
        AND  lower(card_name) = lower(${cardName})
      LIMIT  1
    `;

    const supply = supplyRows[0] ?? null;
    const supplyGlobal = supply?.supply_global != null ? Number(supply.supply_global) : null;
    const supplyRegion = supply?.supply_region != null ? Number(supply.supply_region) : null;
    const rarity       = (supply?.rarity as string) ?? null;

    const marketCapGlobal =
      lastSoldCents != null && supplyGlobal != null
        ? lastSoldCents * supplyGlobal
        : null;

    const marketCapRegion =
      lastSoldCents != null && supplyRegion != null
        ? lastSoldCents * supplyRegion
        : null;

    return NextResponse.json(
      { lastSoldCents, supplyGlobal, supplyRegion, marketCapGlobal, marketCapRegion, rarity },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=120" } }
    );
  } catch (e) {
    console.error("[api/market-cap GET]", e);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
