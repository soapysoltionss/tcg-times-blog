import { getAllPosts } from "@/lib/posts";
import PostCard from "@/components/PostCard";
import { gameCategories } from "@/config/site";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "All Posts",
  description: "Browse all TCG Times articles — card theories, strategy guides, and community discussion.",
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-14">
      {/* Page header */}
      <div className="border-b-2 border-[var(--border-strong)] pb-6 mb-2">
        <h1
          className="text-5xl md:text-6xl font-black text-[var(--foreground)] leading-none tracking-tight mb-3"
          style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
        >
          All Posts
        </h1>
        <p className="label-upper text-[var(--text-muted)]">
          {posts.length} article{posts.length !== 1 ? "s" : ""} — card theories, strategy & more
        </p>
      </div>

      {/* Category filter strip */}
      <div className="flex flex-wrap gap-0 border-b border-[var(--border)] mb-10">
        <span className="label-upper px-4 py-3 bg-[var(--foreground)] text-[var(--background)]">All</span>
        {gameCategories.map((cat) => (
          <Link
            key={cat.slug}
            href={`/category/${cat.slug}`}
            className="label-upper px-4 py-3 text-[var(--text-muted)] border-l border-[var(--border)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            {cat.shortName}
          </Link>
        ))}
      </div>

      {posts.length === 0 ? (
        <div className="py-24 text-center">
          <h2
            className="text-2xl font-black text-[var(--foreground)] mb-3"
            style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
          >
            No posts yet
          </h2>
          <p className="text-[var(--text-muted)] text-sm">
            Drop some MDX files in <code className="bg-[var(--muted)] px-1.5 py-0.5">content/posts/</code> to get started.
          </p>
        </div>
      ) : (
        <>
          {/* First row — 3 cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-2">
            {posts.slice(0, 3).map((post, i) => (
              <PostCard key={post.slug} post={post} index={i} />
            ))}
          </div>

          {/* Remaining as rows */}
          {posts.slice(3).length > 0 && (
            <div className="border-t-2 border-[var(--border-strong)] mt-8">
              {posts.slice(3).map((post, i) => (
                <PostCard key={post.slug} post={post} index={i + 3} variant="row" />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
