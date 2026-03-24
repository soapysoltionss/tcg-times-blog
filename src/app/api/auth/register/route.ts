import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { readDb, saveUser, getUserByUsername, TASK_CATALOGUE } from "@/lib/db";
import { signSession, setSessionCookie } from "@/lib/session";

export async function POST(req: NextRequest) {
  const { username, firstName, lastName, email, password, confirmPassword } =
    await req.json();

  // --- Validation ---
  if (!username || !firstName || !lastName || !password || !confirmPassword) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return NextResponse.json(
      { error: "Username must be 3–20 characters: letters, numbers, underscores only." },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  if (password !== confirmPassword) {
    return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
  }

  // --- Uniqueness check ---
  const existing = getUserByUsername(username);
  if (existing) {
    return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
  }

  // --- Create user ---
  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date().toISOString();

  const user = {
    id: uuidv4(),
    username: username.toLowerCase(),
    firstName,
    lastName,
    email: email ?? "",
    passwordHash,
    createdAt: now,
    updatedAt: now,
    xp: 50, // reward for registering
    tasks: [
      // Mark "register" task as complete immediately
      { id: "register", completedAt: now },
      // Seed all other known tasks as not-started
      ...TASK_CATALOGUE.filter((t) => t.id !== "register").map((t) => ({
        id: t.id,
        completedAt: null,
      })),
    ],
  };

  saveUser(user);

  // --- Sign session ---
  const token = await signSession({ userId: user.id, username: user.username });
  const res = NextResponse.json({ ok: true, username: user.username });
  setSessionCookie(res, token);
  return res;
}
