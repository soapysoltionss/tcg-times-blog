import { getPostBySlug, getAllPostSlugs } from "@/lib/posts";
import { getCategoryBySlug } from "@/config/site";
import { formatDate } from "@/lib/utils";
import { MDXRemote } from "next-mdx-remote/rsc";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

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

  const cat = getCategoryBySlug(post.category);

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 py-5 border-b border-[#d6d3cc] mb-10">
        <Link href="/" className="label-upper text-[#6b6860] hover:text-[#0a0a0a] transition-colors">Home</Link>
        <span className="text-[#d6d3cc]">·</span>
        <Link href="/blog" className="label-upper text-[#6b6860] hover:text-[#0a0a0a] transition-colors">All Posts</Link>
        {cat && (
          <>
            <span className="text-[#d6d3cc]">·</span>
            <Link href={`/category/${cat.slug}`} className="label-upper text-[#6b6860] hover:text-[#0a0a0a] transition-colors">
              {cat.name}
            </Link>
          </>
        )}
      </nav>

      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <header className="mb-10">
          {cat && (
            <span className="label-upper text-[#6b6860] block mb-4">{cat.name}</span>
          )}
          <h1
            className="text-4xl md:text-5xl font-black text-[#0a0a0a] leading-tight tracking-tight mb-6"
            style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
          >
            {post.title}
          </h1>
          <p className="text-lg text-[#6b6860] leading-relaxed mb-8">
            {post.excerpt}
          </p>
          <div className="flex flex-wrap items-center gap-3 pb-8 border-b-2 border-[#0a0a0a]">
            <span className="label-upper text-[#0a0a0a] font-bold">{post.author}</span>
            <span className="text-[#d6d3cc]">·</span>
            <span className="label-upper text-[#6b6860]">
              <time dateTime={post.date}>{formatDate(post.date)}</time>
            </span>
            <span className="text-[#d6d3cc]">·</span>
            <span className="label-upper text-[#6b6860]">{post.readingTime}</span>
          </div>
        </header>

        {/* Content */}
        <article className="prose prose-lg max-w-none">
          <MDXRemote source={post.content} />
        </article>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-10 pt-6 border-t border-[#d6d3cc]">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="label-upper bg-[#f0efec] text-[#6b6860] px-3 py-1.5"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Back link */}
        <div className="mt-12 pt-6 border-t-2 border-[#0a0a0a]">
          <Link
            href="/blog"
            className="label-upper text-[#0a0a0a] hover:opacity-60 transition-opacity"
          >
            ← Back to all posts
          </Link>
        </div>
      </div>
    </div>
  );
}
