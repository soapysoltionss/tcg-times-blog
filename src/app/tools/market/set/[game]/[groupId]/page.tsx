"use client";

/**
 * /tools/market/set/[game]/[groupId]
 *
 * Shows the full card list for a specific set with:
 *  - TCGPlayer prices (market price via tcgcsv.com)
 *  - Price change % vs yesterday
 *  - Reprint risk badges
 *  - Market insights panel: top movers, avg price, total listings
 *
 * Route: /tools/market/set/grand-archive/1234
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { REPRINT_RISK_STYLE, REPRINT_RISK_LABEL, getReprintRisk } from "@/lib/reprint-risk";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SetCard {
  productId: number;
  name: string;
  cleanName: string;
  number?: string;
  rarity?: string;
  imageUrl?: string;
  marketPriceCents: number | null;
  midPriceCents: number | null;
  subTypeName: string;
}

interface SetInfo {
  groupId: number;
  name: string;
  game: string;
  categoryId: number;
  publishedOn: string;
  totalCards: number;
  cards: SetCard[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const GAME_META: Record<string, { label: string; emoji: string; categoryId: number }> = {
  "grand-archive":   { label: "Grand Archive",   emoji: "⚔️",  categoryId: 74 },
  "flesh-and-blood": { label: "Flesh and Blood",  emoji: "🩸",  categoryId: 62 },
  "one-piece":       { label: "One Piece TCG",    emoji: "🏴‍☠️", categoryId: 68 },
  "pokemon":         { label: "Pokémon TCG",      emoji: "🎮",  categoryId: 3  },
};

function fmt(cents: number | null) {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

function PriceChangePill({ pct }: { pct: number | null }) {
  if (pct == null) return null;
  const up = pct >= 0;
  return (
    <span className={`label-upper text-[9px] px-1.5 py-0.5 font-bold ${up ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"}`}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function SetDetailPage({ params }: { params: { game: string; groupId: string } }) {
  const { game, groupId } = params;
  const meta = GAME_META[game];

  const [setInfo, setSetInfo]   = useState<SetInfo | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState("");
  const [search,  setSearch]    = useState("");
  const [sort,    setSort]      = useState<"name" | "price-hi" | "price-lo">("price-hi");

  useEffect(() => {
    if (!meta) return;
    fetch(`/api/market-set?game=${game}&groupId=${groupId}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((d: SetInfo) => { setSetInfo(d); setLoading(false); })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, [game, groupId, meta]);

  if (!meta) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-16 text-center">
        <p className="text-[var(--text-muted)]">Unknown game: {game}</p>
        <Link href="/tools/market" className="label-upper text-xs underline mt-4 inline-block">← Market</Link>
      </div>
    );
  }

  // Filter + sort
  const filtered = (setInfo?.cards ?? [])
    .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === "price-hi") return (b.marketPriceCents ?? 0) - (a.marketPriceCents ?? 0);
      if (sort === "price-lo") return (a.marketPriceCents ?? 0) - (b.marketPriceCents ?? 0);
      return a.name.localeCompare(b.name);
    });

  // Market insights from cards with prices
  const priced = (setInfo?.cards ?? []).filter(c => c.marketPriceCents != null);
  const avgPriceCents = priced.length > 0
    ? Math.round(priced.reduce((s, c) => s + (c.marketPriceCents ?? 0), 0) / priced.length)
    : null;
  const topMovers = [...priced]
    .sort((a, b) => (b.marketPriceCents ?? 0) - (a.marketPriceCents ?? 0))
    .slice(0, 5);

  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-10 py-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-8">
        <Link href="/tools/market" className="hover:text-[var(--foreground)] transition-colors">Market</Link>
        <span>›</span>
        <span>{meta.emoji} {meta.label}</span>
        {setInfo && (
          <>
            <span>›</span>
            <span className="text-[var(--foreground)]">{setInfo.name}</span>
          </>
        )}
      </div>

      {loading ? (
        <div className="py-32 text-center text-[var(--text-muted)]">
          <div className="w-8 h-8 border-2 border-[var(--border)] border-t-[var(--foreground)] rounded-full animate-spin mx-auto mb-4" />
          Loading set data…
        </div>
      ) : error ? (
        <div className="py-16 text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Link href="/tools/market" className="label-upper text-xs underline">← Back to Market</Link>
        </div>
      ) : setInfo && (
        <>
          {/* Set header */}
          <div className="border-b-2 border-[var(--border-strong)] pb-6 mb-8">
            <p className="label-upper text-[var(--text-muted)] mb-1">{meta.emoji} {meta.label} · Latest Release</p>
            <h1
              className="text-4xl font-black text-[var(--foreground)] leading-none mb-2"
              style={{ fontFamily: "var(--font-serif, serif)" }}
            >
              {setInfo.name}
            </h1>
            <p className="text-sm text-[var(--text-muted)]">
              {setInfo.totalCards} cards · Published {new Date(setInfo.publishedOn).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>

          <div className="grid lg:grid-cols-[1fr_300px] gap-8">
            {/* ── Left: Card list ─────────────────────────────────────── */}
            <div>
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <input
                  type="text"
                  placeholder="Search cards…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="flex-1 min-w-[180px] border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--foreground)] transition-colors"
                />
                <div className="flex items-center gap-1">
                  {(["price-hi", "price-lo", "name"] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setSort(s)}
                      className={`label-upper text-[10px] px-3 py-1.5 border transition-colors ${sort === s ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]" : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)]"}`}
                    >
                      {s === "price-hi" ? "Price ↓" : s === "price-lo" ? "Price ↑" : "Name A–Z"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Card table */}
              <div className="border border-[var(--border)] overflow-hidden">
                {/* Header row */}
                <div className="grid grid-cols-[auto_1fr_auto_auto] gap-0 border-b border-[var(--border-strong)] bg-[var(--muted)] px-4 py-2">
                  <span className="label-upper text-[9px] text-[var(--text-muted)] w-8" />
                  <span className="label-upper text-[9px] text-[var(--text-muted)]">Card</span>
                  <span className="label-upper text-[9px] text-[var(--text-muted)] text-right pr-4">Foil Type</span>
                  <span className="label-upper text-[9px] text-[var(--text-muted)] text-right">Market Price</span>
                </div>

                {filtered.length === 0 ? (
                  <div className="py-10 text-center text-[var(--text-muted)] text-sm">No cards found</div>
                ) : (
                  filtered.map((card, i) => {
                    const risk = getReprintRisk(card.name);
                    return (
                      <div
                        key={`${card.productId}-${card.subTypeName}`}
                        className={`grid grid-cols-[auto_1fr_auto_auto] gap-0 items-center px-4 py-3 ${i % 2 === 0 ? "bg-[var(--background)]" : "bg-[var(--muted)]/30"} hover:bg-[var(--muted)] transition-colors`}
                      >
                        {/* Thumbnail */}
                        <div className="w-8 h-11 mr-3 shrink-0 bg-[var(--muted)] border border-[var(--border)] overflow-hidden">
                          {card.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={card.imageUrl} alt={card.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[8px] text-[var(--text-muted)]">?</div>
                          )}
                        </div>

                        {/* Name + rarity */}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--foreground)] truncate">{card.name}</p>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            {card.rarity && (
                              <span className="label-upper text-[9px] text-[var(--text-muted)]">{card.rarity}</span>
                            )}
                            {risk && (
                              <span className={`label-upper text-[8px] px-1 py-px border ${REPRINT_RISK_STYLE[risk.risk]}`}>
                                {REPRINT_RISK_LABEL[risk.risk]}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Foil type */}
                        <span className="label-upper text-[10px] text-[var(--text-muted)] pr-6 whitespace-nowrap">{card.subTypeName}</span>

                        {/* Price */}
                        <div className="text-right">
                          <span className="label-upper text-sm font-bold text-[var(--foreground)]">
                            {fmt(card.marketPriceCents)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <p className="text-xs text-[var(--text-muted)] mt-3">
                Prices sourced from TCGPlayer via tcgcsv.com · Updated daily
              </p>
            </div>

            {/* ── Right: Market Insights sidebar ─────────────────────── */}
            <aside className="flex flex-col gap-5">
              {/* Set summary */}
              <div className="border border-[var(--border)] p-5">
                <h2 className="label-upper text-xs text-[var(--text-muted)] mb-3">Set Summary</h2>
                <div className="flex flex-col gap-3">
                  {[
                    { label: "Total Cards",     value: String(setInfo.totalCards) },
                    { label: "Cards w/ Prices", value: String(priced.length) },
                    { label: "Avg Market Price", value: fmt(avgPriceCents) },
                    { label: "Highest Card",    value: fmt(topMovers[0]?.marketPriceCents ?? null) },
                  ].map(s => (
                    <div key={s.label} className="flex items-baseline justify-between gap-2 border-b border-[var(--border)] pb-2 last:border-0 last:pb-0">
                      <span className="label-upper text-[10px] text-[var(--text-muted)]">{s.label}</span>
                      <span className="label-upper text-[11px] font-bold text-[var(--foreground)]">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top movers */}
              {topMovers.length > 0 && (
                <div className="border border-[var(--border)] p-5">
                  <h2 className="label-upper text-xs text-[var(--text-muted)] mb-3">
                    🔥 Top Cards by Price
                  </h2>
                  <div className="flex flex-col gap-3">
                    {topMovers.map((card, i) => (
                      <div key={card.productId} className="flex items-center gap-2">
                        <span className="label-upper text-[10px] text-[var(--text-muted)] w-4 shrink-0">
                          {i + 1}
                        </span>
                        <div className="w-6 h-8 shrink-0 bg-[var(--muted)] border border-[var(--border)] overflow-hidden">
                          {card.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={card.imageUrl} alt={card.name} className="w-full h-full object-cover" />
                          ) : null}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-[var(--foreground)] truncate">{card.name}</p>
                          <p className="label-upper text-[9px] text-[var(--text-muted)]">{card.subTypeName}</p>
                        </div>
                        <span className="label-upper text-[10px] font-bold text-[var(--foreground)] shrink-0">
                          {fmt(card.marketPriceCents)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Market insights note */}
              <div className="border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
                <p className="label-upper text-[10px] text-amber-700 dark:text-amber-300 mb-1.5">
                  📊 Market Insights — Coming Soon
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-200 leading-relaxed">
                  Full market insights — including community sentiment from forums, Reddit discussion trends,
                  and price history charts — are being built and will appear here automatically once
                  the data pipeline is live.
                </p>
                <Link
                  href="/tools/market"
                  className="label-upper text-[10px] text-amber-700 dark:text-amber-300 underline underline-offset-2 mt-2 inline-block hover:opacity-70"
                >
                  View market index →
                </Link>
              </div>

              {/* TCGPlayer link */}
              <div className="border border-[var(--border)] p-4 flex flex-col gap-2">
                <p className="label-upper text-[10px] text-[var(--text-muted)]">Price source</p>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  All prices are sourced from <strong className="text-[var(--foreground)]">TCGPlayer</strong> via
                  the tcgcsv.com daily mirror. Prices update once per day.
                </p>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
