import { getPostsByCategory, getPinnedPosts } from "@/lib/posts";
import { getCategoryBySlug, gameCategories } from "@/config/site";
import PostCard from "@/components/PostCard";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return gameCategories.map((cat) => ({ slug: cat.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const cat = getCategoryBySlug(slug);
  if (!cat) return { title: "Category not found" };
  return {
    title: `${cat.name} Articles`,
    description: cat.description,
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const cat = getCategoryBySlug(slug);
  if (!cat) notFound();

  const [allPosts, pinnedPosts] = await Promise.all([
    getPostsByCategory(slug),
    getPinnedPosts(slug),
  ]);

  // Normal (non-pinned) posts shown in the grid / list
  const normalPosts = allPosts.filter((p) => !p.pinned);

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 py-5 border-b border-[var(--border)] mb-10">
        <Link href="/" className="label-upper text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors">Home</Link>
        <span className="text-[var(--border)]">·</span>
        <Link href="/blog" className="label-upper text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors">All Posts</Link>
        <span className="text-[var(--border)]">·</span>
        <span className="label-upper text-[var(--foreground)]">{cat.name}</span>
      </nav>

      {/* Category header */}
      <div className="border-b-2 border-[var(--border-strong)] pb-8 mb-2">
        <span className="label-upper text-[var(--text-muted)] block mb-3">{allPosts.length} article{allPosts.length !== 1 ? "s" : ""}</span>
        <h1
          className="text-5xl md:text-6xl font-black text-[var(--foreground)] leading-none tracking-tight mb-4"
          style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
        >
          {cat.name}
        </h1>
        <p className="text-[var(--text-muted)] max-w-xl leading-relaxed">{cat.description}</p>
      </div>

      {/* Pinned "Start Here" guides — 5b */}
      {pinnedPosts.length > 0 && (
        <div className="py-8 border-b border-[var(--border)] mb-8">
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

      {/* Posts */}
      {normalPosts.length === 0 ? (
        <div className="py-24 text-center">
          <h2
            className="text-2xl font-black text-[var(--foreground)] mb-3"
            style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
          >
            No posts yet for {cat.name}
          </h2>
          <p className="text-[var(--text-muted)] mb-8">Articles are on their way — check back soon.</p>
          <Link href="/blog" className="label-upper text-[var(--foreground)] hover:opacity-60 transition-opacity">
            ← Browse all posts
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-2">
            {normalPosts.slice(0, 3).map((post, i) => (
              <PostCard key={post.slug} post={post} index={i} />
            ))}
          </div>
          {normalPosts.slice(3).length > 0 && (
            <div className="border-t-2 border-[var(--border-strong)] mt-8">
              {normalPosts.slice(3).map((post, i) => (
                <PostCard key={post.slug} post={post} index={i + 3} variant="row" />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
