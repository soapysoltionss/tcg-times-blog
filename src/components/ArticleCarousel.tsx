"use client";

/**
 * ArticleCarousel
 *
 * A full-bleed horizontal slider for article cards, built with Embla Carousel.
 * Used below the MarketTicker on the homepage.
 *
 * Features
 * ────────
 * • Embla v8 useEmblaCarousel hook
 * • Autoplay plugin — pauses on hover / focus
 * • Prev / Next arrow buttons (hidden when at start/end)
 * • Dot navigation
 * • Each slide is a newspaper-style article card:
 *     - game badge (coloured)
 *     - cover image (if present) or coloured gradient placeholder
 *     - title, excerpt, author + date + reading time
 * • Fully accessible — arrows have aria-labels, dots have aria-label
 * • Respects prefers-reduced-motion (autoplay disabled)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import type { PostMeta } from "@/types/post";
import { getCategoryBySlug } from "@/config/site";
import { formatDate } from "@/lib/utils";

// ─── Slide card ───────────────────────────────────────────────────────────────

const GRADIENT_BY_GAME: Record<string, string> = {
  "grand-archive":   "from-violet-900 to-violet-700",
  "flesh-and-blood": "from-red-900 to-red-700",
  "one-piece-tcg":   "from-amber-800 to-amber-600",
  "pokemon":         "from-yellow-700 to-yellow-500",
  "magic":           "from-blue-900 to-blue-700",
};

function SlideCard({ post }: { post: PostMeta }) {
  const cat = getCategoryBySlug(post.category);
  const gradient = GRADIENT_BY_GAME[post.category] ?? "from-zinc-800 to-zinc-600";

  return (
    <article className="embla__slide min-w-0 flex-[0_0_100%] sm:flex-[0_0_50%] lg:flex-[0_0_33.333%] xl:flex-[0_0_25%] pl-4 first:pl-0">
      <Link
        href={`/blog/${post.slug}`}
        className="group block h-full border border-[var(--border)] hover:border-[var(--border-strong)] bg-[var(--background)] transition-colors overflow-hidden"
      >
        {/* Cover image / gradient placeholder */}
        <div className="relative aspect-[16/9] overflow-hidden">
          {post.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.coverImage}
              alt={post.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div
              className={`w-full h-full bg-gradient-to-br ${gradient} flex items-end p-4`}
            >
              <span
                className="text-white/90 font-black text-2xl leading-none tracking-tight line-clamp-2"
                style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
              >
                {post.title}
              </span>
            </div>
          )}

          {/* Paywall badge */}
          {post.paywalled && (
            <span className="absolute top-2 right-2 label-upper bg-[var(--foreground)] text-[var(--background)] px-2 py-0.5 text-[9px]">
              Subscriber
            </span>
          )}

          {/* Game badge */}
          {cat && (
            <span
              className={`absolute top-2 left-2 label-upper px-2 py-0.5 text-[9px] ${cat.badgeColor}`}
            >
              {cat.shortName}
            </span>
          )}
        </div>

        {/* Text body */}
        <div className="p-4 flex flex-col gap-2">
          <h3
            className="font-bold text-base text-[var(--foreground)] leading-snug group-hover:opacity-60 transition-opacity line-clamp-2"
            style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
          >
            {post.title}
          </h3>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-2">
            {post.excerpt}
          </p>
          <div className="flex items-center gap-2 mt-auto pt-2 border-t border-[var(--muted)]">
            <span className="label-upper text-[9px] text-[var(--text-muted)] truncate">{post.author}</span>
            <span className="text-[var(--border)]">·</span>
            <time
              dateTime={post.date}
              className="label-upper text-[9px] text-[var(--text-muted)] shrink-0"
            >
              {formatDate(post.date)}
            </time>
            <span className="text-[var(--border)]">·</span>
            <span className="label-upper text-[9px] text-[var(--text-muted)] shrink-0">{post.readingTime}</span>
          </div>
        </div>
      </Link>
    </article>
  );
}

// ─── Arrow button ─────────────────────────────────────────────────────────────

function Arrow({
  dir,
  onClick,
  disabled,
}: {
  dir: "prev" | "next";
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "prev" ? "Previous articles" : "Next articles"}
      className={`
        flex items-center justify-center w-9 h-9 border border-[var(--border)]
        bg-[var(--background)] text-[var(--foreground)]
        hover:bg-[var(--foreground)] hover:text-[var(--background)]
        transition-colors disabled:opacity-25 disabled:pointer-events-none
        shrink-0
      `}
    >
      {dir === "prev" ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      )}
    </button>
  );
}

// ─── Dot ─────────────────────────────────────────────────────────────────────

function Dot({
  active,
  onClick,
  index,
}: {
  active: boolean;
  onClick: () => void;
  index: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Go to slide ${index + 1}`}
      className={`
        h-1.5 rounded-full transition-all duration-200
        ${active ? "w-6 bg-[var(--foreground)]" : "w-1.5 bg-[var(--border-strong)] hover:bg-[var(--text-muted)]"}
      `}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  posts: PostMeta[];
  title?: string;
};

export default function ArticleCarousel({ posts, title = "Featured Articles" }: Props) {
  // Detect prefers-reduced-motion
  const reducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  const autoplayRef = useRef(
    Autoplay({ delay: 4500, stopOnInteraction: true, stopOnMouseEnter: true })
  );

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: false,
      align: "start",
      dragFree: false,
      skipSnaps: false,
      containScroll: "trimSnaps",
    },
    reducedMotion ? [] : [autoplayRef.current]
  );

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);
  const [prevEnabled, setPrevEnabled] = useState(false);
  const [nextEnabled, setNextEnabled] = useState(false);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
    setPrevEnabled(emblaApi.canScrollPrev());
    setNextEnabled(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    setScrollSnaps(emblaApi.scrollSnapList());
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo   = useCallback((i: number) => emblaApi?.scrollTo(i), [emblaApi]);

  if (posts.length === 0) return null;

  return (
    <section className="border-b border-[var(--border)] bg-[var(--background)]">
      {/* Header row */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-10 pb-4 flex items-center justify-between gap-4">
        <h2
          className="text-2xl font-black text-[var(--foreground)] tracking-tight"
          style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
        >
          {title}
        </h2>

        {/* Arrows */}
        <div className="flex items-center gap-2">
          <Arrow dir="prev" onClick={scrollPrev} disabled={!prevEnabled} />
          <Arrow dir="next" onClick={scrollNext} disabled={!nextEnabled} />
        </div>
      </div>

      {/* Embla viewport — clipped inside the page's standard padded container */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 overflow-hidden" ref={emblaRef}>
        <div className="flex pb-10 pt-1">
          {posts.map((post) => (
            <SlideCard key={post.slug} post={post} />
          ))}
        </div>
      </div>

      {/* Dot pagination */}
      {scrollSnaps.length > 1 && (
        <div className="flex justify-center gap-2 pb-6">
          {scrollSnaps.map((_, i) => (
            <Dot
              key={i}
              index={i}
              active={i === selectedIndex}
              onClick={() => scrollTo(i)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
