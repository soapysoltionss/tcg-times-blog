"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { NewsItem, NewsGame } from "@/types/post";

const GAME_LABELS: Record<NewsGame, string> = {
  fab: "Flesh and Blood",
  "grand-archive": "Grand Archive",
  "one-piece": "One Piece TCG",
  pokemon: "Pokémon TCG",
  general: "General",
};

const SOURCE_BADGES: Record<string, string> = {
  reddit:      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  official:    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  fractalofin: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  discord:     "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
};

/**
 * BanListWidget — compact sidebar widget showing recent ban/restriction news.
 *
 * Props:
 *   game  — filters to a specific game (omit or "all" for all games)
 *   limit — number of items to show (default 5)
 *   title — widget heading (default "Recent Bans & Restrictions")
 */
export function BanListWidget({
  game,
  limit = 5,
  title = "Recent Bans & Restrictions",
}: {
  game?: NewsGame | "all";
  limit?: number;
  title?: string;
}) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ tag: "ban", limit: String(limit) });
    if (game && game !== "all") params.set("game", game);
    fetch(`/api/news?${params}`)
      .then((r) => r.json())
      .then((data) => { setItems(data.items ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [game, limit]);

  return (
    <div className="border border-[var(--border)] bg-[var(--muted)] p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm">🚫</span>
          <span className="label-upper text-[10px] text-[var(--text-muted)] font-bold">{title}</span>
        </div>
        <Link
          href="/tools/news?tag=ban"
          className="label-upper text-[9px] text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
        >
          See all →
        </Link>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 bg-[var(--background)] border border-[var(--border)] animate-pulse rounded-sm" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          No recent ban or restriction announcements found.
          <br />
          <span className="opacity-60">Check back after the daily news sync (06:00 UTC).</span>
        </p>
      )}

      {/* Items */}
      {!loading && items.length > 0 && (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-1 p-3 bg-[var(--background)] border border-[var(--border)] hover:border-[var(--border-strong)] transition-colors"
            >
              {/* Game + source badges */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="label-upper text-[8px] px-1.5 py-0.5 bg-[var(--muted)] border border-[var(--border)] text-[var(--text-muted)]">
                  {GAME_LABELS[item.game] ?? item.game}
                </span>
                <span className={`label-upper text-[8px] px-1.5 py-0.5 ${SOURCE_BADGES[item.source] ?? ""}`}>
                  {item.subreddit ? `r/${item.subreddit}` : item.source}
                </span>
              </div>

              {/* Title */}
              <p className="text-xs font-semibold text-[var(--foreground)] group-hover:underline leading-snug line-clamp-2">
                {item.title}
              </p>

              {/* Date */}
              <p className="label-upper text-[9px] text-[var(--text-muted)]">
                {new Date(item.publishedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
