"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrderRow {
  id: string;
  price_cents: number;
  quantity: number;
  quantity_filled: number;
  condition: string;
  note?: string;
  region?: string;
  username: string;
  created_at: string;
  expires_at?: string;
}

interface OrderBook {
  bids: OrderRow[];
  asks: OrderRow[];
  bestBid: number | null;
  bestAsk: number | null;
  spread: number | null;
  midpoint: number | null;
}

interface TxStats {
  lastSoldCents: number | null;
  lastSoldAt: string | null;
  volume24h: number;
  volume7d: number;
  change7dPct: number | null;
  recentSales: { priceCents: number; quantity: number; completedAt: string }[];
}

interface MarketCapData {
  lastSoldCents: number | null;
  supplyGlobal: number | null;
  supplyRegion: number | null;
  marketCapGlobal: number | null;
  marketCapRegion: number | null;
  rarity: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GAME_LABELS: Record<string, string> = {
  pokemon:          "Pokémon",
  "flesh-and-blood": "Flesh & Blood",
  "one-piece":      "One Piece",
  "dragon-ball":    "Dragon Ball",
  "grand-archive":  "Grand Archive",
};

const CONDITIONS = ["Near Mint", "Lightly Played", "Moderately Played", "Heavily Played", "Damaged"] as const;

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtCap(cents: number | null) {
  if (cents == null) return "—";
  const v = cents / 100;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1000)      return `$${(v / 1000).toFixed(1)}k`;
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

// Decode URL-safe slug back to card name ("charizard-ex" → "Charizard ex")
function slugToName(slug: string) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// Mini SVG sparkline for recent sales
function Sparkline({ sales }: { sales: { priceCents: number }[] }) {
  if (sales.length < 2) return null;
  const prices = sales.map(s => s.priceCents);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const W = 120, H = 32, PAD = 4;
  const pts = prices.map((p, i) => {
    const x = PAD + (i / (prices.length - 1)) * (W - PAD * 2);
    const y = PAD + ((max - p) / range) * (H - PAD * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={W} height={H} className="overflow-visible">
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        className="text-[var(--foreground)]"
      />
    </svg>
  );
}

// Volume bar chart (daily counts from recentSales)
function VolumeBars({ sales }: { sales: { priceCents: number; quantity: number; completedAt: string }[] }) {
  // Group by day (last 14 days)
  const days: Record<string, number> = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    days[d] = 0;
  }
  for (const s of sales) {
    const d = new Date(s.completedAt).toISOString().slice(0, 10);
    if (d in days) days[d] += s.quantity;
  }
  const entries = Object.entries(days);
  const maxVol = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <div className="flex items-end gap-0.5 h-12">
      {entries.map(([day, vol]) => {
        const pct = (vol / maxVol) * 100;
        const isToday = day === new Date().toISOString().slice(0, 10);
        return (
          <div
            key={day}
            title={`${day}: ${vol} sold`}
            className={`flex-1 rounded-sm transition-all ${isToday ? "bg-[var(--foreground)]" : "bg-[var(--border)]"}`}
            style={{ height: `${Math.max(pct, 4)}%` }}
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CardMarketPage() {
  const params = useParams();
  const game     = decodeURIComponent(params.game as string);
  const cardSlug = decodeURIComponent(params.cardSlug as string);
  const cardName = slugToName(cardSlug);

  const [book,       setBook]       = useState<OrderBook | null>(null);
  const [txStats,    setTxStats]    = useState<TxStats | null>(null);
  const [marketCap,  setMarketCap]  = useState<MarketCapData | null>(null);
  const [myOrders,   setMyOrders]   = useState<OrderRow[]>([]);
  const [userId,     setUserId]     = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [orderError, setOrderError] = useState("");
  const [placing,    setPlacing]    = useState(false);
  const [condFilter, setCondFilter] = useState("");

  // Order form state
  const [formType,       setFormType]       = useState<"bid" | "ask">("bid");
  const [formPrice,      setFormPrice]      = useState("");
  const [formQty,        setFormQty]        = useState("1");
  const [formCondition,  setFormCondition]  = useState("Near Mint");
  const [formNote,       setFormNote]       = useState("");
  const [formExpiry,     setFormExpiry]     = useState("30");

  // ── Auth ──
  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(({ user }) => { if (user) setUserId(user.id ?? user.userId ?? null); });
  }, []);

  // ── Fetch order book ──
  const fetchBook = useCallback(() => {
    const qs = new URLSearchParams({ cardName, game });
    if (condFilter) qs.set("condition", condFilter);
    fetch(`/api/orders?${qs}`)
      .then(r => r.json())
      .then((d: OrderBook) => { setBook(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [cardName, game, condFilter]);

  // ── Fetch tx stats ──
  const fetchStats = useCallback(() => {
    fetch(`/api/transactions?cardName=${encodeURIComponent(cardName)}&game=${encodeURIComponent(game)}`)
      .then(r => r.json())
      .then(setTxStats)
      .catch(() => {});
  }, [cardName, game]);

  // ── Fetch market cap ──
  const fetchMarketCap = useCallback(() => {
    fetch(`/api/market-cap?cardName=${encodeURIComponent(cardName)}&game=${encodeURIComponent(game)}`)
      .then(r => r.json())
      .then(setMarketCap)
      .catch(() => {});
  }, [cardName, game]);

  // ── Fetch my open orders ──
  const fetchMyOrders = useCallback(() => {
    if (!userId) return;
    fetch(`/api/orders?userId=${userId}`)
      .then(r => r.json())
      .then((d: { orders: OrderRow[] }) => {
        setMyOrders(
          (d.orders ?? []).filter(
            o => o.condition !== undefined &&
              (o as unknown as { card_name: string }).card_name?.toLowerCase() === cardName.toLowerCase() &&
              (o as unknown as { game: string }).game?.toLowerCase() === game.toLowerCase() &&
              (o as unknown as { status: string }).status === "open"
          )
        );
      })
      .catch(() => {});
  }, [userId, cardName, game]);

  useEffect(() => { fetchBook(); fetchStats(); fetchMarketCap(); }, [fetchBook, fetchStats, fetchMarketCap]);
  useEffect(() => { fetchMyOrders(); }, [fetchMyOrders]);

  // ── Place order ──
  async function handlePlaceOrder(e: React.FormEvent) {
    e.preventDefault();
    setOrderError("");
    const priceCents = Math.round(parseFloat(formPrice) * 100);
    if (!priceCents || priceCents < 1) { setOrderError("Enter a valid price."); return; }
    const qty = parseInt(formQty, 10);
    if (!qty || qty < 1) { setOrderError("Enter a valid quantity."); return; }

    setPlacing(true);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardName,
        game,
        type:          formType,
        priceCents,
        quantity:      qty,
        condition:     formCondition,
        note:          formNote.trim() || undefined,
        expiresInDays: parseInt(formExpiry, 10) || 30,
      }),
    });
    const data = await res.json();
    setPlacing(false);
    if (!res.ok) { setOrderError(data.error ?? "Failed to place order."); return; }
    setFormPrice("");
    setFormNote("");
    fetchBook();
    fetchMyOrders();
    fetchStats();
  }

  // ── Cancel order ──
  async function handleCancel(orderId: string) {
    if (!confirm("Cancel this order?")) return;
    await fetch(`/api/orders/${orderId}`, { method: "PATCH" });
    fetchBook();
    fetchMyOrders();
  }

  const gameLabel = GAME_LABELS[game] ?? game;

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 label-upper text-[10px] text-[var(--text-muted)]">
        <Link href="/tools/market" className="hover:text-[var(--foreground)] transition-colors">Market</Link>
        <span>/</span>
        <span>{gameLabel}</span>
        <span>/</span>
        <span>{cardName}</span>
      </div>

      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[var(--foreground)] leading-tight" style={{ fontFamily: "var(--font-serif, serif)" }}>
            {cardName}
          </h1>
          <p className="label-upper text-[10px] text-[var(--text-muted)] mt-1">{gameLabel} · Live Order Book</p>
        </div>

        {/* KPI strip */}
        <div className="flex flex-wrap gap-4 shrink-0">
          {txStats?.lastSoldCents != null && (
            <Kpi label="Last Sold" value={fmt(txStats.lastSoldCents)} />
          )}
          {txStats && <Kpi label="7d Vol" value={String(txStats.volume7d)} />}
          {txStats?.change7dPct != null && (
            <Kpi
              label="7d Chg"
              value={`${txStats.change7dPct > 0 ? "+" : ""}${txStats.change7dPct}%`}
              color={txStats.change7dPct >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}
            />
          )}
          {book?.midpoint != null && (
            <Kpi label="Mid" value={fmt(book.midpoint)} />
          )}
          {book?.spread != null && (
            <Kpi label="Spread" value={fmt(book.spread)} />
          )}
          {marketCap?.marketCapGlobal != null && (
            <Kpi label="Mkt Cap" value={fmtCap(marketCap.marketCapGlobal)} />
          )}
        </div>
      </div>

      {/* Condition filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setCondFilter("")}
          className={`label-upper text-[10px] px-3 py-1 border transition-colors ${!condFilter ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]" : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)]"}`}
        >All Conditions</button>
        {CONDITIONS.map(c => (
          <button
            key={c}
            onClick={() => setCondFilter(c)}
            className={`label-upper text-[10px] px-3 py-1 border transition-colors ${condFilter === c ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]" : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)]"}`}
          >{c}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Left: order book ────────────────────────────────────────────── */}
        <div className="lg:col-span-2 flex flex-col gap-8">

          {/* Order book table */}
          {loading ? (
            <div className="flex justify-center py-16">
              <span className="w-5 h-5 border-2 border-[var(--border)] border-t-[var(--foreground)] rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Bids */}
              <div>
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--border)]">
                  <span className="label-upper text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Bids (Buy)</span>
                  {book?.bestBid != null && (
                    <span className="label-upper text-[10px] text-[var(--text-muted)]">Best: {fmt(book.bestBid)}</span>
                  )}
                </div>
                {(book?.bids?.length ?? 0) === 0 ? (
                  <p className="text-sm text-[var(--text-muted)] py-4 text-center">No open bids</p>
                ) : (
                  <div className="flex flex-col divide-y divide-[var(--border)]">
                    {book!.bids.map((b) => (
                      <OrderRowItem key={b.id} row={b} type="bid" onCancel={userId ? () => handleCancel(b.id) : undefined} isOwn={userId === (b as unknown as { user_id?: string }).user_id} />
                    ))}
                  </div>
                )}
              </div>

              {/* Asks */}
              <div>
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--border)]">
                  <span className="label-upper text-[10px] text-red-500 dark:text-red-400 font-bold">Asks (Sell)</span>
                  {book?.bestAsk != null && (
                    <span className="label-upper text-[10px] text-[var(--text-muted)]">Best: {fmt(book.bestAsk)}</span>
                  )}
                </div>
                {(book?.asks?.length ?? 0) === 0 ? (
                  <p className="text-sm text-[var(--text-muted)] py-4 text-center">No open asks</p>
                ) : (
                  <div className="flex flex-col divide-y divide-[var(--border)]">
                    {book!.asks.map((a) => (
                      <OrderRowItem key={a.id} row={a} type="ask" onCancel={userId ? () => handleCancel(a.id) : undefined} isOwn={userId === (a as unknown as { user_id?: string }).user_id} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Volume chart */}
          {txStats && txStats.recentSales.length > 0 && (
            <div>
              <h2 className="label-upper text-[10px] text-[var(--text-muted)] mb-3 pb-2 border-b border-[var(--border)]">
                Sales Volume · 14d
              </h2>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <VolumeBars sales={txStats.recentSales} />
                  <div className="flex justify-between label-upper text-[8px] text-[var(--text-muted)] mt-1">
                    <span>14d ago</span><span>today</span>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <Sparkline sales={txStats.recentSales} />
                  <p className="label-upper text-[8px] text-[var(--text-muted)] mt-1 text-center">price trend</p>
                </div>
              </div>
            </div>
          )}

          {/* Recent sales */}
          {txStats && txStats.recentSales.length > 0 && (
            <div>
              <h2 className="label-upper text-[10px] text-[var(--text-muted)] mb-3 pb-2 border-b border-[var(--border)]">
                Recent Sales
              </h2>
              <div className="flex flex-col divide-y divide-[var(--border)]">
                {txStats.recentSales.slice(0, 10).map((s, i) => (
                  <div key={i} className="flex justify-between py-2 text-sm">
                    <span className="text-[var(--text-muted)] label-upper text-[10px]">{timeAgo(s.completedAt)}</span>
                    <span className="text-[var(--foreground)] font-medium">
                      {fmt(s.priceCents)} × {s.quantity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: place order + market cap ─────────────────────────────── */}
        <aside className="flex flex-col gap-6">

          {/* Market Cap */}
          {(marketCap?.supplyGlobal != null || marketCap?.marketCapGlobal != null) && (
            <div className="border border-[var(--border)] p-5 flex flex-col gap-3">
              <h2 className="label-upper text-[10px] text-[var(--text-muted)]">Market Cap Estimate</h2>
              {marketCap.rarity && (
                <p className="label-upper text-[9px] text-[var(--text-muted)]">Rarity: {marketCap.rarity}</p>
              )}
              {marketCap.lastSoldCents != null && (
                <p className="text-sm text-[var(--foreground)]">
                  Last price: <strong>{fmt(marketCap.lastSoldCents)}</strong>
                </p>
              )}
              {marketCap.supplyGlobal != null && (
                <div className="flex flex-col gap-1">
                  <p className="label-upper text-[9px] text-[var(--text-muted)]">Global supply est.</p>
                  <p className="font-bold text-[var(--foreground)]">{marketCap.supplyGlobal.toLocaleString()} copies</p>
                  {marketCap.marketCapGlobal != null && (
                    <p className="label-upper text-[10px] text-[var(--foreground)]">{fmtCap(marketCap.marketCapGlobal)} global mkt cap</p>
                  )}
                </div>
              )}
              {marketCap.supplyRegion != null && (
                <div className="flex flex-col gap-1">
                  <p className="label-upper text-[9px] text-[var(--text-muted)]">SEA/SG supply est.</p>
                  <p className="font-bold text-[var(--foreground)]">{marketCap.supplyRegion.toLocaleString()} copies</p>
                  {marketCap.marketCapRegion != null && (
                    <p className="label-upper text-[10px] text-[var(--foreground)]">{fmtCap(marketCap.marketCapRegion)} regional mkt cap</p>
                  )}
                </div>
              )}
              <p className="label-upper text-[8px] text-[var(--text-muted)] mt-1 leading-relaxed">
                Estimate = last sale price × circulating supply. Supply figures are approximate.
              </p>
            </div>
          )}

          {/* Place order form */}
          {!userId ? (
            <div className="border border-[var(--border)] p-5">
              <p className="label-upper text-[10px] text-[var(--text-muted)] mb-3">Place an Order</p>
              <a
                href="/login"
                className="block w-full text-center label-upper text-[10px] px-4 py-2.5 bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 transition-opacity"
              >
                Sign in →
              </a>
            </div>
          ) : (
            <form onSubmit={handlePlaceOrder} className="border border-[var(--border)] p-5 flex flex-col gap-4">
              <p className="label-upper text-[10px] text-[var(--text-muted)]">Place an Order</p>

              {/* Bid / Ask toggle */}
              <div className="flex gap-2">
                {(["bid", "ask"] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFormType(t)}
                    className={`flex-1 label-upper text-[10px] py-2 border transition-colors ${
                      formType === t
                        ? t === "bid"
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-red-600 text-white border-red-600"
                        : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {t === "bid" ? "🟢 Bid (Buy)" : "🔴 Ask (Sell)"}
                  </button>
                ))}
              </div>

              {formType === "bid" && (
                <p className="label-upper text-[9px] text-emerald-600 dark:text-emerald-400 leading-relaxed">
                  You want to buy at or below this price. Fills automatically if a matching ask exists.
                </p>
              )}
              {formType === "ask" && (
                <p className="label-upper text-[9px] text-red-500 dark:text-red-400 leading-relaxed">
                  You want to sell at this price. Fills automatically against the highest matching bid.
                </p>
              )}

              {/* Price */}
              <div>
                <label className="label-upper text-[9px] text-[var(--text-muted)] mb-1 block">Price (SGD $)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formPrice}
                  onChange={e => setFormPrice(e.target.value)}
                  placeholder={book?.midpoint ? (book.midpoint / 100).toFixed(2) : "0.00"}
                  required
                  className="w-full border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--foreground)]"
                />
              </div>

              {/* Quantity */}
              <div>
                <label className="label-upper text-[9px] text-[var(--text-muted)] mb-1 block">Quantity</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formQty}
                  onChange={e => setFormQty(e.target.value)}
                  required
                  className="w-full border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--foreground)]"
                />
              </div>

              {/* Condition */}
              <div>
                <label className="label-upper text-[9px] text-[var(--text-muted)] mb-1 block">Condition</label>
                <select
                  value={formCondition}
                  onChange={e => setFormCondition(e.target.value)}
                  className="w-full border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--foreground)]"
                >
                  {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Note */}
              <div>
                <label className="label-upper text-[9px] text-[var(--text-muted)] mb-1 block">Note (optional)</label>
                <input
                  type="text"
                  maxLength={120}
                  value={formNote}
                  onChange={e => setFormNote(e.target.value)}
                  placeholder="e.g. English only, prefer SG meetup"
                  className="w-full border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--foreground)]"
                />
              </div>

              {/* Expiry */}
              <div>
                <label className="label-upper text-[9px] text-[var(--text-muted)] mb-1 block">Expires in (days)</label>
                <select
                  value={formExpiry}
                  onChange={e => setFormExpiry(e.target.value)}
                  className="w-full border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--foreground)]"
                >
                  <option value="7">7 days</option>
                  <option value="14">14 days</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                </select>
              </div>

              {orderError && <p className="text-sm text-red-500">{orderError}</p>}

              <button
                type="submit"
                disabled={placing}
                className={`label-upper text-[10px] py-2.5 px-4 transition-colors disabled:opacity-40 ${
                  formType === "bid"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "bg-red-600 hover:bg-red-700 text-white"
                }`}
              >
                {placing ? "Placing…" : formType === "bid" ? "Place Bid →" : "Place Ask →"}
              </button>
            </form>
          )}

          {/* My open orders for this card */}
          {myOrders.length > 0 && (
            <div className="border border-[var(--border)] p-5 flex flex-col gap-3">
              <h2 className="label-upper text-[10px] text-[var(--text-muted)]">My Open Orders</h2>
              <div className="flex flex-col divide-y divide-[var(--border)]">
                {myOrders.map(o => {
                  const oAny = o as unknown as { type: string; status: string; id: string };
                  return (
                    <div key={o.id} className="py-2 flex justify-between items-center gap-2">
                      <div className="flex flex-col gap-0.5">
                        <span className={`label-upper text-[10px] font-bold ${oAny.type === "bid" ? "text-emerald-500" : "text-red-500"}`}>
                          {oAny.type === "bid" ? "BID" : "ASK"} · {fmt(o.price_cents)}
                        </span>
                        <span className="label-upper text-[9px] text-[var(--text-muted)]">
                          qty {o.quantity - o.quantity_filled} remaining · {o.condition}
                        </span>
                      </div>
                      <button
                        onClick={() => handleCancel(o.id)}
                        className="label-upper text-[9px] text-red-500 hover:text-red-700 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Marketplace link */}
          <Link
            href={`/marketplace?search=${encodeURIComponent(cardName)}`}
            className="label-upper text-[10px] px-4 py-2.5 border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors text-center block"
          >
            View Active Listings →
          </Link>
        </aside>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="label-upper text-[9px] text-[var(--text-muted)]">{label}</span>
      <span className={`font-black text-base leading-tight ${color ?? "text-[var(--foreground)]"}`}
            style={{ fontFamily: "var(--font-serif, serif)" }}>
        {value}
      </span>
    </div>
  );
}

function OrderRowItem({
  row, type, isOwn, onCancel,
}: {
  row: OrderRow;
  type: "bid" | "ask";
  isOwn: boolean;
  onCancel?: () => void;
}) {
  const remaining = row.quantity - row.quantity_filled;
  return (
    <div className="py-2 flex items-start justify-between gap-2">
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-bold text-sm ${type === "bid" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
            {fmt(row.price_cents)}
          </span>
          <span className="label-upper text-[9px] text-[var(--text-muted)]">×{remaining}</span>
          {isOwn && <span className="label-upper text-[8px] px-1 bg-[var(--muted)] border border-[var(--border)]">you</span>}
        </div>
        <span className="label-upper text-[9px] text-[var(--text-muted)]">
          {row.condition}
          {row.region && ` · ${row.region}`}
          {row.note && ` · ${row.note}`}
        </span>
        <span className="label-upper text-[8px] text-[var(--text-muted)]">@{row.username} · {timeAgo(row.created_at)}</span>
      </div>
      {isOwn && onCancel && (
        <button
          onClick={onCancel}
          className="label-upper text-[9px] text-red-500 hover:text-red-700 transition-colors shrink-0 mt-0.5"
        >✕</button>
      )}
    </div>
  );
}
