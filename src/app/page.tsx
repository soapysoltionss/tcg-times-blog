import Link from "next/link";
import { getFeaturedPosts, getAllPosts } from "@/lib/posts";
import { gameCategories } from "@/config/site";
import PostCard from "@/components/PostCard";
import ArticleCarousel from "@/components/ArticleCarousel";
import HeroSlider from "@/components/HeroSlider";
import { getForumPosts, getListings } from "@/lib/db-neon";
import { getLatestSets } from "@/lib/tcgplayer-prices";
import type { LatestSet } from "@/components/HeroSlider";
import type { TickerEvent } from "@/app/api/ticker/route";

export const revalidate = 300; // revalidate page every 5 minutes

export default async function HomePage() {
  const featured = await getFeaturedPosts(3);
  const latest = await getAllPosts();
  const latestSlice = latest.slice(0, 8);
  const heroPost = featured[0] ?? latestSlice[0];
  const gridPosts = featured.length > 1 ? featured.slice(1, 4) : latestSlice.slice(1, 4);
  // All posts for the carousel (up to 12), excluding the hero so there's no duplication
  const carouselPosts = latest.filter(p => p.slug !== heroPost?.slug).slice(0, 12);

  // Fetch slider data in parallel — failures are silenced so the page never breaks
  const [soldListings, forumPosts, latestSetInfos] = await Promise.all([
    getListings({ includeSold: true }).catch(() => []),
    getForumPosts({ sort: "hot", limit: 1 }).catch(() => []),
    getLatestSets().catch(() => []),
  ]);

  // Build a "Market Insight" ticker event from the top sold listing
  const topSold = soldListings.filter(l => l.sold).sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0] ?? soldListings[0] ?? null;
  const topMover: TickerEvent | null = topSold
    ? {
        id:        topSold.id,
        kind:      "sold",
        cardName:  topSold.cardName,
        game:      topSold.game,
        label:     `$${(topSold.priceCents / 100).toFixed(2)}`,
        priceCents: topSold.priceCents,
        imageUrl:  topSold.imageUrl,
        listingId: topSold.id,
      }
    : null;

  // Top forum post (hot)
  const topForumPost = forumPosts[0] ?? null;

  // Latest sets — map to LatestSet shape used by HeroSlider
  const latestSets: LatestSet[] = latestSetInfos.map(s => ({
    game:      s.game,
    gameEmoji: s.gameEmoji,
    setName:   s.setName,
  }));

  return (
    <div>
      {/* Hero slider — full-bleed auto-sliding hero */}
      <HeroSlider
        latestPost={heroPost ?? null}
        topMover={topMover}
        topForumPost={topForumPost}
        latestSets={latestSets}
      />

      {/* Article carousel — immediately below the hero */}
      {carouselPosts.length > 0 && (
        <ArticleCarousel posts={carouselPosts} title="Latest Articles" />
      )}

      {/* Game categories strip */}
      <section className="border-b border-[var(--border)] bg-[var(--muted)]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 flex overflow-x-auto">
          {gameCategories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/category/${cat.slug}`}
              className="label-upper flex-none px-6 py-4 text-[var(--foreground)] border-r border-[var(--border)] hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors whitespace-nowrap"
            >
              {cat.shortName}
            </Link>
          ))}
          <Link
            href="/blog"
            className="label-upper flex-none px-6 py-4 text-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors ml-auto whitespace-nowrap"
          >
            All Posts →
          </Link>
        </div>
      </section>

      {/* Featured 3-column grid */}
      {gridPosts.length > 0 && (
        <section className="border-b border-[var(--border)]">
          <div className="max-w-7xl mx-auto px-6 lg:px-10 py-14">
            <div className="flex items-baseline justify-between mb-8">
              <h2
                className="text-3xl font-black text-[var(--foreground)]"
                style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
              >
                Latest
              </h2>
              <Link href="/blog" className="label-upper text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors">
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
      {latestSlice.slice(3).length > 0 && (
        <section className="max-w-7xl mx-auto px-6 lg:px-10 py-14">
          <div className="flex items-baseline justify-between mb-2">
            <h2
              className="text-2xl font-black text-[var(--foreground)]"
              style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
            >
              More Articles
            </h2>
          </div>
          <div className="border-t-2 border-[var(--border-strong)]">
            {latestSlice.slice(3).map((post, i) => (
              <PostCard key={post.slug} post={post} index={i + 3} variant="row" />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {latestSlice.length === 0 && (
        <section className="max-w-7xl mx-auto px-6 lg:px-10 py-24 text-center">
          <h2
            className="text-3xl font-black text-[var(--foreground)] mb-4"
            style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
          >
            Coming Soon
          </h2>
          <p className="text-[var(--text-muted)]">
            The blog is freshly launched. Check back soon for card theories and articles.
          </p>
        </section>
      )}
    </div>
  );
}
