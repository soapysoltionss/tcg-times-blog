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
    accent: "#e3350d",
    accentMuted: "rgba(227,53,13,0.15)",
    accentBorder: "rgba(227,53,13,0.35)",
    accentText: "#ff6b4a",
    badge: "bg-red-900/60 text-red-200 border-red-700/50",
    description: "All sets from Scarlet & Violet, Sword & Shield, and beyond.",
  },
  {
    slug: "flesh-and-blood",
    label: "Flesh and Blood",
    shortLabel: "FaB",
    emoji: "🩸",
    accent: "#dc2626",
    accentMuted: "rgba(220,38,38,0.15)",
    accentBorder: "rgba(220,38,38,0.35)",
    accentText: "#f87171",
    badge: "bg-rose-900/60 text-rose-200 border-rose-700/50",
    description: "Every FaB set from Alpha to the latest release.",
  },
  {
    slug: "grand-archive",
    label: "Grand Archive",
    shortLabel: "GA",
    emoji: "📖",
    accent: "#7c3aed",
    accentMuted: "rgba(124,58,237,0.15)",
    accentBorder: "rgba(124,58,237,0.35)",
    accentText: "#a78bfa",
    badge: "bg-violet-900/60 text-violet-200 border-violet-700/50",
    description: "From Dawn of Ashes through the latest Grand Archive expansion.",
  },
  {
    slug: "one-piece",
    label: "One Piece TCG",
    shortLabel: "OP",
    emoji: "🏴‍☠️",
    accent: "#d97706",
    accentMuted: "rgba(217,119,6,0.15)",
    accentBorder: "rgba(217,119,6,0.35)",
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
// SetGrid — renders a game's sets with GSAP stagger
// ---------------------------------------------------------------------------

function SetGrid({ game, sets }: { game: typeof GAMES[number]; sets: SetInfo[] }) {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || sets.length === 0) return;

    const cards = Array.from(grid.querySelectorAll<HTMLElement>(".set-card"));
    gsap.fromTo(
      cards,
      { opacity: 0, y: 30, scale: 0.96 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.4,
        ease: "power2.out",
        stagger: 0.03,
        clearProps: "transform,opacity",
        scrollTrigger: {
          trigger: grid,
          start: "top 90%",
          once: true,
        },
      }
    );

    return () => { ScrollTrigger.getAll().forEach(t => t.kill()); };
  }, [sets]);

  if (sets.length === 0) {
    return (
      <div className="text-center py-16 text-[var(--text-muted)] text-sm">
        No sets found.
      </div>
    );
  }

  return (
    <div
      ref={gridRef}
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3"
    >
      {sets.map((set) => (
        <SetCard key={set.groupId} set={set} game={game} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SetCard — clean glass tile with game-color top accent strip
// ---------------------------------------------------------------------------

function SetCard({ set, game }: { set: SetInfo; game: typeof GAMES[number] }) {
  const cardRef = useRef<HTMLAnchorElement>(null);

  function handleMouseMove(e: React.MouseEvent<HTMLAnchorElement>) {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width  - 0.5;
    const cy = (e.clientY - rect.top)  / rect.height - 0.5;
    gsap.to(el, {
      rotateY: cx * 12,
      rotateX: -cy * 8,
      duration: 0.2,
      ease: "power2.out",
      transformPerspective: 600,
    });
  }

  function handleMouseLeave() {
    const el = cardRef.current;
    if (!el) return;
    gsap.to(el, {
      rotateY: 0,
      rotateX: 0,
      duration: 0.5,
      ease: "elastic.out(1, 0.6)",
      transformPerspective: 600,
    });
  }

  const year = set.publishedOn ? parseDate(set.publishedOn).getUTCFullYear() : null;

  return (
    <Link
      ref={cardRef}
      href={`/tools/cards/${game.slug}/${set.groupId}${set.source === "tcgcsv" ? "?src=tcgcsv" : ""}`}
      className="set-card group relative flex flex-col overflow-hidden rounded-xl cursor-pointer"
      style={{
        willChange: "transform",
        transformStyle: "preserve-3d",
        background: "var(--card-bg, color-mix(in srgb, var(--foreground) 5%, var(--background)))",
        border: `1px solid ${game.accentBorder}`,
        boxShadow: `0 0 0 0 ${game.accentMuted}`,
        transition: "box-shadow 0.2s ease, border-color 0.2s ease",
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 24px ${game.accentMuted}, inset 0 1px 0 rgba(255,255,255,0.06)`;
      }}
    >
      {/* Accent top strip */}
      <div
        className="h-0.5 w-full shrink-0"
        style={{ background: `linear-gradient(90deg, ${game.accent}, transparent)` }}
      />

      <div className="flex flex-col flex-1 p-3.5 gap-2.5">
        {/* Top row: symbol + year */}
        <div className="flex items-start justify-between gap-1">
          {set.setSymbolUrl ? (
            <Image
              src={set.setSymbolUrl}
              alt=""
              width={28}
              height={28}
              className="object-contain opacity-80 group-hover:opacity-100 transition-opacity"
              unoptimized
            />
          ) : (
            <span className="text-xl leading-none">{game.emoji}</span>
          )}
          {year && (
            <span
              className="label-upper text-[9px] px-1.5 py-0.5 rounded shrink-0"
              style={{
                background: game.accentMuted,
                color: game.accentText,
                border: `1px solid ${game.accentBorder}`,
              }}
            >
              {year}
            </span>
          )}
        </div>

        {/* Set name */}
        <p
          className="text-xs font-bold leading-snug text-[var(--foreground)] group-hover:opacity-80 transition-opacity line-clamp-3 flex-1"
          style={{ fontFamily: "var(--font-serif, serif)" }}
        >
          {set.name}
        </p>

        {/* Footer: date + arrow */}
        <div className="flex items-center justify-between">
          <p className="label-upper text-[9px] text-[var(--text-muted)]">
            {formatDate(set.publishedOn)}
          </p>
          <span
            className="text-xs opacity-0 group-hover:opacity-60 transition-opacity"
            style={{ color: game.accentText }}
          >
            →
          </span>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// LoadingSkeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {Array.from({ length: 18 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl h-28 animate-pulse"
          style={{
            background: "color-mix(in srgb, var(--foreground) 6%, var(--background))",
            border: "1px solid color-mix(in srgb, var(--foreground) 10%, var(--background))",
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
// CardSearchResults — inline card hits shown below search bar
// ---------------------------------------------------------------------------

function CardSearchResults({
  query,
  game,
  gameAccent,
  gameAccentMuted,
  gameAccentBorder,
  gameAccentText,
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
    <div className="mt-6">
      <div className="flex items-center gap-3 mb-4">
        <h3
          className="text-sm font-bold text-[var(--foreground)]"
          style={{ fontFamily: "var(--font-serif, serif)" }}
        >
          Card results
        </h3>
        {searched && (
          <span className="label-upper text-[9px] text-[var(--text-muted)]">
            for &ldquo;{searched}&rdquo;
          </span>
        )}
        {loading && (
          <span className="text-[10px] text-[var(--text-muted)] animate-pulse">Searching…</span>
        )}
      </div>

      {!loading && searched && results.length === 0 && (
        <p className="text-sm text-[var(--text-muted)] py-4">No cards found.</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {results.map((card) => (
          <Link
            key={card.productId}
            href={card.groupId ? `/tools/cards/${game}/${card.groupId}` : "#"}
            className="group relative rounded-xl overflow-hidden flex flex-col"
            style={{
              background: "color-mix(in srgb, var(--foreground) 5%, var(--background))",
              border: `1px solid ${gameAccentBorder}`,
              transition: "box-shadow 0.2s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 20px ${gameAccentMuted}`;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
          >
            {/* Accent strip */}
            <div
              className="h-0.5 w-full shrink-0"
              style={{ background: `linear-gradient(90deg, ${gameAccent}, transparent)` }}
            />

            {/* Card image */}
            {card.imageUrl ? (
              <div className="relative w-full aspect-[2.5/3.5] bg-black/20">
                <Image
                  src={card.imageUrl}
                  alt={card.name}
                  fill
                  className="object-contain p-1.5"
                  unoptimized
                />
              </div>
            ) : (
              <div
                className="w-full aspect-[2.5/3.5] flex items-center justify-center text-3xl"
                style={{ background: gameAccentMuted }}
              >
                🃏
              </div>
            )}

            <div className="p-2.5 flex flex-col gap-1">
              <p
                className="text-xs font-bold leading-snug text-[var(--foreground)] line-clamp-2"
                style={{ fontFamily: "var(--font-serif, serif)" }}
              >
                {card.name}
              </p>
              {card.rarity && (
                <p className="label-upper text-[9px] text-[var(--text-muted)]">{card.rarity}</p>
              )}
              {card.marketPriceCents != null && card.marketPriceCents > 0 && (
                <p
                  className="label-upper text-[10px] font-bold"
                  style={{ color: gameAccentText }}
                >
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
    <div className="min-h-screen bg-[var(--background)]">

      {/* ── Hero ── */}
      <div
        ref={heroRef}
        className="relative overflow-hidden border-b border-[var(--border-strong)]"
        style={{
          background: "linear-gradient(135deg, var(--background) 0%, color-mix(in srgb, var(--foreground) 4%, var(--background)) 100%)",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-14 md:py-20">
          <p className="hero-animate label-upper text-[10px] text-[var(--text-muted)] mb-3">TCG Times — Card Database</p>
          <h1
            className="hero-animate text-4xl md:text-6xl font-black text-[var(--foreground)] leading-none tracking-tight mb-4"
            style={{ fontFamily: "var(--font-serif, serif)" }}
          >
            Card Gallery
          </h1>
          <p className="hero-animate text-[var(--text-muted)] text-base max-w-xl leading-relaxed">
            Browse every set across Pokémon, Flesh and Blood, Grand Archive, and One Piece TCG.
            Live market prices, rarity breakdowns, and full card details.
          </p>
        </div>

        {/* Decorative lines */}
        <div className="absolute inset-0 pointer-events-none">
          {[0.2, 0.45, 0.7, 0.88].map((x, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 w-px bg-[var(--border)]"
              style={{ left: `${x * 100}%`, opacity: 0.3 }}
            />
          ))}
        </div>
      </div>

      {/* ── Game tabs ── */}
      <div className="sticky top-0 z-30 bg-[var(--background)]/95 backdrop-blur-md border-b border-[var(--border-strong)]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="flex items-center gap-0 divide-x divide-[var(--border)] overflow-x-auto">
            {GAMES.map((g) => (
              <button
                key={g.slug}
                onClick={() => setActiveGame(g.slug)}
                className={`flex-shrink-0 flex items-center gap-2 px-5 py-3.5 label-upper text-[11px] transition-colors ${
                  activeGame === g.slug
                    ? "bg-[var(--foreground)] text-[var(--background)]"
                    : "text-[var(--text-muted)] hover:text-[var(--foreground)]"
                }`}
              >
                <span>{g.emoji}</span>
                <span>{g.shortLabel}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-8">

        {/* Game header */}
        <div className="mb-5 flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-4">
          <div>
            <h2
              className="text-2xl font-black text-[var(--foreground)] flex items-center gap-2"
              style={{ fontFamily: "var(--font-serif, serif)" }}
            >
              <span>{activeGameMeta.emoji}</span>
              <span>{activeGameMeta.label}</span>
            </h2>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">{activeGameMeta.description}</p>
          </div>
          {!loading && sets.length > 0 && (
            <span className="label-upper text-[10px] text-[var(--text-muted)] sm:ml-auto shrink-0">
              {sets.length} sets
            </span>
          )}
        </div>

        {/* ── Search bar ── */}
        <div className="mb-6">
          <div
            className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{
              background: "color-mix(in srgb, var(--foreground) 5%, var(--background))",
              border: `1px solid ${searchQuery ? activeGameMeta.accentBorder : "color-mix(in srgb, var(--foreground) 12%, var(--background))"}`,
              transition: "border-color 0.2s ease",
              boxShadow: searchQuery ? `0 0 0 3px ${activeGameMeta.accentMuted}` : "none",
            }}
          >
            {/* Search icon */}
            <svg
              width="15" height="15" viewBox="0 0 15 15" fill="none"
              className="shrink-0 opacity-40"
              style={{ color: searchQuery ? activeGameMeta.accentText : "var(--foreground)" }}
            >
              <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>

            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder={`Search sets or cards in ${activeGameMeta.label}…`}
              className="flex-1 bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--text-muted)] outline-none"
            />

            {/* Mode toggle */}
            <div
              className="flex items-center rounded-lg overflow-hidden shrink-0"
              style={{ border: `1px solid color-mix(in srgb, var(--foreground) 12%, var(--background))` }}
            >
              {(["set", "card"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSearchMode(mode)}
                  className="px-2.5 py-1 label-upper text-[9px] transition-colors"
                  style={{
                    background: searchMode === mode ? activeGameMeta.accentMuted : "transparent",
                    color: searchMode === mode ? activeGameMeta.accentText : "var(--text-muted)",
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* Clear */}
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(""); searchRef.current?.focus(); }}
                className="shrink-0 text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors text-sm leading-none"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="text-red-400 text-sm text-center py-10">{error}</div>
        )}

        {/* Card search results (card mode with query) */}
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
          /* Sets grid (with optional set-name filter) */
          <>
            {searchMode === "set" && searchQuery.trim() && !loading && (
              <p className="text-xs text-[var(--text-muted)] mb-4">
                {filteredSets.length} set{filteredSets.length !== 1 ? "s" : ""} matching &ldquo;{searchQuery}&rdquo;
              </p>
            )}
            {loading
              ? <LoadingSkeleton />
              : <SetGrid game={activeGameMeta} sets={filteredSets} />
            }
          </>
        )}
      </div>
    </div>
  );
}
