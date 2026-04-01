/**
 * JSON-file database backend — LOCAL DEV ONLY.
 *
 * Used when DATABASE_URL is not set. All functions are async (returning
 * Promises) to match the db-neon.ts interface so callers are uniform.
 *
 * Local dev  → reads/writes from  <repo>/data/users.json
 */

import fs from "fs";
import path from "path";
import matter from "gray-matter";
import readingTime from "reading-time";
import type { User } from "@/lib/xp";
import { TASK_CATALOGUE, xpToLevel } from "@/lib/xp";
import type { PostComment, Listing, PostFrontmatter, Message, MessageThread, Dispute, DisputeStatus } from "@/types/post";
import type { DbPost, DbPostMeta } from "@/lib/db-neon";

export { TASK_CATALOGUE, xpToLevel };

type Db = { users: User[]; comments: PostComment[]; listings: Listing[] };

function dbPath(): string {
  return path.join(process.cwd(), "data", "users.json");
}

function readDb(): Db {
  try {
    return JSON.parse(fs.readFileSync(dbPath(), "utf-8")) as Db;
  } catch {
    return { users: [], comments: [], listings: [] };
  }
}

function writeDb(db: Db): void {
  fs.writeFileSync(dbPath(), JSON.stringify(db, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

export async function getUserById(id: string): Promise<User | undefined> {
  return readDb().users.find((u) => u.id === id);
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  return readDb().users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  return readDb().users.find((u) => u.username.toLowerCase() === username.toLowerCase());
}

export async function getUserByProvider(
  provider: string,
  providerAccountId: string
): Promise<User | undefined> {
  return readDb().users.find((u) =>
    u.oauthAccounts?.some(
      (a) => a.provider === provider && a.providerAccountId === providerAccountId
    )
  );
}

// ---------------------------------------------------------------------------
// Write helpers
// ---------------------------------------------------------------------------

export async function saveUser(user: User): Promise<void> {
  const db = readDb();
  const idx = db.users.findIndex((u) => u.id === user.id);
  if (idx >= 0) {
    db.users[idx] = user;
  } else {
    db.users.push(user);
  }
  writeDb(db);
}

// ---------------------------------------------------------------------------
// Upsert OAuth user
// ---------------------------------------------------------------------------

export async function upsertOAuthUser(opts: {
  provider: string;
  providerAccountId: string;
  email: string;
  name: string;
  image?: string;
}): Promise<User> {
  const { provider, providerAccountId, email, name, image } = opts;

  let user = await getUserByEmail(email);

  if (user) {
    if (image) user.avatarUrl = image;
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

  const { v4: uuidv4 } = await import("uuid");
  const now = new Date().toISOString();

  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 16)
    .replace(/^_|_$/g, "") || "user";

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
// XP / task completion
// ---------------------------------------------------------------------------

export async function completeTask(
  userId: string,
  taskId: string
): Promise<User | undefined> {
  const db = readDb();
  const user = db.users.find((u) => u.id === userId);
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

  const idx = db.users.findIndex((u) => u.id === userId);
  db.users[idx] = user;
  writeDb(db);
  return user;
}

// ---------------------------------------------------------------------------
// Comments (local dev — stored inside data/users.json under "comments" key)
// ---------------------------------------------------------------------------

export async function getComments(
  slug: string,
  currentUserId?: string
): Promise<PostComment[]> {
  const db = readDb();
  const all = db.comments ?? [];
  const user = currentUserId ? db.users.find((u) => u.id === currentUserId) : undefined;
  return all
    .filter(
      (c) =>
        c.slug === slug &&
        (c.approved || (currentUserId && c.authorId === currentUserId))
    )
    .map((c) => {
      // Hydrate username/avatar from the users array
      const author = db.users.find((u) => u.id === c.authorId);
      return {
        ...c,
        authorUsername: author?.username ?? c.authorUsername,
        authorAvatarUrl: author?.avatarUrl ?? c.authorAvatarUrl,
      };
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  void user; // suppress unused warning
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
  const db = readDb();
  const author = db.users.find((u) => u.id === comment.authorId);
  const newComment: PostComment = {
    id: comment.id,
    slug: comment.slug,
    authorId: comment.authorId,
    authorUsername: author?.username ?? "unknown",
    authorAvatarUrl: author?.avatarUrl,
    body: comment.body,
    createdAt: new Date().toISOString(),
    approved: comment.approved,
    approvedAt: comment.approvedAt ?? undefined,
  };
  db.comments = [...(db.comments ?? []), newComment];
  writeDb(db);
  return newComment;
}

export async function approveStaleComments(): Promise<number> {
  const db = readDb();
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  let count = 0;
  db.comments = (db.comments ?? []).map((c) => {
    if (!c.approved && c.createdAt <= twoHoursAgo) {
      count++;
      return { ...c, approved: true, approvedAt: new Date().toISOString() };
    }
    return c;
  });
  writeDb(db);
  return count;
}

// ---------------------------------------------------------------------------
// Marketplace listings (local dev — stored in users.json under "listings")
// ---------------------------------------------------------------------------

export async function getListings(opts?: {
  marketplace?: "store" | "community";
  game?: string;
  cardName?: string;
  sellerId?: string;
  includeSold?: boolean;
}): Promise<Listing[]> {
  const db = readDb();
  let list = db.listings ?? [];
  if (opts?.marketplace) list = list.filter((l) => l.marketplace === opts.marketplace);
  if (opts?.game) list = list.filter((l) => l.game === opts.game);
  if (opts?.cardName) list = list.filter((l) => l.cardName.toLowerCase().includes(opts.cardName!.toLowerCase()));
  if (opts?.sellerId) list = list.filter((l) => l.sellerId === opts.sellerId);
  if (!opts?.includeSold) list = list.filter((l) => !l.sold);
  return list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getListingById(id: string): Promise<Listing | undefined> {
  const db = readDb();
  return (db.listings ?? []).find((l) => l.id === id);
}

export async function createListing(listing: Omit<Listing, "sellerUsername" | "sellerAvatarUrl">): Promise<Listing> {
  const db = readDb();
  const user = db.users.find((u) => u.id === listing.sellerId);
  const full: Listing = {
    ...listing,
    sellerUsername: user?.username ?? "unknown",
    sellerAvatarUrl: user?.avatarUrl,
  };
  db.listings = [...(db.listings ?? []), full];
  writeDb(db);
  return full;
}

export async function deleteListing(id: string, sellerId: string): Promise<boolean> {
  const db = readDb();
  const before = (db.listings ?? []).length;
  db.listings = (db.listings ?? []).filter((l) => !(l.id === id && l.sellerId === sellerId));
  writeDb(db);
  return db.listings.length < before;
}

export async function markListingSold(id: string, sellerId: string): Promise<boolean> {
  const db = readDb();
  let found = false;
  db.listings = (db.listings ?? []).map((l) => {
    if (l.id === id && l.sellerId === sellerId) { found = true; return { ...l, sold: true }; }
    return l;
  });
  writeDb(db);
  return found;
}

// ---------------------------------------------------------------------------
// Blog posts — local dev reads from content/posts/*.mdx files
// ---------------------------------------------------------------------------

const postsDirectory = path.join(process.cwd(), "content/posts");

function readMdxPost(slug: string): DbPost | undefined {
  const mdxPath = path.join(postsDirectory, `${slug}.mdx`);
  const mdPath  = path.join(postsDirectory, `${slug}.md`);
  const fullPath = fs.existsSync(mdxPath) ? mdxPath : fs.existsSync(mdPath) ? mdPath : null;
  if (!fullPath) return undefined;

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

  return { ...fm, slug, content, freeContent, readingTime: rt.text, tags: fm.tags ?? [] };
}

export async function getDbPostBySlug(slug: string): Promise<DbPost | undefined> {
  return readMdxPost(slug);
}

export async function getAllDbPosts(): Promise<DbPostMeta[]> {
  if (!fs.existsSync(postsDirectory)) return [];
  return fs
    .readdirSync(postsDirectory)
    .filter((f) => f.endsWith(".mdx") || f.endsWith(".md"))
    .map((f) => {
      const slug = f.replace(/\.mdx?$/, "");
      const post = readMdxPost(slug);
      if (!post) return null;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { content, freeContent, ...meta } = post;
      return meta;
    })
    .filter((p): p is DbPostMeta => p !== null)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function getAllDbPostSlugs(): Promise<string[]> {
  if (!fs.existsSync(postsDirectory)) return [];
  return fs
    .readdirSync(postsDirectory)
    .filter((f) => f.endsWith(".mdx") || f.endsWith(".md"))
    .map((f) => f.replace(/\.mdx?$/, ""));
}

export async function getDbPostsByCategory(category: string): Promise<DbPostMeta[]> {
  const all = await getAllDbPosts();
  return all.filter((p) => p.category === category);
}

export async function getPinnedDbPosts(category?: string): Promise<DbPostMeta[]> {
  const all = await getAllDbPosts();
  return all.filter((p) => p.pinned && (!category || p.category === category));
}

export async function getFeaturedDbPosts(limit = 3): Promise<DbPostMeta[]> {
  const all = await getAllDbPosts();
  const featured = all.filter((p) => p.featured);
  return (featured.length > 0 ? featured : all).slice(0, limit);
}

export async function getHeroFeaturedPost(): Promise<DbPostMeta | undefined> {
  const all = await getAllDbPosts();
  return (
    all.find(p => p.heroFeatured) ??
    all.find(p => p.featured) ??
    all[0]
  );
}

export async function upsertPost(
  slug: string,
  frontmatter: PostFrontmatter,
  content: string
): Promise<void> {
  // In local dev, write back to an MDX file so the round-trip is visible
  const fm = Object.entries(frontmatter)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join("\n");
  const body = `---\n${fm}\n---\n\n${content}`;
  if (!fs.existsSync(postsDirectory)) fs.mkdirSync(postsDirectory, { recursive: true });
  fs.writeFileSync(path.join(postsDirectory, `${slug}.mdx`), body, "utf8");
}

export async function deletePost(slug: string): Promise<boolean> {
  const mdxPath = path.join(postsDirectory, `${slug}.mdx`);
  const mdPath  = path.join(postsDirectory, `${slug}.md`);
  if (fs.existsSync(mdxPath)) { fs.unlinkSync(mdxPath); return true; }
  if (fs.existsSync(mdPath))  { fs.unlinkSync(mdPath);  return true; }
  return false;
}

// ---------------------------------------------------------------------------
// Messaging — not supported in JSON local dev, always returns empty
// ---------------------------------------------------------------------------

export async function sendMessage(_msg: {
  id: string; listingId: string; fromUserId: string; toUserId: string; body: string;
}): Promise<Message> {
  throw new Error("Messaging requires Neon Postgres (DATABASE_URL).");
}
export async function getMessageThread(_listingId: string, _userId: string): Promise<Message[]> {
  return [];
}
export async function getInboxThreads(_userId: string): Promise<MessageThread[]> {
  return [];
}
export async function markThreadRead(_listingId: string, _userId: string): Promise<void> {
  // no-op in local dev
}
export async function getUnreadCount(_userId: string): Promise<number> {
  return 0;
}

// ---------------------------------------------------------------------------
// Disputes — not supported in JSON local dev
// ---------------------------------------------------------------------------

export async function openDispute(_d: {
  id: string; listingId: string; buyerId: string; sellerId: string; reason: string;
}): Promise<Dispute> {
  throw new Error("Disputes require Neon Postgres (DATABASE_URL).");
}
export async function getDisputesByListing(_listingId: string): Promise<Dispute[]> {
  return [];
}
export async function updateDisputeStatus(
  _id: string, _status: DisputeStatus, _resolution?: string
): Promise<Dispute | undefined> {
  return undefined;
}
