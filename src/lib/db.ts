/**
 * Database adapter — SERVER ONLY.
 *
 * When DATABASE_URL is set (Vercel prod) → Neon Postgres via db-neon.ts
 * When DATABASE_URL is not set (local dev) → JSON file (data/users.json)
 *
 * All functions are async regardless of backend so callers are uniform.
 */

import type { User } from "@/lib/xp";
import { TASK_CATALOGUE, xpToLevel } from "@/lib/xp";
import type { PostComment, Listing, PostFrontmatter, Message, MessageThread, Dispute, DisputeStatus } from "@/types/post";
import type { DbPost, DbPostMeta } from "@/lib/db-neon";

export type { User };
export { TASK_CATALOGUE, xpToLevel };

// ---------------------------------------------------------------------------
// Lazy-load the right backend
// ---------------------------------------------------------------------------

async function backend() {
  if (process.env.DATABASE_URL) {
    return import("@/lib/db-neon");
  }
  return import("@/lib/db-json");
}

// ---------------------------------------------------------------------------
// Public API — mirrors db-neon.ts signatures (all async)
// ---------------------------------------------------------------------------

export async function getUserById(id: string): Promise<User | undefined> {
  return (await backend()).getUserById(id);
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  return (await backend()).getUserByEmail(email);
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  return (await backend()).getUserByUsername(username);
}

export async function getUserByProvider(
  provider: string,
  providerAccountId: string
): Promise<User | undefined> {
  return (await backend()).getUserByProvider(provider, providerAccountId);
}

export async function saveUser(user: User): Promise<void> {
  return (await backend()).saveUser(user);
}

export async function upsertOAuthUser(opts: {
  provider: string;
  providerAccountId: string;
  email: string;
  name: string;
  image?: string;
}): Promise<User> {
  return (await backend()).upsertOAuthUser(opts);
}

export async function completeTask(
  userId: string,
  taskId: string
): Promise<User | undefined> {
  return (await backend()).completeTask(userId, taskId);
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export async function getComments(
  slug: string,
  currentUserId?: string
): Promise<PostComment[]> {
  return (await backend()).getComments(slug, currentUserId);
}

export async function addComment(comment: {
  id: string;
  slug: string;
  authorId: string;
  body: string;
  approved: boolean;
  approvedAt: string | null;
  articleType: string;
}): Promise<PostComment> {
  return (await backend()).addComment(comment);
}

export async function approveStaleComments(): Promise<number> {
  return (await backend()).approveStaleComments();
}

// ---------------------------------------------------------------------------
// Marketplace listings
// ---------------------------------------------------------------------------

export async function getListings(opts?: {
  marketplace?: "store" | "community";
  game?: string;
  cardName?: string;
  sellerId?: string;
  includeSold?: boolean;
}): Promise<Listing[]> {
  return (await backend()).getListings(opts);
}

export async function getListingById(id: string): Promise<Listing | undefined> {
  return (await backend()).getListingById(id);
}

export async function createListing(
  listing: Omit<Listing, "sellerUsername" | "sellerAvatarUrl">
): Promise<Listing> {
  return (await backend()).createListing(listing);
}

export async function deleteListing(id: string, sellerId: string): Promise<boolean> {
  return (await backend()).deleteListing(id, sellerId);
}

export async function markListingSold(id: string, sellerId: string): Promise<boolean> {
  return (await backend()).markListingSold(id, sellerId);
}

// ---------------------------------------------------------------------------
// Blog posts
// ---------------------------------------------------------------------------

export type { DbPost, DbPostMeta };

export async function getDbPostBySlug(slug: string): Promise<DbPost | undefined> {
  return (await backend()).getDbPostBySlug(slug);
}

export async function getAllDbPosts(): Promise<DbPostMeta[]> {
  return (await backend()).getAllDbPosts();
}

export async function getAllDbPostSlugs(): Promise<string[]> {
  return (await backend()).getAllDbPostSlugs();
}

export async function getDbPostsByCategory(category: string): Promise<DbPostMeta[]> {
  return (await backend()).getDbPostsByCategory(category);
}

export async function getPinnedDbPosts(category?: string): Promise<DbPostMeta[]> {
  return (await backend()).getPinnedDbPosts(category);
}

export async function getFeaturedDbPosts(limit = 3): Promise<DbPostMeta[]> {
  return (await backend()).getFeaturedDbPosts(limit);
}

export async function upsertPost(
  slug: string,
  frontmatter: PostFrontmatter,
  content: string
): Promise<void> {
  return (await backend()).upsertPost(slug, frontmatter, content);
}

export async function deletePost(slug: string): Promise<boolean> {
  return (await backend()).deletePost(slug);
}

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------

export async function sendMessage(msg: {
  id: string;
  listingId: string;
  fromUserId: string;
  toUserId: string;
  body: string;
}): Promise<Message> {
  return (await backend()).sendMessage(msg);
}

export async function getMessageThread(
  listingId: string,
  userId: string
): Promise<Message[]> {
  return (await backend()).getMessageThread(listingId, userId);
}

export async function getInboxThreads(userId: string): Promise<MessageThread[]> {
  return (await backend()).getInboxThreads(userId);
}

export async function markThreadRead(listingId: string, userId: string): Promise<void> {
  return (await backend()).markThreadRead(listingId, userId);
}

export async function getUnreadCount(userId: string): Promise<number> {
  return (await backend()).getUnreadCount(userId);
}

// ---------------------------------------------------------------------------
// Disputes
// ---------------------------------------------------------------------------

export async function openDispute(dispute: {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  reason: string;
}): Promise<Dispute> {
  return (await backend()).openDispute(dispute);
}

export async function getDisputesByListing(listingId: string): Promise<Dispute[]> {
  return (await backend()).getDisputesByListing(listingId);
}

export async function updateDisputeStatus(
  id: string,
  status: DisputeStatus,
  resolution?: string
): Promise<Dispute | undefined> {
  return (await backend()).updateDisputeStatus(id, status, resolution);
}
