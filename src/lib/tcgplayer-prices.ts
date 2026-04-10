/**
 * src/lib/tcgplayer-prices.ts  — SERVER ONLY
 *
 * Fetches daily price data from tcgcsv.com (a public TCGPlayer mirror)
 * and stores it in the price_snapshots Neon table.
 *
 * Strategy
 * ────────
 * 1. On first request each day, load the product catalogue + prices for the
 *    most-recent groups of a given TCGPlayer category.
 * 2. Upsert today's prices into price_snapshots (ON CONFLICT DO NOTHING so we
 *    only write once per card per day).
 * 3. Return today vs. yesterday price rows to compute % change.
 *
 * The result is a Map keyed by lower-cased card name:
 *   { marketPriceCents: number, priceChangePct: number | null }
 *
 * Category IDs (TCGPlayer / tcgcsv):
 *   1  Magic: The Gathering
 *   3  Pokémon
 *  62  Flesh & Blood TCG
 *  68  One Piece Card Game
 *  74  Grand Archive
 */

import { neon } from "@neondatabase/serverless";

const TCGCSV = "https://tcgcsv.com/tcgplayer";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CardPriceData {
  marketPriceCents: number;
  /** % change vs yesterday — null if no yesterday snapshot exists */
  priceChangePct: number | null;
  tcgplayerId?: number;
}

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
}

interface TcgCsvPrice {
  productId: number;
  marketPrice: number | null;
  midPrice: number | null;
  subTypeName: string;
}

// ── Module-level daily cache per category ────────────────────────────────────
// Key: categoryId, Value: { date: YYYY-MM-DD, data: Map<lowerName, CardPriceData> }

const dailyCache = new Map<number, { date: string; data: Map<string, CardPriceData> }>();
const loadingPromise = new Map<number, Promise<Map<string, CardPriceData>>>();

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function fetchGroups(categoryId: number): Promise<TcgCsvGroup[]> {
  const res = await fetch(`${TCGCSV}/${categoryId}/groups`, {
    signal: AbortSignal.timeout(10_000),
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`tcgcsv groups ${categoryId}: ${res.status}`);
  const data = await res.json() as { results: TcgCsvGroup[] };
  return data.results ?? [];
}

async function fetchProducts(categoryId: number, groupId: number): Promise<TcgCsvProduct[]> {
  const res = await fetch(`${TCGCSV}/${categoryId}/${groupId}/products`, {
    signal: AbortSignal.timeout(15_000),
    next: { revalidate: 86400 },
  });
  if (!res.ok) return [];
  const data = await res.json() as { results: TcgCsvProduct[] };
  return data.results ?? [];
}

async function fetchPrices(categoryId: number, groupId: number): Promise<TcgCsvPrice[]> {
  const res = await fetch(`${TCGCSV}/${categoryId}/${groupId}/prices`, {
    signal: AbortSignal.timeout(15_000),
    next: { revalidate: 86400 },
  });
  if (!res.ok) return [];
  const data = await res.json() as { results: TcgCsvPrice[] };
  return data.results ?? [];
}

// ── Pick best market price across foil types ──────────────────────────────────

function pickBestPrice(prices: TcgCsvPrice[]): number | null {
  // Prefer: Cold Foil > Rainbow Foil > Normal
  const order = ["Cold Foil", "Rainbow Foil", "1st Edition", "Holofoil", "Normal"];
  for (const subType of order) {
    const p = prices.find(p => p.subTypeName === subType && (p.marketPrice ?? 0) > 0);
    if (p?.marketPrice) return Math.round(p.marketPrice * 100);
  }
  // Fall back to any price
  const any = prices.find(p => (p.marketPrice ?? 0) > 0);
  return any?.marketPrice ? Math.round(any.marketPrice * 100) : null;
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function upsertSnapshots(
  game: string,
  rows: Array<{ cardName: string; tcgplayerId: number; priceCents: number }>,
  dateStr?: string  // defaults to today; pass yesterday's date to back-fill
): Promise<void> {
  if (rows.length === 0) return;
  const db = sql();
  const targetDate = dateStr ?? todayStr();

  // Batch upsert in chunks of 200 to stay within parameter limits
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    // Build a VALUES string manually since neon tagged template doesn't support array expansion
    const values = chunk
      .map((r) => `('${game.replace(/'/g, "''")}', '${r.cardName.replace(/'/g, "''")}', ${r.tcgplayerId}, ${r.priceCents}, '${targetDate}')`)
      .join(",\n");

    await db.query(
      `INSERT INTO price_snapshots (game, card_name, tcgplayer_id, price_cents, recorded_date)
       VALUES ${values}
       ON CONFLICT (lower(game), lower(card_name), recorded_date) DO NOTHING`
    );
  }
}

async function loadSnapshotsForDates(
  game: string,
  dates: string[]
): Promise<Map<string, { today: number | null; yesterday: number | null }>> {
  const db = sql();
  const rows = await db`
    SELECT lower(card_name) AS name, price_cents, recorded_date::text AS date
    FROM price_snapshots
    WHERE lower(game) = lower(${game})
      AND recorded_date = ANY(ARRAY[${dates[0]}, ${dates[1] ?? dates[0]}]::date[])
  `;

  const result = new Map<string, { today: number | null; yesterday: number | null }>();
  for (const r of rows) {
    const name = (r.name as string).toLowerCase();
    if (!result.has(name)) result.set(name, { today: null, yesterday: null });
    const entry = result.get(name)!;
    if (r.date === dates[0]) entry.today = r.price_cents as number;
    else entry.yesterday = r.price_cents as number;
  }
  return result;
}

// ── Main loader ───────────────────────────────────────────────────────────────

/**
 * Load (and cache for today) the TCGPlayer price map for a given game.
 * Returns a Map<lowerCardName, CardPriceData>.
 *
 * @param game       Internal game slug, e.g. "flesh-and-blood"
 * @param categoryId TCGPlayer/tcgcsv category ID
 * @param maxGroups  How many recent sets to load (default 5)
 */
async function buildPriceMap(
  game: string,
  categoryId: number,
  maxGroups = 5
): Promise<Map<string, CardPriceData>> {
  const today = todayStr();
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  // ── 1. Fetch groups ────────────────────────────────────────────────────────
  const groups = await fetchGroups(categoryId);
  // Sort by publishedOn descending, skip future releases, take maxGroups
  const now = Date.now();
  const recentGroups = groups
    .filter(g => !g.isSupplemental && new Date(g.publishedOn).getTime() <= now)
    .sort((a, b) => new Date(b.publishedOn).getTime() - new Date(a.publishedOn).getTime())
    .slice(0, maxGroups);

  // ── 2. Fetch products + prices for each group ─────────────────────────────
  const productIdToName = new Map<number, string>();
  const pricesByProduct = new Map<number, TcgCsvPrice[]>();

  await Promise.all(
    recentGroups.map(async (group) => {
      const [products, prices] = await Promise.all([
        fetchProducts(categoryId, group.groupId),
        fetchPrices(categoryId, group.groupId),
      ]);
      for (const p of products) productIdToName.set(p.productId, p.cleanName ?? p.name);
      for (const price of prices) {
        if (!pricesByProduct.has(price.productId)) pricesByProduct.set(price.productId, []);
        pricesByProduct.get(price.productId)!.push(price);
      }
    })
  );

  // ── 3. Build today's snapshot rows ─────────────────────────────────────────
  const snapshotRows: Array<{ cardName: string; tcgplayerId: number; priceCents: number }> = [];

  for (const [productId, prices] of pricesByProduct.entries()) {
    const name = productIdToName.get(productId);
    if (!name) continue;
    const priceCents = pickBestPrice(prices);
    if (!priceCents) continue;
    snapshotRows.push({ cardName: name, tcgplayerId: productId, priceCents });
  }

  // ── 4. Upsert into DB (fire-and-forget if it fails) ────────────────────────
  try {
    await upsertSnapshots(game, snapshotRows);
  } catch (err) {
    console.warn(`[tcgplayer-prices] upsert failed for ${game}:`, err);
  }

  // ── 4b. Back-fill yesterday if it has no data (bootstraps % change history)
  // We write today's prices under yesterday's date so the NEXT request can
  // compute a day-over-day diff. ON CONFLICT DO NOTHING means we never
  // overwrite genuine historical data.
  try {
    await upsertSnapshots(game, snapshotRows, yesterday);
  } catch (err) {
    console.warn(`[tcgplayer-prices] yesterday back-fill failed for ${game}:`, err);
  }

  // ── 5. Load today + yesterday from DB to compute % change ─────────────────
  let dbSnapshots = new Map<string, { today: number | null; yesterday: number | null }>();
  try {
    dbSnapshots = await loadSnapshotsForDates(game, [today, yesterday]);
  } catch (err) {
    console.warn(`[tcgplayer-prices] snapshot load failed for ${game}:`, err);
  }

  // ── 6. Build the final price map ──────────────────────────────────────────
  const priceMap = new Map<string, CardPriceData>();

  for (const row of snapshotRows) {
    const key = row.cardName.toLowerCase();
    const snap = dbSnapshots.get(key);
    const todayPrice = snap?.today ?? row.priceCents;
    const yesterdayPrice = snap?.yesterday ?? null;

    const priceChangePct =
      yesterdayPrice && yesterdayPrice > 0
        ? Math.round(((todayPrice - yesterdayPrice) / yesterdayPrice) * 1000) / 10 // 1 decimal
        : null;

    priceMap.set(key, {
      marketPriceCents: todayPrice,
      priceChangePct,
      tcgplayerId: row.tcgplayerId,
    });
  }

  return priceMap;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Get the TCGPlayer price map for a game, cached per-day per-category.
 * Lazy-loads on first call; subsequent calls in the same Vercel instance
 * return the cached map instantly.
 */
export async function getPriceMap(
  game: string,
  categoryId: number,
  maxGroups = 5
): Promise<Map<string, CardPriceData>> {
  const today = todayStr();
  const cached = dailyCache.get(categoryId);
  if (cached && cached.date === today) return cached.data;

  // Prevent parallel fetches for the same category
  const existing = loadingPromise.get(categoryId);
  if (existing) return existing;

  const promise = buildPriceMap(game, categoryId, maxGroups)
    .then((data) => {
      dailyCache.set(categoryId, { date: today, data });
      loadingPromise.delete(categoryId);
      return data;
    })
    .catch((err) => {
      loadingPromise.delete(categoryId);
      console.error(`[tcgplayer-prices] buildPriceMap failed (cat=${categoryId}):`, err);
      return new Map<string, CardPriceData>();
    });

  loadingPromise.set(categoryId, promise);
  return promise;
}

/**
 * Convenience: look up a single card's price data by name.
 * Returns null if not found.
 */
export async function getPriceData(
  game: string,
  categoryId: number,
  cardName: string
): Promise<CardPriceData | null> {
  const map = await getPriceMap(game, categoryId);
  return map.get(cardName.toLowerCase()) ?? null;
}

// ── TCGPlayer category IDs ────────────────────────────────────────────────────

export const TCGPLAYER_CATEGORIES = {
  "flesh-and-blood": 62,
  "grand-archive":   74,
  "one-piece":       68,
  "pokemon":          3,
  "magic":            1,
} as const;

export type PriceSupportedGame = keyof typeof TCGPLAYER_CATEGORIES;

// ── Latest set helper (for HeroSlider) ───────────────────────────────────────

export interface LatestSetInfo {
  game: string;
  gameEmoji: string;
  categoryId: number;
  groupId: number;
  setName: string;
}

const GAME_EMOJI_MAP: Record<string, string> = {
  "grand-archive":   "⚔️",
  "flesh-and-blood": "🩸",
  "one-piece":       "🏴‍☠️",
  "pokemon":         "🎮",
};

/** Returns the latest published set for each game, cached for 24 h. */
export async function getLatestSets(): Promise<LatestSetInfo[]> {
  const games: Array<{ slug: string; emoji: string; categoryId: number }> = [
    { slug: "grand-archive",   emoji: "⚔️",  categoryId: 74 },
    { slug: "flesh-and-blood", emoji: "🩸",  categoryId: 62 },
    { slug: "one-piece",       emoji: "🏴‍☠️", categoryId: 68 },
    { slug: "pokemon",         emoji: "🎮",  categoryId: 3  },
  ];

  const results = await Promise.allSettled(
    games.map(async (g) => {
      const groups = await fetchGroups(g.categoryId);
      // Sort by publishedOn descending, skip supplementals
      const sorted = groups
        .filter(gr => !gr.isSupplemental)
        .sort((a, b) => new Date(b.publishedOn).getTime() - new Date(a.publishedOn).getTime());
      const latest = sorted[0];
      if (!latest) return null;
      return {
        game:       g.slug,
        gameEmoji:  g.emoji,
        categoryId: g.categoryId,
        groupId:    latest.groupId,
        setName:    latest.name,
      } satisfies LatestSetInfo;
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<LatestSetInfo | null> => r.status === "fulfilled")
    .map(r => r.value)
    .filter((r): r is LatestSetInfo => r !== null);
}
