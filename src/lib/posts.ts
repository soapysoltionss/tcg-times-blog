import fs from "fs";
import path from "path";
import matter from "gray-matter";
import readingTime from "reading-time";
import { Post, PostMeta, PostFrontmatter } from "@/types/post";

const postsDirectory = path.join(process.cwd(), "content/posts");

function ensurePostsDir() {
  if (!fs.existsSync(postsDirectory)) {
    fs.mkdirSync(postsDirectory, { recursive: true });
  }
}

export function getAllPostSlugs(): string[] {
  ensurePostsDir();
  return fs
    .readdirSync(postsDirectory)
    .filter((f) => f.endsWith(".mdx") || f.endsWith(".md"))
    .map((f) => f.replace(/\.mdx?$/, ""));
}

export function getPostBySlug(slug: string): Post {
  ensurePostsDir();
  const fullPath =
    fs.existsSync(path.join(postsDirectory, `${slug}.mdx`))
      ? path.join(postsDirectory, `${slug}.mdx`)
      : path.join(postsDirectory, `${slug}.md`);

  const raw = fs.readFileSync(fullPath, "utf8");
  const { data, content } = matter(raw);
  const fm = data as PostFrontmatter;
  const rt = readingTime(content);

  const PAYWALL_MARKER = "PAYWALL_BREAK";
  const markerIndex = content.indexOf(PAYWALL_MARKER);
  const freeContent =
    fm.paywalled && markerIndex !== -1
      ? content.slice(0, markerIndex).trim()
      : undefined;

  return {
    ...fm,
    slug,
    content,
    freeContent,
    readingTime: rt.text,
    tags: fm.tags ?? [],
  };
}

export function getAllPosts(): PostMeta[] {
  return getAllPostSlugs()
    .map((slug) => {
      const post = getPostBySlug(slug);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { content, ...meta } = post;
      return meta;
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPostsByCategory(category: string): PostMeta[] {
  return getAllPosts().filter((p) => p.category === category);
}

export function getFeaturedPosts(limit = 3): PostMeta[] {
  const all = getAllPosts();
  const featured = all.filter((p) => p.featured);
  return featured.length > 0 ? featured.slice(0, limit) : all.slice(0, limit);
}
