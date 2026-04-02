import Link from "next/link";
import { gameCategories } from "@/config/site";
import HeroSlider from "@/components/HeroSlider";
import { getHeroPost } from "@/lib/posts";
import { getForumPosts, getListings } from "@/lib/db-neon";
import { getLatestSets } from "@/lib/tcgplayer-prices";
import type { LatestSet, MarketReportSnap } from "@/components/HeroSlider";

export const revalidate = 300; // revalidate page every 5 minutes

export default async function HomePage() {
  const heroPost = await getHeroPost().catch(() => null);

  // Fetch slider data in parallel — failures are silenced so the page never breaks
  const [soldListings, forumPosts, latestSetInfos] = await Promise.all([
    getListings({ includeSold: true }).catch(() => []),
    getForumPosts({ sort: "hot", limit: 1 }).catch(() => []),
    getLatestSets().catch(() => []),
  ]);

  // Build a MarketReportSnap from the most recent sold listing
  const recentSold = soldListings
    .filter(l => l.sold)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const topSold = recentSold[0] ?? soldListings[0] ?? null;

  const GAME_EMOJI: Record<string, string> = {
    "flesh-and-blood": "⚔️",
    "pokemon": "⚡",
    "magic": "✨",
    "one-piece": "🏴‍☠️",
    "lorcana": "🌟",
  };

  const marketReport: MarketReportSnap | null = topSold
    ? {
        totalListings: soldListings.length,
        topGame: topSold.game,
        topGameEmoji: GAME_EMOJI[topSold.game] ?? "🃏",
        topCardName: topSold.cardName,
        topCardPriceCents: topSold.priceCents,
        topCardImageUrl: topSold.imageUrl,
      }
    : null;

  // Top forum post (hot)
  const topForumPost = forumPosts[0] ?? null;

  // Latest sets — map to LatestSet shape used by HeroSlider
  const latestSets: LatestSet[] = latestSetInfos.map(s => ({
    game:      s.game,
    gameEmoji: s.gameEmoji,
    setName:   s.setName,
    groupId:   s.groupId,
  }));

  return (
    <div>
      {/* Hero slider — full-bleed auto-sliding hero */}
      <HeroSlider
        latestPost={heroPost ?? null}
        marketReport={marketReport}
        topForumPost={topForumPost}
        latestSets={latestSets}
      />

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
            All Articles →
          </Link>
        </div>
      </section>

      {/* Daily Pokémon game banner */}
      <section className="border-b border-[var(--border)]">
        <Link
          href="/tools/guess-pokemon"
          className="group max-w-7xl mx-auto px-6 lg:px-10 py-5 flex items-center gap-5 hover:bg-[var(--muted)] transition-colors"
        >
          {/* Pokéball icon */}
          <span className="text-3xl select-none" aria-hidden>🎮</span>

          <div className="flex-1 min-w-0">
            <p className="label-upper text-[9px] text-[var(--text-muted)] mb-0.5">Daily Mini-Game</p>
            <p className="font-black text-base text-[var(--foreground)] leading-tight truncate">
              Guess That Pokémon! — Today&apos;s Wordle
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
              Read the clue, name the Gen 1 Pokémon in 6 tries. New Pokémon every day.
            </p>
          </div>

          <span className="label-upper text-[9px] text-[var(--text-muted)] group-hover:text-[var(--foreground)] transition-colors whitespace-nowrap hidden sm:block">
            Play now →
          </span>
        </Link>
      </section>
    </div>
  );
}
