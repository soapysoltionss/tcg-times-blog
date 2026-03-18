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
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-8">
        <Link href="/" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">Home</Link>
        <span>·</span>
        <Link href="/blog" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">Blog</Link>
        {cat && (
          <>
            <span>·</span>
            <Link
              href={`/category/${cat.slug}`}
              className={`hover:underline transition-colors ${cat.color}`}
            >
              {cat.emoji} {cat.name}
            </Link>
          </>
        )}
      </nav>

      {/* Header */}
      <header className="mb-10">
        {cat && (
          <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full mb-4 ${cat.badgeColor}`}>
            {cat.emoji} {cat.name}
          </span>
        )}
        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white leading-tight mb-4">
          {post.title}
        </h1>
        <p className="text-lg text-gray-500 dark:text-gray-400 leading-relaxed mb-6">
          {post.excerpt}
        </p>
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400 pb-6 border-b border-gray-200 dark:border-gray-700">
          <span className="font-medium text-gray-700 dark:text-gray-300">{post.author}</span>
          <span>·</span>
          <time dateTime={post.date}>{formatDate(post.date)}</time>
          <span>·</span>
          <span>{post.readingTime}</span>
        </div>
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2.5 py-1 rounded-lg"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* Content */}
      <article className="prose prose-gray dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-violet-600 dark:prose-a:text-violet-400 prose-code:bg-gray-100 dark:prose-code:bg-gray-800 prose-code:px-1 prose-code:rounded prose-pre:bg-gray-950">
        <MDXRemote source={post.content} />
      </article>

      {/* Back link */}
      <div className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-700">
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-sm font-medium text-violet-600 dark:text-violet-400 hover:underline"
        >
          ← Back to all posts
        </Link>
      </div>
    </div>
  );
}
