"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — gsap/Observer casing is correct at runtime; TS false-positive on macOS
import { Observer } from "gsap/Observer";
import type { PostMeta } from "@/types/post";
import { getCategoryBySlug } from "@/config/site";
import { formatDate } from "@/lib/utils";

gsap.registerPlugin(Observer);

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
    <Link
      href={`/blog/${post.slug}`}
      className="group block border border-[var(--border)] hover:border-[var(--border-strong)] bg-[var(--background)] transition-colors overflow-hidden"
    >
      <div className="relative aspect-[16/9] overflow-hidden">
        {post.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.coverImage}
            alt={post.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
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
  );
}

function Arrow({ dir, onClick, disabled }: { dir: "prev" | "next"; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      aria-label={dir === "prev" ? "Previous articles" : "Next articles"}
      className="flex items-center justify-center w-9 h-9 border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors disabled:opacity-25 disabled:pointer-events-none shrink-0"
    >
      {dir === "prev"
        ? <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
      }
    </button>
  );
}

type Props = { posts: PostMeta[]; title?: string };

// How many cards are visible at a given viewport width
function getPageSize(): number {
  if (typeof window === "undefined") return 4;
  if (window.innerWidth < 640)  return 1;
  if (window.innerWidth < 1024) return 2;
  if (window.innerWidth < 1280) return 3;
  return 4;
}

export default function ArticleCarousel({ posts, title = "Featured Articles" }: Props) {
  const trackRef   = useRef<HTMLDivElement>(null);
  const wrapRef    = useRef<HTMLDivElement>(null);
  const indexRef   = useRef(0);
  const animRef    = useRef<gsap.core.Tween | null>(null);

  const [index,    setIndex]    = useState(0);
  const [pageSize, setPageSize] = useState(4);

  const total      = posts.length;
  const maxIndex   = Math.max(0, total - pageSize);

  // ── Sync pageSize on resize ──────────────────────────────────────────────
  useEffect(() => {
    const update = () => setPageSize(getPageSize());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // ── Animate to a target index ────────────────────────────────────────────
  const goTo = useCallback((target: number, instant = false) => {
    const track = trackRef.current;
    const wrap  = wrapRef.current;
    if (!track || !wrap) return;

    const clamped = Math.max(0, Math.min(target, maxIndex));
    indexRef.current = clamped;
    setIndex(clamped);

    // Each card = (wrapWidth / pageSize). Use getBoundingClientRect for accuracy.
    const cardW = wrap.getBoundingClientRect().width / pageSize;
    const xTarget = -(clamped * cardW);

    if (animRef.current) animRef.current.kill();
    if (instant) {
      gsap.set(track, { x: xTarget });
    } else {
      animRef.current = gsap.to(track, {
        x: xTarget,
        duration: 0.55,
        ease: "power3.out",
      });
    }
  }, [maxIndex, pageSize]);

  // ── Re-snap when pageSize changes (responsive) ───────────────────────────
  useEffect(() => {
    goTo(Math.min(indexRef.current, Math.max(0, total - pageSize)), true);
  }, [pageSize, goTo, total]);

  // ── Stagger-in entrance animation ────────────────────────────────────────
  useEffect(() => {
    if (!trackRef.current) return;
    const cards = Array.from(trackRef.current.children) as HTMLElement[];
    gsap.from(cards, {
      opacity: 0,
      y: 20,
      duration: 0.5,
      stagger: 0.07,
      ease: "power2.out",
      clearProps: "all",
    });
  }, []);

  // ── GSAP Observer: drag/swipe on the viewport ────────────────────────────
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    let startX = 0;
    let dragging = false;
    const threshold = 40; // px swipe needed to advance

    const obs = Observer.create({
      target: wrap,
      type: "pointer,touch",
      onPress:  (self) => { startX = self.x ?? 0; dragging = true; },
      onDrag:   (self) => {
        if (!dragging || !trackRef.current) return;
        const cardW = wrap.getBoundingClientRect().width / pageSize;
        const drag  = (self.x ?? startX) - startX;
        const base  = -(indexRef.current * cardW);
        // Live drag feedback — capped at ±1 card width
        gsap.set(trackRef.current, { x: base + Math.max(-cardW, Math.min(cardW, drag)) });
      },
      onRelease: (self) => {
        if (!dragging) return;
        dragging = false;
        const delta = (self.x ?? startX) - startX;
        if      (delta < -threshold) goTo(indexRef.current + 1);
        else if (delta >  threshold) goTo(indexRef.current - 1);
        else                         goTo(indexRef.current); // snap back
      },
    });
    return () => obs.kill();
  }, [pageSize, goTo]);

  if (posts.length === 0) return null;

  // Card width CSS: 1/pageSize of the container, minus gaps
  // gap-4 = 16px. For n cards: each card loses ((n-1)/n)*16px
  const gapPx   = 16;
  const cardW   = `calc(${100 / pageSize}% - ${(pageSize - 1) / pageSize * gapPx}px)`;

  return (
    <section className="border-b border-[var(--border)] bg-[var(--background)]">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-10 pb-4 flex items-center justify-between gap-4">
        <h2 className="text-2xl font-black text-[var(--foreground)] tracking-tight" style={{ fontFamily: "var(--font-serif, serif)" }}>
          {title}
        </h2>
        <div className="flex items-center gap-2">
          <Arrow dir="prev" onClick={() => goTo(index - 1)} disabled={index === 0} />
          <Arrow dir="next" onClick={() => goTo(index + 1)} disabled={index >= maxIndex} />
        </div>
      </div>

      {/* Viewport — overflow-hidden inside the padded wrapper so clip = padded area */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 pb-10 pt-1">
        <div ref={wrapRef} className="overflow-hidden cursor-grab active:cursor-grabbing select-none">
          {/* Track — GSAP moves this element's x */}
          <div
            ref={trackRef}
            className="flex gap-4 will-change-transform"
            style={{ userSelect: "none" }}
          >
            {posts.map((post) => (
              <div key={post.slug} style={{ flex: `0 0 ${cardW}`, minWidth: 0 }}>
                <SlideCard post={post} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dot indicators */}
      {maxIndex > 0 && (
        <div className="flex justify-center gap-1.5 pb-6">
          {Array.from({ length: maxIndex + 1 }).map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Go to position ${i + 1}`}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                i === index ? "w-6 bg-[var(--foreground)]" : "w-1.5 bg-[var(--border-strong)] hover:bg-[var(--text-muted)]"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
