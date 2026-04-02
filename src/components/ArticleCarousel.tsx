"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import type { PostMeta } from "@/types/post";
import { getCategoryBySlug } from "@/config/site";
import { formatDate } from "@/lib/utils";

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
    <article className="article-carousel-slide shrink-0 min-w-0">
      <Link
        href={`/blog/${post.slug}`}
        className="group block h-full border border-[var(--border)] hover:border-[var(--border-strong)] bg-[var(--background)] transition-colors overflow-hidden"
      >
        <div className="relative aspect-[16/9] overflow-hidden">
          {post.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-end p-4`}>
              <span className="text-white/90 font-black text-2xl leading-none tracking-tight line-clamp-2" style={{ fontFamily: "var(--font-serif, serif)" }}>
                {post.title}
              </span>
            </div>
          )}
          {post.paywalled && (
            <span className="absolute top-2 right-2 label-upper bg-[var(--foreground)] text-[var(--background)] px-2 py-0.5 text-[9px]">Subscriber</span>
          )}
          {cat && (
            <span className={`absolute top-2 left-2 label-upper px-2 py-0.5 text-[9px] ${cat.badgeColor}`}>{cat.shortName}</span>
          )}
        </div>
        <div className="p-4 flex flex-col gap-2">
          <h3 className="font-bold text-base text-[var(--foreground)] leading-snug group-hover:opacity-60 transition-opacity line-clamp-2" style={{ fontFamily: "var(--font-serif, serif)" }}>
            {post.title}
          </h3>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-2">{post.excerpt}</p>
          <div className="flex items-center gap-2 mt-auto pt-2 border-t border-[var(--muted)]">
            <span className="label-upper text-[9px] text-[var(--text-muted)] truncate">{post.author}</span>
            <span className="text-[var(--border)]">·</span>
            <time dateTime={post.date} className="label-upper text-[9px] text-[var(--text-muted)] shrink-0">{formatDate(post.date)}</time>
            <span className="text-[var(--border)]">·</span>
            <span className="label-upper text-[9px] text-[var(--text-muted)] shrink-0">{post.readingTime}</span>
          </div>
        </div>
      </Link>
    </article>
  );
}

function Arrow({ dir, onClick, disabled }: { dir: "prev" | "next"; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      aria-label={dir === "prev" ? "Previous articles" : "Next articles"}
      className="flex items-center justify-center w-9 h-9 border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors disabled:opacity-25 disabled:pointer-events-none shrink-0"
    >
      {dir === "prev" ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
      )}
    </button>
  );
}

type Props = { posts: PostMeta[]; title?: string };

export default function ArticleCarousel({ posts, title = "Featured Articles" }: Props) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: "start",
    dragFree: false,
    containScroll: "trimSnaps",
  });

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps]     = useState<number[]>([]);
  const [prevEnabled, setPrevEnabled]     = useState(false);
  const [nextEnabled, setNextEnabled]     = useState(false);

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
    return () => { emblaApi.off("select", onSelect); emblaApi.off("reInit", onSelect); };
  }, [emblaApi, onSelect]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo   = useCallback((i: number) => emblaApi?.scrollTo(i), [emblaApi]);

  if (posts.length === 0) return null;

  return (
    <section className="border-b border-[var(--border)] bg-[var(--background)]">
      {/*
        Slide widths use calc() to subtract gap space so cards fill exactly:
          mobile:  1 card  = 100%
          sm≥640:  2 cards = calc(50% - 8px)   (gap-4=16px, 1 gap / 2 cards = 8px each)
          lg≥1024: 3 cards = calc(33.333% - 11px) (2 gaps / 3 cards ≈ 10.67px each)
          xl≥1280: 4 cards = calc(25% - 12px)  (3 gaps / 4 cards = 12px each)
      */}
      <style>{`
        .article-carousel-slide { flex: 0 0 100%; }
        @media (min-width: 640px)  { .article-carousel-slide { flex: 0 0 calc(50% - 8px); } }
        @media (min-width: 1024px) { .article-carousel-slide { flex: 0 0 calc(33.333% - 11px); } }
        @media (min-width: 1280px) { .article-carousel-slide { flex: 0 0 calc(25% - 12px); } }
      `}</style>
      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-10 pb-4 flex items-center justify-between gap-4">
        <h2 className="text-2xl font-black text-[var(--foreground)] tracking-tight" style={{ fontFamily: "var(--font-serif, serif)" }}>
          {title}
        </h2>
        <div className="flex items-center gap-2">
          <Arrow dir="prev" onClick={scrollPrev} disabled={!prevEnabled} />
          <Arrow dir="next" onClick={scrollNext} disabled={!nextEnabled} />
        </div>
      </div>

      {/*
        Layout strategy:
        - Outer wrapper: max-w-7xl + px-6/lg:px-10 for page alignment (NO overflow-hidden)
        - ref div: overflow-hidden — this is what Embla uses as its viewport and clip boundary
        - Flex container: gap-4, no negative margin tricks
        - Each slide: calc() width so 4 cards + 3 gaps = exactly 100% of the clipped area
      */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 pb-10 pt-1">
        <div ref={emblaRef} className="overflow-hidden">
          <div className="flex gap-4">
            {posts.map((post) => (
              <SlideCard key={post.slug} post={post} />
            ))}
          </div>
        </div>
      </div>

      {/* Dots */}
      {scrollSnaps.length > 1 && (
        <div className="flex justify-center gap-1.5 pb-6">
          {scrollSnaps.map((_, i) => (
            <button
              key={i} onClick={() => scrollTo(i)} aria-label={`Go to slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all duration-200 ${i === selectedIndex ? "w-6 bg-[var(--foreground)]" : "w-1.5 bg-[var(--border-strong)] hover:bg-[var(--text-muted)]"}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
