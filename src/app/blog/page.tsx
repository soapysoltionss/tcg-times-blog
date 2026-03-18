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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Page header */}
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-3">
          All Posts
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-lg">
          {posts.length} article{posts.length !== 1 ? "s" : ""} covering the best card games in the world.
        </p>

        {/* Category filter strip */}
        <div className="flex flex-wrap gap-2 mt-6">
          <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-violet-600 text-white">All</span>
          {gameCategories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/category/${cat.slug}`}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${cat.badgeColor} hover:opacity-80`}
            >
              {cat.emoji} {cat.name}
            </Link>
          ))}
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-24">
          <div className="text-5xl mb-4">✍️</div>
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">No posts yet</h2>
          <p className="text-gray-500 dark:text-gray-400">Drop some MDX files in <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">content/posts/</code> to get started.</p>
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
