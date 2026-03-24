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
import type { User, UserTask } from "@/lib/xp";
import { TASK_CATALOGUE, xpToLevel } from "@/lib/xp";

export type { User, UserTask };
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
