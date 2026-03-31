"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Listing } from "@/types/post";
import { REPRINT_RISK_STYLE, REPRINT_RISK_LABEL, getReprintRisk } from "@/lib/reprint-risk";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GameStats {
  game: string;
  label: string;
  emoji: string;
  totalListings: number;
  avgPriceCents: number;
  lowestPriceCents: number;
  highestPriceCents: number;
  /** Weighted index value: avg price × listing count (proxy for "market cap") */
  indexValue: number;
  topCards: CardStat[];
}

interface CardStat {
  cardName: string;
  setName: string;
  game: string;
  latestPriceCents: number;
  listingCount: number;
  imageUrl?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

const GAME_META: Record<string, { label: string; emoji: string }> = {
  "flesh-and-blood": { label: "Flesh and Blood", emoji: "⚔️" },
  "grand-archive":   { label: "Grand Archive",   emoji: "📖" },
  "one-piece":       { label: "One Piece",        emoji: "🏴‍☠️" },
  "pokemon":         { label: "Pokémon",           emoji: "⚡" },
  "magic":           { label: "Magic: The Gathering", emoji: "🔮" },
  "other":           { label: "Other",            emoji: "🃏" },
};

function buildGameStats(listings: Listing[]): GameStats[] {
  const byGame = new Map<string, Listing[]>();
  for (const l of listings) {
    if (!byGame.has(l.game)) byGame.set(l.game, []);
    byGame.get(l.game)!.push(l);
  }

  const stats: GameStats[] = [];

  for (const [game, gameListing] of byGame.entries()) {
    if (gameListing.length === 0) continue;
    const prices = gameListing.map((l) => l.priceCents);
    const avgPriceCents = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
    const lowestPriceCents = Math.min(...prices);
    const highestPriceCents = Math.max(...prices);

    // Group by card name to find top movers
    const byCard = new Map<string, Listing[]>();
    for (const l of gameListing) {
      const key = l.cardName.toLowerCase();
      if (!byCard.has(key)) byCard.set(key, []);
      byCard.get(key)!.push(l);
    }

    const topCards: CardStat[] = Array.from(byCard.entries())
      .map(([, cardListings]) => {
        const sorted = [...cardListings].sort((a, b) => b.priceCents - a.priceCents);
        const top = sorted[0];
        return {
          cardName: top.cardName,
          setName: top.setName,
          game,
          latestPriceCents: top.priceCents,
          listingCount: cardListings.length,
          imageUrl: top.imageUrl,
        };
      })
      .sort((a, b) => b.latestPriceCents - a.latestPriceCents)
      .slice(0, 5);

    const meta = GAME_META[game] ?? { label: game, emoji: "🃏" };

    stats.push({
      game,
      label: meta.label,
      emoji: meta.emoji,
      totalListings: gameListing.length,
      avgPriceCents,
      lowestPriceCents,
      highestPriceCents,
      indexValue: avgPriceCents * gameListing.length,
      topCards,
    });
  }

  return stats.sort((a, b) => b.indexValue - a.indexValue);
}

// ---------------------------------------------------------------------------
// Index card (per game)
// ---------------------------------------------------------------------------

function GameIndexCard({ stats }: { stats: GameStats }) {
  return (
    <div className="border border-[var(--border)] bg-[var(--background)] p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="text-2xl">{stats.emoji}</span>
          <h2 className="font-black text-lg text-[var(--foreground)] leading-tight mt-1" style={{ fontFamily: "var(--font-serif, serif)" }}>
            {stats.label}
          </h2>
          <p className="label-upper text-[10px] text-[var(--text-muted)]">{stats.totalListings} active listing{stats.totalListings !== 1 ? "s" : ""}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="label-upper text-[10px] text-[var(--text-muted)] mb-0.5">Avg Price</p>
          <p className="text-2xl font-black text-[var(--foreground)]" style={{ fontFamily: "var(--font-serif, serif)" }}>
            {formatPrice(stats.avgPriceCents)}
          </p>
        </div>
      </div>

      {/* Mini stats row */}
      <div className="grid grid-cols-3 gap-px bg-[var(--border)]">
        {[
          { label: "Lowest", value: formatPrice(stats.lowestPriceCents) },
          { label: "Highest", value: formatPrice(stats.highestPriceCents) },
          { label: "Index", value: formatPrice(stats.indexValue) },
        ].map((s) => (
          <div key={s.label} className="bg-[var(--muted)] p-2.5 text-center">
            <p className="label-upper text-[9px] text-[var(--text-muted)]">{s.label}</p>
            <p className="label-upper text-[11px] font-bold text-[var(--foreground)]">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Top cards */}
      {stats.topCards.length > 0 && (
        <div>
          <p className="label-upper text-[10px] text-[var(--text-muted)] mb-2">Top by Price</p>
          <div className="flex flex-col gap-1.5">
            {stats.topCards.map((card) => {
              const risk = getReprintRisk(card.cardName);
              return (
                <Link
                  key={card.cardName}
                  href={`/marketplace?search=${encodeURIComponent(card.cardName)}`}
                  className="flex items-center gap-3 hover:bg-[var(--muted)] px-2 py-1.5 -mx-2 transition-colors group"
                >
                  {/* Thumbnail */}
                  <div className="w-7 h-9 shrink-0 bg-[var(--muted)] border border-[var(--border)] overflow-hidden">
                    {card.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={card.imageUrl} alt={card.cardName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[8px] text-[var(--text-muted)]">?</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[var(--foreground)] truncate group-hover:underline">
                      {card.cardName}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="label-upper text-[9px] text-[var(--text-muted)] truncate">{card.setName}</p>
                      {risk && (
                        <span className={`label-upper text-[8px] px-1 py-px border ${REPRINT_RISK_STYLE[risk.risk]}`}>
                          {REPRINT_RISK_LABEL[risk.risk]}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="label-upper text-[10px] font-bold text-[var(--foreground)] shrink-0">
                    {formatPrice(card.latestPriceCents)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function MarketPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/marketplace?marketplace=community")
      .then((r) => r.json())
      .then((d) => setListings(d.listings ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const gameStats = buildGameStats(listings);

  // Overall index = sum of all game index values
  const totalIndex = gameStats.reduce((s, g) => s + g.indexValue, 0);
  const totalListings = gameStats.reduce((s, g) => s + g.totalListings, 0);
  const allPrices = listings.map((l) => l.priceCents);
  const globalAvg = allPrices.length > 0
    ? Math.round(allPrices.reduce((a, b) => a + b, 0) / allPrices.length)
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10">
      {/* Header */}
      <div className="border-b-2 border-[var(--border-strong)] pb-6 mb-8">
        <p className="label-upper text-[var(--text-muted)] mb-1">TCG Times Tools</p>
        <h1
          className="text-4xl font-black text-[var(--foreground)] leading-none mb-3"
          style={{ fontFamily: "var(--font-serif, serif)" }}
        >
          Market Index
        </h1>
        <p className="text-sm text-[var(--text-muted)] max-w-2xl">
          A weighted price index across all active TCG Times community listings.
          Index value = average price × listing count per game — a proxy for total market depth.
        </p>
      </div>

      {/* Global stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[var(--border)] mb-10">
        {[
          { label: "Total Index", value: loading ? "…" : formatPrice(totalIndex), sub: "all games combined" },
          { label: "Active Listings", value: loading ? "…" : String(totalListings), sub: "community marketplace" },
          { label: "Avg Card Price", value: loading ? "…" : formatPrice(globalAvg), sub: "across all games" },
          { label: "Games Tracked", value: loading ? "…" : String(gameStats.length), sub: "with active listings" },
        ].map((s) => (
          <div key={s.label} className="bg-[var(--background)] p-5">
            <p className="label-upper text-[10px] text-[var(--text-muted)] mb-1">{s.label}</p>
            <p className="text-3xl font-black text-[var(--foreground)]" style={{ fontFamily: "var(--font-serif, serif)" }}>
              {s.value}
            </p>
            <p className="label-upper text-[9px] text-[var(--text-muted)] mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Index disclaimer */}
      <div className="mb-8 p-4 border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
        <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
          <strong>Index methodology:</strong> Prices reflect active community listings on TCG Times only —
          not completed sales. Index value is <em>average listing price × number of listings</em>, a proxy for
          market depth, not true market cap. Real transaction history will replace this once sales data is
          recorded (Roadmap 8a).
        </p>
      </div>

      {/* Per-game cards */}
      {loading ? (
        <div className="flex justify-center py-20">
          <span className="w-6 h-6 border-2 border-[var(--border)] border-t-[var(--foreground)] rounded-full animate-spin" />
        </div>
      ) : gameStats.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-[var(--border)]">
          <p className="label-upper text-[var(--text-muted)] mb-2">No listings yet</p>
          <Link href="/marketplace" className="label-upper text-sm underline underline-offset-2 hover:opacity-70">
            List a card →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {gameStats.map((s) => <GameIndexCard key={s.game} stats={s} />)}
        </div>
      )}

      {/* Box EV CTA */}
      <div className="mt-12 border border-[var(--border)] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="label-upper text-[10px] text-[var(--text-muted)] mb-1">Tool</p>
          <h2 className="font-black text-xl text-[var(--foreground)]" style={{ fontFamily: "var(--font-serif, serif)" }}>
            Box EV Calculator
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Calculate the expected value of opening a sealed box based on current card prices.
          </p>
        </div>
        <Link
          href="/tools/market/box-ev"
          className="label-upper px-6 py-3 bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 transition-opacity shrink-0 text-[11px]"
        >
          Open Calculator →
        </Link>
      </div>

      {/* Nav */}
      <div className="mt-8 flex flex-wrap gap-4">
        <Link href="/marketplace" className="label-upper text-[10px] text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors">
          ← Marketplace
        </Link>
        <Link href="/tools" className="label-upper text-[10px] text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors">
          ← All Tools
        </Link>
      </div>
    </div>
  );
}
