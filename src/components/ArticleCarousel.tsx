"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
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
    <article className="min-w-0">
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

function getPageSize() {
  if (typeof window === "undefined") return 4;
  if (window.innerWidth < 640)  return 1;
  if (window.innerWidth < 1024) return 2;
  if (window.innerWidth < 1280) return 3;
  return 4;
}

type Props = { posts: PostMeta[]; title?: string };

export default function ArticleCarousel({ posts, title = "Featured Articles" }: Props) {
  const [start, setStart]       = useState(0);
  const [pageSize, setPageSize] = useState(4);
  const [dir, setDir]           = useState<"left" | "right">("left");
  const [animKey, setAnimKey]   = useState(0);
  const mounted                 = useRef(false);

  useEffect(() => {
    const sync = () => setPageSize(getPageSize());
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  useEffect(() => {
    setStart(s => Math.min(s, Math.max(0, posts.length - pageSize)));
  }, [pageSize, posts.length]);

  useEffect(() => { mounted.current = true; }, []);

  const canPrev = start > 0;
  const canNext = start + pageSize < posts.length;

  const prev = () => { setDir("right"); setAnimKey(k => k + 1); setStart(s => Math.max(0, s - 1)); };
  const next = () => { setDir("left");  setAnimKey(k => k + 1); setStart(s => Math.min(posts.length - pageSize, s + 1)); };
  const jumpTo = (i: number) => { setDir(i > start ? "left" : "right"); setAnimKey(k => k + 1); setStart(i); };

  const visible = posts.slice(start, start + pageSize);
  if (posts.length === 0) return null;

  const animStyle: React.CSSProperties = mounted.current
    ? { animation: `carousel-in-${dir} 280ms cubic-bezier(0.25,0.46,0.45,0.94) both` }
    : {};

  return (
    <section className="border-b border-[var(--border)] bg-[var(--background)]">
      <style>{`
        @keyframes carousel-in-left  { from { opacity:0; transform:translateX(32px)  } to { opacity:1; transform:translateX(0) } }
        @keyframes carousel-in-right { from { opacity:0; transform:translateX(-32px) } to { opacity:1; transform:translateX(0) } }
      `}</style>

      <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-10 pb-4 flex items-center justify-between gap-4">
        <h2 className="text-2xl font-black text-[var(--foreground)] tracking-tight" style={{ fontFamily: "var(--font-serif, serif)" }}>
          {title}
        </h2>
        <div className="flex items-center gap-2">
          <Arrow dir="prev" onClick={prev} disabled={!canPrev} />
          <Arrow dir="next" onClick={next} disabled={!canNext} />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-10 pb-10 pt-1 overflow-hidden">
        <div
          key={animKey}
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${pageSize}, minmax(0, 1fr))`, ...animStyle }}
        >
          {visible.map((post) => <SlideCard key={post.slug} post={post} />)}
        </div>
      </div>

      {posts.length > pageSize && (
        <div className="flex justify-center gap-1.5 pb-6">
          {Array.from({ length: posts.length - pageSize + 1 }, (_, i) => (
            <button
              key={i} onClick={() => jumpTo(i)} aria-label={`Go to position ${i + 1}`}
              className={`h-1.5 rounded-full transition-all duration-200 ${i === start ? "w-6 bg-[var(--foreground)]" : "w-1.5 bg-[var(--border-strong)] hover:bg-[var(--text-muted)]"}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
