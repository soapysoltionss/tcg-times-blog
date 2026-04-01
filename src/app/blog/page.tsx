import { getAllPosts, getPinnedPosts, getFeaturedPosts } from "@/lib/posts";
import PostCard from "@/components/PostCard";
import ArticleCarousel from "@/components/ArticleCarousel";
import Link from "next/link";
import type { Metadata } from "next";

export const revalidate = 300; // ISR: rebuild at most every 5 minutes

export const metadata: Metadata = {
  title: "All Articles",
  description: "Browse all TCG Times articles — card theories, strategy guides, and community discussion.",
};

const PER_PAGE = 5;

const TAG_FILTERS = [
  { label: "Buying Guide", value: "buying-guide" },
  { label: "Strategy",     value: "strategy" },
  { label: "Budget Decks", value: "budget" },
  { label: "Deck Tech",    value: "deck-tech" },
];

type Props = {
  searchParams: Promise<{ page?: string; tag?: string }>;
};

export default async function BlogPage({ searchParams }: Props) {
  const { page: pageParam, tag } = await searchParams;
  const [allPosts, pinnedPosts, featuredPosts] = await Promise.all([
    getAllPosts(),
    getPinnedPosts(),
    getFeaturedPosts(3),
  ]);

  // Filter by tag when active — pinned posts included in filtered view
  const tagFiltered = tag
    ? allPosts.filter((p) => p.tags?.some((t) => t.toLowerCase().replace(/\s+/g, "-") === tag))
    : null;

  // Regular (non-pinned) posts, optionally tag-filtered
  const normalPosts = (tagFiltered ?? allPosts).filter((p) => !p.pinned);

  const totalPages = Math.max(1, Math.ceil(normalPosts.length / PER_PAGE));
  const page = Math.min(Math.max(1, parseInt(pageParam ?? "1", 10) || 1), totalPages);
  const start = (page - 1) * PER_PAGE;
  const pagePosts = normalPosts.slice(start, start + PER_PAGE);

  // Pinned posts: show on page 1 only, hide when tag filter active (they appear in results)
  const showPinned = !tag && page === 1 && pinnedPosts.length > 0;

  // Posts for the carousel (up to 12, excluding featured to avoid duplication)
  const featuredSlugs = new Set(featuredPosts.map(p => p.slug));
  const carouselPosts = allPosts.filter(p => !featuredSlugs.has(p.slug)).slice(0, 12);

  return (
    <div>
      {/* Article carousel — scrollable strip of latest articles */}
      {carouselPosts.length > 0 && (
        <ArticleCarousel posts={carouselPosts} title="Latest Articles" />
      )}

      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-14">
        {/* Featured 3-column grid */}
        {!tag && page === 1 && featuredPosts.length > 0 && (
          <section className="mb-14">
            <div className="flex items-baseline justify-between mb-8">
              <h2
                className="text-3xl font-black text-[var(--foreground)]"
                style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
              >
                Featured
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {featuredPosts.map((post, i) => (
                <PostCard key={post.slug} post={post} index={i} />
              ))}
            </div>
          </section>
        )}

        {/* Page header */}
        <div className="border-b-2 border-[var(--border-strong)] pb-6 mb-10">
          <h1
            className="text-5xl md:text-6xl font-black text-[var(--foreground)] leading-none tracking-tight mb-3"
            style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
          >
            All Articles
          </h1>
          <p className="label-upper text-[var(--text-muted)]">
            {allPosts.length} article{allPosts.length !== 1 ? "s" : ""} — card theories, strategy &amp; more
          </p>
        </div>

      {/* Tag filter chips — 5d */}
      <div className="flex flex-wrap gap-2 mb-8">
        <Link
          href="/blog"
          className={`label-upper text-[10px] px-3 py-1.5 border transition-colors ${
            !tag
              ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
              : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
          }`}
        >
          All
        </Link>
        {TAG_FILTERS.map((tf) => (
          <Link
            key={tf.value}
            href={`/blog?tag=${tf.value}`}
            className={`label-upper text-[10px] px-3 py-1.5 border transition-colors ${
              tag === tf.value
                ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            {tf.label}
          </Link>
        ))}
      </div>

      {/* Pinned "Start Here" articles — 5b */}
      {showPinned && (
        <div className="mb-10">
          <p className="label-upper text-[10px] text-[var(--text-muted)] mb-4 flex items-center gap-2">
            <span className="inline-block w-4 border-t border-[var(--border-strong)]" />
            Start Here
            <span className="inline-block flex-1 border-t border-[var(--border-strong)]" />
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pinnedPosts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group block border-2 border-[var(--border-strong)] p-5 hover:bg-[var(--muted)] transition-colors"
              >
                <span className="label-upper text-[9px] px-1.5 py-0.5 bg-[var(--foreground)] text-[var(--background)] mb-3 inline-block">
                  📌 Start Here
                </span>
                <h3
                  className="text-lg font-bold text-[var(--foreground)] group-hover:opacity-60 transition-opacity leading-snug mb-2"
                  style={{ fontFamily: "var(--font-serif, serif)" }}
                >
                  {post.title}
                </h3>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-3">
                  {post.excerpt}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {allPosts.length === 0 ? (
        <div className="py-24 text-center">
          <h2
            className="text-2xl font-black text-[var(--foreground)] mb-3"
            style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
          >
            No posts yet
          </h2>
        </div>
      ) : (
        <>
          {/* Post list */}
          <div className="border-t-2 border-[var(--border-strong)]">
            {pagePosts.map((post, i) => (
              <PostCard key={post.slug} post={post} index={start + i} variant="row" />
            ))}
            {pagePosts.length === 0 && (
              <p className="py-16 text-center text-sm text-[var(--text-muted)]">
                No posts found for this filter.
              </p>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-10 pt-6 border-t border-[var(--border)]">
              {page > 1 ? (
                <Link
                  href={`/blog?page=${page - 1}${tag ? `&tag=${tag}` : ""}`}
                  scroll={false}
                  className="label-upper flex items-center gap-2 px-5 py-2.5 border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
                >
                  ← Previous
                </Link>
              ) : (
                <span className="label-upper flex items-center gap-2 px-5 py-2.5 border border-[var(--border)] text-[var(--text-muted)] opacity-40 cursor-not-allowed">
                  ← Previous
                </span>
              )}
              <span className="label-upper text-[var(--text-muted)]">
                Page {page} of {totalPages}
              </span>
              {page < totalPages ? (
                <Link
                  href={`/blog?page=${page + 1}${tag ? `&tag=${tag}` : ""}`}
                  scroll={false}
                  className="label-upper flex items-center gap-2 px-5 py-2.5 border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
                >
                  Next →
                </Link>
              ) : (
                <span className="label-upper flex items-center gap-2 px-5 py-2.5 border border-[var(--border)] text-[var(--text-muted)] opacity-40 cursor-not-allowed">
                  Next →
                </span>
              )}
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}

