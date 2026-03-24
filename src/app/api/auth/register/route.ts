import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { saveUser, getUserByUsername, getUserByEmail, TASK_CATALOGUE } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email";

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req: NextRequest) {
  const { username, firstName, lastName, email, password, confirmPassword } =
    await req.json();

  // --- Validation ---
  if (!username || !firstName || !lastName || !email || !password || !confirmPassword) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return NextResponse.json(
      { error: "Username must be 3–20 characters: letters, numbers, underscores only." },
      { status: 400 }
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  if (password !== confirmPassword) {
    return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
  }

  // --- Uniqueness checks ---
  const existingUsername = await getUserByUsername(username);
  if (existingUsername) {
    return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
  }
  const existingEmail = await getUserByEmail(email);
  if (existingEmail) {
    return NextResponse.json(
      { error: "An account with that email already exists." },
      { status: 409 }
    );
  }

  // --- Create user (unverified) ---
  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date().toISOString();
  const code = generateCode();
  const codeExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

  const user = {
    id: uuidv4(),
    username: username.toLowerCase(),
    firstName,
    lastName,
    email: email.toLowerCase(),
    passwordHash,
    createdAt: now,
    updatedAt: now,
    xp: 0, // XP awarded after email verification
    emailVerified: false,
    verificationCode: code,
    verificationCodeExpiresAt: codeExpiry,
    tasks: TASK_CATALOGUE.map((t) => ({ id: t.id, completedAt: null })),
  };

  await saveUser(user);

  // --- Send verification email ---
  try {
    await sendVerificationEmail({ to: user.email, firstName: user.firstName, code });
  } catch (err) {
    console.error("Failed to send verification email:", err);
    // Don't block registration — user can request a resend
  }

  return NextResponse.json({ ok: true, username: user.username, email: user.email });
}

