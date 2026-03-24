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
import type { PostComment } from "@/types/post";

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
