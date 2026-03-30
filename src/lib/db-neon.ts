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
import type { PostComment, Listing, ListingType, PostFrontmatter, Message, MessageThread, Dispute, DisputeStatus } from "@/types/post";
import readingTime from "reading-time";

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
    INSERT INTO users (id, email, username, data, region)
    VALUES (
      ${user.id},
      ${user.email.toLowerCase()},
      ${user.username.toLowerCase()},
      ${JSON.stringify(user)},
      ${user.region ?? null}
    )
    ON CONFLICT (id) DO UPDATE SET
      email    = EXCLUDED.email,
      username = EXCLUDED.username,
      data     = EXCLUDED.data,
      region   = EXCLUDED.region
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

// ---------------------------------------------------------------------------
// Marketplace listings
// ---------------------------------------------------------------------------

function rowToListing(row: Record<string, unknown>): Listing {
  return {
    id:               row.id as string,
    sellerId:         row.seller_id as string,
    sellerUsername:   row.seller_username as string,
    sellerAvatarUrl:  row.seller_avatar_url as string | undefined,
    sellerIsTrusted:  (row.seller_is_trusted as boolean) ?? false,
    sellerIsVerified: (row.seller_is_verified as boolean) ?? false,
    sellerTotalSales: (row.seller_total_sales as number) ?? 0,
    marketplace:      row.marketplace as "store" | "community",
    listingType:      (row.listing_type as ListingType | undefined) ?? "card",
    cardName:         row.card_name as string,
    setName:          row.set_name as string,
    game:             row.game as string,
    condition:        row.condition as Listing["condition"],
    conditionNotes:   row.condition_notes as string | undefined,
    priceCents:       row.price_cents as number,
    quantity:         row.quantity as number,
    imageUrl:         row.image_url as string | undefined,
    description:      row.description as string | undefined,
    createdAt:        (row.created_at as Date).toISOString(),
    sold:             row.sold as boolean,
  };
}

export async function getListings(opts?: {
  marketplace?: "store" | "community";
  game?: string;
  cardName?: string;
  sellerId?: string;
  includeSold?: boolean;
  listingType?: ListingType;
}): Promise<Listing[]> {
  const db = sql();
  const marketplace = opts?.marketplace ?? null;
  const game = opts?.game ?? null;
  const cardName = opts?.cardName ?? null;
  const sellerId = opts?.sellerId ?? null;
  const includeSold = opts?.includeSold ?? false;
  const listingType = opts?.listingType ?? null;

  const rows = await db`
    SELECT
      l.id,
      l.seller_id,
      u.username  AS seller_username,
      (u.data->>'avatarUrl') AS seller_avatar_url,
      (
        SELECT count(*)::int FROM listings s
        WHERE s.seller_id = l.seller_id AND s.sold = true
      ) >= 10 AS seller_is_trusted,
      (u.data->>'verifiedSeller')::boolean AS seller_is_verified,
      (
        SELECT count(*)::int FROM listings s
        WHERE s.seller_id = l.seller_id AND s.sold = true
      ) AS seller_total_sales,
      l.marketplace,
      l.listing_type,
      l.card_name,
      l.set_name,
      l.game,
      l.condition,
      l.condition_notes,
      l.price_cents,
      l.quantity,
      l.image_url,
      l.description,
      l.created_at,
      l.sold
    FROM listings l
    JOIN users u ON u.id = l.seller_id
    WHERE (${marketplace}::text IS NULL OR l.marketplace = ${marketplace})
      AND (${game}::text IS NULL OR l.game = ${game})
      AND (${cardName}::text IS NULL OR lower(l.card_name) LIKE '%' || lower(${cardName}) || '%')
      AND (${sellerId}::text IS NULL OR l.seller_id = ${sellerId})
      AND (${listingType}::text IS NULL OR COALESCE(l.listing_type, 'card') = ${listingType})
      AND (${includeSold} OR l.sold = false)
    ORDER BY l.created_at DESC
  `;
  return rows.map((r) => rowToListing(r as Record<string, unknown>));
}

export async function getListingById(id: string): Promise<Listing | undefined> {
  const db = sql();
  const rows = await db`
    SELECT
      l.id,
      l.seller_id,
      u.username  AS seller_username,
      (u.data->>'avatarUrl') AS seller_avatar_url,
      (
        SELECT count(*)::int FROM listings s
        WHERE s.seller_id = l.seller_id AND s.sold = true
      ) >= 10 AS seller_is_trusted,
      (u.data->>'verifiedSeller')::boolean AS seller_is_verified,
      (
        SELECT count(*)::int FROM listings s
        WHERE s.seller_id = l.seller_id AND s.sold = true
      ) AS seller_total_sales,
      l.marketplace,
      l.listing_type,
      l.card_name,
      l.set_name,
      l.game,
      l.condition,
      l.condition_notes,
      l.price_cents,
      l.quantity,
      l.image_url,
      l.description,
      l.created_at,
      l.sold
    FROM listings l
    JOIN users u ON u.id = l.seller_id
    WHERE l.id = ${id}
    LIMIT 1
  `;
  return rows[0] ? rowToListing(rows[0] as Record<string, unknown>) : undefined;
}

export async function createListing(listing: Omit<Listing, "sellerUsername" | "sellerAvatarUrl">): Promise<Listing> {
  const db = sql();
  await db`
    INSERT INTO listings
      (id, seller_id, marketplace, listing_type, card_name, set_name, game, condition, condition_notes,
       price_cents, quantity, image_url, description, sold)
    VALUES (
      ${listing.id},
      ${listing.sellerId},
      ${listing.marketplace},
      ${listing.listingType ?? "card"},
      ${listing.cardName},
      ${listing.setName},
      ${listing.game},
      ${listing.condition},
      ${listing.conditionNotes ?? null},
      ${listing.priceCents},
      ${listing.quantity},
      ${listing.imageUrl ?? null},
      ${listing.description ?? null},
      ${listing.sold}
    )
  `;
  const created = await getListingById(listing.id);
  return created!;
}

export async function deleteListing(id: string, sellerId: string): Promise<boolean> {
  const db = sql();
  const result = await db`
    DELETE FROM listings WHERE id = ${id} AND seller_id = ${sellerId}
  `;
  return result.length > 0;
}

export async function markListingSold(id: string, sellerId: string): Promise<boolean> {
  const db = sql();
  const result = await db`
    UPDATE listings SET sold = true WHERE id = ${id} AND seller_id = ${sellerId}
  `;
  const didUpdate = result.length > 0;

  // Award XP for each completed sale (repeatable — 75 XP per sale)
  if (didUpdate) {
    const task = TASK_CATALOGUE.find((t) => t.id === "sale_completed");
    if (task) {
      const user = await getUserById(sellerId);
      if (user) {
        user.xp += task.xpReward;
        user.updatedAt = new Date().toISOString();
        // Record the task completion (push a new entry each time so history is preserved)
        user.tasks.push({ id: "sale_completed", completedAt: new Date().toISOString() });
        await saveUser(user);
      }
    }
  }

  return didUpdate;
}

// ---------------------------------------------------------------------------
// Blog posts
// ---------------------------------------------------------------------------

export type DbPost = PostFrontmatter & {
  slug: string;
  content: string;
  freeContent?: string;
  readingTime: string;
};

export type DbPostMeta = Omit<DbPost, "content" | "freeContent">;

function rowToPost(row: Record<string, unknown>): DbPost {
  const fm = row.frontmatter as PostFrontmatter;
  const content = row.content as string;
  const rt = readingTime(content);

  const PAYWALL_MARKER = "PAYWALL_BREAK";
  const markerIndex = content.indexOf(PAYWALL_MARKER);
  const freeContent =
    fm.paywalled && markerIndex !== -1
      ? content.slice(0, markerIndex).trim()
      : undefined;

  return {
    ...fm,
    slug: row.slug as string,
    content,
    freeContent,
    readingTime: rt.text,
    tags: fm.tags ?? [],
  };
}

export async function getDbPostBySlug(slug: string): Promise<DbPost | undefined> {
  const db = sql();
  const rows = await db`
    SELECT slug, frontmatter, content FROM posts WHERE slug = ${slug} LIMIT 1
  `;
  return rows[0] ? rowToPost(rows[0] as Record<string, unknown>) : undefined;
}

export async function getAllDbPosts(): Promise<DbPostMeta[]> {
  const db = sql();
  const rows = await db`
    SELECT slug, frontmatter
    FROM posts
    ORDER BY frontmatter->>'date' DESC
  `;
  return rows.map((r) => {
    const fm = r.frontmatter as Record<string, unknown>;
    return {
      slug: r.slug as string,
      title: (fm.title as string) ?? "",
      date: (fm.date as string) ?? "",
      category: (fm.category as string) ?? "",
      excerpt: (fm.excerpt as string) ?? "",
      coverImage: (fm.coverImage as string) ?? undefined,
      featured: fm.featured === true || fm.featured === "true",
      pinned: fm.pinned === true || fm.pinned === "true",
      paywalled: fm.paywalled === true || fm.paywalled === "true",
      tags: Array.isArray(fm.tags) ? (fm.tags as string[]) : [],
      readingTime: "",
    } as DbPostMeta;
  });
}

export async function getAllDbPostSlugs(): Promise<string[]> {
  const db = sql();
  const rows = await db`SELECT slug FROM posts ORDER BY frontmatter->>'date' DESC`;
  return rows.map((r) => r.slug as string);
}

export async function getDbPostsByCategory(category: string): Promise<DbPostMeta[]> {
  const db = sql();
  const rows = await db`
    SELECT slug, frontmatter
    FROM posts
    WHERE frontmatter->>'category' = ${category}
    ORDER BY frontmatter->>'date' DESC
  `;
  return rows.map((r) => {
    const fm = r.frontmatter as Record<string, unknown>;
    return {
      slug: r.slug as string,
      title: (fm.title as string) ?? "",
      date: (fm.date as string) ?? "",
      category: (fm.category as string) ?? "",
      excerpt: (fm.excerpt as string) ?? "",
      coverImage: (fm.coverImage as string) ?? undefined,
      featured: fm.featured === true || fm.featured === "true",
      pinned: fm.pinned === true || fm.pinned === "true",
      paywalled: fm.paywalled === true || fm.paywalled === "true",
      tags: Array.isArray(fm.tags) ? (fm.tags as string[]) : [],
      readingTime: "",
    } as DbPostMeta;
  });
}

export async function getPinnedDbPosts(category?: string): Promise<DbPostMeta[]> {
  const db = sql();
  const rows = category
    ? await db`
        SELECT slug, frontmatter
        FROM posts
        WHERE frontmatter->>'pinned' = 'true'
          AND frontmatter->>'category' = ${category}
        ORDER BY frontmatter->>'date' DESC
      `
    : await db`
        SELECT slug, frontmatter
        FROM posts
        WHERE frontmatter->>'pinned' = 'true'
        ORDER BY frontmatter->>'date' DESC
      `;
  return rows.map((r) => {
    const fm = r.frontmatter as Record<string, unknown>;
    return {
      slug: r.slug as string,
      title: (fm.title as string) ?? "",
      date: (fm.date as string) ?? "",
      category: (fm.category as string) ?? "",
      excerpt: (fm.excerpt as string) ?? "",
      coverImage: (fm.coverImage as string) ?? undefined,
      featured: fm.featured === true || fm.featured === "true",
      pinned: true,
      paywalled: fm.paywalled === true || fm.paywalled === "true",
      tags: Array.isArray(fm.tags) ? (fm.tags as string[]) : [],
      author: (fm.author as string) ?? "",
      readingTime: "",
    } as DbPostMeta;
  });
}

export async function getFeaturedDbPosts(limit = 3): Promise<DbPostMeta[]> {
  const db = sql();
  const rows = await db`
    SELECT slug, frontmatter, content
    FROM posts
    WHERE frontmatter->>'featured' = 'true'
    ORDER BY frontmatter->>'date' DESC
    LIMIT ${limit}
  `;
  if (rows.length === 0) {
    // Fall back to most recent posts
    const fallback = await db`
      SELECT slug, frontmatter, content
      FROM posts
      ORDER BY frontmatter->>'date' DESC
      LIMIT ${limit}
    `;
    return fallback.map((r) => {
      const post = rowToPost(r as Record<string, unknown>);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { content, freeContent, ...meta } = post;
      return meta;
    });
  }
  return rows.map((r) => {
    const post = rowToPost(r as Record<string, unknown>);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { content, freeContent, ...meta } = post;
    return meta;
  });
}

/** Insert or replace a post. Frontmatter is passed as a plain object. */
export async function upsertPost(
  slug: string,
  frontmatter: PostFrontmatter,
  content: string
): Promise<void> {
  const db = sql();
  const fm = JSON.stringify(frontmatter);
  await db`
    INSERT INTO posts (slug, frontmatter, content, updated_at)
    VALUES (${slug}, ${fm}::jsonb, ${content}, now())
    ON CONFLICT (slug) DO UPDATE
      SET frontmatter = EXCLUDED.frontmatter,
          content     = EXCLUDED.content,
          updated_at  = now()
  `;
}

export async function deletePost(slug: string): Promise<boolean> {
  const db = sql();
  const result = await db`DELETE FROM posts WHERE slug = ${slug}`;
  return result.length > 0;
}

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------

function rowToMessage(row: Record<string, unknown>): Message {
  return {
    id:            row.id as string,
    listingId:     row.listing_id as string,
    fromUserId:    row.from_user_id as string,
    fromUsername:  row.from_username as string,
    fromAvatarUrl: row.from_avatar_url as string | undefined,
    toUserId:      row.to_user_id as string,
    toUsername:    row.to_username as string,
    body:          row.body as string,
    createdAt:     (row.created_at as Date).toISOString(),
    readAt:        row.read_at ? (row.read_at as Date).toISOString() : null,
  };
}

/** Send a new message in a listing thread */
export async function sendMessage(msg: {
  id: string;
  listingId: string;
  fromUserId: string;
  toUserId: string;
  body: string;
}): Promise<Message> {
  const db = sql();
  const rows = await db`
    INSERT INTO messages (id, listing_id, from_user_id, to_user_id, body)
    VALUES (${msg.id}, ${msg.listingId}, ${msg.fromUserId}, ${msg.toUserId}, ${msg.body})
    RETURNING
      messages.*,
      (SELECT username    FROM users WHERE id = ${msg.fromUserId}) AS from_username,
      (SELECT data->>'avatarUrl' FROM users WHERE id = ${msg.fromUserId}) AS from_avatar_url,
      (SELECT username    FROM users WHERE id = ${msg.toUserId})   AS to_username
  `;
  return rowToMessage(rows[0] as Record<string, unknown>);
}

/** Fetch all messages in a listing thread that involve the given user */
export async function getMessageThread(
  listingId: string,
  userId: string
): Promise<Message[]> {
  const db = sql();
  const rows = await db`
    SELECT
      m.*,
      fu.username    AS from_username,
      (fu.data->>'avatarUrl') AS from_avatar_url,
      tu.username    AS to_username
    FROM messages m
    JOIN users fu ON fu.id = m.from_user_id
    JOIN users tu ON tu.id = m.to_user_id
    WHERE m.listing_id = ${listingId}
      AND (m.from_user_id = ${userId} OR m.to_user_id = ${userId})
    ORDER BY m.created_at ASC
  `;
  return rows.map((r) => rowToMessage(r as Record<string, unknown>));
}

/** Get all threads for a user's inbox, one row per (listing, other_user) pair */
export async function getInboxThreads(userId: string): Promise<MessageThread[]> {
  const db = sql();
  const rows = await db`
    SELECT DISTINCT ON (m.listing_id, other_id)
      m.listing_id,
      l.card_name,
      l.image_url,
      CASE WHEN m.from_user_id = ${userId} THEN m.to_user_id ELSE m.from_user_id END AS other_id,
      CASE WHEN m.from_user_id = ${userId} THEN tu.username   ELSE fu.username        END AS other_username,
      CASE WHEN m.from_user_id = ${userId}
           THEN (tu.data->>'avatarUrl')
           ELSE (fu.data->>'avatarUrl')
      END AS other_avatar_url,
      last_msg.body        AS last_message,
      last_msg.created_at  AS last_message_at,
      (
        SELECT count(*)::int
        FROM messages unread
        WHERE unread.listing_id = m.listing_id
          AND unread.to_user_id = ${userId}
          AND unread.read_at IS NULL
      ) AS unread_count
    FROM messages m
    JOIN users fu ON fu.id = m.from_user_id
    JOIN users tu ON tu.id = m.to_user_id
    JOIN listings l ON l.id = m.listing_id
    JOIN LATERAL (
      SELECT body, created_at
      FROM messages lm
      WHERE lm.listing_id = m.listing_id
        AND (lm.from_user_id = ${userId} OR lm.to_user_id = ${userId})
      ORDER BY lm.created_at DESC
      LIMIT 1
    ) last_msg ON true
    WHERE (m.from_user_id = ${userId} OR m.to_user_id = ${userId})
    ORDER BY m.listing_id, other_id, last_msg.created_at DESC
  `;
  return rows.map((r) => ({
    listingId:      r.listing_id as string,
    cardName:       r.card_name as string,
    imageUrl:       r.image_url as string | undefined,
    otherUserId:    r.other_id as string,
    otherUsername:  r.other_username as string,
    otherAvatarUrl: r.other_avatar_url as string | undefined,
    lastMessage:    r.last_message as string,
    lastMessageAt:  (r.last_message_at as Date).toISOString(),
    unreadCount:    r.unread_count as number,
  }));
}

/** Mark all unread messages to `userId` in a listing thread as read */
export async function markThreadRead(listingId: string, userId: string): Promise<void> {
  const db = sql();
  await db`
    UPDATE messages
    SET read_at = now()
    WHERE listing_id = ${listingId}
      AND to_user_id  = ${userId}
      AND read_at IS NULL
  `;
}

/** Total unread message count for a user — used for inbox badge */
export async function getUnreadCount(userId: string): Promise<number> {
  const db = sql();
  const rows = await db`
    SELECT count(*)::int AS n
    FROM messages
    WHERE to_user_id = ${userId} AND read_at IS NULL
  `;
  return (rows[0]?.n as number) ?? 0;
}

// ---------------------------------------------------------------------------
// Disputes
// ---------------------------------------------------------------------------

function rowToDispute(row: Record<string, unknown>): Dispute {
  return {
    id:             row.id as string,
    listingId:      row.listing_id as string,
    buyerId:        row.buyer_id as string,
    buyerUsername:  row.buyer_username as string,
    sellerId:       row.seller_id as string,
    sellerUsername: row.seller_username as string,
    reason:         row.reason as string,
    status:         row.status as DisputeStatus,
    resolution:     row.resolution as string | null,
    createdAt:      (row.created_at as Date).toISOString(),
    updatedAt:      (row.updated_at as Date).toISOString(),
  };
}

export async function openDispute(dispute: {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  reason: string;
}): Promise<Dispute> {
  const db = sql();
  const rows = await db`
    INSERT INTO disputes (id, listing_id, buyer_id, seller_id, reason)
    VALUES (${dispute.id}, ${dispute.listingId}, ${dispute.buyerId}, ${dispute.sellerId}, ${dispute.reason})
    RETURNING
      disputes.*,
      (SELECT username FROM users WHERE id = ${dispute.buyerId})  AS buyer_username,
      (SELECT username FROM users WHERE id = ${dispute.sellerId}) AS seller_username
  `;
  return rowToDispute(rows[0] as Record<string, unknown>);
}

export async function getDisputesByListing(listingId: string): Promise<Dispute[]> {
  const db = sql();
  const rows = await db`
    SELECT
      d.*,
      bu.username AS buyer_username,
      su.username AS seller_username
    FROM disputes d
    JOIN users bu ON bu.id = d.buyer_id
    JOIN users su ON su.id = d.seller_id
    WHERE d.listing_id = ${listingId}
    ORDER BY d.created_at DESC
  `;
  return rows.map((r) => rowToDispute(r as Record<string, unknown>));
}

export async function updateDisputeStatus(
  id: string,
  status: DisputeStatus,
  resolution?: string
): Promise<Dispute | undefined> {
  const db = sql();
  const rows = await db`
    UPDATE disputes
    SET status = ${status},
        resolution = ${resolution ?? null},
        updated_at = now()
    WHERE id = ${id}
    RETURNING
      disputes.*,
      (SELECT username FROM users WHERE id = disputes.buyer_id)  AS buyer_username,
      (SELECT username FROM users WHERE id = disputes.seller_id) AS seller_username
  `;
  return rows[0] ? rowToDispute(rows[0] as Record<string, unknown>) : undefined;
}
