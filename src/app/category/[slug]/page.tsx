import { getPostsByCategory } from "@/lib/posts";
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

  const posts = getPostsByCategory(slug);

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
        <span className="label-upper text-[var(--text-muted)] block mb-3">{posts.length} article{posts.length !== 1 ? "s" : ""}</span>
        <h1
          className="text-5xl md:text-6xl font-black text-[var(--foreground)] leading-none tracking-tight mb-4"
          style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
        >
          {cat.name}
        </h1>
        <p className="text-[var(--text-muted)] max-w-xl leading-relaxed">{cat.description}</p>
      </div>

      {/* Posts */}
      {posts.length === 0 ? (
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
            {posts.slice(0, 3).map((post, i) => (
              <PostCard key={post.slug} post={post} index={i} />
            ))}
          </div>
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
