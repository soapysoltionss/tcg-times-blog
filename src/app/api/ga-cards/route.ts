import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/ga-cards?q=QUERY
 *
 * Searches Grand Archive cards via the official Grand Archive API.
 * Live search — no local cache needed since the GA API is fast and paginated.
 *
 * Data source: https://api.gatcg.com/cards/search
 */

const GA_API = "https://api.gatcg.com";

export interface GaCardPrinting {
  /** Display label, e.g. "Mortal Ambition Draft Pack" */
  label: string;
  setName: string;
  imageUrl: string;
}

export interface GaCardResult {
  /** Edition UUID used as a stable identifier */
  identifier: string;
  name: string;
  /** Default set name (first edition) */
  setName: string;
  /** Default image URL (first edition) */
  imageUrl: string | null;
  /** One entry per edition/printing */
  printings: GaCardPrinting[];
  /** GA API does not provide market prices — always null */
  marketPriceCents: null;
}

interface GaEdition {
  uuid: string;
  slug: string;
  image: string;
  set: {
    id: string;
    name: string;
    prefix: string;
  };
  rarity: number;
  collector_number: string;
}

interface GaCard {
  uuid: string;
  name: string;
  slug: string;
  types: string[];
  editions: GaEdition[];
  result_editions: GaEdition[];
}

interface GaSearchResponse {
  results: GaCard[];
  has_more: boolean;
  total_cards: number;
  page: number;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ cards: [] });
  }

  try {
    const url = `${GA_API}/cards/search?q=${encodeURIComponent(q)}&count=20`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { "Accept": "application/json" },
    });

    if (!res.ok) {
      return NextResponse.json({ cards: [] });
    }

    const data: GaSearchResponse = await res.json();

    const cards: GaCardResult[] = (data.results ?? []).map((card) => {
      // Use result_editions if available (matching editions), otherwise fall back to all editions
      const editions: GaEdition[] = card.result_editions?.length
        ? card.result_editions
        : card.editions ?? [];

      const printings: GaCardPrinting[] = editions.map((ed) => ({
        label: ed.set.name,
        setName: ed.set.name,
        imageUrl: `${GA_API}${ed.image}`,
      }));

      const first = editions[0] ?? null;

      return {
        identifier: first?.uuid ?? card.uuid,
        name: card.name,
        setName: first?.set.name ?? "",
        imageUrl: first ? `${GA_API}${first.image}` : null,
        printings,
        marketPriceCents: null,
      };
    });

    return NextResponse.json({ cards });
  } catch {
    return NextResponse.json({ cards: [] });
  }
}
