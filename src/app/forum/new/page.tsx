"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ForumPost } from "@/types/post";

const CATEGORIES = [
  { slug: "grand-archive",   label: "Grand Archive",  emoji: "⚔️" },
  { slug: "flesh-and-blood", label: "Flesh & Blood",  emoji: "🩸" },
  { slug: "one-piece-tcg",   label: "One Piece TCG",  emoji: "🏴‍☠️" },
  { slug: "general",         label: "General TCG",    emoji: "🃏" },
];

export default function NewForumPostPage() {
  const router = useRouter();
  const [title,    setTitle]    = useState("");
  const [content,  setContent]  = useState("");
  const [category, setCategory] = useState("general");
  const [flair,    setFlair]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError("Title and body are required.");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch("/api/forum/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), content: content.trim(), category, flair: flair.trim() || undefined }),
    });
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    if (!res.ok) {
      const err = await res.json() as { error: string };
      setError(err.error ?? "Failed to create post.");
      setLoading(false);
      return;
    }
    const post = await res.json() as ForumPost;
    router.push(`/forum/${post.id}`);
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-8">
        <Link href="/forum" className="hover:text-[var(--foreground)] transition-colors">Forum</Link>
        <span>›</span>
        <span className="text-[var(--foreground)]">New Post</span>
      </div>

      <h1
        className="text-3xl font-black text-[var(--foreground)] mb-8"
        style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
      >
        Create a Post
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Category */}
        <div>
          <label className="label-upper text-xs text-[var(--text-muted)] block mb-2">
            Category
          </label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(c => (
              <button
                key={c.slug}
                type="button"
                onClick={() => setCategory(c.slug)}
                className={`label-upper text-xs px-4 py-2 border transition-colors ${
                  category === c.slug
                    ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                    : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]"
                }`}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="label-upper text-xs text-[var(--text-muted)] block mb-2">
            Title <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="E.g. Best value box to crack right now?"
            maxLength={300}
            className="w-full border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-4 py-3 text-sm focus:outline-none focus:border-[var(--foreground)] transition-colors"
          />
          <p className="text-xs text-[var(--text-muted)] mt-1 text-right">{title.length}/300</p>
        </div>

        {/* Flair */}
        <div>
          <label className="label-upper text-xs text-[var(--text-muted)] block mb-2">
            Flair <span className="opacity-60">(optional)</span>
          </label>
          <input
            type="text"
            value={flair}
            onChange={e => setFlair(e.target.value)}
            placeholder="E.g. Deckbuilding, Price Check, SELL…"
            maxLength={40}
            className="w-full border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-4 py-3 text-sm focus:outline-none focus:border-[var(--foreground)] transition-colors"
          />
        </div>

        {/* Body */}
        <div>
          <label className="label-upper text-xs text-[var(--text-muted)] block mb-2">
            Body <span className="text-red-400">*</span>
          </label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Write your post here…"
            rows={10}
            className="w-full border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-4 py-3 text-sm resize-y focus:outline-none focus:border-[var(--foreground)] transition-colors"
          />
          <p className="text-xs text-[var(--text-muted)] mt-1 text-right">{content.length}/40 000</p>
        </div>

        {error && (
          <p className="text-red-500 text-sm border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800 px-4 py-3">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="label-upper px-8 py-3 bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 transition-opacity disabled:opacity-40"
          >
            {loading ? "Posting…" : "Post"}
          </button>
          <Link
            href="/forum"
            className="label-upper px-8 py-3 border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
