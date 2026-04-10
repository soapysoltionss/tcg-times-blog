"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SetInfo {
  groupId: string;
  name: string;
  publishedOn: string | null;
  categoryId: number;
  totalCards?: number;
  setSymbolUrl?: string;
  source?: "pokemontcg" | "tcgcsv";
}

// ---------------------------------------------------------------------------
// Game config
// ---------------------------------------------------------------------------

const GAMES = [
  {
    slug: "pokemon",
    label: "Pokémon",
    shortLabel: "PKM",
    emoji: "⚡",
    // Market green — "price is up"
    accent: "#16a34a",
    accentMuted: "rgba(22,163,74,0.12)",
    accentBorder: "rgba(22,163,74,0.30)",
    accentText: "#4ade80",
    badge: "bg-green-900/60 text-green-200 border-green-700/50",
    description: "Every Pokémon set ever printed — from Base Set (1999) through Scarlet & Violet and beyond.",
  },
  {
    slug: "flesh-and-blood",
    label: "Flesh and Blood",
    shortLabel: "FaB",
    emoji: "🩸",
    // Ticker-chart blue — Bloomberg terminal style
    accent: "#0284c7",
    accentMuted: "rgba(2,132,199,0.12)",
    accentBorder: "rgba(2,132,199,0.30)",
    accentText: "#38bdf8",
    badge: "bg-sky-900/60 text-sky-200 border-sky-700/50",
    description: "Every FaB set from Alpha to the latest release.",
  },
  {
    slug: "grand-archive",
    label: "Grand Archive",
    shortLabel: "GA",
    emoji: "📖",
    // Data-terminal teal
    accent: "#0f766e",
    accentMuted: "rgba(15,118,110,0.12)",
    accentBorder: "rgba(15,118,110,0.30)",
    accentText: "#2dd4bf",
    badge: "bg-teal-900/60 text-teal-200 border-teal-700/50",
    description: "From Dawn of Ashes through the latest Grand Archive expansion.",
  },
  {
    slug: "one-piece",
    label: "One Piece TCG",
    shortLabel: "OP",
    emoji: "🏴‍☠️",
    // Gold / commodity
    accent: "#b45309",
    accentMuted: "rgba(180,83,9,0.12)",
    accentBorder: "rgba(180,83,9,0.30)",
    accentText: "#fbbf24",
    badge: "bg-amber-900/60 text-amber-200 border-amber-700/50",
    description: "All One Piece card sets from OP01 to present.",
  },
] as const;

type GameSlug = (typeof GAMES)[number]["slug"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse the date-only part of an ISO string as UTC to avoid timezone drift. */
function parseDate(iso: string): Date {
  // tcgcsv returns "2025-01-17T00:00:00" (no timezone) — treat as UTC date
  const datePart = iso.split("T")[0]; // "2025-01-17"
  const [y, m, d] = datePart.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return parseDate(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", timeZone: "UTC" });
}

// ---------------------------------------------------------------------------
// SetGrid — grouped by year, each year collapsible
// ---------------------------------------------------------------------------

function SetGrid({ game, sets }: { game: typeof GAMES[number]; sets: SetInfo[] }) {
  // Group sets by year, preserving sort order within each year
  const grouped = sets.reduce<Record<string, SetInfo[]>>((acc, s) => {
    const y = s.publishedOn ? String(parseDate(s.publishedOn).getUTCFullYear()) : "—";
    (acc[y] ??= []).push(s);
    return acc;
  }, {});

  // Years sorted newest first; "—" goes to end
  const years = Object.keys(grouped).sort((a, b) => {
    if (a === "—") return 1;
    if (b === "—") return -1;
    return Number(b) - Number(a);
  });

  // Most recent year open by default
  const [openYear, setOpenYear] = useState<string>(years[0] ?? "");

  // Re-open most recent when game changes
  useEffect(() => {
    setOpenYear(years[0] ?? "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.slug]);

  if (sets.length === 0) {
    return (
      <div className="py-24 text-center text-sm" style={{ color: "var(--text-muted)" }}>
        No sets found.
      </div>
    );
  }

  return (
    <div style={{ borderTop: "1px solid var(--border)" }}>
      {years.map((year) => {
        const isOpen = openYear === year;
        const count = grouped[year].length;
        return (
          <div key={year} style={{ borderBottom: "1px solid var(--border)" }}>
            {/* Year header — click to open/close */}
            <button
              onClick={() => setOpenYear(isOpen ? "" : year)}
              className="w-full flex items-center justify-between px-6 py-4 group"
              style={{ background: isOpen ? "var(--muted)" : "var(--background)", transition: "background 0.15s" }}
            >
              <div className="flex items-baseline gap-4">
                <span
                  className="font-bold"
                  style={{
                    fontFamily: "var(--font-serif, serif)",
                    fontSize: "clamp(1.4rem, 3vw, 2rem)",
                    color: isOpen ? game.accent : "var(--foreground)",
                    transition: "color 0.15s",
                  }}
                >
                  {year}
                </span>
                <span className="label-upper text-[9px]" style={{ color: "var(--text-muted)" }}>
                  {count} set{count !== 1 ? "s" : ""}
                </span>
              </div>
              <span
                className="label-upper text-[9px] transition-transform duration-200"
                style={{
                  color: "var(--text-muted)",
                  transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                  display: "inline-block",
                }}
              >
                ↓
              </span>
            </button>

            {/* Set grid for this year */}
            {isOpen && (
              <YearGrid sets={grouped[year]} game={game} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function YearGrid({ sets, game }: { sets: SetInfo[]; game: typeof GAMES[number] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cards = Array.from(el.querySelectorAll<HTMLElement>(".set-card"));
    gsap.fromTo(
      cards,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.35, ease: "power2.out", stagger: 0.04, clearProps: "transform,opacity" }
    );
  }, []);

  return (
    <div
      ref={ref}
      className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
      style={{ borderTop: "1px solid var(--border)", borderLeft: "1px solid var(--border)" }}
    >
      {sets.map((set) => (
        <SetCard key={set.groupId} set={set} game={game} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SetCard — Ravi Klaassens-inspired: dark, tall, typographic, minimal
// ---------------------------------------------------------------------------

function SetCard({ set, game }: { set: SetInfo; game: typeof GAMES[number] }) {
  const year = set.publishedOn ? parseDate(set.publishedOn).getUTCFullYear() : null;
  const month = set.publishedOn
    ? parseDate(set.publishedOn).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })
    : null;

  return (
    <Link
      href={`/tools/cards/${game.slug}/${set.groupId}${set.source === "tcgcsv" ? "?src=tcgcsv" : ""}`}
      className="set-card group relative flex flex-col justify-between overflow-hidden cursor-pointer"
      style={{
        borderRight: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
        background: "var(--background)",
        minHeight: "11rem",
        padding: "1.5rem 1.4rem 1.1rem",
      }}
    >
      {/* Accent line — CSS transition, scoped to this card via group */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-out"
        style={{ background: game.accent }}
      />

      {/* Top row: game tag + symbol */}
      <div className="flex items-center justify-between mb-3">
        <span
          className="label-upper text-[8px] tracking-[0.18em]"
          style={{ color: game.accent }}
        >
          {game.shortLabel}
        </span>
        {set.setSymbolUrl ? (
          <Image
            src={set.setSymbolUrl}
            alt="" width={14} height={14}
            className="object-contain opacity-30 group-hover:opacity-70 transition-opacity duration-300"
            unoptimized
          />
        ) : (
          <span className="text-[11px] opacity-25 group-hover:opacity-60 transition-opacity">{game.emoji}</span>
        )}
      </div>

      {/* Set name */}
      <p
        className="flex-1 font-bold leading-[1.2] line-clamp-3 -translate-y-0 group-hover:-translate-y-0.5 transition-transform duration-300 ease-out"
        style={{
          fontFamily: "var(--font-serif, serif)",
          fontSize: "clamp(0.9rem, 1.3vw, 1.05rem)",
          color: "var(--foreground)",
        }}
      >
        {set.name}
      </p>

      {/* Footer */}
      <div
        className="flex items-end justify-between mt-3 pt-2.5"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <span className="label-upper text-[8px]" style={{ color: "var(--text-muted)" }}>
          {month && year ? `${month} ${year}` : "—"}
        </span>
        <span
          className="label-upper text-[9px] font-bold opacity-0 translate-x-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200 ease-out"
          style={{ color: game.accent }}
        >
          View →
        </span>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// LoadingSkeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
      style={{ borderTop: "1px solid var(--border)", borderLeft: "1px solid var(--border)" }}
    >
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse"
          style={{
            height: "11rem",
            borderRight: "1px solid var(--border)",
            borderBottom: "1px solid var(--border)",
            background: "var(--muted)",
            animationDelay: `${i * 0.04}s`,
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card search types
// ---------------------------------------------------------------------------

interface CardSearchResult {
  productId: number | string;
  name: string;
  imageUrl?: string | null;
  marketPriceCents?: number | null;
  rarity?: string;
  setName?: string;
  groupId?: string | number;
}

// ---------------------------------------------------------------------------
// CardSearchResults
// ---------------------------------------------------------------------------

function CardSearchResults({
  query,
  game,
  gameAccent,
}: {
  query: string;
  game: string;
  gameAccent: string;
  gameAccentMuted: string;
  gameAccentBorder: string;
  gameAccentText: string;
}) {
  const [results, setResults] = useState<CardSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState("");

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setSearched(""); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/sets?game=${encodeURIComponent(game)}&cardSearch=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      setResults(data.cards ?? []);
      setSearched(q.trim());
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [game]);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 400);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  if (!query.trim()) return null;

  return (
    <div className="mt-8">
      {/* Header */}
      <div className="flex items-baseline gap-4 mb-5" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem" }}>
        <h3
          className="text-base font-bold"
          style={{ fontFamily: "var(--font-serif, serif)", color: "var(--foreground)" }}
        >
          Cards
        </h3>
        {searched && !loading && (
          <span className="label-upper text-[9px]" style={{ color: "var(--text-muted)" }}>
            &ldquo;{searched}&rdquo; — {results.length} result{results.length !== 1 ? "s" : ""}
          </span>
        )}
        {loading && (
          <span className="label-upper text-[9px] animate-pulse" style={{ color: "var(--text-muted)" }}>
            Searching…
          </span>
        )}
      </div>

      {!loading && searched && results.length === 0 && (
        <p className="text-sm py-8" style={{ color: "var(--text-muted)" }}>No cards found.</p>
      )}

      <div
        className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8"
        style={{ borderTop: "1px solid var(--border)", borderLeft: "1px solid var(--border)" }}
      >
        {results.map((card) => (
          <Link
            key={card.productId}
            href={card.groupId ? `/tools/cards/${game}/${card.groupId}` : "#"}
            className="group relative flex flex-col overflow-hidden cursor-pointer"
            style={{
              borderRight: "1px solid var(--border)",
              borderBottom: "1px solid var(--border)",
              background: "var(--background)",
            }}
          >
            {/* Hover accent line */}
            <div
              className="absolute top-0 left-0 right-0 h-[2px] origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300"
              style={{ background: gameAccent }}
            />

            {/* Card image */}
            {card.imageUrl ? (
              <div className="relative w-full aspect-[2.5/3.5] overflow-hidden">
                <Image
                  src={card.imageUrl}
                  alt={card.name}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  unoptimized
                />
              </div>
            ) : (
              <div
                className="w-full aspect-[2.5/3.5] flex items-center justify-center text-2xl"
                style={{ background: "var(--muted)" }}
              >
                🃏
              </div>
            )}

            <div className="p-2 flex flex-col gap-0.5">
              <p
                className="text-[10px] font-bold leading-snug line-clamp-2"
                style={{ fontFamily: "var(--font-serif, serif)", color: "var(--foreground)" }}
              >
                {card.name}
              </p>
              {card.setName && (
                <p className="label-upper text-[8px] truncate" style={{ color: "var(--text-muted)" }}>
                  {card.setName}
                </p>
              )}
              {card.marketPriceCents != null && card.marketPriceCents > 0 && (
                <p className="label-upper text-[9px] font-black mt-0.5" style={{ color: gameAccent }}>
                  ${(card.marketPriceCents / 100).toFixed(2)}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CardsIndexPage() {
  const [activeGame, setActiveGame] = useState<GameSlug>("pokemon");
  const [sets, setSets] = useState<SetInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"set" | "card">("set");

  const heroRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Hero entrance animation
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    gsap.fromTo(
      el.querySelectorAll(".hero-animate"),
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.6, ease: "power2.out", stagger: 0.1 }
    );
  }, []);

  // Fetch sets when game tab changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setSets([]);

    fetch(`/api/sets?game=${activeGame}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data.error) { setError(data.error); setLoading(false); return; }
        setSets(data.sets ?? []);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) { setError("Failed to load sets."); setLoading(false); }
      });

    return () => { cancelled = true; };
  }, [activeGame]);

  const activeGameMeta = GAMES.find(g => g.slug === activeGame)!;

  // Filter sets by search query (set mode) or show all (card mode)
  const filteredSets = searchMode === "set" && searchQuery.trim()
    ? sets.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : sets;

  // Detect if query looks more like a card (>2 words or starts with a pokemon name hint)
  function handleSearchInput(val: string) {
    setSearchQuery(val);
    // Auto-switch mode: if the query is long/specific, likely a card search
    if (val.length > 18) setSearchMode("card");
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>

      {/* ── Hero ── */}
      <div ref={heroRef} className="max-w-7xl mx-auto px-6 lg:px-12 pt-16 pb-10">
        <p className="hero-animate label-upper text-[9px] mb-5" style={{ color: "var(--text-muted)" }}>
          TCG Times — Card Database
        </p>
        <h1
          className="hero-animate font-bold leading-[0.95] tracking-tight"
          style={{
            fontFamily: "var(--font-serif, serif)",
            fontSize: "clamp(3rem, 8vw, 7rem)",
            color: "var(--foreground)",
          }}
        >
          Card<br />Gallery
        </h1>
        <p className="hero-animate mt-5 text-sm max-w-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Browse every set across Pokémon, Flesh and Blood, Grand Archive, and One Piece. Live prices, full card details.
        </p>
      </div>

      {/* ── Game tabs + search ── sticky bar ── */}
      <div
        className="sticky top-0 z-30 backdrop-blur-md"
        style={{
          background: "color-mix(in srgb, var(--background) 92%, transparent)",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex items-center gap-0">
          {/* Game tabs */}
          <div className="flex items-center overflow-x-auto shrink-0" style={{ borderRight: "1px solid var(--border)" }}>
            {GAMES.map((g) => (
              <button
                key={g.slug}
                onClick={() => { setActiveGame(g.slug); setSearchQuery(""); }}
                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-3.5 label-upper text-[10px] transition-colors duration-150"
                style={{
                  background: activeGame === g.slug ? g.accent : "transparent",
                  color: activeGame === g.slug ? "#fff" : "var(--text-muted)",
                  borderRight: "1px solid var(--border)",
                }}
              >
                <span>{g.emoji}</span>
                <span>{g.shortLabel}</span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex-1 flex items-center gap-2 px-4">
            <svg width="13" height="13" viewBox="0 0 15 15" fill="none" className="shrink-0 opacity-30">
              <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder={`Search ${activeGameMeta.label} sets or cards…`}
              className="flex-1 bg-transparent text-sm outline-none py-3.5"
              style={{ color: "var(--foreground)" }}
            />
            {/* Mode pills */}
            <div className="flex items-center gap-1 shrink-0">
              {(["set", "card"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSearchMode(mode)}
                  className="px-2 py-0.5 label-upper text-[8px] rounded-full transition-colors"
                  style={{
                    background: searchMode === mode ? activeGameMeta.accent : "transparent",
                    color: searchMode === mode ? "#fff" : "var(--text-muted)",
                    border: `1px solid ${searchMode === mode ? activeGameMeta.accent : "var(--border)"}`,
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(""); searchRef.current?.focus(); }}
                className="shrink-0 text-sm leading-none transition-opacity hover:opacity-60"
                style={{ color: "var(--text-muted)" }}
              >
                ×
              </button>
            )}
          </div>

          {/* Set count */}
          {!loading && sets.length > 0 && (
            <span className="label-upper text-[9px] px-4 shrink-0" style={{ color: "var(--text-muted)", borderLeft: "1px solid var(--border)", paddingTop: "1rem", paddingBottom: "1rem" }}>
              {sets.length} sets
            </span>
          )}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-8">

        {error && (
          <p className="text-sm py-10 text-center" style={{ color: "#f87171" }}>{error}</p>
        )}

        {/* Set-name filter count */}
        {searchMode === "set" && searchQuery.trim() && !loading && (
          <p className="label-upper text-[9px] mb-4" style={{ color: "var(--text-muted)" }}>
            {filteredSets.length} set{filteredSets.length !== 1 ? "s" : ""} matching &ldquo;{searchQuery}&rdquo;
          </p>
        )}

        {searchMode === "card" && searchQuery.trim() ? (
          <CardSearchResults
            query={searchQuery}
            game={activeGame}
            gameAccent={activeGameMeta.accent}
            gameAccentMuted={activeGameMeta.accentMuted}
            gameAccentBorder={activeGameMeta.accentBorder}
            gameAccentText={activeGameMeta.accentText}
          />
        ) : (
          loading ? <LoadingSkeleton /> : <SetGrid game={activeGameMeta} sets={filteredSets} />
        )}
      </div>
    </div>
  );
}
