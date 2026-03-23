import Link from "next/link";
import { getFeaturedPosts, getAllPosts } from "@/lib/posts";
import { gameCategories } from "@/config/site";
import PostCard from "@/components/PostCard";

export default function HomePage() {
  const featured = getFeaturedPosts(3);
  const latest = getAllPosts().slice(0, 6);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-violet-950 via-gray-950 to-gray-900 text-white">
        <div className="absolute inset-0 opacity-10 pointer-events-none select-none flex items-center justify-center text-[20rem] leading-none">
          🃏
        </div>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-36 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm font-medium text-violet-200 mb-6 backdrop-blur-sm">
            <span>✨</span>
            <span>Theory · Strategy · Community</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight mb-6">
            Welcome to{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-pink-400">
              TCG Times
            </span>
          </h1>
          <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed mb-10">
            In-depth card theories, strategic breakdowns, and community discussion
            covering Grand Archive, Flesh and Blood, One Piece TCG, and beyond.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/blog"
              className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-violet-900/40"
            >
              Read the Blog
            </Link>
            <Link
              href="/about"
              className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl border border-white/20 transition-colors backdrop-blur-sm"
            >
              About the Site
            </Link>
          </div>
        </div>
      </section>

      {/* Game Categories */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Browse by Game</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {gameCategories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/category/${cat.slug}`}
              className={`group rounded-2xl border p-6 flex flex-col gap-2 hover:shadow-md transition-all hover:-translate-y-0.5 ${cat.bgColor} ${cat.borderColor}`}
            >
              <span className="text-3xl">{cat.emoji}</span>
              <h3 className={`font-bold text-base ${cat.color}`}>{cat.name}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-3">
                {cat.description}
              </p>
              <span className={`self-start mt-1 text-xs font-semibold ${cat.color} group-hover:underline`}>
                Read posts →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Posts */}
      {featured.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">⭐ Featured Posts</h2>
            <Link href="/blog" className="text-sm text-violet-600 dark:text-violet-400 hover:underline font-medium">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featured.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        </section>
      )}

      {/* Latest Posts */}
      {latest.length > 0 && (
        <section className="bg-gray-50 dark:bg-gray-900/50 py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Latest Posts</h2>
              <Link href="/blog" className="text-sm text-violet-600 dark:text-violet-400 hover:underline font-medium">
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {latest.map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Empty state */}
      {latest.length === 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <div className="text-5xl mb-4">✍️</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Posts coming soon!</h2>
          <p className="text-gray-500 dark:text-gray-400">
            The blog is freshly launched. Check back soon for card theories and articles.
          </p>
        </section>
      )}
    </div>
  );
}
