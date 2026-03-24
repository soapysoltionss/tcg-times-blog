import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUserByUsername } from "@/lib/db";
import { signSession, setSessionCookie } from "@/lib/session";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
  }

  const user = await getUserByUsername(username);
  if (!user) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const isSubscriber =
    user.subscription?.status === "active" ||
    user.subscription?.status === "declined";

  const token = await signSession({ userId: user.id, username: user.username, isSubscriber });
  const res = NextResponse.json({ ok: true, username: user.username });
  setSessionCookie(res, token);
  return res;
}
