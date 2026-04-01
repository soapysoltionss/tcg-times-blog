import { NextRequest, NextResponse } from "next/server";
import { getPriceMap, TCGPLAYER_CATEGORIES } from "@/lib/tcgplayer-prices";

/**
 * GET /api/fab-cards?q=QUERY
 *
 * Searches FaB cards using the open flesh-and-blood-cards dataset on GitHub.
 * Uses the `compendium-of-rathe` branch which includes the latest sets.
 * Data is fetched once per Vercel function instance and cached in module scope.
 *
 * Data source: https://github.com/the-fab-cube/flesh-and-blood-cards
 */

const BRANCH = "compendium-of-rathe";
const BASE = `https://raw.githubusercontent.com/the-fab-cube/flesh-and-blood-cards/${BRANCH}/json/english`;
const CARDS_URL = `${BASE}/card-flattened.json`;
const SETS_URL  = `${BASE}/set.json`;

export interface FabCardPrinting {
  /** Display label shown in the dropdown, e.g. "Everfest" or "Uprising (Alternate Art)" */
  label: string;
  setName: string;
  imageUrl: string;
  /** Back face image URL — only present for double-faced cards */
  backImageUrl?: string;
}

export interface FabCardResult {
  identifier: string;
  name: string;
  /** Default set name (first printing) */
  setName: string;
  /** Default image (first printing) */
  imageUrl: string | null;
  /** All printings — one entry per unique (set + art variation) */
  printings: FabCardPrinting[];
  marketPriceCents: number | null;
  /** % change vs yesterday from TCGPlayer — null if no history yet */
  priceChangePct: number | null;
}

// ── Module-level cache ───────────────────────────────────────────────────────
let cardIndex: FabCardResult[] | null = null;
let loadPromise: Promise<FabCardResult[]> | null = null;

interface FlatCard {
  unique_id: string;
  name: string;
  set_id: string;
  foiling?: string;
  art_variations?: string[];
  image_url?: string;
}

interface SetRecord {
  id: string;
  name: string;
}

/** Build a human-readable label for a printing based on art variation flags */
function printingLabel(setName: string, artVariations: string[], imageUrl: string): string {
  const tags: string[] = [];
  // AB = second alternate art, AA = first alternate art, FA = full art, EA = extended art
  if (artVariations.includes("AB")) tags.push("Alt Art B");
  else if (artVariations.includes("AA")) tags.push("Alternate Art");
  if (artVariations.includes("FA")) tags.push("Full Art");
  else if (artVariations.includes("EA")) tags.push("Extended Art");

  // ARC 1st edition vs Unlimited have different image URLs (2020-ARC vs 2020-U-ARC)
  if (imageUrl.includes("U-ARC")) tags.push("Unlimited");

  return tags.length > 0 ? `${setName} (${tags.join(", ")})` : setName;
}

async function buildIndex(): Promise<FabCardResult[]> {
  const [cardsRes, setsRes] = await Promise.all([
    fetch(CARDS_URL, { signal: AbortSignal.timeout(25_000) }),
    fetch(SETS_URL,  { signal: AbortSignal.timeout(10_000) }),
  ]);

  if (!cardsRes.ok || !setsRes.ok) {
    throw new Error(`GitHub fetch failed: cards=${cardsRes.status} sets=${setsRes.status}`);
  }

  const [flatCards, sets] = (await Promise.all([
    cardsRes.json(),
    setsRes.json(),
  ])) as [FlatCard[], SetRecord[]];

  // set_id → set_name
  const setNames: Record<string, string> = {};
  for (const s of sets) setNames[s.id] = s.name;

  // Group by card name; deduplicate by image_url (the true unique identifier per art)
  type CardEntry = {
    identifier: string;
    // key = frontImageUrl → { label, setName, backImageUrl? }
    byImage: Map<string, { label: string; setName: string; backImageUrl?: string }>;
  };
  const byName = new Map<string, CardEntry>();

  // First pass: collect all _BACK urls keyed by their front URL
  // e.g. "ROS008-MV_BACK.png" → pairs with "ROS008-MV.png"
  const backUrlByFront = new Map<string, string>();
  for (const card of flatCards) {
    const url = card.image_url;
    if (!url) continue;
    if (url.includes("_BACK") || url.includes("_Back")) {
      // Derive the front URL by stripping the _BACK / _Back suffix (before extension)
      const frontUrl = url.replace(/_BACK(_V\d+)?(\.\w+)$/, "$2").replace(/_Back(\.\w+)$/, "$1");
      if (frontUrl !== url) {
        backUrlByFront.set(frontUrl, url);
      }
    }
  }

  // Second pass: build card index — skip _BACK entries as standalone printings
  for (const card of flatCards) {
    if (!card.image_url) continue;
    if (card.image_url.includes("_BACK") || card.image_url.includes("_Back")) continue;

    const setName = setNames[card.set_id] ?? card.set_id;
    const artVars = card.art_variations ?? [];
    const label = printingLabel(setName, artVars, card.image_url);

    if (!byName.has(card.name)) {
      byName.set(card.name, { identifier: card.unique_id, byImage: new Map() });
    }
    const entry = byName.get(card.name)!;

    // Each unique image_url = one distinct printing row
    if (!entry.byImage.has(card.image_url)) {
      const backImageUrl = backUrlByFront.get(card.image_url);
      entry.byImage.set(card.image_url, { label, setName, backImageUrl });
    }
  }

  return Array.from(byName.entries()).map(([name, entry]) => {
    const printings: FabCardPrinting[] = Array.from(entry.byImage.entries()).map(
      ([imageUrl, { label, setName, backImageUrl }]) => ({
        label,
        setName,
        imageUrl,
        ...(backImageUrl ? { backImageUrl } : {}),
      })
    );
    const first = printings[0];
    return {
      identifier: entry.identifier,
      name,
      setName: first?.setName ?? "",
      imageUrl: first?.imageUrl ?? null,
      printings,
      marketPriceCents: null,
      priceChangePct: null,
    };
  });
}

async function getIndex(): Promise<FabCardResult[]> {
  if (cardIndex) return cardIndex;
  if (!loadPromise) {
    loadPromise = buildIndex()
      .then((idx) => {
        cardIndex = idx;
        loadPromise = null;
        console.log(`[fab-cards] index built: ${idx.length} unique cards`);
        return idx;
      })
      .catch((err) => {
        loadPromise = null;
        throw err;
      });
  }
  return loadPromise;
}
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase();
  if (!q || q.length < 2) {
    return NextResponse.json({ cards: [] });
  }

  try {
    const [index, priceMap] = await Promise.all([
      getIndex(),
      getPriceMap("flesh-and-blood", TCGPLAYER_CATEGORIES["flesh-and-blood"], 6).catch(() => new Map()),
    ]);

    const results = index
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 12)
      .map((c) => {
        const priceData = priceMap.get(c.name.toLowerCase());
        return {
          ...c,
          marketPriceCents: priceData?.marketPriceCents ?? c.marketPriceCents,
          priceChangePct:   priceData?.priceChangePct ?? null,
        };
      });

    return NextResponse.json({ cards: results });
  } catch (err) {
    console.warn("[fab-cards] error:", err);
    return NextResponse.json({ cards: [], error: "network_error" });
  }
}
