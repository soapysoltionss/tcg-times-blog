import { getPostBySlug, getAllPostSlugs } from "@/lib/posts";
import { getCategoryBySlug } from "@/config/site";
import { formatDate } from "@/lib/utils";
import { MDXRemote } from "next-mdx-remote/rsc";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PaywallGate from "@/components/PaywallGate";
import CommentsSection from "@/components/CommentsSection";
import { getSession } from "@/lib/session";
import { getUserById } from "@/lib/db";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return getAllPostSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const post = getPostBySlug(slug);
    return {
      title: post.title,
      description: post.excerpt,
    };
  } catch {
    return { title: "Post not found" };
  }
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;

  let post;
  try {
    post = getPostBySlug(slug);
  } catch {
    notFound();
  }

  // Resolve subscriber status server-side for the paywall gate
  const session = await getSession();
  let isSubscriber = session?.isSubscriber ?? false;
  if (!isSubscriber && session?.userId) {
    // Double-check against the DB (session token may be stale)
    const user = await getUserById(session.userId);
    isSubscriber =
      user?.subscription?.status === "active" ||
      user?.subscription?.status === "declined";
  }

  const cat = getCategoryBySlug(post.category);

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 py-5 border-b border-[var(--border)] mb-10">
        <Link href="/" className="label-upper text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors">Home</Link>
        <span className="text-[var(--border)]">·</span>
        <Link href="/blog" className="label-upper text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors">All Posts</Link>
        {cat && (
          <>
            <span className="text-[var(--border)]">·</span>
            <Link href={`/category/${cat.slug}`} className="label-upper text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors">
              {cat.name}
            </Link>
          </>
        )}
      </nav>

      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <header className="mb-10">
          {cat && (
            <span className="label-upper text-[var(--text-muted)] block mb-4">{cat.name}</span>
          )}
          <h1
            className="text-4xl md:text-5xl font-black text-[var(--foreground)] leading-tight tracking-tight mb-6"
            style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
          >
            {post.title}
          </h1>
          <p className="text-lg text-[var(--text-muted)] leading-relaxed mb-8">
            {post.excerpt}
          </p>
          <div className="flex flex-wrap items-center gap-3 pb-8 border-b-2 border-[var(--border-strong)]">
            <span className="label-upper text-[var(--foreground)] font-bold">{post.author}</span>
            <span className="text-[var(--border)]">·</span>
            <span className="label-upper text-[var(--text-muted)]">
              <time dateTime={post.date}>{formatDate(post.date)}</time>
            </span>
            <span className="text-[var(--border)]">·</span>
            <span className="label-upper text-[var(--text-muted)]">{post.readingTime}</span>
            {post.articleType && (
              <>
                <span className="text-[var(--border)]">·</span>
                <span
                  className={`label-upper px-2 py-0.5 text-[10px] border ${
                    post.articleType === "professional"
                      ? "border-[var(--border-strong)] text-[var(--foreground)]"
                      : "border-[var(--border)] text-[var(--text-muted)]"
                  }`}
                >
                  {post.articleType === "professional" ? "Professional" : "Community"}
                </span>
              </>
            )}
          </div>
        </header>

        {/* Content */}
        <article className="prose prose-lg max-w-none">
          <MDXRemote source={
            post.paywalled && post.freeContent && !isSubscriber
              ? post.freeContent
              : post.content
          } />
        </article>

        {/* Paywall gate */}
        {post.paywalled && post.freeContent && (
          <PaywallGate title={post.title} isSubscriber={isSubscriber} />
        )}

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-10 pt-6 border-t border-[var(--border)]">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="label-upper bg-[var(--muted)] text-[var(--text-muted)] px-3 py-1.5"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Back link */}
        <div className="mt-12 pt-6 border-t-2 border-[var(--border-strong)]">
          <Link
            href="/blog"
            className="label-upper text-[var(--foreground)] hover:opacity-60 transition-opacity"
          >
            ← Back to all posts
          </Link>
        </div>

        {/* Comments */}
        <CommentsSection slug={post.slug} articleType={post.articleType} />
      </div>
    </div>
  );
}
