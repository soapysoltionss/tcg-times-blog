import Link from "next/link";
import { PostMeta } from "@/types/post";
import { getCategoryBySlug } from "@/config/site";
import { formatDate } from "@/lib/utils";

type Props = {
  post: PostMeta;
  featured?: boolean;
};

export default function PostCard({ post, featured = false }: Props) {
  const cat = getCategoryBySlug(post.category);

  return (
    <article
      className={`group relative flex flex-col rounded-2xl border bg-white dark:bg-gray-900 overflow-hidden hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 ${
        cat?.borderColor ?? "border-gray-200 dark:border-gray-700"
      } ${featured ? "md:flex-row" : ""}`}
    >
      {/* Category accent bar */}
      <div
        className={`h-1 w-full ${featured ? "md:h-auto md:w-1" : ""} ${
          post.category === "grand-archive"
            ? "bg-violet-500"
            : post.category === "flesh-and-blood"
            ? "bg-red-500"
            : post.category === "one-piece-tcg"
            ? "bg-amber-500"
            : "bg-teal-500"
        }`}
      />

      <div className="flex flex-col flex-1 p-6">
        {/* Category badge */}
        {cat && (
          <span
            className={`self-start text-xs font-semibold px-2.5 py-0.5 rounded-full mb-3 ${cat.badgeColor}`}
          >
            {cat.emoji} {cat.name}
          </span>
        )}

        {/* Title */}
        <Link href={`/blog/${post.slug}`} className="group/title">
          <h2
            className={`font-bold text-gray-900 dark:text-white group-hover/title:text-violet-600 dark:group-hover/title:text-violet-400 transition-colors leading-snug ${
              featured ? "text-xl md:text-2xl mb-3" : "text-lg mb-2"
            }`}
          >
            {post.title}
          </h2>
        </Link>

        {/* Excerpt */}
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed flex-1 line-clamp-3 mb-4">
          {post.excerpt}
        </p>

        {/* Meta */}
        <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 pt-3 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-600 dark:text-gray-400">{post.author}</span>
            <span>·</span>
            <time dateTime={post.date}>{formatDate(post.date)}</time>
          </div>
          <span>{post.readingTime}</span>
        </div>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {post.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-md"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
