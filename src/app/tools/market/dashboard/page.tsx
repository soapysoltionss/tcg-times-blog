"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CardMover {
  cardName: string;
  game: string;
  lastPrice: number;
  volume7d: number;
  change7dPct: number | null;
}

interface CardTraded {
  cardName: string;
  game: string;
  volume7d: number;
  avgPrice: number;
  lastSaleAt: string;
}

interface SaleFeedItem {
  cardName: string;
  game: string;
  condition: string;
  priceCents: number;
  quantity: number;
  completedAt: string;
}

interface GameStat {
  game: string;
  volume: number;
  gmvCents: number;
}

interface DashboardData {
  topMovers: CardMover[];
  mostTraded: CardTraded[];
  recentFeed: SaleFeedItem[];
  gameBreakdown: GameStat[];
  totalGmvCents: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtGmv(cents: number) {
  const v = cents / 100;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const GAME_LABELS: Record<string, string> = {
  pokemon: "Pokémon",
  "flesh-and-blood": "Flesh & Blood",
  "one-piece": "One Piece",
  "dragon-ball": "Dragon Ball",
};

const GAMES = ["", "pokemon", "flesh-and-blood", "one-piece", "dragon-ball"];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MarketDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [gameFilter, setGameFilter] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    const url = gameFilter
      ? `/api/transactions?mode=dashboard&game=${encodeURIComponent(gameFilter)}`
      : `/api/transactions?mode=dashboard`;

    fetch(url)
      .then(r => r.json())
      .then((d: DashboardData) => { setData(d); setLoading(false); })
      .catch(() => { setError("Failed to load market data."); setLoading(false); });
  }, [gameFilter]);

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 label-upper text-[10px] text-[var(--text-muted)] mb-4">
          <Link href="/tools/market" className="hover:text-[var(--foreground)] transition-colors">Market</Link>
          <span>/</span>
          <span>Dashboard</span>
        </div>
        <h1 className="text-3xl font-black text-[var(--foreground)]" style={{ fontFamily: "var(--font-serif, serif)" }}>
          Market Dashboard
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Real sales data from TCG Times marketplace · last 7 days
        </p>
      </div>

      {/* Game filter */}
      <div className="flex flex-wrap gap-2 mb-8">
        {GAMES.map(g => (
          <button
            key={g}
            onClick={() => setGameFilter(g)}
            className={`label-upper text-[10px] px-3 py-1.5 border transition-colors ${
              gameFilter === g
                ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {g ? (GAME_LABELS[g] ?? g) : "All Games"}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-20">
          <span className="w-6 h-6 border-2 border-[var(--border)] border-t-[var(--foreground)] rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500 py-10 text-center">{error}</p>
      )}

      {!loading && !error && data && (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
            <KpiCard label="7d GMV" value={fmtGmv(data.totalGmvCents)} />
            <KpiCard label="Unique Cards" value={String(new Set([...data.topMovers, ...data.mostTraded].map(r => r.cardName)).size)} />
            <KpiCard label="Top Mover" value={data.topMovers[0]?.cardName ?? "—"} small />
            <KpiCard label="Most Traded" value={data.mostTraded[0]?.cardName ?? "—"} small />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: top movers + most traded */}
            <div className="lg:col-span-2 flex flex-col gap-8">

              {/* Top Movers */}
              <section>
                <h2 className="label-upper text-[10px] text-[var(--text-muted)] mb-3 pb-2 border-b border-[var(--border)]">
                  Top Movers · 7d
                </h2>
                {data.topMovers.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)] py-6 text-center">No data yet — sales will appear here.</p>
                ) : (
                  <div className="flex flex-col divide-y divide-[var(--border)]">
                    {data.topMovers.map((m, i) => (
                      <div key={i} className="flex items-center justify-between py-2.5 gap-4">
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="font-semibold text-sm text-[var(--foreground)] truncate">{m.cardName}</span>
                          <span className="label-upper text-[9px] text-[var(--text-muted)]">{GAME_LABELS[m.game] ?? m.game} · vol {m.volume7d}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-bold text-[var(--foreground)]">{fmt(m.lastPrice)}</span>
                          {m.change7dPct != null ? (
                            <span className={`label-upper text-[10px] font-bold ${m.change7dPct >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                              {m.change7dPct > 0 ? "+" : ""}{m.change7dPct}%
                            </span>
                          ) : (
                            <span className="label-upper text-[10px] text-[var(--text-muted)]">—</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Most Traded */}
              <section>
                <h2 className="label-upper text-[10px] text-[var(--text-muted)] mb-3 pb-2 border-b border-[var(--border)]">
                  Most Traded · 7d
                </h2>
                {data.mostTraded.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)] py-6 text-center">No data yet.</p>
                ) : (
                  <div className="flex flex-col divide-y divide-[var(--border)]">
                    {data.mostTraded.map((m, i) => (
                      <div key={i} className="flex items-center justify-between py-2.5 gap-4">
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="font-semibold text-sm text-[var(--foreground)] truncate">{m.cardName}</span>
                          <span className="label-upper text-[9px] text-[var(--text-muted)]">{GAME_LABELS[m.game] ?? m.game} · last sale {timeAgo(m.lastSaleAt)}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-bold text-[var(--foreground)]">{fmt(m.avgPrice)} avg</span>
                          <span className="label-upper text-[10px] text-[var(--text-muted)]">{m.volume7d} sold</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Right: recent feed + game breakdown */}
            <div className="flex flex-col gap-8">
              {/* Game Breakdown */}
              {data.gameBreakdown.length > 0 && (
                <section>
                  <h2 className="label-upper text-[10px] text-[var(--text-muted)] mb-3 pb-2 border-b border-[var(--border)]">
                    By Game · 7d GMV
                  </h2>
                  <div className="flex flex-col gap-2">
                    {data.gameBreakdown.map((g, i) => {
                      const pct = data.totalGmvCents > 0 ? (g.gmvCents / data.totalGmvCents) * 100 : 0;
                      return (
                        <div key={i}>
                          <div className="flex justify-between label-upper text-[10px] mb-1">
                            <span className="text-[var(--foreground)]">{GAME_LABELS[g.game] ?? g.game}</span>
                            <span className="text-[var(--text-muted)]">{fmtGmv(g.gmvCents)} · {g.volume} units</span>
                          </div>
                          <div className="h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[var(--foreground)] rounded-full transition-all duration-500"
                              style={{ width: `${pct.toFixed(1)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Recent Sales Feed */}
              <section>
                <h2 className="label-upper text-[10px] text-[var(--text-muted)] mb-3 pb-2 border-b border-[var(--border)]">
                  Recent Sales
                </h2>
                {data.recentFeed.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)] py-4 text-center">No sales yet.</p>
                ) : (
                  <div className="flex flex-col divide-y divide-[var(--border)]">
                    {data.recentFeed.map((s, i) => (
                      <div key={i} className="py-2 flex flex-col gap-0.5">
                        <div className="flex justify-between items-baseline gap-2">
                          <span className="text-sm font-medium text-[var(--foreground)] truncate">{s.cardName}</span>
                          <span className="text-sm font-bold text-[var(--foreground)] shrink-0">{fmt(s.priceCents)}</span>
                        </div>
                        <div className="flex justify-between label-upper text-[9px] text-[var(--text-muted)]">
                          <span>{GAME_LABELS[s.game] ?? s.game} · {s.condition} · qty {s.quantity}</span>
                          <span>{timeAgo(s.completedAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="border border-[var(--border)] bg-[var(--muted)] p-4 flex flex-col gap-1">
      <p className="label-upper text-[9px] text-[var(--text-muted)]">{label}</p>
      <p className={`font-black text-[var(--foreground)] leading-tight ${small ? "text-base" : "text-2xl"}`}
         style={{ fontFamily: "var(--font-serif, serif)" }}>
        {value}
      </p>
    </div>
  );
}
