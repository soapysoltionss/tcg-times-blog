import Link from "next/link";
import { PostMeta } from "@/types/post";
import { getCategoryBySlug } from "@/config/site";
import { formatDate } from "@/lib/utils";

const GRADIENT_BY_GAME: Record<string, string> = {
  "grand-archive":   "from-violet-900 to-violet-700",
  "flesh-and-blood": "from-red-900 to-red-700",
  "one-piece-tcg":   "from-amber-800 to-amber-600",
  "pokemon":         "from-yellow-700 to-yellow-500",
  "magic":           "from-blue-900 to-blue-700",
  "general":         "from-zinc-700 to-zinc-500",
};

type Props = {
  post: PostMeta;
  index?: number;
  featured?: boolean;
  variant?: "row" | "card";
};
export default function PostCard({ post, index, featured = false, variant = "card" }: Props) {
  const cat = getCategoryBySlug(post.category);
  const num = index !== undefined ? String(index + 1).padStart(2, "0") : null;
  const gradient = GRADIENT_BY_GAME[post.category] ?? "from-zinc-700 to-zinc-500";

  if (variant === "row") {
    return (
      <article className="group border-b border-[var(--border)] py-6 grid grid-cols-[3rem_1fr_auto] gap-4 items-start hover:bg-[var(--muted)] transition-colors px-2 -mx-2">
        {/* Number */}
        <span className="label-upper text-[var(--text-muted)] pt-1">{num ?? "—"}</span>

        {/* Content */}
        <div>
          {cat && (
            <span className="label-upper text-[var(--text-muted)] mb-2 block">{cat.name}</span>
          )}
          <Link href={`/blog/${post.slug}`}>
            <h2
              className="text-xl font-bold text-[var(--foreground)] group-hover:opacity-60 transition-opacity leading-snug mb-1"
              style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
            >
              {post.title}
            </h2>
          </Link>
          <p className="text-sm text-[var(--text-muted)] line-clamp-2 leading-relaxed mt-1">{post.excerpt}</p>
        </div>

        {/* Meta */}
        <div className="text-right hidden sm:block">
          {post.paywalled && (
            <span className="label-upper bg-[var(--foreground)] text-[var(--background)] px-2 py-1 block mb-2">Subscriber</span>
          )}
          <p className="label-upper text-[var(--text-muted)]">{formatDate(post.date)}</p>
          <p className="label-upper text-[var(--text-muted)] mt-1">{post.readingTime}</p>
        </div>
      </article>
    );
  }

  return (
    <article className="group border-t border-[var(--border)] pt-5 pb-6 flex flex-col gap-3">
      {/* Cover image */}
      {post.coverImage && (
        <Link href={`/blog/${post.slug}`} className="block overflow-hidden aspect-[16/9] relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.coverImage}
            alt={post.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {cat && (
            <span className={`absolute top-2 left-2 label-upper px-2 py-0.5 text-[9px] ${cat.badgeColor}`}>{cat.shortName}</span>
          )}
          {post.paywalled && (
            <span className="absolute top-2 right-2 label-upper bg-[var(--foreground)] text-[var(--background)] px-2 py-0.5 text-[9px]">Subscriber</span>
          )}
        </Link>
      )}

      {/* Top meta row (only shown when no cover image, to avoid duplicate category) */}
      {!post.coverImage && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {cat && <span className="label-upper text-[var(--text-muted)]">{cat.name}</span>}
            {post.paywalled && (
              <span className="label-upper bg-[var(--foreground)] text-[var(--background)] px-2 py-0.5">Subscriber</span>
            )}
          </div>
          {num && <span className="label-upper text-[var(--border)]">{num}</span>}
        </div>
      )}

      {/* Gradient fallback when no image */}
      {!post.coverImage && (
        <Link href={`/blog/${post.slug}`} className="block overflow-hidden aspect-[16/9]">
          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-end p-4`}>
            <span className="text-white/90 font-black text-xl leading-tight line-clamp-2" style={{ fontFamily: "var(--font-serif, serif)" }}>
              {post.title}
            </span>
          </div>
        </Link>
      )}

      {/* Title */}
      <Link href={`/blog/${post.slug}`} className="group/title block">
        <h2
          className={`font-bold text-[var(--foreground)] group-hover/title:opacity-60 transition-opacity leading-tight ${
            featured ? "text-2xl md:text-3xl" : "text-xl"
          }`}
          style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
        >
          {post.title}
        </h2>
      </Link>

      {/* Excerpt */}
      <p className="text-sm text-[var(--text-muted)] leading-relaxed line-clamp-3 flex-1">
        {post.excerpt}
      </p>

      {/* Footer meta */}
      <div className="flex items-center gap-3 text-[var(--text-muted)] pt-2 border-t border-[var(--muted)]">
        <span className="label-upper">{post.author}</span>
        <span className="text-[var(--border)]">·</span>
        <span className="label-upper">
          <time dateTime={post.date}>{formatDate(post.date)}</time>
        </span>
        <span className="text-[var(--border)]">·</span>
        <span className="label-upper">{post.readingTime}</span>
      </div>
    </article>
  );
}

