import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/market-set?game=grand-archive&groupId=1234
 *
 * Returns the full card list + prices for a specific set (group) from tcgcsv.com.
 * Cached at the edge for 24 hours since card lists rarely change.
 */

const TCGCSV = "https://tcgcsv.com/tcgplayer";

const CATEGORY_ID: Record<string, number> = {
  "grand-archive":   74,
  "flesh-and-blood": 62,
  "one-piece":       68,
  "pokemon":          3,
  "magic":            1,
};

interface TcgCsvGroup {
  groupId: number;
  name: string;
  publishedOn: string;
  isSupplemental: boolean;
  categoryId: number;
}

interface TcgCsvProduct {
  productId: number;
  name: string;
  cleanName: string;
  categoryId: number;
  groupId: number;
  imageUrl?: string;
  // Some sets use flat ext* fields, others use extendedData[]
  extRarity?: string;
  extNumber?: string;
  extendedData?: Array<{ name: string; displayName: string; value: string }>;
}

interface TcgCsvPrice {
  productId: number;
  marketPrice: number | null;
  midPrice: number | null;
  subTypeName: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const game    = searchParams.get("game") ?? "";
  const groupId = searchParams.get("groupId") ?? "";

  const categoryId = CATEGORY_ID[game];
  if (!categoryId) {
    return NextResponse.json({ error: `Unknown game: ${game}` }, { status: 400 });
  }
  if (!groupId || isNaN(Number(groupId))) {
    return NextResponse.json({ error: "groupId is required" }, { status: 400 });
  }

  try {
    // Fetch group metadata, products, and prices in parallel
    const gid = Number(groupId);
    const [groupsData, productsData, pricesData] = await Promise.all([
      fetchJson<{ results: TcgCsvGroup[] }>(`${TCGCSV}/${categoryId}/groups`),
      fetchJson<{ results: TcgCsvProduct[] }>(`${TCGCSV}/${categoryId}/${gid}/products`),
      fetchJson<{ results: TcgCsvPrice[] }>(`${TCGCSV}/${categoryId}/${gid}/prices`),
    ]);

    const group = groupsData.results.find(g => g.groupId === gid);
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Build price map: productId → best price
    const priceByProduct = new Map<number, { marketPriceCents: number | null; midPriceCents: number | null; subTypeName: string }>();
    // Prefer Cold Foil > Rainbow Foil > 1st Edition > Holofoil > Normal
    const PREF = ["Cold Foil", "Rainbow Foil", "1st Edition", "Holofoil", "Normal"];
    for (const price of pricesData.results) {
      const existing = priceByProduct.get(price.productId);
      const existingPref = existing ? PREF.indexOf(existing.subTypeName) : 999;
      const newPref = PREF.indexOf(price.subTypeName);
      // Use if better preference, or if no existing and has a price
      if (!existing || (newPref < existingPref && (price.marketPrice ?? 0) > 0)) {
        priceByProduct.set(price.productId, {
          marketPriceCents: price.marketPrice != null ? Math.round(price.marketPrice * 100) : null,
          midPriceCents:    price.midPrice    != null ? Math.round(price.midPrice    * 100) : null,
          subTypeName:      price.subTypeName,
        });
      }
    }

    const cards = productsData.results
      .map(p => {
        // Build a lookup from extendedData (present on some sets like First Partner)
        const ext: Record<string, string> = {};
        for (const e of p.extendedData ?? []) {
          ext[e.name] = e.value;
        }

        const number = p.extNumber ?? ext["Number"] ?? null;
        const rarity = p.extRarity ?? ext["Rarity"] ?? null;

        // Filter out non-playable products:
        //   - Code cards (Rarity === "Code Card")
        //   - Sealed product (boxes, packs, binders) — no HP and no card number
        // A real card must have either HP or a collector number.
        const isCodeCard = rarity === "Code Card";
        const isCard = !isCodeCard && !!(ext["HP"] || number);

        return {
          productId:        p.productId,
          name:             p.name,
          cleanName:        p.cleanName,
          number,
          rarity,
          imageUrl:         p.imageUrl ?? null,
          marketPriceCents: null as number | null,
          midPriceCents:    null as number | null,
          subTypeName:      "Normal",
          _isCard:          isCard,
        };
      })
      .filter(c => c._isCard)
      .map(({ _isCard, ...c }) => {
        const priceData = priceByProduct.get(c.productId);
        return {
          ...c,
          marketPriceCents: priceData?.marketPriceCents ?? null,
          midPriceCents:    priceData?.midPriceCents ?? null,
          subTypeName:      priceData?.subTypeName ?? "Normal",
        };
      });

    return NextResponse.json({
      groupId:     gid,
      name:        group.name,
      game,
      categoryId,
      publishedOn: group.publishedOn,
      totalCards:  cards.length,
      cards,
    }, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300" },
    });

  } catch (err) {
    console.error("[market-set]", err);
    return NextResponse.json({ error: "Failed to fetch set data" }, { status: 500 });
  }
}
