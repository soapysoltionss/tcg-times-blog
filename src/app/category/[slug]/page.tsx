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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-8">
        <Link href="/" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">Home</Link>
        <span>·</span>
        <Link href="/blog" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">Blog</Link>
        <span>·</span>
        <span className={cat.color}>{cat.name}</span>
      </nav>

      {/* Header */}
      <div className={`rounded-2xl border p-8 mb-10 ${cat.bgColor} ${cat.borderColor}`}>
        <div className="text-4xl mb-3">{cat.emoji}</div>
        <h1 className={`text-3xl font-extrabold mb-3 ${cat.color}`}>{cat.name}</h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-xl leading-relaxed">{cat.description}</p>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-3">{posts.length} post{posts.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Posts */}
      {posts.length === 0 ? (
        <div className="text-center py-24">
          <div className="text-5xl mb-4">{cat.emoji}</div>
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">No posts yet for {cat.name}</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Check back soon — articles are on their way!
          </p>
          <Link href="/blog" className="text-sm font-medium text-violet-600 dark:text-violet-400 hover:underline">
            ← Browse all posts
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
