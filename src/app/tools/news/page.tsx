"use client";

import { useState, useEffect, useCallback } from "react";
import type { NewsItem, NewsGame, NewsTag } from "@/types/post";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GAME_TABS: Array<{ id: NewsGame | "all"; label: string; emoji: string }> = [
  { id: "all",           label: "All Games",       emoji: "🃏" },
  { id: "fab",           label: "Flesh and Blood", emoji: "⚔️" },
  { id: "grand-archive", label: "Grand Archive",   emoji: "🏛️" },
  { id: "one-piece",     label: "One Piece TCG",   emoji: "☠️" },
  { id: "pokemon",       label: "Pokémon TCG",     emoji: "⚡" },
];

const TAG_FILTERS: Array<{ id: NewsTag | "all"; label: string; emoji: string; color: string }> = [
  { id: "all",        label: "All",        emoji: "📰", color: "border-[var(--border)] text-[var(--text-muted)]" },
  { id: "ban",        label: "Bans",       emoji: "🚫", color: "border-red-400 text-red-700 dark:text-red-400" },
  { id: "rotation",   label: "Rotation",   emoji: "🔄", color: "border-blue-400 text-blue-700 dark:text-blue-400" },
  { id: "tournament", label: "Tournament", emoji: "🏆", color: "border-yellow-400 text-yellow-700 dark:text-yellow-400" },
  { id: "new-set",    label: "New Sets",   emoji: "✨", color: "border-emerald-400 text-emerald-700 dark:text-emerald-400" },
];

const SOURCE_META: Record<string, { label: string; color: string }> = {
  reddit:      { label: "Reddit",      color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  official:    { label: "Official",    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  fractalofin: { label: "fractalofin", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  discord:     { label: "Discord",     color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" },
};

const TAG_BADGE: Record<string, string> = {
  ban:        "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  rotation:   "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  tournament: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  "new-set":  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day:   "numeric",
    year:  "numeric",
  });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1)  return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d ago`;
  return formatDate(iso);
}

// ---------------------------------------------------------------------------
// NewsCard
// ---------------------------------------------------------------------------

function NewsCard({ item }: { item: NewsItem }) {
  const src = SOURCE_META[item.source] ?? { label: item.source, color: "" };
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block border border-[var(--border)] bg-[var(--background)] hover:border-[var(--border-strong)] transition-all p-5"
    >
      {/* Badges row */}
      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        <span className={`label-upper text-[8px] px-1.5 py-0.5 rounded-sm ${src.color}`}>
          {item.subreddit ? `r/${item.subreddit}` : src.label}
        </span>
        {item.tags.map((tag) => (
          <span
            key={tag}
            className={`label-upper text-[8px] px-1.5 py-0.5 rounded-sm ${TAG_BADGE[tag] ?? ""}`}
          >
            {TAG_FILTERS.find((t) => t.id === tag)?.emoji} {tag}
          </span>
        ))}
      </div>

      {/* Title */}
      <p className="font-bold text-sm text-[var(--foreground)] group-hover:underline leading-snug mb-2 line-clamp-3">
        {item.title}
      </p>

      {/* Summary */}
      {item.summary && (
        <p className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-2 mb-3">
          {item.summary}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2">
        <span className="label-upper text-[9px] text-[var(--text-muted)]">
          {timeAgo(item.publishedAt)}
        </span>
        <span className="label-upper text-[9px] text-[var(--text-muted)] group-hover:text-[var(--foreground)] transition-colors">
          Read →
        </span>
      </div>
    </a>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NewsPage() {
  const [activeGame, setActiveGame] = useState<NewsGame | "all">("all");
  const [activeTag,  setActiveTag]  = useState<NewsTag | "all">("all");
  const [items,     setItems]     = useState<NewsItem[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset,    setOffset]    = useState(0);
  const [hasMore,   setHasMore]   = useState(true);

  const LIMIT = 30;

  const fetchNews = useCallback(
    async (game: NewsGame | "all", tag: NewsTag | "all", off: number, append: boolean) => {
      if (append) setLoadingMore(true); else setLoading(true);
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(off) });
      if (game !== "all") params.set("game", game);
      if (tag  !== "all") params.set("tag", tag);
      try {
        const res  = await fetch(`/api/news?${params}`);
        const data = await res.json();
        const newItems: NewsItem[] = data.items ?? [];
        setItems((prev) => append ? [...prev, ...newItems] : newItems);
        setHasMore(newItems.length === LIMIT);
        setOffset(off + newItems.length);
      } catch {
        // silently fail — empty state handles it
      } finally {
        if (append) setLoadingMore(false); else setLoading(false);
      }
    },
    []
  );

  // Re-fetch when filters change
  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    fetchNews(activeGame, activeTag, 0, false);
  }, [activeGame, activeTag, fetchNews]);

  function handleGameChange(game: NewsGame | "all") {
    setActiveGame(game);
  }
  function handleTagChange(tag: NewsTag | "all") {
    setActiveTag(tag);
  }

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10">
      {/* Page header */}
      <div className="mb-8">
        <p className="label-upper text-[10px] text-[var(--text-muted)] mb-2">Tools</p>
        <h1
          className="text-4xl font-black text-[var(--foreground)] leading-none mb-3"
          style={{ fontFamily: "var(--font-serif, serif)" }}
        >
          TCG News
        </h1>
        <p className="text-sm text-[var(--text-muted)] max-w-2xl leading-relaxed">
          Ban lists, format rotations, tournament results, and new set reveals — aggregated daily
          from Reddit and official sources across Flesh and Blood, Grand Archive, One Piece TCG,
          and Pokémon.
        </p>
      </div>

      {/* Game tabs */}
      <div className="flex gap-1 flex-wrap mb-4 border-b border-[var(--border)] pb-0">
        {GAME_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleGameChange(tab.id)}
            className={`label-upper text-[10px] px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
              activeGame === tab.id
                ? "border-[var(--foreground)] text-[var(--foreground)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {tab.emoji} {tab.label}
          </button>
        ))}
      </div>

      {/* Tag filter pills */}
      <div className="flex gap-2 flex-wrap mb-8">
        {TAG_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => handleTagChange(f.id)}
            className={`label-upper text-[9px] px-3 py-1.5 border transition-all ${
              activeTag === f.id
                ? `border-current ${f.color} font-bold`
                : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
            }`}
          >
            {f.emoji} {f.label}
          </button>
        ))}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="border border-[var(--border)] p-5 flex flex-col gap-3 animate-pulse">
              <div className="flex gap-2">
                <div className="h-4 w-16 bg-[var(--muted)] rounded-sm" />
                <div className="h-4 w-10 bg-[var(--muted)] rounded-sm" />
              </div>
              <div className="h-4 bg-[var(--muted)] rounded-sm" />
              <div className="h-4 bg-[var(--muted)] rounded-sm w-4/5" />
              <div className="h-3 bg-[var(--muted)] rounded-sm w-1/3 mt-2" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-4xl mb-4">📡</p>
          <p className="label-upper text-[10px] text-[var(--text-muted)] mb-2">No news yet</p>
          <p className="text-sm text-[var(--text-muted)] max-w-sm mx-auto">
            The news scraper runs daily at 06:00 UTC. Check back after the first run, or try
            changing the game/tag filters.
          </p>
        </div>
      )}

      {/* Results */}
      {!loading && items.length > 0 && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="label-upper text-[10px] text-[var(--text-muted)]">
              {items.length} article{items.length !== 1 ? "s" : ""} · sorted by newest
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <NewsCard key={item.id} item={item} />
            ))}
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="mt-8 text-center">
              <button
                onClick={() => fetchNews(activeGame, activeTag, offset, true)}
                disabled={loadingMore}
                className="label-upper px-6 py-2.5 border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)] transition-colors disabled:opacity-40 text-[10px]"
              >
                {loadingMore ? "Loading…" : "Load more →"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
