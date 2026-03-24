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
import type { User } from "@/lib/xp";
import { TASK_CATALOGUE, xpToLevel } from "@/lib/xp";

export { TASK_CATALOGUE, xpToLevel };

type Db = { users: User[] };

function dbPath(): string {
  return path.join(process.cwd(), "data", "users.json");
}

function readDb(): Db {
  try {
    return JSON.parse(fs.readFileSync(dbPath(), "utf-8")) as Db;
  } catch {
    return { users: [] };
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
