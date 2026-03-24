/**
 * Neon Postgres database backend — SERVER ONLY.
 *
 * Stores the entire User object as a JSONB column so the schema
 * stays in sync automatically with the User type — no migrations
 * needed when you add fields.
 *
 * Schema (run schema.sql on your Neon project once):
 *
 *   CREATE TABLE IF NOT EXISTS users (
 *     id TEXT PRIMARY KEY,
 *     email TEXT UNIQUE NOT NULL,
 *     username TEXT UNIQUE NOT NULL,
 *     data JSONB NOT NULL
 *   );
 *
 * All queries go through the Neon serverless HTTP driver which works
 * in Vercel Edge / serverless functions without a persistent connection.
 */

import { neon } from "@neondatabase/serverless";
import type { User } from "@/lib/xp";
import { TASK_CATALOGUE, xpToLevel } from "@/lib/xp";
import type { PostComment } from "@/types/post";

export type { User };
export { TASK_CATALOGUE, xpToLevel };

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

function rowToUser(row: Record<string, unknown>): User {
  return row.data as User;
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

export async function getUserById(id: string): Promise<User | undefined> {
  const db = sql();
  const rows = await db`SELECT data FROM users WHERE id = ${id} LIMIT 1`;
  return rows[0] ? rowToUser(rows[0]) : undefined;
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const db = sql();
  const rows = await db`SELECT data FROM users WHERE email = ${email.toLowerCase()} LIMIT 1`;
  return rows[0] ? rowToUser(rows[0]) : undefined;
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  const db = sql();
  // Case-insensitive match using lower()
  const rows = await db`SELECT data FROM users WHERE lower(username) = ${username.toLowerCase()} LIMIT 1`;
  return rows[0] ? rowToUser(rows[0]) : undefined;
}

export async function getUserByProvider(
  provider: string,
  providerAccountId: string
): Promise<User | undefined> {
  const db = sql();
  // Search inside the JSONB oauthAccounts array
  const rows = await db`
    SELECT data FROM users
    WHERE EXISTS (
      SELECT 1 FROM jsonb_array_elements(data->'oauthAccounts') AS acct
      WHERE acct->>'provider' = ${provider}
        AND acct->>'providerAccountId' = ${providerAccountId}
    )
    LIMIT 1
  `;
  return rows[0] ? rowToUser(rows[0]) : undefined;
}

// ---------------------------------------------------------------------------
// Write helpers
// ---------------------------------------------------------------------------

export async function saveUser(user: User): Promise<void> {
  const db = sql();
  await db`
    INSERT INTO users (id, email, username, data)
    VALUES (
      ${user.id},
      ${user.email.toLowerCase()},
      ${user.username.toLowerCase()},
      ${JSON.stringify(user)}
    )
    ON CONFLICT (id) DO UPDATE SET
      email    = EXCLUDED.email,
      username = EXCLUDED.username,
      data     = EXCLUDED.data
  `;
}

// ---------------------------------------------------------------------------
// Upsert OAuth user (find-or-create by email)
// ---------------------------------------------------------------------------

export async function upsertOAuthUser(opts: {
  provider: string;
  providerAccountId: string;
  email: string;
  name: string;
  image?: string;
}): Promise<User> {
  const { provider, providerAccountId, email, name, image } = opts;

  // Primary lookup: email
  let user = await getUserByEmail(email);

  if (user) {
    // Refresh avatar
    if (image) user.avatarUrl = image;
    // Link provider if not already linked
    user.oauthAccounts = user.oauthAccounts ?? [];
    const alreadyLinked = user.oauthAccounts.some(
      (a) => a.provider === provider && a.providerAccountId === providerAccountId
    );
    if (!alreadyLinked) {
      user.oauthAccounts.push({ provider, providerAccountId, email, name, image });
    }
    user.updatedAt = new Date().toISOString();
    await saveUser(user);
    return user;
  }

  // Brand new user
  const { v4: uuidv4 } = await import("uuid");
  const now = new Date().toISOString();

  // Generate a unique username from display name
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 16)
    .replace(/^_|_$/g, "") || "user";

  // Find a unique username by checking DB
  let username = base;
  let suffix = 1;
  while (await getUserByUsername(username)) {
    username = `${base}${suffix++}`;
  }

  const [firstName = name, ...rest] = name.split(" ");
  const lastName = rest.join(" ") || "";

  const newUser: User = {
    id: uuidv4(),
    username,
    firstName,
    lastName,
    email,
    passwordHash: "",
    createdAt: now,
    updatedAt: now,
    xp: 50,
    avatarUrl: image,
    emailVerified: true,
    needsUsername: true,
    oauthAccounts: [{ provider, providerAccountId, email, name, image }],
    tasks: [
      { id: "register", completedAt: now },
      ...TASK_CATALOGUE.filter((t) => t.id !== "register").map((t) => ({
        id: t.id,
        completedAt: null,
      })),
    ],
  };

  await saveUser(newUser);
  return newUser;
}

// ---------------------------------------------------------------------------
// Register a new user (email + password)
// ---------------------------------------------------------------------------

export async function createUser(user: User): Promise<void> {
  await saveUser(user);
}

// ---------------------------------------------------------------------------
// XP / task completion
// ---------------------------------------------------------------------------

export async function completeTask(
  userId: string,
  taskId: string
): Promise<User | undefined> {
  const user = await getUserById(userId);
  if (!user) return undefined;

  const alreadyDone = user.tasks.find((t) => t.id === taskId && t.completedAt);
  if (alreadyDone) return user;

  const task = TASK_CATALOGUE.find((t) => t.id === taskId);
  if (!task) return user;

  const existing = user.tasks.find((t) => t.id === taskId);
  if (existing) {
    existing.completedAt = new Date().toISOString();
  } else {
    user.tasks.push({ id: taskId, completedAt: new Date().toISOString() });
  }

  user.xp += task.xpReward;
  user.updatedAt = new Date().toISOString();

  await saveUser(user);
  return user;
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

function rowToComment(row: Record<string, unknown>): PostComment {
  return {
    id:              row.id as string,
    slug:            row.slug as string,
    authorId:        row.author_id as string,
    authorUsername:  row.author_username as string,
    authorAvatarUrl: row.author_avatar_url as string | undefined,
    body:            row.body as string,
    createdAt:       (row.created_at as Date).toISOString(),
    approved:        row.approved as boolean,
    approvedAt:      row.approved_at ? (row.approved_at as Date).toISOString() : undefined,
  };
}

/**
 * Return all approved comments for a slug, plus any pending comments
 * belonging to `currentUserId` (so the author can see their own pending comment).
 */
export async function getComments(
  slug: string,
  currentUserId?: string
): Promise<PostComment[]> {
  const db = sql();
  const rows = await db`
    SELECT
      c.id,
      c.slug,
      c.author_id,
      u.username  AS author_username,
      (u.data->>'avatarUrl') AS author_avatar_url,
      c.body,
      c.created_at,
      c.approved,
      c.approved_at
    FROM comments c
    JOIN users u ON u.id = c.author_id
    WHERE c.slug = ${slug}
      AND (
        c.approved = true
        OR (${currentUserId ?? ""} <> '' AND c.author_id = ${currentUserId ?? ""})
      )
    ORDER BY c.created_at ASC
  `;
  return rows.map(rowToComment);
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
  const db = sql();
  const rows = await db`
    INSERT INTO comments (id, slug, author_id, body, approved, approved_at, article_type)
    VALUES (
      ${comment.id},
      ${comment.slug},
      ${comment.authorId},
      ${comment.body},
      ${comment.approved},
      ${comment.approvedAt ?? null},
      ${comment.articleType}
    )
    RETURNING
      comments.*,
      (SELECT username  FROM users WHERE id = ${comment.authorId}) AS author_username,
      (SELECT data->>'avatarUrl' FROM users WHERE id = ${comment.authorId}) AS author_avatar_url
  `;
  return rowToComment(rows[0] as Record<string, unknown>);
}

/** Approve all professional comments that were created more than 2 hours ago. */
export async function approveStaleComments(): Promise<number> {
  const db = sql();
  const result = await db`
    UPDATE comments
    SET approved = true, approved_at = now()
    WHERE approved = false
      AND article_type = 'professional'
      AND created_at <= now() - INTERVAL '2 hours'
  `;
  return result.length;
}
