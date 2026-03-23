import Link from "next/link";
import { PostMeta } from "@/types/post";
import { getCategoryBySlug } from "@/config/site";
import { formatDate } from "@/lib/utils";

type Props = {
  post: PostMeta;
  index?: number;
  featured?: boolean;
  variant?: "row" | "card";
};
export default function PostCard({ post, index, featured = false, variant = "card" }: Props) {
  const cat = getCategoryBySlug(post.category);
  const num = index !== undefined ? String(index + 1).padStart(2, "0") : null;

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
      {/* Top meta row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {cat && <span className="label-upper text-[var(--text-muted)]">{cat.name}</span>}
          {post.paywalled && (
            <span className="label-upper bg-[var(--foreground)] text-[var(--background)] px-2 py-0.5">Subscriber</span>
          )}
        </div>
        {num && <span className="label-upper text-[var(--border)]">{num}</span>}
      </div>

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

