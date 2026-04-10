"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getReprintRisk } from "@/lib/reprint-risk";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtK(cents: number) {
  const v = cents / 100;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

const TREND_CONFIG = {
  Rising:  { icon: "▲", color: "#22c55e", desc: "Prices up today" },
  Falling: { icon: "▼", color: "#ef4444", desc: "Prices down today" },
  Stable:  { icon: "→", color: "#f59e0b", desc: "Prices stable today" },
  Unknown: { icon: "—", color: "#6b7280", desc: "Not enough data yet" },
} as const;

const REPRINT_RISK_CONFIG: Record<string, { color: string; short: string }> = {
  confirmed: { color: "#ef4444", short: "Reprint confirmed" },
  likely:    { color: "#f59e0b", short: "Reprint likely" },
  possible:  { color: "#eab308", short: "Reprint possible" },
};

const BUY_SIGNAL_CONFIG: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  "Strong Buy":  { color: "#16a34a", bg: "#16a34a18", icon: "⬆⬆", label: "Strong Buy"  },
  "Buy":         { color: "#22c55e", bg: "#22c55e15", icon: "⬆",   label: "Buy"          },
  "Hold":        { color: "#f59e0b", bg: "#f59e0b12", icon: "→",   label: "Hold"         },
  "Sell":        { color: "#ef4444", bg: "#ef444415", icon: "⬇",   label: "Sell"         },
  "Strong Sell": { color: "#b91c1c", bg: "#b91c1c18", icon: "⬇⬇", label: "Strong Sell"  },
};

// ---------------------------------------------------------------------------
// Types — mirrors /api/market-dashboard response
// ---------------------------------------------------------------------------

interface CardMove {
  cardName: string;
  priceCents: number;
  dayChangePct: number | null;
  tcgplayerId?: number;
}

interface MetaDeckCard {
  name: string;
  qty: number;
  unitCents: number;
  totalCents: number;
  found: boolean;
}

interface MetaDeck {
  archetype: string;
  format: string;
  totalCents: number;
  foundCards: number;
  totalCards: number;
  cards: MetaDeckCard[];
}

interface PriceTiers {
  p10: number;
  p25: number;
  p75: number;
  p90: number;
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
  trendLabel: "Rising" | "Falling" | "Stable" | "Unknown";
  budgetLabel: string;
  priceTiers: PriceTiers;
  reprintRiskCount: number;
  metaDecks: MetaDeck[];
  // Market analysis signals
  entryScore: number | null;
  buySignal: "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell";
  buySignalReason: string;
  concentrationPct: number;
  sellPressure: number;
  gainersCount: number;
  losersCount: number;
}

interface DashboardData {
  updatedAt: string;
  games: GameMarketData[];
  globalIndex: number;
  totalCards: number;
}

const GAME_META: Record<string, { label: string; emoji: string; accent: string }> = {
  "flesh-and-blood": { label: "Flesh and Blood", emoji: "⚔️",  accent: "#0284c7" },
  "grand-archive":   { label: "Grand Archive",   emoji: "📖",  accent: "#0f766e" },
  "one-piece":       { label: "One Piece",        emoji: "🏴‍☠️", accent: "#b45309" },
  "pokemon":         { label: "Pokémon",           emoji: "⚡",  accent: "#16a34a" },
  "magic":           { label: "Magic",             emoji: "🔮",  accent: "#7c3aed" },
  "other":           { label: "Other",             emoji: "🃏",  accent: "#6b7280" },
};

// ---------------------------------------------------------------------------
// Price distribution mini-bar (histogram)
// ---------------------------------------------------------------------------
function MiniHistogram({ counts, accent }: { counts: number[]; accent: string }) {
  const maxCount = Math.max(...counts, 1);
  return (
    <div className="flex items-end gap-[2px] h-8">
      {counts.map((c, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm transition-all"
          style={{
            height: `${Math.max(4, (c / maxCount) * 100)}%`,
            background: c > 0 ? accent : "var(--border)",
            opacity: c > 0 ? 0.7 + (c / maxCount) * 0.3 : 0.3,
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day change chip  (+2.4% / -1.1%)
// ---------------------------------------------------------------------------
function DayChange({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="label-upper text-[9px]" style={{ color: "var(--text-muted)" }}>—</span>;
  const up = pct >= 0;
  return (
    <span
      className="label-upper text-[9px] font-black"
      style={{ color: up ? "#22c55e" : "#ef4444" }}
    >
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

// ---------------------------------------------------------------------------
// Game panel (sidebar button)
// ---------------------------------------------------------------------------
function GamePanel({ stats, isSelected, onClick }: {
  stats: GameMarketData;
  isSelected: boolean;
  onClick: () => void;
}) {
  const trend = TREND_CONFIG[stats.trendLabel];

  return (
    <button
      onClick={onClick}
      className="w-full text-left flex flex-col gap-3 p-5 transition-colors"
      style={{
        background: isSelected ? `color-mix(in srgb, ${stats.accent} 8%, var(--background))` : "var(--background)",
        borderLeft: isSelected ? `3px solid ${stats.accent}` : "3px solid transparent",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">{stats.emoji}</span>
            <span className="font-bold text-sm" style={{ fontFamily: "var(--font-serif, serif)", color: "var(--foreground)" }}>
              {stats.label}
            </span>
          </div>
          <div className="label-upper text-[9px] mt-1" style={{ color: "var(--text-muted)" }}>
            {stats.budgetLabel}
          </div>
        </div>
        {/* Trend + day change */}
        <div className="text-right shrink-0">
          <div className="flex items-center justify-end gap-1">
            <span className="text-sm font-black" style={{ color: trend.color }}>{trend.icon}</span>
            <span className="label-upper text-[10px] font-black" style={{ color: trend.color }}>
              {stats.trendLabel}
            </span>
          </div>
          <div className="label-upper text-[9px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            {stats.dayChangePct != null
              ? `${stats.dayChangePct >= 0 ? "+" : ""}${stats.dayChangePct.toFixed(1)}% today`
              : "no change data"}
          </div>
        </div>
      </div>

      {/* Price range bar: p10 → p90 */}
      <div>
        <div className="flex justify-between label-upper text-[8px] mb-1" style={{ color: "var(--text-muted)" }}>
          <span>Budget {fmt(stats.priceTiers.p10)}</span>
          <span>Chase {fmt(stats.priceTiers.p90)}</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
          <div className="h-full rounded-full" style={{ background: stats.accent, width: "100%" }} />
        </div>
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between">
        <span className="label-upper text-[9px]" style={{ color: "var(--text-muted)" }}>
          {stats.cardCount.toLocaleString()} singles tracked
        </span>
        {stats.reprintRiskCount > 0 && (
          <span className="label-upper text-[8px] font-black px-1.5 py-0.5"
            style={{ background: "#f59e0b22", color: "#f59e0b" }}>
            ⚠ {stats.reprintRiskCount} reprint risk
          </span>
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Most expensive singles list
// ---------------------------------------------------------------------------
function TopSinglesTable({ cards, accent }: { cards: CardMove[]; accent: string }) {
  return (
    <div>
      <SectionHeader
        title="Most Expensive Singles"
        sub="The cards you'll need to budget for"
      />
      <div style={{ borderTop: "1px solid var(--border)" }}>
        {cards.map((card, i) => {
          const riskEntry = getReprintRisk(card.cardName);
          const risk = riskEntry ? REPRINT_RISK_CONFIG[riskEntry.risk] : null;

          return (
            <Link
              key={card.cardName}
              href={`/tools/cards?search=${encodeURIComponent(card.cardName)}`}
              className="group flex items-center gap-3 py-3 px-2 -mx-2 transition-colors"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <span className="label-upper text-[10px] w-5 shrink-0 text-center font-black"
                style={{ color: i === 0 ? accent : "var(--text-muted)" }}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate group-hover:underline" style={{ color: "var(--foreground)" }}>
                  {card.cardName}
                </p>
                {risk && (
                  <p className="label-upper text-[8px] mt-0.5" style={{ color: risk.color }}>
                    ⚠ {risk.short}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="label-upper text-[11px] font-black" style={{ color: "var(--foreground)" }}>
                  {fmt(card.priceCents)}
                </div>
                {card.dayChangePct != null && (
                  <DayChange pct={card.dayChangePct} />
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Price movers (gainers / losers)
// ---------------------------------------------------------------------------
function MoversTable({ gainers, losers }: { gainers: CardMove[]; losers: CardMove[] }) {
  if (gainers.length === 0 && losers.length === 0) {
    return (
      <div className="p-4 text-[11px] leading-relaxed" style={{ color: "var(--text-muted)", background: "var(--muted)" }}>
        📅 Day-over-day change data will appear here once 2+ days of prices have been collected.
        Check back tomorrow!
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-px" style={{ background: "var(--border)" }}>
      <div style={{ background: "var(--background)" }}>
        <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <span className="label-upper text-[9px] font-black" style={{ color: "#22c55e" }}>▲ Spiking today</span>
        </div>
        {gainers.length === 0
          ? <p className="px-3 py-3 text-[10px]" style={{ color: "var(--text-muted)" }}>No gainers today</p>
          : gainers.map(card => (
            <div key={card.cardName} className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
              <span className="text-[10px] truncate flex-1" style={{ color: "var(--foreground)" }}>{card.cardName}</span>
              <div className="text-right shrink-0">
                <div className="label-upper text-[9px] font-black" style={{ color: "#22c55e" }}>
                  +{card.dayChangePct!.toFixed(1)}%
                </div>
                <div className="label-upper text-[8px]" style={{ color: "var(--text-muted)" }}>
                  {fmt(card.priceCents)}
                </div>
              </div>
            </div>
          ))}
      </div>
      <div style={{ background: "var(--background)" }}>
        <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <span className="label-upper text-[9px] font-black" style={{ color: "#ef4444" }}>▼ Dropping today</span>
        </div>
        {losers.length === 0
          ? <p className="px-3 py-3 text-[10px]" style={{ color: "var(--text-muted)" }}>No drops today</p>
          : losers.map(card => (
            <div key={card.cardName} className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
              <span className="text-[10px] truncate flex-1" style={{ color: "var(--foreground)" }}>{card.cardName}</span>
              <div className="text-right shrink-0">
                <div className="label-upper text-[9px] font-black" style={{ color: "#ef4444" }}>
                  {card.dayChangePct!.toFixed(1)}%
                </div>
                <div className="label-upper text-[8px]" style={{ color: "var(--text-muted)" }}>
                  {fmt(card.priceCents)}
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section header helper
// ---------------------------------------------------------------------------
function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <span className="label-upper text-[10px] font-black" style={{ color: "var(--foreground)" }}>{title}</span>
      {sub && <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{sub}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Condition discount — "what do LP/MP copies cost?"
// ---------------------------------------------------------------------------
function ConditionMatrix({ nmPrice }: { nmPrice: number }) {
  const conditions = [
    { label: "Near Mint",         short: "NM",  multi: 1.00 },
    { label: "Lightly Played",    short: "LP",  multi: 0.82 },
    { label: "Moderately Played", short: "MP",  multi: 0.62 },
    { label: "Heavily Played",    short: "HP",  multi: 0.40 },
    { label: "Damaged",           short: "DMG", multi: 0.20 },
  ];
  return (
    <div>
      <SectionHeader
        title="Condition Pricing"
        sub={`What a played copy saves you vs NM ${fmt(nmPrice)}`}
      />
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-px" style={{ background: "var(--border)" }}>
        {conditions.map(c => {
          const adjusted = nmPrice * c.multi;
          const saving   = nmPrice - adjusted;
          return (
            <div key={c.short} className="flex flex-col items-center py-3 px-1" style={{ background: "var(--background)" }}>
              <span className="label-upper text-[9px] font-black" style={{ color: "var(--foreground)" }}>{c.short}</span>
              <span className="text-sm font-black mt-1" style={{ fontFamily: "var(--font-serif, serif)", color: "var(--foreground)" }}>
                {fmt(adjusted)}
              </span>
              <span className="label-upper text-[8px] mt-0.5" style={{ color: saving === 0 ? "var(--text-muted)" : "#22c55e" }}>
                {saving === 0 ? "base" : `save ${fmt(saving)}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail panel — player-centric view
// ---------------------------------------------------------------------------
function DetailPanel({ stats, onBack }: { stats: GameMarketData; onBack?: () => void }) {
  const trend = TREND_CONFIG[stats.trendLabel];

  return (
    <div className="flex flex-col gap-8">
      {/* Mobile back */}
      {onBack && (
        <button
          onClick={onBack}
          className="md:hidden flex items-center gap-2 label-upper text-[10px] self-start -mt-1 mb-1 transition-opacity hover:opacity-60"
          style={{ color: "var(--text-muted)" }}
        >
          ← All Games
        </button>
      )}

      {/* ── Header ── */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-3xl">{stats.emoji}</span>
          <h2 className="text-2xl sm:text-3xl font-black" style={{ fontFamily: "var(--font-serif, serif)", color: "var(--foreground)" }}>
            {stats.label}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Trend badge */}
          <span className="label-upper text-[10px] font-black px-2 py-1"
            style={{ background: `${trend.color}22`, color: trend.color }}>
            {trend.icon} {stats.trendLabel}
            {stats.dayChangePct != null && ` · ${stats.dayChangePct >= 0 ? "+" : ""}${stats.dayChangePct.toFixed(1)}% today`}
          </span>
          {/* Budget label */}
          <span className="label-upper text-[10px] px-2 py-1"
            style={{ background: "var(--muted)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
            {stats.budgetLabel}
          </span>
          <span className="label-upper text-[9px]" style={{ color: "var(--text-muted)" }}>
            {stats.cardCount.toLocaleString()} singles · TCGPlayer market prices
          </span>
        </div>
      </div>

      {/* ── Market Signal ── */}
      {(() => {
        const sig = BUY_SIGNAL_CONFIG[stats.buySignal];
        return (
          <div style={{ border: `1.5px solid ${sig.color}`, background: sig.bg }}>
            <div className="flex items-start justify-between gap-4 p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="label-upper text-[9px]" style={{ color: "var(--text-muted)" }}>
                    Market Signal
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl font-black" style={{ fontFamily: "var(--font-serif, serif)", color: sig.color }}>
                    {sig.icon} {sig.label}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed" style={{ color: "var(--foreground)" }}>
                  {stats.buySignalReason}
                </p>
              </div>
              {stats.entryScore != null && (
                <div className="shrink-0 flex flex-col items-center gap-1 text-center">
                  <span className="label-upper text-[8px]" style={{ color: "var(--text-muted)" }}>30d Position</span>
                  <span className="text-2xl font-black" style={{ fontFamily: "var(--font-serif, serif)", color: sig.color }}>
                    {stats.entryScore}
                  </span>
                  <span className="label-upper text-[8px]" style={{ color: "var(--text-muted)" }}>/ 100</span>
                </div>
              )}
            </div>
            <div className="px-4 pb-3 text-[9px]" style={{ color: "var(--text-muted)" }}>
              Signal based on: 30-day price position · trend direction · reprint risk · daily buyer/seller balance.
              Not financial advice — for entertainment and research only.
            </div>
          </div>
        );
      })()}

      {/* ── Entry Timing: where current prices sit in the 30d range ── */}
      {stats.entryScore != null && stats.high30d != null && stats.low30d != null && (
        <div>
          <SectionHeader
            title="Entry Timing"
            sub="Where today's prices sit in the last 30 days"
          />
          <div className="p-4" style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
            {/* Bar */}
            <div className="relative h-3 rounded-full overflow-hidden mb-2" style={{ background: "var(--border)" }}>
              <div className="absolute inset-y-0 left-0 rounded-full" style={{
                width: `${stats.entryScore}%`,
                background: stats.entryScore <= 35
                  ? "#22c55e"
                  : stats.entryScore <= 65
                  ? "#f59e0b"
                  : "#ef4444",
              }} />
              {/* Needle */}
              <div className="absolute top-0 bottom-0 w-0.5" style={{
                left: `${stats.entryScore}%`,
                background: "var(--foreground)",
              }} />
            </div>
            {/* Labels */}
            <div className="flex justify-between label-upper text-[8px]" style={{ color: "var(--text-muted)" }}>
              <span>30d Low · {fmt(stats.low30d)} · Best entry</span>
              <span>30d High · {fmt(stats.high30d)} · Peak price</span>
            </div>
            <div className="mt-3 text-[10px] leading-relaxed" style={{ color: "var(--foreground)" }}>
              {stats.entryScore <= 25 && "📗 Near the 30-day low — historically a good window to buy singles."}
              {stats.entryScore > 25 && stats.entryScore <= 50 && "🟡 Below the 30-day average — prices are reasonable but not at a deep discount."}
              {stats.entryScore > 50 && stats.entryScore <= 75 && "🟠 Above the 30-day average — no urgency to buy; wait for a dip if possible."}
              {stats.entryScore > 75 && "📕 Near the 30-day peak — consider waiting for prices to cool before buying."}
            </div>
          </div>
        </div>
      )}

      {/* ── Buyer / Seller balance ── */}
      <div>
        <SectionHeader
          title="Today's Buyer / Seller Balance"
          sub="Are more cards going up or down in price?"
        />
        {stats.gainersCount + stats.losersCount === 0 ? (
          <div className="p-4 text-[11px] leading-relaxed" style={{ background: "var(--muted)", color: "var(--text-muted)" }}>
            📅 Not enough day-over-day data yet. Check back once 2+ days of prices are collected.
          </div>
        ) : (
          <div style={{ border: "1px solid var(--border)" }}>
            {/* Bar */}
            <div className="flex h-4 overflow-hidden">
              {stats.gainersCount > 0 && (
                <div className="h-full flex items-center justify-center label-upper text-[8px] font-black text-white"
                  style={{ width: `${(stats.gainersCount / (stats.gainersCount + stats.losersCount)) * 100}%`, background: "#22c55e" }}>
                  {stats.gainersCount > 2 ? `▲ ${stats.gainersCount}` : ""}
                </div>
              )}
              {stats.losersCount > 0 && (
                <div className="h-full flex items-center justify-center label-upper text-[8px] font-black text-white"
                  style={{ width: `${(stats.losersCount / (stats.gainersCount + stats.losersCount)) * 100}%`, background: "#ef4444" }}>
                  {stats.losersCount > 2 ? `▼ ${stats.losersCount}` : ""}
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-px" style={{ background: "var(--border)", borderTop: "1px solid var(--border)" }}>
              <div className="p-3 text-center" style={{ background: "var(--background)" }}>
                <div className="text-lg font-black" style={{ color: "#22c55e" }}>{stats.gainersCount}</div>
                <div className="label-upper text-[8px]" style={{ color: "var(--text-muted)" }}>Gaining today</div>
              </div>
              <div className="p-3 text-center" style={{ background: "var(--background)" }}>
                <div className="text-lg font-black" style={{ color: "var(--foreground)" }}>
                  {stats.sellPressure > 0.6
                    ? "Sellers winning"
                    : stats.sellPressure < 0.4
                    ? "Buyers winning"
                    : "Balanced"}
                </div>
                <div className="label-upper text-[8px]" style={{ color: "var(--text-muted)" }}>Market mood</div>
              </div>
              <div className="p-3 text-center" style={{ background: "var(--background)" }}>
                <div className="text-lg font-black" style={{ color: "#ef4444" }}>{stats.losersCount}</div>
                <div className="label-upper text-[8px]" style={{ color: "var(--text-muted)" }}>Dropping today</div>
              </div>
            </div>
            <div className="px-4 py-2 text-[10px] leading-relaxed" style={{ background: "var(--background)", color: "var(--text-muted)", borderTop: "1px solid var(--border)" }}>
              {stats.sellPressure > 0.6
                ? "More cards are losing value than gaining — selling pressure is high. Good time to pick up singles at a discount."
                : stats.sellPressure < 0.4
                ? "More cards are gaining than losing — buying pressure is high. Sellers may be holding out for better prices."
                : "Market is mixed today — no strong directional signal from movers alone."}
            </div>
          </div>
        )}
      </div>

      {/* ── Market concentration ── */}
      <div>
        <SectionHeader
          title="Market Concentration"
          sub="How much of the game's total value is in the top 10 cards?"
        />
        <div style={{ border: "1px solid var(--border)" }}>
          <div className="flex h-3 overflow-hidden">
            <div className="h-full" style={{ width: `${stats.concentrationPct}%`, background: stats.accent }} />
            <div className="h-full flex-1" style={{ background: "var(--muted)" }} />
          </div>
          <div className="grid grid-cols-2 gap-px" style={{ background: "var(--border)", borderTop: "1px solid var(--border)" }}>
            <div className="p-4 flex flex-col gap-1" style={{ background: "var(--background)" }}>
              <span className="label-upper text-[9px]" style={{ color: "var(--text-muted)" }}>Top 10 cards hold</span>
              <span className="text-2xl font-black" style={{ fontFamily: "var(--font-serif, serif)", color: stats.accent }}>
                {stats.concentrationPct}%
              </span>
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>of total tracked market value</span>
            </div>
            <div className="p-4 flex flex-col gap-1" style={{ background: "var(--background)" }}>
              <span className="label-upper text-[9px]" style={{ color: "var(--text-muted)" }}>What this means</span>
              <span className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                {stats.concentrationPct >= 60
                  ? "Whale-driven game"
                  : stats.concentrationPct >= 35
                  ? "Chase-card focused"
                  : "Spread value game"}
              </span>
              <span className="text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {stats.concentrationPct >= 60
                  ? "A handful of chase cards dominate pricing. Budget players can find value in the long tail."
                  : stats.concentrationPct >= 35
                  ? "A few key singles drive most value — buying the right cards matters a lot."
                  : "Value is spread across many cards — easier for budget players to build competitive decks."}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Value window (p25–p75 range) ── */}
      <div>
        <SectionHeader
          title="Singles Budget Guide"
          sub="What to expect at each price tier"
        />
        <div className="grid grid-cols-4 gap-px" style={{ background: "var(--border)" }}>
          {[
            { label: "Budget",  tier: "10th pctile", val: stats.priceTiers.p10, color: "#22c55e",
              desc: "Cheap commons & uncommons — great for budget decks" },
            { label: "Common",  tier: "25th pctile", val: stats.priceTiers.p25, color: "#84cc16",
              desc: "Staple non-rares — the workhorse cards of most formats" },
            { label: "Staple",  tier: "75th pctile", val: stats.priceTiers.p75, color: "#f59e0b",
              desc: "Competitive rares — the cards you'll need for top decks" },
            { label: "Chase",   tier: "90th pctile", val: stats.priceTiers.p90, color: "#ef4444",
              desc: "Premium singles — the most expensive cards in the format" },
          ].map(t => (
            <div key={t.label} className="p-3 flex flex-col gap-1" style={{ background: "var(--background)" }}>
              <span className="label-upper text-[9px] font-black" style={{ color: t.color }}>{t.label}</span>
              <span className="text-lg font-black mt-0.5" style={{ fontFamily: "var(--font-serif, serif)", color: "var(--foreground)" }}>
                {fmt(t.val)}
              </span>
              <span className="label-upper text-[7px] mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>{t.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Price histogram ── */}
      <div>
        <SectionHeader
          title="Price Distribution"
          sub={`${stats.cardCount.toLocaleString()} singles from cheapest to most expensive`}
        />
        <MiniHistogram counts={stats.priceDistribution} accent={stats.accent} />
        <div className="flex justify-between label-upper text-[8px] mt-1" style={{ color: "var(--text-muted)" }}>
          <span>Budget {fmt(stats.priceTiers.p10)}</span>
          <span>Most singles cluster here</span>
          <span>Chase {fmt(stats.priceTiers.p90)}</span>
        </div>
      </div>

      {/* ── Spiking / dropping ── */}
      <div>
        <SectionHeader
          title="Today's Price Moves"
          sub="Individual cards that spiked or dropped since yesterday"
        />
        <MoversTable gainers={stats.gainers} losers={stats.losers} />
      </div>

      {/* ── Competitive deck costs ── */}
      {stats.metaDecks.length > 0 && (
        <div>
          <SectionHeader
            title="Competitive Deck Cost"
            sub="Key singles priced at today's TCGPlayer market price"
          />
          <div className="flex flex-col gap-px" style={{ background: "var(--border)" }}>
            {stats.metaDecks.map(deck => (
              <div key={deck.archetype} style={{ background: "var(--background)" }}>
                <div className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: "1px solid var(--border)" }}>
                  <div>
                    <span className="text-sm font-black" style={{ fontFamily: "var(--font-serif, serif)", color: "var(--foreground)" }}>
                      {deck.archetype}
                    </span>
                    <span className="label-upper text-[9px] ml-2" style={{ color: "var(--text-muted)" }}>
                      {deck.format}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black" style={{ fontFamily: "var(--font-serif, serif)", color: stats.accent }}>
                      {deck.totalCents > 0 ? fmtK(deck.totalCents) : "—"}
                    </span>
                    {deck.foundCards < deck.totalCards && (
                      <div className="label-upper text-[8px]" style={{ color: "var(--text-muted)" }}>
                        {deck.foundCards}/{deck.totalCards} cards priced
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  {deck.cards.map(card => (
                    <div key={card.name}
                      className="flex items-center justify-between px-4 py-2"
                      style={{ borderBottom: "1px solid var(--border)", opacity: card.found ? 1 : 0.4 }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="label-upper text-[9px] shrink-0 w-5 text-center font-black"
                          style={{ color: "var(--text-muted)" }}>
                          ×{card.qty}
                        </span>
                        <span className="text-[11px] capitalize truncate" style={{ color: "var(--foreground)" }}>
                          {card.name}
                        </span>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        {card.found ? (
                          <>
                            <span className="label-upper text-[10px] font-black" style={{ color: "var(--foreground)" }}>
                              {fmt(card.unitCents)}
                            </span>
                            {card.qty > 1 && (
                              <span className="label-upper text-[8px] ml-1" style={{ color: "var(--text-muted)" }}>
                                × {card.qty} = {fmt(card.totalCents)}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="label-upper text-[9px]" style={{ color: "var(--text-muted)" }}>
                            not in recent sets
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[9px] mt-2 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            * Key singles only — not a full decklist. Cards outside the current price snapshot window show as "not in recent sets".
          </p>
        </div>
      )}

      {/* ── Most expensive singles ── */}
      {stats.topByPrice.length > 0 && (
        <TopSinglesTable cards={stats.topByPrice} accent={stats.accent} />
      )}

      {/* ── 30-day range ── */}
      {(stats.high30d || stats.low30d) && (
        <div>
          <SectionHeader
            title="30-Day Price Range"
            sub="Best and worst prices in the last month"
          />
          <div className="grid grid-cols-2 gap-px" style={{ background: "var(--border)" }}>
            <div className="p-4 flex flex-col gap-1" style={{ background: "var(--background)" }}>
              <span className="label-upper text-[9px]" style={{ color: "var(--text-muted)" }}>30d Best Price</span>
              <span className="text-xl font-black" style={{ fontFamily: "var(--font-serif, serif)", color: "#22c55e" }}>
                {stats.low30d ? fmt(stats.low30d) : "—"}
              </span>
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Cheapest any card got in the last 30 days</span>
            </div>
            <div className="p-4 flex flex-col gap-1" style={{ background: "var(--background)" }}>
              <span className="label-upper text-[9px]" style={{ color: "var(--text-muted)" }}>30d Peak Price</span>
              <span className="text-xl font-black" style={{ fontFamily: "var(--font-serif, serif)", color: "#ef4444" }}>
                {stats.high30d ? fmt(stats.high30d) : "—"}
              </span>
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Most expensive any card got in the last 30 days</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Condition pricing ── */}
      {stats.avgPriceCents > 0 && <ConditionMatrix nmPrice={stats.priceTiers.p75} />}

      {/* ── Data note ── */}
      <div className="p-3 text-[10px] leading-relaxed" style={{ background: "var(--muted)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
        📊 Prices from <strong>TCGPlayer</strong> via tcgcsv.com (daily mirror) — actual transaction prices, not asking prices.
        Market signal is a research tool only, not financial advice.
        Entry timing and buyer/seller balance update once per hour.
        Condition discounts modelled on typical TCGPlayer haircuts.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MarketPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  // Mobile: "list" shows game cards, "detail" shows the drill-down panel
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");

  useEffect(() => {
    fetch("/api/market-dashboard")
      .then(r => r.json())
      .then((d: DashboardData) => {
        setData(d);
        if (d.games.length > 0) setSelectedGame(d.games[0].game);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const gameStats = data?.games ?? [];
  const selectedStats = gameStats.find(g => g.game === selectedGame) ?? null;

  // Global aggregates (from API)
  const totalIndex  = data?.globalIndex ?? 0;
  const totalCards  = data?.totalCards  ?? 0;
  const globalAvgPct = gameStats.length > 0
    ? gameStats.reduce((s, g) => s + (g.dayChangePct ?? 0), 0) / gameStats.length
    : null;

  function handleSelectGame(game: string) {
    setSelectedGame(game);
    setMobileView("detail");
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>

      {/* ── Header ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 pt-10 sm:pt-14 pb-6 sm:pb-8" style={{ borderBottom: "1px solid var(--border)" }}>
        <p className="label-upper text-[9px] mb-3 sm:mb-4" style={{ color: "var(--text-muted)" }}>
          TCG Times — Market Intelligence
        </p>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4 justify-between">
          <h1
            className="text-4xl sm:text-5xl md:text-7xl font-black leading-[0.9] tracking-tight"
            style={{ fontFamily: "var(--font-serif, serif)", color: "var(--foreground)" }}
          >
            Market<br />Dashboard
          </h1>
          <p className="text-sm max-w-xs leading-relaxed pb-1 hidden sm:block" style={{ color: "var(--text-muted)" }}>
            Is this game affordable? Are prices rising or falling? Which singles cost the most?
            Real TCGPlayer market prices to help you decide when and what to buy.
          </p>
        </div>
      </div>

      {/* ── Global ticker strip ── */}
      <div
        className="sticky top-0 z-30 backdrop-blur-md overflow-x-auto"
        style={{
          background: "color-mix(in srgb, var(--background) 93%, transparent)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="flex items-stretch min-w-max">
          {loading ? (
            <div className="px-6 py-3 label-upper text-[9px] animate-pulse" style={{ color: "var(--text-muted)" }}>
              Loading market data…
            </div>
          ) : (
            <>
              {[
                { label: "TCG Index",  value: fmtK(totalIndex),           sub: "all games"      },
                { label: "Cards",      value: totalCards.toLocaleString(), sub: "tracked"        },
                { label: "Day Chg",    value: globalAvgPct != null ? `${globalAvgPct >= 0 ? "+" : ""}${globalAvgPct.toFixed(1)}%` : "—", sub: "avg",
                  color: globalAvgPct != null ? (globalAvgPct >= 0 ? "#22c55e" : "#ef4444") : undefined },
                { label: "Games",      value: String(gameStats.length),   sub: "tracked"        },
              ].map((t, i) => (
                <div
                  key={i}
                  className="flex flex-col justify-center px-4 py-2 shrink-0"
                  style={{ borderRight: "1px solid var(--border)" }}
                >
                  <span className="label-upper text-[8px]" style={{ color: "var(--text-muted)" }}>{t.label}</span>
                  <span className="label-upper text-[11px] font-black" style={{ color: t.color ?? "var(--foreground)" }}>
                    {t.value}
                  </span>
                  <span className="label-upper text-[7px]" style={{ color: "var(--text-muted)" }}>{t.sub}</span>
                </div>
              ))}
              <Link
                href="/tools/market/box-ev"
                className="flex items-center px-4 label-upper text-[9px] shrink-0 transition-opacity hover:opacity-60"
                style={{ color: "var(--foreground)", borderRight: "1px solid var(--border)" }}
              >
                Box EV →
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row min-h-[70vh]">

        {/* Left sidebar — game list */}
        {/* On mobile: show only when mobileView === "list" */}
        <div
          className={`md:w-72 shrink-0 ${mobileView === "detail" ? "hidden md:block" : "block"}`}
          style={{ borderRight: "1px solid var(--border)" }}
        >
          <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <span className="label-upper text-[9px]" style={{ color: "var(--text-muted)" }}>
              Select a game to analyse
            </span>
          </div>

          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse h-24 m-3" style={{ background: "var(--muted)", animationDelay: `${i * 0.1}s` }} />
            ))
          ) : gameStats.length === 0 ? (
            <div className="p-6 text-sm" style={{ color: "var(--text-muted)" }}>No listings yet.</div>
          ) : (
            gameStats.map(gs => (
              <GamePanel
                key={gs.game}
                stats={gs}
                isSelected={selectedGame === gs.game}
                onClick={() => handleSelectGame(gs.game)}
              />
            ))
          )}
        </div>

        {/* Right — detail panel */}
        {/* On mobile: show only when mobileView === "detail" */}
        <div
          className={`flex-1 p-4 sm:p-6 md:p-8 ${mobileView === "list" ? "hidden md:block" : "block"}`}
        >
          {!loading && !selectedStats && (
            <div className="flex items-center justify-center h-full py-24">
              <p className="label-upper text-sm" style={{ color: "var(--text-muted)" }}>
                ← Select a game to view analysis
              </p>
            </div>
          )}
          {selectedStats && (
            <DetailPanel
              stats={selectedStats}
              onBack={() => setMobileView("list")}
            />
          )}
        </div>
      </div>

      {/* ── Footer nav ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-6 sm:py-8 flex gap-6" style={{ borderTop: "1px solid var(--border)" }}>
        <Link href="/marketplace" className="label-upper text-[10px] transition-opacity hover:opacity-60" style={{ color: "var(--text-muted)" }}>
          ← Marketplace
        </Link>
        <Link href="/tools" className="label-upper text-[10px] transition-opacity hover:opacity-60" style={{ color: "var(--text-muted)" }}>
          ← All Tools
        </Link>
        <Link href="/tools/market/box-ev" className="label-upper text-[10px] transition-opacity hover:opacity-60" style={{ color: "var(--text-muted)" }}>
          Box EV →
        </Link>
      </div>
    </div>
  );
}

