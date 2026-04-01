"use client";

/**
 * HeroSlider
 *
 * Full-bleed auto-sliding hero that replaces the static editorial banner.
 * 4 slide types:
 *  1) Latest Article   — cover image or game gradient, title + excerpt + CTA
 *  2) Market Insight   — top price mover from /api/ticker, card art, price ▲/▼
 *  3) Trending Forum   — top forum post by hot score, upvotes + excerpt + CTA
 *  4) Latest Set (×N)  — one slide per game from tcgcsv.com release data
 *
 * Built on Embla v8 with loop + autoplay (6 s, pause on hover).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import type { PostMeta, ForumPost } from "@/types/post";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LatestSet = {
  game: string;
  gameEmoji: string;
  setName: string;
  /** tcgcsv.com groupId — used to link to the set detail page */
  groupId: number;
  imageUrl?: string;
};

/** Lightweight market report snapshot passed from the server */
export type MarketReportSnap = {
  totalListings: number;
  topGame: string;
  topGameEmoji: string;
  topCardName: string;
  topCardPriceCents: number;
  topCardImageUrl?: string;
};

interface HeroSliderProps {
  latestPost:   PostMeta | null;
  marketReport: MarketReportSnap | null;
  topForumPost: ForumPost | null;
  latestSets:   LatestSet[];
}

// ─── Gradient map (game → CSS gradient) ──────────────────────────────────────

const GAME_GRADIENT: Record<string, string> = {
  "grand-archive":   "from-violet-950 via-violet-800 to-violet-600",
  "flesh-and-blood": "from-red-950 via-red-800 to-red-600",
  "one-piece-tcg":   "from-amber-900 via-amber-700 to-amber-500",
  "pokemon":         "from-yellow-800 via-yellow-600 to-yellow-400",
  "general":         "from-zinc-900 via-zinc-700 to-zinc-500",
};

function gradientFor(game: string) {
  return GAME_GRADIENT[game] ?? "from-zinc-950 via-zinc-800 to-zinc-600";
}

// ─── Individual slide components ──────────────────────────────────────────────

function ArticleSlide({ post }: { post: PostMeta }) {
  const gradient = gradientFor(post.category);
  return (
    <div className="relative h-full min-h-[420px] md:min-h-[520px] overflow-hidden">
      {/* Background */}
      {post.coverImage ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.coverImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        </>
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-end h-full max-w-4xl mx-auto px-8 md:px-12 pb-12 pt-20">
        <span className="label-upper text-xs text-white/70 tracking-widest mb-3 inline-flex items-center gap-2">
          <span className="w-6 h-px bg-white/50 inline-block" />
          New Article
        </span>
        <h2
          className="text-3xl md:text-5xl font-black text-white leading-tight mb-4 drop-shadow"
          style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
        >
          {post.title}
        </h2>
        {post.excerpt && (
          <p className="text-white/80 text-base md:text-lg max-w-2xl mb-6 line-clamp-2">
            {post.excerpt}
          </p>
        )}
        <Link
          href={`/blog/${post.slug}`}
          className="self-start label-upper text-xs px-6 py-3 bg-white text-black hover:bg-white/80 transition-colors"
        >
          Read Article →
        </Link>
      </div>
    </div>
  );
}

function MarketSlide({ report }: { report: MarketReportSnap }) {
  const priceDollars = (report.topCardPriceCents / 100).toFixed(2);
  return (
    <div className="relative h-full min-h-[420px] md:min-h-[520px] overflow-hidden">
      {/* Background: card art blurred + darkened */}
      {report.topCardImageUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={report.topCardImageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover scale-110 blur-sm"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-black/70" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-emerald-800 to-emerald-600" />
      )}

      {/* Card art (crisp, positioned right) */}
      {report.topCardImageUrl && (
        <div className="hidden md:flex absolute right-24 bottom-0 h-[85%] items-end justify-center pointer-events-none select-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={report.topCardImageUrl}
            alt={report.topCardName}
            className="h-full object-contain drop-shadow-2xl"
          />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-end h-full max-w-4xl mx-auto px-8 md:px-12 pb-12 pt-20">
        <span className="label-upper text-xs text-white/70 tracking-widest mb-3 inline-flex items-center gap-2">
          <span className="w-6 h-px bg-white/50 inline-block" />
          Market Report · {report.topGameEmoji} {report.topGame}
        </span>
        <h2
          className="text-3xl md:text-5xl font-black text-white leading-tight mb-3 drop-shadow"
          style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
        >
          {report.topCardName}
        </h2>
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <span className="text-2xl font-bold text-white">${priceDollars}</span>
          <span className="label-upper text-xs text-white/60 border border-white/30 px-2 py-0.5">
            Highest listed
          </span>
        </div>
        <p className="text-white/60 text-sm max-w-lg mb-6">
          {report.totalListings} active listing{report.totalListings !== 1 ? "s" : ""} on the marketplace.
          Full market reports with price history, community sentiment &amp; Reddit trends are coming soon.
        </p>
        <Link
          href="/tools/market"
          className="self-start label-upper text-xs px-6 py-3 bg-white text-black hover:bg-white/80 transition-colors"
        >
          View Market Index →
        </Link>
      </div>
    </div>
  );
}

function ForumSlide({ post }: { post: ForumPost }) {
  return (
    <div className="relative h-full min-h-[420px] md:min-h-[520px] overflow-hidden">
      {/* Background: dark noise-ish gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black" />
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-10"
        style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "28px 28px" }}
      />

      <div className="relative z-10 flex flex-col justify-end h-full max-w-4xl mx-auto px-8 md:px-12 pb-12 pt-20">
        <span className="label-upper text-xs text-white/70 tracking-widest mb-3 inline-flex items-center gap-2">
          <span className="w-6 h-px bg-white/50 inline-block" />
          Trending Discussion
        </span>
        <h2
          className="text-3xl md:text-5xl font-black text-white leading-tight mb-3 drop-shadow"
          style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
        >
          {post.title}
        </h2>
        <p className="text-white/70 text-base max-w-2xl mb-2 line-clamp-2">{post.body}</p>
        <div className="flex items-center gap-3 mb-6 text-sm text-white/60">
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
            {post.upvotes}
          </span>
          <span>·</span>
          <span>💬 {post.commentCount} comments</span>
          <span>·</span>
          <span>by {post.authorUsername}</span>
        </div>
        <Link
          href={`/forum/${post.id}`}
          className="self-start label-upper text-xs px-6 py-3 bg-white text-black hover:bg-white/80 transition-colors"
        >
          Join Discussion →
        </Link>
      </div>
    </div>
  );
}

function LatestSetSlide({ set }: { set: LatestSet }) {
  const gradient = gradientFor(set.game);
  const gameName = set.game.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
  const setHref = `/tools/market/set/${set.game}/${set.groupId}`;
  return (
    <div className="relative h-full min-h-[420px] md:min-h-[520px] overflow-hidden">
      {set.imageUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={set.imageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
        </>
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
      )}

      <div className="relative z-10 flex flex-col justify-end h-full max-w-4xl mx-auto px-8 md:px-12 pb-12 pt-20">
        <span className="label-upper text-xs text-white/70 tracking-widest mb-3 inline-flex items-center gap-2">
          <span className="w-6 h-px bg-white/50 inline-block" />
          Latest Release · {set.gameEmoji} {gameName}
        </span>
        <h2
          className="text-3xl md:text-5xl font-black text-white leading-tight mb-3 drop-shadow"
          style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
        >
          {set.setName}
        </h2>
        <p className="text-white/70 text-sm md:text-base max-w-xl mb-6 leading-relaxed">
          Browse the full card list with TCGPlayer market prices. See which cards are leading
          in value, check reprint risk ratings, and explore market insights for this set.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href={setHref}
            className="self-start label-upper text-xs px-6 py-3 bg-white text-black hover:bg-white/80 transition-colors"
          >
            View Card List &amp; Prices →
          </Link>
          <Link
            href={setHref + "#insights"}
            className="self-start label-upper text-xs px-6 py-3 bg-white/10 text-white border border-white/30 hover:bg-white/20 transition-colors"
          >
            Market Insights →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function HeroSlider({
  latestPost,
  marketReport,
  topForumPost,
  latestSets,
}: HeroSliderProps) {
  // Build slide list
  type Slide =
    | { type: "article"; post: PostMeta }
    | { type: "market";  report: MarketReportSnap }
    | { type: "forum";   post: ForumPost }
    | { type: "set";     set: LatestSet };

  const slides: Slide[] = [];
  if (latestPost)    slides.push({ type: "article", post: latestPost });
  if (marketReport)  slides.push({ type: "market",  report: marketReport });
  if (topForumPost)  slides.push({ type: "forum",   post: topForumPost });
  for (const s of latestSets) slides.push({ type: "set", set: s });

  // Always need at least 1 slide
  if (slides.length === 0) return null;

  const autoplay = useRef(
    Autoplay({ delay: 6000, stopOnMouseEnter: true, stopOnInteraction: false })
  );

  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, duration: 30 },
    [autoplay.current]
  );

  const [selectedIndex, setSelectedIndex] = useState(0);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo   = useCallback((i: number) => emblaApi?.scrollTo(i), [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi]);

  return (
    <section
      className="relative border-b border-[var(--border-strong)] overflow-hidden"
      aria-label="Featured content slider"
    >
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex touch-pan-y">
          {slides.map((slide, i) => (
            <div key={i} className="flex-[0_0_100%] min-w-0">
              {slide.type === "article" && <ArticleSlide post={slide.post} />}
              {slide.type === "market"  && <MarketSlide report={slide.report} />}
              {slide.type === "forum"   && <ForumSlide post={slide.post} />}
              {slide.type === "set"     && <LatestSetSlide set={slide.set} />}
            </div>
          ))}
        </div>
      </div>

      {/* Prev / Next arrows */}
      {slides.length > 1 && (
        <>
          <button
            onClick={scrollPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center bg-black/30 hover:bg-black/60 text-white backdrop-blur-sm transition-colors"
            aria-label="Previous slide"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={scrollNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center bg-black/30 hover:bg-black/60 text-white backdrop-blur-sm transition-colors"
            aria-label="Next slide"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {/* Dot navigation */}
      {slides.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`rounded-full transition-all duration-300 ${
                i === selectedIndex
                  ? "w-6 h-2 bg-white"
                  : "w-2 h-2 bg-white/40 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
