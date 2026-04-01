/**
 * Public post API — SERVER ONLY.
 *
 * All reads go through the database (Neon on prod, MDX files on local dev).
 * The MDX content string is returned as-is; callers pass it to MDXRemote.
 *
 * Types re-exported from db so callers don't need to import from two places.
 */
import { unstable_cache } from "next/cache";
import {
  getDbPostBySlug,
  getAllDbPosts,
  getAllDbPostSlugs,
  getDbPostsByCategory,
  getFeaturedDbPosts,
  getPinnedDbPosts,
  getHeroFeaturedPost,
  upsertPost,
  deletePost,
} from "@/lib/db";

export type { DbPost as Post, DbPostMeta as PostMeta } from "@/lib/db";

// ---------------------------------------------------------------------------
// Cached listing queries — revalidate every 60 s
// ---------------------------------------------------------------------------

const cachedGetAllPosts = unstable_cache(
  () => getAllDbPosts(),
  ["all-posts"],
  { revalidate: 60, tags: ["posts"] },
);

const cachedGetAllPostSlugs = unstable_cache(
  () => getAllDbPostSlugs(),
  ["all-post-slugs"],
  { revalidate: 60, tags: ["posts"] },
);

const cachedGetPostsByCategory = unstable_cache(
  (category: string) => getDbPostsByCategory(category),
  ["posts-by-category"],
  { revalidate: 60, tags: ["posts"] },
);

const cachedGetPinnedPosts = unstable_cache(
  (category?: string) => getPinnedDbPosts(category),
  ["pinned-posts"],
  { revalidate: 60, tags: ["posts"] },
);

const cachedGetFeaturedPosts = unstable_cache(
  (limit: number) => getFeaturedDbPosts(limit),
  ["featured-posts"],
  { revalidate: 60, tags: ["posts"] },
);

// ---------------------------------------------------------------------------
// Read helpers (async — matches the DB backend)
// ---------------------------------------------------------------------------

export async function getPostBySlug(slug: string) {
  const post = await getDbPostBySlug(slug);
  if (!post) throw new Error(`Post not found: ${slug}`);
  return post;
}

export async function getAllPosts() {
  return cachedGetAllPosts();
}

export async function getAllPostSlugs() {
  return cachedGetAllPostSlugs();
}

export async function getPostsByCategory(category: string) {
  return cachedGetPostsByCategory(category);
}

export async function getPinnedPosts(category?: string) {
  return cachedGetPinnedPosts(category);
}

export async function getFeaturedPosts(limit = 3) {
  return cachedGetFeaturedPosts(limit);
}

export async function getHeroPost() {
  return getHeroFeaturedPost();
}

// ---------------------------------------------------------------------------
// Write helpers
// ---------------------------------------------------------------------------

export { upsertPost, deletePost };
