import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getPriceMap, TCGPLAYER_CATEGORIES } from "@/lib/tcgplayer-prices";

/**
 * GET /api/market-dashboard
 *
 * Aggregates TCGPlayer market price data for the Market Dashboard page.
 * Uses two sources:
 *
 *  1. price_snapshots DB — historical daily prices (today + yesterday + 30d)
 *     Enables: % day change, 30-day high/low, trending cards.
 *
 *  2. getPriceMap() — live tcgcsv.com prices for the most recent sets of each
 *     game. Enables: current price, index value, volatility across tracked cards.
 *
 * Both sources reflect actual TCGPlayer market prices (transaction-based),
 * NOT community listing prices which are asking prices only.
 *
 * Response:
 * {
 *   updatedAt: string,            // ISO timestamp
 *   games: GameMarketData[],      // one per game, sorted by index desc
 *   globalIndex: number,          // sum of all game indexes (cents)
 *   totalCards: number,           // total distinct cards tracked today
 * }
 *
 * GameMarketData:
 * {
 *   game: string,
 *   label: string,
 *   emoji: string,
 *   accent: string,
 *   cardCount: number,
 *   avgPriceCents: number,
 *   medianPriceCents: number,
 *   indexCents: number,           // avg × count (market depth proxy)
 *   volatilityCv: number,         // coefficient of variation % across all cards
 *   spreadPct: number,            // (max - min) / avg × 100
 *   liquidityScore: number,       // 0–100
 *   dayChangePct: number | null,  // avg % change across all cards with yesterday data
 *   gainers: CardMove[],          // top 5 cards by day % gain
 *   losers: CardMove[],           // top 5 cards by day % loss (most negative first)
 *   topByPrice: CardMove[],       // top 8 cards by current price
 *   priceDistribution: number[],  // 8-bucket histogram of card prices
 *   high30d: number | null,       // highest single card price in last 30 days
 *   low30d: number | null,        // lowest single card price in last 30 days
 * }
 *
 * CardMove:
 * {
 *   cardName: string,
 *   priceCents: number,
 *   dayChangePct: number | null,
 *   tcgplayerId?: number,
 * }
 */

const sql = () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  return neon(url);
};

function todayStr() { return new Date().toISOString().slice(0, 10); }
function yesterdayStr() { return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10); }
function daysAgoStr(n: number) { return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10); }

// ── Financial helpers (server-side duplicates of client helpers) ──────────────

function mean(v: number[]) { return v.reduce((a, b) => a + b, 0) / v.length; }

function stdDev(v: number[]) {
  if (v.length < 2) return 0;
  const m = mean(v);
  return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length);
}

function cv(v: number[]) {
  const m = mean(v);
  return m > 0 ? (stdDev(v) / m) * 100 : 0;
}

function spreadPct(v: number[]) {
  if (v.length < 2) return 0;
  const m = mean(v);
  return m > 0 ? ((Math.max(...v) - Math.min(...v)) / m) * 100 : 0;
}

function liquidityScore(count: number, spread: number) {
  const countScore  = Math.min(count / 50, 1) * 60;         // up to 60 pts for 50+ cards
  const spreadScore = Math.max(0, 1 - spread / 500) * 40;   // up to 40 pts for tight spread
  return Math.round(countScore + spreadScore);
}

function median(v: number[]) {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

function histogram(values: number[], buckets = 8): number[] {
  if (values.length < 2) return Array(buckets).fill(0);
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const counts = Array(buckets).fill(0);
  for (const v of values) {
    const i = Math.min(buckets - 1, Math.floor(((v - min) / range) * buckets));
    counts[i]++;
  }
  return counts;
}

function percentile(values: number[], p: number): number {
  const s = [...values].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.floor((p / 100) * s.length));
  return s[idx];
}

function trendLabel(
  dayChangePct: number | null,
  avgCents?: number,
  low30d?: number | null,
  high30d?: number | null,
): "Rising" | "Falling" | "Stable" | "Unknown" {
  // Prefer day-over-day change
  if (dayChangePct != null) {
    if (dayChangePct >  2) return "Rising";
    if (dayChangePct < -2) return "Falling";
    return "Stable";
  }
  // Fallback: position within 30-day range
  if (avgCents != null && low30d != null && high30d != null) {
    const range = high30d - low30d;
    if (range <= 0) return "Stable";
    const position = (avgCents - low30d) / range; // 0 = at low, 1 = at high
    if (position > 0.7) return "Rising";
    if (position < 0.3) return "Falling";
    return "Stable";
  }
  return "Unknown";
}

function budgetLabel(avgCents: number): string {
  const avg = avgCents / 100;
  if (avg < 1)   return "Ultra-budget · avg under $1";
  if (avg < 3)   return "Budget-friendly · avg under $3";
  if (avg < 8)   return "Mid-range · avg under $8";
  if (avg < 20)  return "Premium · avg under $20";
  return "High-end · avg $20+";
}

/**
 * entryScore — 0-100 where the current avg price sits within the 30d range.
 * 0 = at the 30d low (great entry), 100 = at the 30d high (expensive).
 * Returns null if no 30d range data.
 */
function entryScore(avgCents: number, low30d: number | null, high30d: number | null): number | null {
  if (low30d == null || high30d == null) return null;
  const range = high30d - low30d;
  if (range <= 0) return 50;
  return Math.round(Math.min(100, Math.max(0, ((avgCents - low30d) / range) * 100)));
}

/**
 * buySignal — synthesized BUY / HOLD / SELL signal for the game as a whole.
 * Logic:
 *   STRONG BUY:  entryScore < 25 AND trend not Rising AND reprint risk low
 *   BUY:         entryScore < 40 OR (Falling trend and reprint risk low)
 *   HOLD:        entryScore 40-65 OR Unknown trend
 *   SELL:        entryScore > 65 OR (Rising trend and reprint risk high)
 *   STRONG SELL: entryScore > 80 AND Rising trend
 */
function computeBuySignal(
  score: number | null,
  trend: "Rising" | "Falling" | "Stable" | "Unknown",
  reprintRiskCount: number,
  sellPressure: number,
): { signal: "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell"; reason: string } {
  const s = score ?? 50;
  const highRisk = reprintRiskCount >= 3;

  if (s <= 20 && trend !== "Rising" && !highRisk)
    return { signal: "Strong Buy", reason: `Prices near 30-day low — historically a good entry point. ${trend === "Falling" ? "Ongoing dip may deepen further." : "Momentum is neutral."}` };

  if ((s <= 35 && !highRisk) || (trend === "Falling" && s <= 50 && !highRisk))
    return { signal: "Buy", reason: `Prices are below their recent average. ${sellPressure > 0.6 ? "More sellers than buyers today." : ""} Consider picking up singles you need.` };

  if (s >= 80 && trend === "Rising")
    return { signal: "Strong Sell", reason: `Prices at 30-day highs and still climbing — peak risk zone. If you own key singles, now is a strong time to move them.` };

  if (s >= 65 || (trend === "Rising" && highRisk))
    return { signal: "Sell", reason: `Prices are above their recent average. ${highRisk ? `${reprintRiskCount} key cards have reprint risk — value could drop.` : "Good time to list singles you're willing to part with."}` };

  return { signal: "Hold", reason: `Prices are in the middle of their recent range. ${trend === "Unknown" ? "Not enough data to give a strong signal." : "No obvious entry or exit pressure right now."}` };
}

import type { CardPriceData } from "@/lib/tcgplayer-prices";

// ── Shared output types ───────────────────────────────────────────────────────

interface CardMove {
  cardName: string;
  priceCents: number;
  dayChangePct: number | null;
  tcgplayerId?: number;
}

interface PriceTiers {
  p10: number;   // budget singles (10th percentile)
  p25: number;   // common singles (25th percentile)
  p75: number;   // staple singles (75th percentile)
  p90: number;   // chase singles (90th percentile)
}

// Priced output for a single meta deck card
interface MetaDeckCardPriced {
  name: string;
  qty: number;
  unitCents: number;   // TCGPlayer market price per copy
  totalCents: number;  // qty × unitCents
  found: boolean;      // false if card not in current price map
}

// Priced meta deck — for the "How much is a competitive deck?" section
interface MetaDeck {
  archetype: string;
  format: string;
  totalCents: number;       // sum of all priced cards (missing = $0)
  foundCards: number;       // # cards that had a price
  totalCards: number;       // total distinct card names in the deck def
  cards: MetaDeckCardPriced[];
}

interface GameMarketData {
  game: string;
  label: string;
  emoji: string;
  accent: string;
  cardCount: number;
  avgPriceCents: number;
  medianPriceCents: number;
  indexCents: number;
  volatilityCv: number;
  spreadPct: number;
  liquidityScore: number;
  dayChangePct: number | null;
  gainers: CardMove[];
  losers: CardMove[];
  topByPrice: CardMove[];
  priceDistribution: number[];
  high30d: number | null;
  low30d: number | null;
  // Player-friendly derived fields
  trendLabel: "Rising" | "Falling" | "Stable" | "Unknown";
  budgetLabel: string;
  priceTiers: PriceTiers;
  reprintRiskCount: number;
  metaDecks: MetaDeck[];
  // Market analysis signals
  entryScore: number | null;          // 0=near 30d low (good buy), 100=near 30d high (expensive)
  buySignal: "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell";
  buySignalReason: string;
  concentrationPct: number;           // % of total market value in top 10 cards (0-100)
  sellPressure: number;               // 0-1: share of movers that are losers today
  gainersCount: number;
  losersCount: number;
}

// ── Meta deck registry ────────────────────────────────────────────────────────
// Key singles for known competitive archetypes. Card names must match the
// lower-cased names returned by getPriceMap (tcgcsv product cleanName).
// Each entry lists the most expensive / most-played singles — not the full 60.
// Quantities reflect typical playset counts so the total is a realistic budget.

interface MetaDeckCard {
  name: string;    // lower-case, matches price map key
  qty: number;     // typical copies in a competitive list
}

interface MetaDeckDef {
  archetype: string;
  format: string;
  cards: MetaDeckCard[];
}

const META_DECKS: Record<string, MetaDeckDef[]> = {
  "pokemon": [
    {
      archetype: "Charizard ex",
      format: "Standard",
      cards: [
        { name: "charizard ex",           qty: 3 },
        { name: "charmander",             qty: 4 },
        { name: "charmeleon",             qty: 2 },
        { name: "pidgeot ex",             qty: 2 },
        { name: "pidgey",                 qty: 4 },
        { name: "radiant charizard",      qty: 1 },
        { name: "rare candy",             qty: 4 },
        { name: "arven",                  qty: 4 },
      ],
    },
    {
      archetype: "Gardevoir ex",
      format: "Standard",
      cards: [
        { name: "gardevoir ex",           qty: 3 },
        { name: "kirlia",                 qty: 4 },
        { name: "ralts",                  qty: 4 },
        { name: "zacian v",               qty: 2 },
        { name: "cresselia",              qty: 2 },
        { name: "buddy-buddy poffin",     qty: 4 },
        { name: "level ball",             qty: 4 },
      ],
    },
    {
      archetype: "Regidrago VSTAR",
      format: "Standard",
      cards: [
        { name: "regidrago vstar",        qty: 3 },
        { name: "regidrago v",            qty: 4 },
        { name: "giratina vstar",         qty: 1 },
        { name: "giratina v",             qty: 2 },
        { name: "comfey",                 qty: 4 },
        { name: "colress's experiment",   qty: 4 },
      ],
    },
  ],
  "magic": [
    {
      archetype: "Domain Ramp (Modern)",
      format: "Modern",
      cards: [
        { name: "arid mesa",              qty: 4 },
        { name: "misty rainforest",       qty: 4 },
        { name: "omnath, locus of creation", qty: 4 },
        { name: "leyline binding",        qty: 4 },
        { name: "triome",                 qty: 1 },
        { name: "up the beanstalk",       qty: 4 },
        { name: "sunbaked canyon",        qty: 2 },
      ],
    },
    {
      archetype: "Mono-Red Burn (Standard)",
      format: "Standard",
      cards: [
        { name: "slickshot show-off",     qty: 4 },
        { name: "manifold mouse",         qty: 4 },
        { name: "monstrous rage",         qty: 4 },
        { name: "emberheart challenger",  qty: 4 },
        { name: "questing druid",         qty: 2 },
      ],
    },
  ],
  "flesh-and-blood": [
    {
      archetype: "Briar (Classic Constructed)",
      format: "Classic Constructed",
      cards: [
        { name: "briar",                  qty: 1 },
        { name: "oasis respite",          qty: 3 },
        { name: "embodied earth",         qty: 3 },
        { name: "bramble rider",          qty: 3 },
        { name: "sink below",             qty: 3 },
        { name: "sigil of solstice",      qty: 3 },
      ],
    },
    {
      archetype: "Fai (Classic Constructed)",
      format: "Classic Constructed",
      cards: [
        { name: "fai, rising rebellion",  qty: 1 },
        { name: "phoenix flame",          qty: 3 },
        { name: "brand with cinderclaw",  qty: 3 },
        { name: "compounding anger",      qty: 3 },
        { name: "art of the dragon: fire", qty: 3 },
        { name: "snatch",                 qty: 3 },
      ],
    },
  ],
  "one-piece": [
    {
      archetype: "Luffy OP01",
      format: "Standard",
      cards: [
        { name: "monkey d. luffy",        qty: 4 },
        { name: "portgas d. ace",         qty: 4 },
        { name: "sabo",                   qty: 4 },
        { name: "marco",                  qty: 4 },
        { name: "shanks",                 qty: 2 },
      ],
    },
    {
      archetype: "Zoro OP06",
      format: "Standard",
      cards: [
        { name: "roronoa zoro",           qty: 4 },
        { name: "sanji",                  qty: 4 },
        { name: "nami",                   qty: 4 },
        { name: "zoro and sanji",         qty: 3 },
      ],
    },
  ],
  "grand-archive": [
    {
      archetype: "Lorraine Crux Knight",
      format: "Constructed",
      cards: [
        { name: "lorraine, blademaster",  qty: 1 },
        { name: "arcanite rapier",        qty: 3 },
        { name: "knight's valor",         qty: 3 },
        { name: "divine blade",           qty: 3 },
        { name: "brilliant edge",         qty: 3 },
      ],
    },
  ],
};

// ── Game metadata ─────────────────────────────────────────────────────────────

const GAME_META: Record<string, { label: string; emoji: string; accent: string }> = {
  "flesh-and-blood": { label: "Flesh and Blood", emoji: "⚔️",  accent: "#0284c7" },
  "grand-archive":   { label: "Grand Archive",   emoji: "📖",  accent: "#0f766e" },
  "one-piece":       { label: "One Piece",        emoji: "🏴‍☠️", accent: "#b45309" },
  "pokemon":         { label: "Pokémon",           emoji: "⚡",  accent: "#16a34a" },
  "magic":           { label: "Magic",             emoji: "🔮",  accent: "#7c3aed" },
};

// ── Main route ────────────────────────────────────────────────────────────────

export const revalidate = 3600; // ISR: regenerate at most once per hour

export async function GET() {
  const today     = todayStr();
  const yesterday = yesterdayStr();
  const day30ago  = daysAgoStr(30);

  // ── 1. Load live TCGPlayer prices for all games ───────────────────────────
  // getPriceMap already handles caching + DB upsert internally.
  const gameSlugs = Object.keys(TCGPLAYER_CATEGORIES) as (keyof typeof TCGPLAYER_CATEGORIES)[];

  const priceMaps = await Promise.allSettled(
    gameSlugs.map(game =>
      getPriceMap(game, TCGPLAYER_CATEGORIES[game], 10).then(m => ({ game, map: m }))
    )
  );

  // ── 2. Load yesterday's snapshot prices from DB for % change ─────────────
  // (getPriceMap already computed dayChangePct per card, but we also want
  //  30d high/low which requires a separate DB query.)
  let db30dRows: Array<{ game: string; card_name: string; price_cents: number; recorded_date: string }> = [];
  try {
    const db = sql();
    const rows = await db`
      SELECT lower(game) AS game,
             lower(card_name) AS card_name,
             price_cents,
             recorded_date::text AS recorded_date
      FROM price_snapshots
      WHERE recorded_date >= ${day30ago}::date
        AND recorded_date <= ${today}::date
      ORDER BY recorded_date ASC
    `;
    db30dRows = rows as typeof db30dRows;
  } catch (err) {
    console.warn("[market-dashboard] 30d snapshot query failed:", err);
  }

  // Build per-(game, card) 30d high/low
  const thirtyDayRange = new Map<string, { high: number; low: number }>();
  for (const row of db30dRows) {
    const key = `${row.game}::${row.card_name}`;
    const existing = thirtyDayRange.get(key);
    if (!existing) {
      thirtyDayRange.set(key, { high: row.price_cents, low: row.price_cents });
    } else {
      if (row.price_cents > existing.high) existing.high = row.price_cents;
      if (row.price_cents < existing.low)  existing.low  = row.price_cents;
    }
  }

  // ── 3. Build per-game stats ───────────────────────────────────────────────
  const games: GameMarketData[] = [];

  for (const result of priceMaps) {
    if (result.status !== "fulfilled") continue;
    const { game, map } = result.value;
    const meta = GAME_META[game] ?? { label: game, emoji: "🃏", accent: "#6b7280" };

    // Only include cards with a valid price
    const entries: [string, CardPriceData][] = [...map.entries()].filter(([, v]) => v.marketPriceCents > 0);
    if (entries.length === 0) continue;

    const prices = entries.map(([, v]) => v.marketPriceCents);
    const spread = spreadPct(prices);
    const liq    = liquidityScore(entries.length, spread);

    // Day movers — cards that have both today and yesterday prices
    type EntryWithChange = [string, CardPriceData & { priceChangePct: number }];
    const withChange: EntryWithChange[] = entries.filter(
      (e): e is EntryWithChange => e[1].priceChangePct != null
    );

    const avgDayChangePct = withChange.length > 0
      ? withChange.reduce((s, [, v]) => s + v.priceChangePct, 0) / withChange.length
      : null;

    const sorted = [...withChange].sort((a, b) => b[1].priceChangePct - a[1].priceChangePct);

    const toCardMove = ([name, v]: [string, CardPriceData]): CardMove => ({
      cardName:     name,
      priceCents:   v.marketPriceCents,
      dayChangePct: v.priceChangePct ?? null,
      tcgplayerId:  v.tcgplayerId,
    });

    const gainers    = sorted.filter(([, v]) => v.priceChangePct > 0).slice(0, 5).map(toCardMove);
    const losers     = sorted.filter(([, v]) => v.priceChangePct < 0).slice(-5).reverse().map(toCardMove);
    const topByPrice = [...entries]
      .sort((a, b) => b[1].marketPriceCents - a[1].marketPriceCents)
      .slice(0, 8)
      .map(toCardMove);

    // 30d high/low (max across all cards in this game)
    let high30d: number | null = null;
    let low30d:  number | null = null;
    for (const [name] of entries) {
      const range = thirtyDayRange.get(`${game}::${name}`);
      if (!range) continue;
      if (high30d == null || range.high > high30d) high30d = range.high;
      if (low30d  == null || range.low  < low30d)  low30d  = range.low;
    }

    const avgPrice = Math.round(mean(prices));
    const avgDayChg = avgDayChangePct != null ? Math.round(avgDayChangePct * 10) / 10 : null;

    // Reprint risk count among top-priced cards
    const { getReprintRisk } = await import("@/lib/reprint-risk");
    const reprintRiskCount = topByPrice.filter(c => getReprintRisk(c.cardName) != null).length;

    // Price known meta decks using the live price map
    const deckDefs = META_DECKS[game] ?? [];
    const metaDecks: MetaDeck[] = deckDefs.map(def => {
      let totalCents = 0;
      let foundCards = 0;
      const pricedCards: MetaDeckCardPriced[] = def.cards.map(c => {
        const priceData = map.get(c.name);
        const unitCents = priceData?.marketPriceCents ?? 0;
        const found = unitCents > 0;
        if (found) { totalCents += unitCents * c.qty; foundCards++; }
        return { name: c.name, qty: c.qty, unitCents, totalCents: unitCents * c.qty, found };
      });
      return {
        archetype:  def.archetype,
        format:     def.format,
        totalCents,
        foundCards,
        totalCards: def.cards.length,
        cards:      pricedCards,
      };
    });

    // ── Market analysis signals ────────────────────────────────────────────
    const score        = entryScore(avgPrice, low30d, high30d);
    const trend        = trendLabel(avgDayChg, avgPrice, low30d, high30d);
    const totalMovers  = gainers.length + losers.length;
    const sellPressure = totalMovers > 0 ? Math.round((losers.length / totalMovers) * 100) / 100 : 0.5;

    // Market concentration: % of total index value in top-10 cards
    const top10Value = topByPrice
      .slice(0, 10)
      .reduce((s, c) => s + c.priceCents, 0);
    const totalValue   = prices.reduce((s, p) => s + p, 0);
    const concentrationPct = totalValue > 0
      ? Math.round((top10Value / totalValue) * 100)
      : 0;

    const { signal: buySignal, reason: buySignalReason } = computeBuySignal(
      score, trend, reprintRiskCount, sellPressure
    );

    games.push({
      game,
      label:            meta.label,
      emoji:            meta.emoji,
      accent:           meta.accent,
      cardCount:        entries.length,
      avgPriceCents:    avgPrice,
      medianPriceCents: Math.round(median(prices)),
      indexCents:       Math.round(avgPrice * entries.length),
      volatilityCv:     Math.round(cv(prices) * 10) / 10,
      spreadPct:        Math.round(spread * 10) / 10,
      liquidityScore:   liq,
      dayChangePct:     avgDayChg,
      gainers,
      losers,
      topByPrice,
      priceDistribution: histogram(prices),
      high30d,
      low30d,
      trendLabel:       trend,
      budgetLabel:      budgetLabel(avgPrice),
      priceTiers: {
        p10: Math.round(percentile(prices, 10)),
        p25: Math.round(percentile(prices, 25)),
        p75: Math.round(percentile(prices, 75)),
        p90: Math.round(percentile(prices, 90)),
      },
      reprintRiskCount,
      metaDecks,
      entryScore:       score,
      buySignal,
      buySignalReason,
      concentrationPct,
      sellPressure,
      gainersCount:     gainers.length,
      losersCount:      losers.length,
    });
  }

  games.sort((a, b) => b.indexCents - a.indexCents);

  const globalIndex  = games.reduce((s, g) => s + g.indexCents, 0);
  const totalCards   = games.reduce((s, g) => s + g.cardCount, 0);

  return NextResponse.json(
    { updatedAt: new Date().toISOString(), games, globalIndex, totalCards },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600" } }
  );
}
