"use client";

/**
 * HeroSlider — GSAP-powered crossfade + stagger entrance
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — gsap/Observer casing is correct at runtime; TS false-positive on macOS
import { Observer } from "gsap/Observer";
import type { PostMeta, ForumPost } from "@/types/post";
import { useCurrency } from "@/lib/currency";

gsap.registerPlugin(Observer);

export type LatestSet = {
  game: string;
  gameEmoji: string;
  setName: string;
  groupId: number;
  imageUrl?: string;
};

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

const SET_HOOKS = [
  "What's It Worth Right Now?",
  "The Cards Collectors Are Chasing",
  "Prices, Pulls & Market Insights",
  "Early Price Signals You Should Know",
  "Which Cards Are Already Spiking?",
];
const MARKET_HOOKS = [
  "The Price Driving the Market",
  "Insights Behind the Hype",
  "Why Collectors Are Paying a Premium",
  "The Card Everyone Is Watching",
  "A Closer Look at the Numbers",
];
const FORUM_HOOKS = [
  "The Community Has Opinions",
  "The Thread the TCG World Is Reading",
  "Hot Take or Hard Truth?",
  "Collectors Are Divided on This One",
  "The Discussion You Don't Want to Miss",
];

function pickHook(arr: string[], seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return arr[Math.abs(h) % arr.length];
}

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

// ─── Slide components ─────────────────────────────────────────────────────────

function ArticleSlide({ post }: { post: PostMeta }) {
  const gradient = gradientFor(post.category);
  const ARTICLE_HOOKS = [
    "Insights Behind the Hype",
    "What Every Collector Should Know",
    "The Story the Numbers Tell",
    "A Deep Dive Worth Your Time",
    "Breaking Down What Matters",
  ];
  const needsHook = !/[:\u2014\u2013]/.test(post.title);
  const articleHook = needsHook ? pickHook(ARTICLE_HOOKS, post.slug) : null;

  return (
    <div className="relative h-full overflow-hidden">
      {post.coverImage ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.coverImage} alt="" className="absolute inset-0 w-full h-full object-cover" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        </>
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
      )}
      <div className="slide-content relative z-10 flex flex-col justify-end h-full max-w-4xl mx-auto px-8 md:px-12 pb-12 pt-20">
        <span className="label-upper text-xs text-white/70 tracking-widest mb-3 inline-flex items-center gap-2">
          <span className="w-6 h-px bg-white/50 inline-block" />New Article
        </span>
        <h2 className="text-3xl md:text-5xl font-black text-white leading-tight mb-1 drop-shadow" style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}>
          {post.title}
        </h2>
        {articleHook && (
          <p className="text-white/50 text-lg md:text-2xl italic font-medium mb-3 drop-shadow" style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}>
            {articleHook}
          </p>
        )}
        {post.excerpt && (
          <p className="text-white/80 text-base md:text-lg max-w-2xl mb-6 line-clamp-2">{post.excerpt}</p>
        )}
        <Link href={`/blog/${post.slug}`} className="self-start label-upper text-xs px-6 py-3 bg-white text-black hover:bg-white/80 transition-colors">
          Read Article →
        </Link>
      </div>
    </div>
  );
}

function MarketSlide({ report }: { report: MarketReportSnap }) {
  const { formatPrice } = useCurrency();
  const hook = pickHook(MARKET_HOOKS, report.topCardName);
  return (
    <div className="relative h-full overflow-hidden">
      {report.topCardImageUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={report.topCardImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover scale-110 blur-sm" aria-hidden="true" />
          <div className="absolute inset-0 bg-black/70" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-emerald-800 to-emerald-600" />
      )}
      {report.topCardImageUrl && (
        <div className="hidden md:flex absolute right-24 bottom-0 h-[85%] items-end justify-center pointer-events-none select-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={report.topCardImageUrl} alt={report.topCardName} className="h-full object-contain drop-shadow-2xl" />
        </div>
      )}
      <div className="slide-content relative z-10 flex flex-col justify-end h-full max-w-4xl mx-auto px-8 md:px-12 pb-12 pt-20">
        <span className="label-upper text-xs text-white/70 tracking-widest mb-3 inline-flex items-center gap-2">
          <span className="w-6 h-px bg-white/50 inline-block" />Market Report · {report.topGameEmoji} {report.topGame}
        </span>
        <h2 className="text-3xl md:text-5xl font-black text-white leading-tight mb-1 drop-shadow" style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}>
          {report.topCardName}
        </h2>
        <p className="text-white/50 text-lg md:text-2xl italic font-medium mb-3 drop-shadow" style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}>
          {hook}
        </p>
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <span className="text-2xl font-bold text-white">{formatPrice(report.topCardPriceCents)}</span>
          <span className="label-upper text-xs text-white/60 border border-white/30 px-2 py-0.5">Highest listed</span>
        </div>
        <p className="text-white/60 text-sm max-w-lg mb-6">
          {report.totalListings} active listing{report.totalListings !== 1 ? "s" : ""} on the marketplace. Full market reports with price history, community sentiment &amp; Reddit trends coming soon.
        </p>
        <Link href="/tools/market" className="self-start label-upper text-xs px-6 py-3 bg-white text-black hover:bg-white/80 transition-colors">
          View Market Index →
        </Link>
      </div>
    </div>
  );
}

function ForumSlide({ post }: { post: ForumPost }) {
  const hook = pickHook(FORUM_HOOKS, post.title);
  return (
    <div className="relative h-full overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black" />
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
      <div className="slide-content relative z-10 flex flex-col justify-end h-full max-w-4xl mx-auto px-8 md:px-12 pb-12 pt-20">
        <span className="label-upper text-xs text-white/70 tracking-widest mb-3 inline-flex items-center gap-2">
          <span className="w-6 h-px bg-white/50 inline-block" />Trending Discussion
        </span>
        <h2 className="text-3xl md:text-5xl font-black text-white leading-tight mb-1 drop-shadow" style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}>
          {post.title}
        </h2>
        <p className="text-white/50 text-lg md:text-2xl italic font-medium mb-3 drop-shadow" style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}>
          {hook}
        </p>
        <p className="text-white/70 text-base max-w-2xl mb-2 line-clamp-2">{post.body}</p>
        <div className="flex items-center gap-3 mb-6 text-sm text-white/60">
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
            {post.upvotes}
          </span>
          <span>·</span>
          <span>💬 {post.commentCount} comments</span>
          <span>·</span>
          <span>by {post.authorUsername}</span>
        </div>
        <Link href={`/forum/${post.id}`} className="self-start label-upper text-xs px-6 py-3 bg-white text-black hover:bg-white/80 transition-colors">
          Join Discussion →
        </Link>
      </div>
    </div>
  );
}

function LatestSetSlide({ set }: { set: LatestSet }) {
  const gradient = gradientFor(set.game);
  const gameName = set.game.split("-").map((w: string) => w[0].toUpperCase() + w.slice(1)).join(" ");
  const setHref = `/tools/market/set/${set.game}/${set.groupId}`;
  const hook = pickHook(SET_HOOKS, set.setName);
  return (
    <div className="relative h-full overflow-hidden">
      {set.imageUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={set.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
        </>
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
      )}
      <div className="slide-content relative z-10 flex flex-col justify-end h-full max-w-4xl mx-auto px-8 md:px-12 pb-12 pt-20">
        <span className="label-upper text-xs text-white/70 tracking-widest mb-3 inline-flex items-center gap-2">
          <span className="w-6 h-px bg-white/50 inline-block" />Latest Release · {set.gameEmoji} {gameName}
        </span>
        <h2 className="text-3xl md:text-5xl font-black text-white leading-tight mb-1 drop-shadow" style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}>
          {set.setName}
        </h2>
        <p className="text-white/50 text-lg md:text-2xl italic font-medium mb-3 drop-shadow" style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}>
          {hook}
        </p>
        <p className="text-white/70 text-sm md:text-base max-w-xl mb-6 leading-relaxed">
          Browse the full card list with TCGPlayer market prices. See which cards are leading in value, check reprint risk ratings, and explore market insights for this set.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href={setHref} className="self-start label-upper text-xs px-6 py-3 bg-white text-black hover:bg-white/80 transition-colors">
            View Card List &amp; Prices →
          </Link>
          <Link href={setHref + "#insights"} className="self-start label-upper text-xs px-6 py-3 bg-white/10 text-white border border-white/30 hover:bg-white/20 transition-colors">
            Market Insights →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function HeroSlider({ latestPost, marketReport, topForumPost, latestSets }: HeroSliderProps) {
  type Slide =
    | { type: "article"; post: PostMeta }
    | { type: "market";  report: MarketReportSnap }
    | { type: "forum";   post: ForumPost }
    | { type: "set";     set: LatestSet };

  const slides: Slide[] = [];
  if (latestPost)   slides.push({ type: "article", post: latestPost });
  if (marketReport) slides.push({ type: "market",  report: marketReport });
  if (topForumPost) slides.push({ type: "forum",   post: topForumPost });
  for (const s of latestSets) slides.push({ type: "set", set: s });

  if (slides.length === 0) return null;

  const total = slides.length;

  const containerRef = useRef<HTMLDivElement>(null);
  const slideRefs    = useRef<(HTMLDivElement | null)[]>([]);
  const currentRef   = useRef(0);
  const animatingRef = useRef(false);
  const hoverRef     = useRef(false);
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const [current, setCurrent] = useState(0);

  // ── Crossfade transition ──────────────────────────────────────────────────
  const goTo = useCallback((next: number) => {
    if (total <= 1) return;
    if (animatingRef.current) return;
    const clamped = ((next % total) + total) % total;
    if (clamped === currentRef.current) return;

    animatingRef.current = true;
    const outEl = slideRefs.current[currentRef.current];
    const inEl  = slideRefs.current[clamped];
    if (!outEl || !inEl) { animatingRef.current = false; return; }

    const inContent  = inEl.querySelector(".slide-content");
    const inChildren = inContent ? Array.from(inContent.children) : [];

    gsap.set(inEl,  { zIndex: 2, opacity: 0 });
    gsap.set(outEl, { zIndex: 1 });

    const tl = gsap.timeline({
      onComplete: () => {
        gsap.set(outEl, { zIndex: 0, opacity: 0 });
        gsap.set(inEl,  { zIndex: 1, opacity: 1 });
        currentRef.current = clamped;
        setCurrent(clamped);
        animatingRef.current = false;
      },
    });

    tl.to(inEl, { opacity: 1, duration: 0.7, ease: "power2.inOut" });

    if (inChildren.length > 0) {
      tl.fromTo(
        inChildren,
        { opacity: 0, y: 22 },
        { opacity: 1, y: 0, duration: 0.45, stagger: 0.07, ease: "power2.out", clearProps: "transform,opacity" },
        "-=0.35"
      );
    }
  }, [total]);

  // ── Autoplay ──────────────────────────────────────────────────────────────
  const startAutoplay = useCallback(() => {
    if (total <= 1) return;
    intervalRef.current = setInterval(() => {
      if (!hoverRef.current) goTo(currentRef.current + 1);
    }, 6000);
  }, [goTo, total]);

  const stopAutoplay = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  // ── Mount ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    slideRefs.current.forEach((el, i) => {
      if (!el) return;
      gsap.set(el, { zIndex: i === 0 ? 1 : 0, opacity: i === 0 ? 1 : 0 });
    });

    const firstContent = slideRefs.current[0]?.querySelector(".slide-content");
    if (firstContent) {
      gsap.fromTo(
        Array.from(firstContent.children),
        { opacity: 0, y: 22 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: "power2.out", delay: 0.2 }
      );
    }

    startAutoplay();
    return () => stopAutoplay();
  }, [startAutoplay, stopAutoplay]);

  // ── Observer for swipe/drag ───────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container || total <= 1) return;

    const obs = Observer.create({
      target: container,
      type: "pointer,touch",
      onLeft:  () => { stopAutoplay(); goTo(currentRef.current + 1); startAutoplay(); },
      onRight: () => { stopAutoplay(); goTo(currentRef.current - 1); startAutoplay(); },
      tolerance: 30,
    });
    return () => obs.kill();
  }, [goTo, startAutoplay, stopAutoplay, total]);

  return (
    <section
      ref={containerRef}
      className="relative border-b border-[var(--border-strong)] min-h-[420px] md:min-h-[520px]"
      aria-label="Featured content slider"
      onMouseEnter={() => { hoverRef.current = true; }}
      onMouseLeave={() => { hoverRef.current = false; }}
    >
      {slides.map((slide, i) => (
        <div
          key={i}
          ref={el => { slideRefs.current[i] = el; }}
          className="absolute inset-0"
          style={{ opacity: 0, zIndex: 0 }}
          aria-hidden={i !== current}
        >
          {slide.type === "article" && <ArticleSlide post={slide.post} />}
          {slide.type === "market"  && <MarketSlide report={slide.report} />}
          {slide.type === "forum"   && <ForumSlide post={slide.post} />}
          {slide.type === "set"     && <LatestSetSlide set={slide.set} />}
        </div>
      ))}

      {total > 1 && (
        <>
          <button
            onClick={() => { stopAutoplay(); goTo(current - 1); startAutoplay(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 flex items-center justify-center bg-black/30 hover:bg-black/60 text-white backdrop-blur-sm transition-colors"
            aria-label="Previous slide"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button
            onClick={() => { stopAutoplay(); goTo(current + 1); startAutoplay(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 flex items-center justify-center bg-black/30 hover:bg-black/60 text-white backdrop-blur-sm transition-colors"
            aria-label="Next slide"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </>
      )}

      {total > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => { stopAutoplay(); goTo(i); startAutoplay(); }}
              aria-label={`Go to slide ${i + 1}`}
              className={`rounded-full transition-all duration-300 ${
                i === current ? "w-6 h-2 bg-white" : "w-2 h-2 bg-white/40 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
