import Link from "next/link";
import { getFeaturedPosts, getAllPosts } from "@/lib/posts";
import { gameCategories } from "@/config/site";
import PostCard from "@/components/PostCard";

export default function HomePage() {
  const featured = getFeaturedPosts(3);
  const latest = getAllPosts().slice(0, 8);
  const heroPost = featured[0] ?? latest[0];
  const gridPosts = featured.length > 1 ? featured.slice(1, 4) : latest.slice(1, 4);

  return (
    <div>
      {/* Hero — full-width editorial banner */}
      {heroPost && (
        <section className="border-b border-[#0a0a0a]">
          <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16 md:py-24 grid md:grid-cols-2 gap-12 items-end">
            <div>
              <span className="label-upper text-[#6b6860] block mb-4">
                {gameCategories.find(c => c.slug === heroPost.category)?.name ?? "Featured"}
              </span>
              <h2
                className="text-4xl md:text-6xl font-black text-[#0a0a0a] leading-none tracking-tight mb-6"
                style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
              >
                {heroPost.title}
              </h2>
              <Link
                href={`/blog/${heroPost.slug}`}
                className="inline-flex items-center gap-2 bg-[#0a0a0a] text-[#fafaf8] label-upper px-6 py-3 hover:opacity-70 transition-opacity"
              >
                Read Article →
              </Link>
            </div>
            <div>
              <p className="text-lg text-[#6b6860] leading-relaxed mb-6">{heroPost.excerpt}</p>
              <div className="flex items-center gap-3">
                <span className="label-upper text-[#6b6860]">{heroPost.author}</span>
                <span className="text-[#d6d3cc]">·</span>
                <span className="label-upper text-[#6b6860]">{heroPost.readingTime}</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Game categories strip */}
      <section className="border-b border-[#d6d3cc] bg-[#f0efec]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 flex overflow-x-auto">
          {gameCategories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/category/${cat.slug}`}
              className="label-upper flex-none px-6 py-4 text-[#0a0a0a] border-r border-[#d6d3cc] hover:bg-[#0a0a0a] hover:text-[#fafaf8] transition-colors whitespace-nowrap"
            >
              {cat.shortName}
            </Link>
          ))}
          <Link
            href="/blog"
            className="label-upper flex-none px-6 py-4 text-[#0a0a0a] hover:bg-[#0a0a0a] hover:text-[#fafaf8] transition-colors ml-auto whitespace-nowrap"
          >
            All Posts →
          </Link>
        </div>
      </section>

      {/* Featured 3-column grid */}
      {gridPosts.length > 0 && (
        <section className="border-b border-[#d6d3cc]">
          <div className="max-w-7xl mx-auto px-6 lg:px-10 py-14">
            <div className="flex items-baseline justify-between mb-8">
              <h2
                className="text-3xl font-black text-[#0a0a0a]"
                style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
              >
                Latest
              </h2>
              <Link href="/blog" className="label-upper text-[#6b6860] hover:text-[#0a0a0a] transition-colors">
                All Posts →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {gridPosts.map((post, i) => (
                <PostCard key={post.slug} post={post} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Numbered article list */}
      {latest.slice(3).length > 0 && (
        <section className="max-w-7xl mx-auto px-6 lg:px-10 py-14">
          <div className="flex items-baseline justify-between mb-2">
            <h2
              className="text-2xl font-black text-[#0a0a0a]"
              style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
            >
              More Articles
            </h2>
          </div>
          <div className="border-t-2 border-[#0a0a0a]">
            {latest.slice(3).map((post, i) => (
              <PostCard key={post.slug} post={post} index={i + 3} variant="row" />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {latest.length === 0 && (
        <section className="max-w-7xl mx-auto px-6 lg:px-10 py-24 text-center">
          <h2
            className="text-3xl font-black text-[#0a0a0a] mb-4"
            style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
          >
            Coming Soon
          </h2>
          <p className="text-[#6b6860]">
            The blog is freshly launched. Check back soon for card theories and articles.
          </p>
        </section>
      )}
    </div>
  );
}
