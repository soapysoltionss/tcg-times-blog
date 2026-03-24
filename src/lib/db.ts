/**
 * Lightweight JSON-file database — SERVER ONLY.
 *
 * Do not import this in client components. Import types/constants from @/lib/xp instead.
 *
 * Local dev  → reads/writes from  <repo>/data/users.json
 * Vercel     → reads from the bundled file (cold-start seed),
 *              writes to /tmp/users.json (ephemeral per instance).
 */

import fs from "fs";
import path from "path";
import type { User, UserTask, OAuthAccount } from "@/lib/xp";
import { TASK_CATALOGUE, xpToLevel } from "@/lib/xp";

export type { User, UserTask, OAuthAccount };
export { TASK_CATALOGUE, xpToLevel };

type Db = { users: User[] };

function dbPath(): string {
  // On Vercel the filesystem is read-only except /tmp
  if (process.env.VERCEL) {
    const tmp = "/tmp/users.json";
    if (!fs.existsSync(tmp)) {
      // Seed from the bundled file on first cold-start
      const seed = path.join(process.cwd(), "data", "users.json");
      fs.copyFileSync(seed, tmp);
    }
    return tmp;
  }
  return path.join(process.cwd(), "data", "users.json");
}

// ---------------------------------------------------------------------------
// Read / write
// ---------------------------------------------------------------------------

export function readDb(): Db {
  try {
    return JSON.parse(fs.readFileSync(dbPath(), "utf-8")) as Db;
  } catch {
    return { users: [] };
  }
}

export function writeDb(db: Db): void {
  fs.writeFileSync(dbPath(), JSON.stringify(db, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// User helpers
// ---------------------------------------------------------------------------

export function getUserByUsername(username: string): User | undefined {
  const db = readDb();
  return db.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
}

export function getUserById(id: string): User | undefined {
  const db = readDb();
  return db.users.find((u) => u.id === id);
}

export function getUserByEmail(email: string): User | undefined {
  const db = readDb();
  return db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

/** Find a user who has a linked OAuth account for the given provider + account ID. */
export function getUserByProvider(provider: string, providerAccountId: string): User | undefined {
  const db = readDb();
  return db.users.find((u) =>
    u.oauthAccounts?.some(
      (a) => a.provider === provider && a.providerAccountId === providerAccountId
    )
  );
}

/**
 * Find-or-create a user from an OAuth sign-in.
 * - If the providerAccountId is already linked → return that user.
 * - If the email matches an existing user → link the new provider account.
 * - Otherwise → create a brand new user with a generated username.
 */
export function upsertOAuthUser(opts: {
  provider: string;
  providerAccountId: string;
  email: string;
  name: string;
  image?: string;
}): User {
  const { provider, providerAccountId, email, name, image } = opts;

  // 1. Already linked to this OAuth account
  let user = getUserByProvider(provider, providerAccountId);
  if (user) {
    // Refresh avatar
    user.avatarUrl = image ?? user.avatarUrl;
    user.updatedAt = new Date().toISOString();
    saveUser(user);
    return user;
  }

  // 2. Email matches an existing account → link provider
  user = getUserByEmail(email);
  if (user) {
    user.oauthAccounts = user.oauthAccounts ?? [];
    user.oauthAccounts.push({ provider, providerAccountId, email, name, image });
    user.avatarUrl = user.avatarUrl ?? image;
    user.updatedAt = new Date().toISOString();
    saveUser(user);
    return user;
  }

  // 3. Brand new user
  const { v4: uuidv4 } = require("uuid") as { v4: () => string };
  const now = new Date().toISOString();

  // Generate a unique username from the display name
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 16);
  let username = base;
  let suffix = 1;
  const db = readDb();
  while (db.users.some((u) => u.username === username)) {
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
    passwordHash: "", // OAuth-only user has no password
    createdAt: now,
    updatedAt: now,
    xp: 50,
    avatarUrl: image,
    emailVerified: true, // OAuth email is pre-verified by the provider
    needsUsername: true, // Prompt the user to choose a proper username
    oauthAccounts: [{ provider, providerAccountId, email, name, image }],
    tasks: [
      { id: "register", completedAt: now },
      ...TASK_CATALOGUE.filter((t) => t.id !== "register").map((t) => ({
        id: t.id,
        completedAt: null,
      })),
    ],
  };

  saveUser(newUser);
  return newUser;
}

export function saveUser(user: User): void {
  const db = readDb();
  const idx = db.users.findIndex((u) => u.id === user.id);
  if (idx >= 0) {
    db.users[idx] = user;
  } else {
    db.users.push(user);
  }
  writeDb(db);
}

/** Award XP and mark a task complete. Returns updated user (or undefined if not found). */
export function completeTask(userId: string, taskId: string): User | undefined {
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
