"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { gameCategories } from "@/config/site";
import type { ForumPost } from "@/types/post";

const TABS = [
  { slug: "all",             label: "All",          emoji: "🌐" },
  { slug: "grand-archive",   label: "Grand Archive", emoji: "⚔️" },
  { slug: "flesh-and-blood", label: "Flesh & Blood", emoji: "🩸" },
  { slug: "one-piece-tcg",   label: "One Piece",     emoji: "🏴‍☠️" },
  { slug: "general",         label: "General",       emoji: "🃏" },
];

const SORTS = [
  { value: "new", label: "New" },
  { value: "hot", label: "Hot" },
] as const;

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60)   return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function getCatMeta(slug: string) {
  return gameCategories.find(c => c.slug === slug) ?? {
    name: "General TCG", shortName: "TCG", emoji: "🃏",
    badgeColor: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  };
}

function PostRow({ post }: { post: ForumPost }) {
  const [upvotes, setUpvotes]     = useState(post.upvotes);
  const [upvoted, setUpvoted]     = useState(post.viewerHasUpvoted ?? false);
  const [upvoting, setUpvoting]   = useState(false);
  const cat = getCatMeta(post.category);

  async function handleUpvote(e: React.MouseEvent) {
    e.preventDefault();
    if (upvoting) return;
    setUpvoting(true);
    try {
      const res = await fetch(`/api/forum/posts/${post.id}/upvote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "post" }),
      });
      if (res.status === 401) { window.location.href = "/login"; return; }
      if (res.ok) {
        const data = await res.json() as { upvotes: number; hasUpvoted: boolean };
        setUpvotes(data.upvotes);
        setUpvoted(data.hasUpvoted);
      }
    } finally {
      setUpvoting(false);
    }
  }

  return (
    <div className="border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors">
      <div className="max-w-5xl mx-auto px-6 py-4 flex gap-4 items-start">
        {/* Upvote column */}
        <div className="flex flex-col items-center gap-0.5 min-w-[44px]">
          <button
            onClick={handleUpvote}
            disabled={upvoting}
            className={`flex flex-col items-center gap-0.5 group transition-opacity ${upvoting ? "opacity-50" : ""}`}
            aria-label="Upvote"
          >
            <svg
              className={`w-5 h-5 ${upvoted ? "text-[var(--foreground)]" : "text-[var(--text-muted)] group-hover:text-[var(--foreground)]"} transition-colors`}
              fill={upvoted ? "currentColor" : "none"}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
            <span className={`text-xs font-bold tabular-nums ${upvoted ? "text-[var(--foreground)]" : "text-[var(--text-muted)]"}`}>
              {upvotes}
            </span>
          </button>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            {/* Category badge */}
            <span className={`label-upper text-[10px] px-1.5 py-0.5 rounded ${cat.badgeColor}`}>
              {cat.emoji} {cat.shortName ?? cat.name}
            </span>
            {post.flair && (
              <span className="label-upper text-[10px] px-1.5 py-0.5 rounded bg-[var(--muted)] text-[var(--text-muted)] border border-[var(--border)]">
                {post.flair}
              </span>
            )}
          </div>
          <Link href={`/forum/${post.id}`} className="group">
            <h3 className="font-bold text-[var(--foreground)] group-hover:underline leading-snug mb-1">
              {post.title}
            </h3>
          </Link>
          <p className="text-sm text-[var(--text-muted)] line-clamp-2">{post.body}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-[var(--text-muted)]">
            <span>by <span className="font-medium text-[var(--foreground)]">{post.authorUsername}</span></span>
            <span>·</span>
            <span>{timeAgo(post.createdAt)}</span>
            <span>·</span>
            <Link href={`/forum/${post.id}`} className="hover:text-[var(--foreground)] transition-colors flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {post.commentCount} comment{post.commentCount !== 1 ? "s" : ""}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ForumPage() {
  const router = useRouter();
  const [tab,  setTab]  = useState("all");
  const [sort, setSort] = useState<"new" | "hot">("new");
  const [posts,    setPosts]    = useState<ForumPost[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [offset,   setOffset]   = useState(0);
  const [hasMore,  setHasMore]  = useState(true);

  const LIMIT = 30;

  const load = useCallback(async (cat: string, s: "new" | "hot", off: number, replace: boolean) => {
    setLoading(true);
    const url = `/api/forum/posts?category=${cat}&sort=${s}&limit=${LIMIT}&offset=${off}`;
    try {
      const res = await fetch(url);
      const data = await res.json() as ForumPost[];
      if (replace) setPosts(data);
      else setPosts(prev => [...prev, ...data]);
      setHasMore(data.length === LIMIT);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setOffset(0);
    load(tab, sort, 0, true);
  }, [tab, sort, load]);

  function loadMore() {
    const next = offset + LIMIT;
    setOffset(next);
    load(tab, sort, next, false);
  }

  return (
    <div className="min-h-screen">
      {/* Page header */}
      <div className="border-b border-[var(--border-strong)] bg-[var(--background)]">
        <div className="max-w-5xl mx-auto px-6 py-8 flex items-start justify-between gap-4">
          <div>
            <h1
              className="text-4xl font-black text-[var(--foreground)] leading-tight mb-1"
              style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
            >
              Community Forum
            </h1>
            <p className="text-[var(--text-muted)] text-sm">
              Discuss TCG strategy, share decklists, and connect with the community.
            </p>
          </div>
          <Link
            href="/forum/new"
            className="flex-none inline-flex items-center gap-2 bg-[var(--foreground)] text-[var(--background)] label-upper px-5 py-2.5 hover:opacity-70 transition-opacity whitespace-nowrap"
          >
            + New Post
          </Link>
        </div>

        {/* Category tabs */}
        <div className="max-w-5xl mx-auto px-6 flex overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.slug}
              onClick={() => setTab(t.slug)}
              className={`label-upper flex-none px-5 py-3 border-b-2 transition-colors whitespace-nowrap ${
                tab === t.slug
                  ? "border-[var(--foreground)] text-[var(--foreground)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sort bar */}
      <div className="border-b border-[var(--border)] bg-[var(--muted)]">
        <div className="max-w-5xl mx-auto px-6 py-2 flex items-center gap-3">
          <span className="label-upper text-[var(--text-muted)] text-[10px]">Sort:</span>
          {SORTS.map(s => (
            <button
              key={s.value}
              onClick={() => setSort(s.value)}
              className={`label-upper text-xs px-3 py-1 rounded transition-colors ${
                sort === s.value
                  ? "bg-[var(--foreground)] text-[var(--background)]"
                  : "text-[var(--text-muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Post list */}
      <div className="max-w-5xl mx-auto">
        {loading && posts.length === 0 ? (
          <div className="py-24 text-center text-[var(--text-muted)]">
            <div className="w-8 h-8 border-2 border-[var(--border)] border-t-[var(--foreground)] rounded-full animate-spin mx-auto mb-4" />
            Loading...
          </div>
        ) : posts.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-5xl mb-4">💬</p>
            <h2
              className="text-2xl font-black text-[var(--foreground)] mb-2"
              style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
            >
              No posts yet
            </h2>
            <p className="text-[var(--text-muted)] mb-6">Be the first to start a discussion!</p>
            <Link
              href="/forum/new"
              className="inline-flex items-center gap-2 bg-[var(--foreground)] text-[var(--background)] label-upper px-6 py-3 hover:opacity-70 transition-opacity"
            >
              + New Post
            </Link>
          </div>
        ) : (
          <>
            {posts.map(p => <PostRow key={p.id} post={p} />)}
            {hasMore && (
              <div className="py-8 text-center">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="label-upper px-6 py-2.5 border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors disabled:opacity-50"
                >
                  {loading ? "Loading…" : "Load More"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
