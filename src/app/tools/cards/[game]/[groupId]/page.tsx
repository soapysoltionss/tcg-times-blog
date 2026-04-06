"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { use } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { PriceGraph, PricePoint } from "@/components/PriceGraph";
import { getReprintRisk, REPRINT_RISK_STYLE, REPRINT_RISK_LABEL } from "@/lib/reprint-risk";

gsap.registerPlugin(ScrollTrigger);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CardData {
  productId: number;
  name: string;
  cleanName: string;
  number: string | null;
  rarity: string | null;
  imageUrl: string | null;
  marketPriceCents: number | null;
  midPriceCents: number | null;
  subTypeName: string;
}

interface SetData {
  groupId: number;
  name: string;
  game: string;
  categoryId: number;
  publishedOn: string | null;
  totalCards: number;
  cards: CardData[];
}

// ---------------------------------------------------------------------------
// Game config (visual theming)
// ---------------------------------------------------------------------------

const GAME_META: Record<string, { label: string; emoji: string; accent: string; badge: string; backBg: string }> = {
  pokemon: {
    label: "Pokémon",
    emoji: "⚡",
    accent: "#e3350d",
    badge: "bg-red-900/60 text-red-200 border-red-700/50",
    backBg: "from-red-950 to-yellow-950",
  },
  "flesh-and-blood": {
    label: "Flesh and Blood",
    emoji: "🩸",
    accent: "#dc2626",
    badge: "bg-rose-900/60 text-rose-200 border-rose-700/50",
    backBg: "from-rose-950 to-red-950",
  },
  "grand-archive": {
    label: "Grand Archive",
    emoji: "📖",
    accent: "#7c3aed",
    badge: "bg-violet-900/60 text-violet-200 border-violet-700/50",
    backBg: "from-violet-950 to-purple-950",
  },
  "one-piece": {
    label: "One Piece TCG",
    emoji: "🏴‍☠️",
    accent: "#d97706",
    badge: "bg-amber-900/60 text-amber-200 border-amber-700/50",
    backBg: "from-amber-950 to-orange-950",
  },
};

const CARD_BACKS: Record<string, string> = {
  "flesh-and-blood": "/fab-card-back.png",
  "grand-archive":   "/ga-card-back.jpg",
  "one-piece":       "/op-card-back.svg",
  "pokemon":         "/pokemon-card-back.png",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SortKey = "number" | "name" | "price-asc" | "price-desc" | "rarity";

function sortCards(cards: CardData[], key: SortKey): CardData[] {
  return [...cards].sort((a, b) => {
    switch (key) {
      case "number": {
        const na = parseInt(a.number ?? "9999", 10);
        const nb = parseInt(b.number ?? "9999", 10);
        return na - nb;
      }
      case "name":
        return a.name.localeCompare(b.name);
      case "price-asc":
        return (a.marketPriceCents ?? 0) - (b.marketPriceCents ?? 0);
      case "price-desc":
        return (b.marketPriceCents ?? 0) - (a.marketPriceCents ?? 0);
      case "rarity":
        return (a.rarity ?? "").localeCompare(b.rarity ?? "");
      default:
        return 0;
    }
  });
}

function formatCents(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  // tcgcsv returns "2025-01-17T00:00:00" (no timezone) — parse as UTC date only
  const datePart = iso.split("T")[0];
  const [y, m, d] = datePart.split("-").map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d));
  return utcDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

// ---------------------------------------------------------------------------
// CardItem — individual card in the grid
// ---------------------------------------------------------------------------

function CardItem({
  card,
  game,
  onSelect,
}: {
  card: CardData;
  game: string;
  onSelect: (card: CardData) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  function handleMouseMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width  - 0.5;
    const cy = (e.clientY - rect.top)  / rect.height - 0.5;
    gsap.to(el, {
      rotateY: cx * 18,
      rotateX: -cy * 12,
      scale: 1.04,
      duration: 0.2,
      ease: "power2.out",
      transformPerspective: 700,
    });
  }

  function handleMouseLeave() {
    const el = ref.current;
    if (!el) return;
    gsap.to(el, {
      rotateY: 0,
      rotateX: 0,
      scale: 1,
      duration: 0.6,
      ease: "elastic.out(1, 0.5)",
      transformPerspective: 700,
    });
  }

  const reprisk = getReprintRisk(card.name);
  const meta = GAME_META[game] ?? GAME_META["pokemon"];

  return (
    <button
      ref={ref}
      onClick={() => onSelect(card)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="card-item group relative flex flex-col text-left cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded-xl"
      style={{ willChange: "transform", transformStyle: "preserve-3d" }}
      aria-label={`View details for ${card.name}`}
    >
      {/* Card image */}
      <div className="relative w-full aspect-[2.5/3.5] rounded-xl overflow-hidden shadow-md bg-[var(--surface)]">
        {card.imageUrl ? (
          <Image
            src={card.imageUrl}
            alt={card.name}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 14vw"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${meta.backBg} flex items-center justify-center text-4xl`}>
            {meta.emoji}
          </div>
        )}

        {/* Reprint risk badge overlay */}
        {reprisk && (
          <span
            className={`absolute top-1.5 left-1.5 label-upper text-[8px] px-1.5 py-0.5 rounded border ${REPRINT_RISK_STYLE[reprisk.risk]}`}
          >
            {REPRINT_RISK_LABEL[reprisk.risk]}
          </span>
        )}

        {/* Price badge */}
        {card.marketPriceCents != null && (
          <span className="absolute bottom-1.5 right-1.5 bg-black/75 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
            {formatCents(card.marketPriceCents)}
          </span>
        )}
      </div>

      {/* Info below image */}
      <div className="mt-1.5 px-0.5">
        <p className="text-xs font-semibold text-[var(--foreground)] leading-snug truncate group-hover:text-white transition-colors">
          {card.name}
        </p>
        <div className="flex items-center justify-between mt-0.5 gap-1">
          {card.number && (
            <span className="label-upper text-[9px] text-[var(--text-muted)]">#{card.number}</span>
          )}
          {card.rarity && (
            <span className="label-upper text-[9px] text-[var(--text-muted)] truncate">{card.rarity}</span>
          )}
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// CardModal
// ---------------------------------------------------------------------------

function CardModal({
  card,
  game,
  setName,
  onClose,
}: {
  card: CardData;
  game: string;
  setName: string;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);
  const reprisk    = getReprintRisk(card.name);
  const meta       = GAME_META[game] ?? GAME_META["pokemon"];

  // Entrance animation
  useEffect(() => {
    const overlay = overlayRef.current;
    const panel   = panelRef.current;
    if (!overlay || !panel) return;
    gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.25 });
    gsap.fromTo(panel,   { opacity: 0, y: 40, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: "power2.out" });
  }, []);

  // Exit animation then call onClose
  function handleClose() {
    const overlay = overlayRef.current;
    const panel   = panelRef.current;
    if (!overlay || !panel) { onClose(); return; }
    gsap.to(panel,   { opacity: 0, y: 20, scale: 0.97, duration: 0.2, ease: "power2.in" });
    gsap.to(overlay, { opacity: 0, duration: 0.25, onComplete: onClose });
  }

  // Close on backdrop click
  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === overlayRef.current) handleClose();
  }

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Placeholder price history — in a real app you'd fetch this
  const mockPriceData: PricePoint[] = [];

  return (
    <div
      ref={overlayRef}
      onClick={handleBackdrop}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
    >
      <div
        ref={panelRef}
        className="relative w-full max-w-2xl bg-[var(--background)] border border-[var(--border-strong)] rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-[var(--surface)] hover:bg-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
          aria-label="Close"
        >
          ✕
        </button>

        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-0">
          {/* Card image column */}
          <div className={`bg-gradient-to-br ${meta.backBg} p-6 flex items-center justify-center sm:w-52`}>
            <div className="relative w-40 sm:w-44 aspect-[2.5/3.5] rounded-xl overflow-hidden shadow-xl">
              {card.imageUrl ? (
                <Image
                  src={card.imageUrl}
                  alt={card.name}
                  fill
                  className="object-cover"
                  unoptimized
                  sizes="176px"
                />
              ) : (
                <div className={`w-full h-full bg-gradient-to-br ${meta.backBg} flex items-center justify-center text-5xl`}>
                  {meta.emoji}
                </div>
              )}
            </div>
          </div>

          {/* Details column */}
          <div className="p-5 overflow-y-auto max-h-[80vh]">
            {/* Breadcrumb */}
            <p className="label-upper text-[9px] text-[var(--text-muted)] mb-1">
              {meta.emoji} {meta.label} · {setName}
            </p>

            {/* Card name */}
            <h2
              className="text-xl font-black text-[var(--foreground)] leading-tight mb-3"
              style={{ fontFamily: "var(--font-serif, serif)" }}
            >
              {card.name}
            </h2>

            {/* Meta pills */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {card.number && (
                <span className="label-upper text-[9px] px-2 py-0.5 rounded border border-[var(--border)] text-[var(--text-muted)]">
                  #{card.number}
                </span>
              )}
              {card.rarity && (
                <span className="label-upper text-[9px] px-2 py-0.5 rounded border border-[var(--border)] text-[var(--text-muted)]">
                  {card.rarity}
                </span>
              )}
              {card.subTypeName && card.subTypeName !== "Normal" && (
                <span className="label-upper text-[9px] px-2 py-0.5 rounded border border-[var(--border)] text-[var(--text-muted)]">
                  {card.subTypeName}
                </span>
              )}
              {reprisk && (
                <span className={`label-upper text-[9px] px-2 py-0.5 rounded border ${REPRINT_RISK_STYLE[reprisk.risk]}`}>
                  {REPRINT_RISK_LABEL[reprisk.risk]}
                </span>
              )}
            </div>

            {/* Prices */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-[var(--surface)] rounded-lg p-3">
                <p className="label-upper text-[9px] text-[var(--text-muted)] mb-0.5">Market Price</p>
                <p className="text-lg font-black text-[var(--foreground)]">
                  {formatCents(card.marketPriceCents)}
                </p>
              </div>
              <div className="bg-[var(--surface)] rounded-lg p-3">
                <p className="label-upper text-[9px] text-[var(--text-muted)] mb-0.5">Mid Price</p>
                <p className="text-lg font-black text-[var(--foreground)]">
                  {formatCents(card.midPriceCents)}
                </p>
              </div>
            </div>

            {/* Reprint risk note */}
            {reprisk && (
              <div className={`text-xs px-3 py-2 rounded-lg border mb-4 ${REPRINT_RISK_STYLE[reprisk.risk]}`}>
                <span className="font-bold">{REPRINT_RISK_LABEL[reprisk.risk]}: </span>
                {reprisk.notes}
              </div>
            )}

            {/* Price graph — placeholder until history API is wired up */}
            {card.marketPriceCents != null && (
              <div className="mb-4">
                <p className="label-upper text-[9px] text-[var(--text-muted)] mb-2">Price History</p>
                <PriceGraph cardName={card.name} data={mockPriceData} />
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 mt-1">
              <Link
                href={`/marketplace?game=${game}&search=${encodeURIComponent(card.name)}`}
                className="label-upper text-[10px] px-4 py-2 bg-[var(--foreground)] text-[var(--background)] rounded-lg hover:opacity-90 transition-opacity"
              >
                Find on Marketplace →
              </Link>
              <a
                href={`https://www.tcgplayer.com/search/all/product?q=${encodeURIComponent(card.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="label-upper text-[10px] px-4 py-2 border border-[var(--border)] text-[var(--text-muted)] rounded-lg hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition-colors"
              >
                TCGPlayer ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stats bar
// ---------------------------------------------------------------------------

function StatsBar({ cards, game }: { cards: CardData[]; game: string }) {
  const priced = cards.filter(c => c.marketPriceCents != null);
  const total  = cards.length;
  const avgCents = priced.length
    ? Math.round(priced.reduce((s, c) => s + (c.marketPriceCents ?? 0), 0) / priced.length)
    : null;
  const maxCard = priced.reduce<CardData | null>(
    (best, c) => (best == null || (c.marketPriceCents ?? 0) > (best.marketPriceCents ?? 0) ? c : best),
    null
  );

  const rarities = Array.from(new Set(cards.map(c => c.rarity).filter(Boolean)));

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {[
        { label: "Total Cards",    value: total.toString() },
        { label: "With Prices",    value: `${priced.length}` },
        { label: "Avg Market",     value: formatCents(avgCents) },
        { label: "Top Card",       value: maxCard?.name ?? "—", sub: formatCents(maxCard?.marketPriceCents ?? null) },
      ].map((s) => (
        <div key={s.label} className="bg-[var(--surface)] rounded-xl p-3 border border-[var(--border)]">
          <p className="label-upper text-[9px] text-[var(--text-muted)] mb-0.5">{s.label}</p>
          <p
            className="text-base font-black text-[var(--foreground)] leading-tight truncate"
            title={s.value}
          >
            {s.value}
          </p>
          {s.sub && (
            <p className="label-upper text-[9px] text-[var(--text-muted)] mt-0.5">{s.sub}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SetGalleryPage({
  params,
}: {
  params: Promise<{ game: string; groupId: string }>;
}) {
  const { game, groupId } = use(params);

  const [setData,  setSetData]   = useState<SetData | null>(null);
  const [loading,  setLoading]   = useState(true);
  const [error,    setError]     = useState("");
  const [query,    setQuery]     = useState("");
  const [sortKey,  setSortKey]   = useState<SortKey>("number");
  const [rarityFilter, setRarityFilter] = useState("all");
  const [selected, setSelected]  = useState<CardData | null>(null);

  const gridRef  = useRef<HTMLDivElement>(null);
  const heroRef  = useRef<HTMLDivElement>(null);

  // Fetch set data
  useEffect(() => {
    fetch(`/api/market-set?game=${encodeURIComponent(game)}&groupId=${encodeURIComponent(groupId)}`)
      .then(r => r.json())
      .then((d: SetData & { error?: string }) => {
        if (d.error) { setError(d.error); setLoading(false); return; }
        setSetData(d);
        setLoading(false);
      })
      .catch(() => { setError("Failed to load set."); setLoading(false); });
  }, [game, groupId]);

  // Hero entrance
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    gsap.fromTo(
      el.querySelectorAll(".hero-animate"),
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.5, ease: "power2.out", stagger: 0.08 }
    );
  }, [setData]);

  // Card grid stagger animation (runs when visible cards change)
  const animateGrid = useCallback(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const cards = Array.from(grid.querySelectorAll<HTMLElement>(".card-item"));
    gsap.fromTo(
      cards,
      { opacity: 0, y: 36, scale: 0.94 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.4,
        ease: "power2.out",
        stagger: 0.025,
        clearProps: "transform,opacity",
      }
    );
  }, []);

  // Trigger stagger when sort/filter/search changes
  useEffect(() => {
    animateGrid();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortKey, rarityFilter, query]);

  // Also trigger once data loads
  useEffect(() => {
    if (!loading && setData) {
      animateGrid();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const meta = GAME_META[game] ?? GAME_META["pokemon"];

  // Build filtered + sorted card list
  const allCards    = setData?.cards ?? [];
  const rarities    = Array.from(new Set(allCards.map(c => c.rarity).filter(Boolean))) as string[];
  const filtered    = allCards.filter(c => {
    const matchQ = !query || c.name.toLowerCase().includes(query.toLowerCase());
    const matchR = rarityFilter === "all" || c.rarity === rarityFilter;
    return matchQ && matchR;
  });
  const sorted      = sortCards(filtered, sortKey);

  // ---------------------------------------------------------------------------
  // Loading / error states
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--text-muted)]">
        <span className="animate-pulse">Loading set…</span>
      </div>
    );
  }

  if (error || !setData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-red-400">
        <p>{error || "Set not found."}</p>
        <Link href="/tools/cards" className="label-upper text-[10px] text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors">
          ← Back to sets
        </Link>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[var(--background)]">

      {/* ── Hero ── */}
      <div
        ref={heroRef}
        className={`relative overflow-hidden border-b border-[var(--border-strong)] bg-gradient-to-br ${meta.backBg}`}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12 md:py-16">
          {/* Breadcrumb */}
          <div className="hero-animate flex items-center gap-2 mb-4 text-white/40 text-xs">
            <Link href="/tools/cards" className="hover:text-white/70 transition-colors">
              Card Gallery
            </Link>
            <span>/</span>
            <span>{meta.emoji} {meta.label}</span>
          </div>

          <h1
            className="hero-animate text-4xl md:text-5xl font-black text-white leading-none tracking-tight mb-2"
            style={{ fontFamily: "var(--font-serif, serif)" }}
          >
            {setData.name}
          </h1>

          <div className="hero-animate flex flex-wrap items-center gap-3 mt-3">
            <span className="label-upper text-[10px] text-white/50">
              {formatDate(setData.publishedOn)}
            </span>
            <span className="label-upper text-[10px] px-2 py-0.5 rounded border border-white/20 text-white/60 bg-white/5">
              {setData.totalCards} cards
            </span>
          </div>
        </div>

        {/* Decorative lines */}
        <div className="absolute inset-0 pointer-events-none">
          {[0.15, 0.4, 0.65, 0.85].map((x, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 w-px bg-white/5"
              style={{ left: `${x * 100}%` }}
            />
          ))}
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="sticky top-0 z-30 bg-[var(--background)]/95 backdrop-blur-md border-b border-[var(--border-strong)]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-2.5 flex flex-wrap items-center gap-2">

          {/* Search */}
          <input
            type="search"
            placeholder="Search cards…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 min-w-[140px] max-w-xs text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-[var(--foreground)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--border-strong)]"
          />

          {/* Rarity filter */}
          {rarities.length > 0 && (
            <select
              value={rarityFilter}
              onChange={e => setRarityFilter(e.target.value)}
              className="text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-[var(--foreground)] focus:outline-none"
            >
              <option value="all">All Rarities</option>
              {rarities.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          )}

          {/* Sort */}
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
            className="text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-[var(--foreground)] focus:outline-none"
          >
            <option value="number">Sort: Number</option>
            <option value="name">Sort: Name</option>
            <option value="price-desc">Sort: Price ↓</option>
            <option value="price-asc">Sort: Price ↑</option>
            <option value="rarity">Sort: Rarity</option>
          </select>

          {/* Result count */}
          <span className="label-upper text-[9px] text-[var(--text-muted)] ml-auto shrink-0">
            {sorted.length} / {allCards.length}
          </span>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-8">

        {/* Stats — only when there are cards */}
        {allCards.length > 0 && <StatsBar cards={allCards} game={game} />}

        {/* Card grid */}
        {allCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <span className="text-5xl">{meta.emoji}</span>
            <p className="text-[var(--foreground)] font-bold text-lg">
              Individual cards not yet listed
            </p>
            <p className="text-[var(--text-muted)] text-sm max-w-sm leading-relaxed">
              TCGPlayer hasn&apos;t added individual card listings for{" "}
              <span className="text-[var(--foreground)] font-semibold">{setData.name}</span>{" "}
              yet. Check back after the set releases or once singles go on sale.
            </p>
            <a
              href={`https://www.tcgplayer.com/search/${game}/product?q=${encodeURIComponent(setData.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="label-upper text-[10px] px-4 py-2 border border-[var(--border)] text-[var(--text-muted)] rounded-lg hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition-colors"
            >
              Search on TCGPlayer ↗
            </a>
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16 text-[var(--text-muted)] text-sm">
            No cards match your filters.
          </div>
        ) : (
          <div
            ref={gridRef}
            className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3"
          >
            {sorted.map(card => (
              <CardItem
                key={card.productId}
                card={card}
                game={game}
                onSelect={setSelected}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {selected && (
        <CardModal
          card={selected}
          game={game}
          setName={setData.name}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
