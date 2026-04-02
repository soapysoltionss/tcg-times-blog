"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
// @ts-ignore — gsap/Observer path casing works at runtime; macOS TS false-positive
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

// ─── SlideCard ────────────────────────────────────────────────────────────────

function SlideCard({ post }: { post: PostMeta }) {
  const cat = getCategoryBySlug(post.category);
  const gradient = GRADIENT_BY_GAME[post.category] ?? "from-zinc-800 to-zinc-600";

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex flex-col border border-[var(--border)] hover:border-[var(--border-strong)] bg-[var(--background)] transition-colors"
      style={{ textDecoration: "none" }}
    >
      {/* Image / gradient */}
      <div className="relative w-full" style={{ aspectRatio: "16/9", overflow: "hidden" }}>
        {post.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.coverImage}
            alt={post.title}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transition: "transform 0.5s ease" }}
            className="group-hover:scale-105"
          />
        ) : (
          <div
            className={`bg-gradient-to-br ${gradient} flex items-end p-4`}
            style={{ width: "100%", height: "100%" }}
          >
            <span
              className="text-white/90 font-black text-2xl leading-none tracking-tight line-clamp-2"
              style={{ fontFamily: "var(--font-serif, serif)" }}
            >
              {post.title}
            </span>
          </div>
        )}
        {post.paywalled && (
          <span className="absolute top-2 right-2 label-upper bg-[var(--foreground)] text-[var(--background)] px-2 py-0.5 text-[9px]">
            Subscriber
          </span>
        )}
        {cat && (
          <span className={`absolute top-2 left-2 label-upper px-2 py-0.5 text-[9px] ${cat.badgeColor}`}>
            {cat.shortName}
          </span>
        )}
      </div>

      {/* Text */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <h3
          className="font-bold text-base text-[var(--foreground)] leading-snug group-hover:opacity-60 transition-opacity line-clamp-2"
          style={{ fontFamily: "var(--font-serif, serif)" }}
        >
          {post.title}
        </h3>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-2">{post.excerpt}</p>
        <div className="flex items-center gap-2 mt-auto pt-2 border-t border-[var(--muted)]">
          <span className="label-upper text-[9px] text-[var(--text-muted)] truncate">{post.author}</span>
          <span className="text-[var(--border)]">·</span>
          <time dateTime={post.date} className="label-upper text-[9px] text-[var(--text-muted)] shrink-0">
            {formatDate(post.date)}
          </time>
          <span className="text-[var(--border)]">·</span>
          <span className="label-upper text-[9px] text-[var(--text-muted)] shrink-0">{post.readingTime}</span>
        </div>
      </div>
    </Link>
  );
}

// ─── Arrow ────────────────────────────────────────────────────────────────────

function Arrow({ dir, onClick, disabled }: { dir: "prev" | "next"; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "prev" ? "Previous" : "Next"}
      className="flex items-center justify-center w-9 h-9 border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors disabled:opacity-25 disabled:pointer-events-none shrink-0"
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

// ─── Main carousel ────────────────────────────────────────────────────────────

type Props = { posts: PostMeta[]; title?: string };

// Number of visible cards at each breakpoint
const BREAKPOINTS = [
  { minWidth: 1280, count: 4 },
  { minWidth: 1024, count: 3 },
  { minWidth: 640,  count: 2 },
  { minWidth: 0,    count: 1 },
] as const;

function getVisibleCount(): number {
  if (typeof window === "undefined") return 4;
  for (const bp of BREAKPOINTS) {
    if (window.innerWidth >= bp.minWidth) return bp.count;
  }
  return 1;
}

const GAP = 16; // gap-4 = 16px

export default function ArticleCarousel({ posts, title = "Featured Articles" }: Props) {
  const trackRef  = useRef<HTMLDivElement>(null);
  const wrapRef   = useRef<HTMLDivElement>(null);
  const tweenRef  = useRef<gsap.core.Tween | null>(null);
  const indexRef  = useRef(0);          // source of truth (avoids stale closure)

  const [index,   setIndex]   = useState(0);
  const [visible, setVisible] = useState(4); // SSR default matches widest breakpoint

  const total    = posts.length;
  const maxIndex = Math.max(0, total - visible);

  // ── Responsive visible count ───────────────────────────────────────────────
  useEffect(() => {
    const onResize = () => setVisible(getVisibleCount());
    onResize(); // run once on mount to correct SSR default
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── goTo — reads real DOM width so offset is always exact ─────────────────
  const goTo = useCallback((target: number, instant = false) => {
    const track = trackRef.current;
    const wrap  = wrapRef.current;
    if (!track || !wrap) return;

    const clamped = Math.max(0, Math.min(target, Math.max(0, total - visible)));
    indexRef.current = clamped;
    setIndex(clamped);

    // Measure actual card width from DOM (includes borders, accounts for gaps correctly)
    const firstCard = track.children[0] as HTMLElement | undefined;
    const cardW = firstCard
      ? firstCard.getBoundingClientRect().width + GAP
      : (wrap.getBoundingClientRect().width + GAP) / visible;

    const xTarget = -(clamped * cardW);

    if (tweenRef.current) tweenRef.current.kill();
    if (instant) {
      gsap.set(track, { x: xTarget });
    } else {
      tweenRef.current = gsap.to(track, {
        x: xTarget,
        duration: 0.5,
        ease: "power3.out",
      });
    }
  }, [total, visible]);

  // ── Re-snap when visible count changes (responsive resize) ────────────────
  useEffect(() => {
    goTo(Math.min(indexRef.current, Math.max(0, total - visible)), true);
  }, [visible, goTo, total]);

  // ── GSAP Observer: drag / swipe ───────────────────────────────────────────
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    let startX = 0;
    let active = false;
    const THRESHOLD = 40;

    const obs = Observer.create({
      target: wrap,
      type: "pointer,touch",
      onPress:   (self: { x?: number }) => { startX = self.x ?? 0; active = true; },
      onDrag:    (self: { x?: number }) => {
        if (!active || !trackRef.current) return;
        const track = trackRef.current;
        const firstCard = track.children[0] as HTMLElement | undefined;
        const wrapW = wrap.getBoundingClientRect().width;
        const cardW = firstCard
          ? firstCard.getBoundingClientRect().width + GAP
          : (wrapW + GAP) / visible;
        const base  = -(indexRef.current * cardW);
        const delta = (self.x ?? startX) - startX;
        gsap.set(track, { x: base + Math.max(-cardW, Math.min(cardW, delta)) });
      },
      onRelease: (self: { x?: number }) => {
        if (!active) return;
        active = false;
        const delta = (self.x ?? startX) - startX;
        if      (delta < -THRESHOLD) goTo(indexRef.current + 1);
        else if (delta >  THRESHOLD) goTo(indexRef.current - 1);
        else                         goTo(indexRef.current);
      },
    });
    return () => obs.kill();
  }, [visible, goTo]);

  if (posts.length === 0) return null;

  // CSS card width: even split minus shared gap space
  const cardWidthCSS = visible === 1
    ? "100%"
    : `calc(${100 / visible}% - ${(GAP * (visible - 1)) / visible}px)`;

  return (
    <section className="border-b border-[var(--border)] bg-[var(--background)]">
      {/* Header row */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-10 pb-4 flex items-center justify-between gap-4">
        <h2
          className="text-2xl font-black text-[var(--foreground)] tracking-tight"
          style={{ fontFamily: "var(--font-serif, serif)" }}
        >
          {title}
        </h2>
        <div className="flex items-center gap-2">
          <Arrow dir="prev" onClick={() => goTo(index - 1)} disabled={index === 0} />
          <Arrow dir="next" onClick={() => goTo(index + 1)} disabled={index >= maxIndex} />
        </div>
      </div>

      {/* Clipping viewport */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 pb-10 pt-1">
        <div
          ref={wrapRef}
          style={{ overflow: "hidden", cursor: "grab" }}
          className="active:cursor-grabbing"
        >
          {/* Sliding track */}
          <div
            ref={trackRef}
            style={{
              display: "flex",
              gap: `${GAP}px`,
              willChange: "transform",
              userSelect: "none",
            }}
          >
            {posts.map((post) => (
              <div
                key={post.slug}
                style={{ flex: `0 0 ${cardWidthCSS}`, minWidth: 0 }}
              >
                <SlideCard post={post} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dots */}
      {maxIndex > 0 && (
        <div className="flex justify-center gap-1.5 pb-6">
          {Array.from({ length: maxIndex + 1 }).map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Go to position ${i + 1}`}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                i === index
                  ? "w-6 bg-[var(--foreground)]"
                  : "w-1.5 bg-[var(--border-strong)] hover:bg-[var(--text-muted)]"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
