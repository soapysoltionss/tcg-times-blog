"use client";

import { useState, useCallback, FormEvent } from "react";
import Link from "next/link";
import { PriceGraph, type PricePoint } from "@/components/PriceGraph";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GAMES = [
  { id: "",               label: "All Games"        },
  { id: "pokemon",        label: "Pokémon"           },
  { id: "flesh-and-blood",label: "Flesh and Blood"  },
  { id: "grand-archive",  label: "Grand Archive"    },
  { id: "one-piece",      label: "One Piece TCG"    },
  { id: "magic",          label: "Magic: The Gathering" },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MentionedPost {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  coverImage: string | null;
  category: string;
}

interface TrackerResult {
  cardName: string;
  game: string | null;
  latestPriceCents: number | null;
  dayChangePct: number | null;
  history: PricePoint[];
  mentionedIn: MentionedPost[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtPct(pct: number) {
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MentionedCard({ post }: { post: MentionedPost }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex gap-4 border border-[var(--border)] bg-[var(--background)] hover:border-[var(--border-strong)] transition-all p-4"
    >
      {post.coverImage && (
        <img
          src={post.coverImage}
          alt=""
          className="w-20 h-14 object-cover flex-shrink-0"
        />
      )}
      <div className="min-w-0">
        <p className="label-upper text-[10px] text-[var(--text-muted)] mb-1">
          {post.category} · {formatDate(post.date)}
        </p>
        <h3 className="font-semibold text-sm leading-snug group-hover:text-[var(--accent)] transition-colors line-clamp-2">
          {post.title}
        </h3>
        <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">
          {post.excerpt}
        </p>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PriceTrackerPage() {
  const [cardName, setCardName] = useState("");
  const [game, setGame] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrackerResult | null>(null);

  const search = useCallback(
    async (name: string, gameId: string) => {
      if (!name.trim()) return;
      setLoading(true);
      setError(null);
      setResult(null);
      try {
        const params = new URLSearchParams({ cardName: name.trim() });
        if (gameId) params.set("game", gameId);
        const res = await fetch(`/api/price-tracker?${params}`);
        if (!res.ok) throw new Error("Failed to fetch price data");
        const data: TrackerResult = await res.json();
        setResult(data);
      } catch {
        setError("Could not load price data. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    search(cardName, game);
  };

  const hasHistory = result && result.history.length > 0;
  const noData = result && result.history.length === 0 && result.mentionedIn.length === 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Price Tracker</h1>
        <p className="text-[var(--text-muted)] text-sm">
          Search any card to see its full TCGPlayer price history and find TCG Times articles that mention it.
        </p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 mb-10">
        <input
          type="text"
          value={cardName}
          onChange={(e) => setCardName(e.target.value)}
          placeholder="Card name, e.g. Charizard ex"
          className="flex-1 border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--border-strong)]"
          required
        />
        <select
          value={game}
          onChange={(e) => setGame(e.target.value)}
          className="border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--border-strong)] cursor-pointer"
        >
          {GAMES.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={loading || !cardName.trim()}
          className="px-5 py-2.5 bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity cursor-pointer"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 mb-6">{error}</p>
      )}

      {/* No data found */}
      {noData && (
        <div className="border border-[var(--border)] p-8 text-center text-[var(--text-muted)] text-sm">
          No price history or articles found for &ldquo;{result.cardName}&rdquo;.
          <br />
          Try a different spelling or a broader game filter.
        </div>
      )}

      {/* Results */}
      {result && (hasHistory || result.mentionedIn.length > 0) && (
        <div className="space-y-10">
          {/* Price summary */}
          <div>
            <div className="flex items-baseline gap-3 mb-4">
              <h2 className="text-lg font-bold">{result.cardName}</h2>
              {result.game && (
                <span className="label-upper text-[10px] text-[var(--text-muted)]">
                  {GAMES.find((g) => g.id === result.game)?.label ?? result.game}
                </span>
              )}
            </div>

            {/* Current price + change */}
            {result.latestPriceCents !== null && (
              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl font-bold">
                  {fmt(result.latestPriceCents)}
                </span>
                {result.dayChangePct !== null && (
                  <span
                    className={`text-sm font-medium ${
                      result.dayChangePct >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {fmtPct(result.dayChangePct)} today
                  </span>
                )}
                <span className="text-xs text-[var(--text-muted)]">TCGPlayer market price</span>
              </div>
            )}

            {/* Price graph */}
            {hasHistory ? (
              <PriceGraph
                cardName={result.cardName}
                data={result.history}
              />
            ) : (
              <div className="border border-[var(--border)] p-6 text-center text-[var(--text-muted)] text-sm">
                No price history in the database yet for this card.
              </div>
            )}

            {hasHistory && (
              <p className="text-xs text-[var(--text-muted)] mt-2">
                Data from TCGPlayer via tcgcsv.com. Updated daily.
              </p>
            )}
          </div>

          {/* Mentioned In */}
          {result.mentionedIn.length > 0 && (
            <div>
              <h2 className="text-base font-semibold mb-4">
                Mentioned in {result.mentionedIn.length === 1 ? "1 article" : `${result.mentionedIn.length} articles`}
              </h2>
              <div className="space-y-3">
                {result.mentionedIn.map((post) => (
                  <MentionedCard key={post.slug} post={post} />
                ))}
              </div>
            </div>
          )}

          {result.mentionedIn.length === 0 && (
            <div className="text-sm text-[var(--text-muted)]">
              No TCG Times articles mention this card yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
