import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, saveUser, completeTask } from "@/lib/db";
import { signSession, setSessionCookie } from "@/lib/session";
import { sendVerificationEmail } from "@/lib/email";

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** POST /api/auth/verify-email — verify the 6-digit code */
export async function POST(req: NextRequest) {
  const { email, code } = await req.json();

  if (!email || !code) {
    return NextResponse.json({ error: "Email and code are required." }, { status: 400 });
  }

  const user = await getUserByEmail(email);
  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  if (user.emailVerified) {
    // Already verified — just sign them in
    const token = await signSession({ userId: user.id, username: user.username });
    const res = NextResponse.json({ ok: true });
    setSessionCookie(res, token);
    return res;
  }

  // Check code
  if (!user.verificationCode || user.verificationCode !== String(code).trim()) {
    return NextResponse.json({ error: "Incorrect code. Please try again." }, { status: 400 });
  }

  // Check expiry
  if (
    !user.verificationCodeExpiresAt ||
    new Date() > new Date(user.verificationCodeExpiresAt)
  ) {
    return NextResponse.json(
      { error: "This code has expired. Request a new one." },
      { status: 400 }
    );
  }

  // Mark verified, clear code, award XP
  user.emailVerified = true;
  user.verificationCode = undefined;
  user.verificationCodeExpiresAt = undefined;
  user.updatedAt = new Date().toISOString();
  await saveUser(user);

  // Award register XP task
  await completeTask(user.id, "register");

  // Issue session cookie
  const token = await signSession({ userId: user.id, username: user.username });
  const res = NextResponse.json({ ok: true });
  setSessionCookie(res, token);
  return res;
}

/** POST /api/auth/verify-email/resend — resend a fresh code */
export async function PUT(req: NextRequest) {
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const user = await getUserByEmail(email);
  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  if (user.emailVerified) {
    return NextResponse.json({ error: "Email already verified." }, { status: 400 });
  }

  const code = generateCode();
  user.verificationCode = code;
  user.verificationCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  user.updatedAt = new Date().toISOString();
  await saveUser(user);

  try {
    await sendVerificationEmail({ to: user.email, firstName: user.firstName, code });
  } catch (err) {
    console.error("Resend verification email failed:", err);
    return NextResponse.json({ error: "Failed to send email. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
