import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUserByUsername, saveUser } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { username, newPassword, confirmPassword } = await req.json();

  if (!username || !newPassword || !confirmPassword) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const user = await getUserByUsername(username);
  if (!user) {
    // Return the same message to avoid username enumeration
    return NextResponse.json({ ok: true });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.updatedAt = new Date().toISOString();
  await saveUser(user);

  return NextResponse.json({ ok: true });
}
