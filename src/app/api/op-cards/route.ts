import { NextRequest, NextResponse } from "next/server";
import { getPriceMap, TCGPLAYER_CATEGORIES } from "@/lib/tcgplayer-prices";

/**
 * GET /api/op-cards?q=QUERY
 *
 * Searches One Piece TCG cards via the onelogtcg.com Supabase backend.
 * Uses the public anon key — read-only access.
 *
 * Table: Card
 * Fields: id, name, serial, url (full Cloudinary image URL), card_sets
 */

const SUPABASE_URL = "https://qjgcitmjpthngoivyjvu.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqZ2NpdG1qcHRobmdvaXZ5anZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2NzQwOTk5MDIsImV4cCI6MTk4OTY3NTkwMn0.7tp0okCUXGPu26VJEqXebMh6OQiyBq5_JCfeLpiLxOI";

export interface OpCardPrinting {
  label: string;
  setName: string;
  imageUrl: string;
}

export interface OpCardResult {
  /** Card serial number, e.g. "OP01-001" — used as the stable identifier */
  identifier: string;
  name: string;
  setName: string;
  imageUrl: string | null;
  /** One entry per printing (usually just one for OP cards) */
  printings: OpCardPrinting[];
  /** TCGPlayer market price in cents — null if unavailable */
  marketPriceCents: number | null;
  /** % change vs yesterday from TCGPlayer — null if no history yet */
  priceChangePct: number | null;
}

interface SupabaseCard {
  id: number;
  name: string;
  serial: string;
  url: string | null;
  card_sets: string | null;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ cards: [] });
  }

  try {
    const params = new URLSearchParams({
      "name": `ilike.*${q}*`,
      "limit": "20",
      "select": "id,name,serial,url,card_sets",
      "order": "serial.asc",
    });

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/Card?${params}`,
      {
        signal: AbortSignal.timeout(10_000),
        headers: {
          "apikey": ANON_KEY,
          "Authorization": `Bearer ${ANON_KEY}`,
          "Accept": "application/json",
        },
      }
    );

    if (!res.ok) {
      return NextResponse.json({ cards: [] });
    }

    const rows: SupabaseCard[] = await res.json();

    // Load One Piece price map from TCGPlayer in parallel
    const priceMap = await getPriceMap("one-piece", TCGPLAYER_CATEGORIES["one-piece"], 8).catch(() => new Map());

    const cards: OpCardResult[] = rows.map((row) => {
      const setName = row.card_sets ?? "";
      const imageUrl = row.url ?? null;
      const printing: OpCardPrinting = {
        label: row.serial ? `${row.serial}${setName ? ` — ${setName}` : ""}` : setName,
        setName,
        imageUrl: imageUrl ?? "",
      };

      const priceData = priceMap.get(row.name.toLowerCase());

      return {
        identifier: row.serial || String(row.id),
        name: row.name,
        setName,
        imageUrl,
        printings: imageUrl ? [printing] : [],
        marketPriceCents: priceData?.marketPriceCents ?? null,
        priceChangePct:   priceData?.priceChangePct ?? null,
      };
    });

    return NextResponse.json({ cards });
  } catch {
    return NextResponse.json({ cards: [] });
  }
}
