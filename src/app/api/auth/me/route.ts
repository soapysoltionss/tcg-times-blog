import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUserById } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null });
  }

  const user = getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ user: null });
  }

  // Never send the password hash to the client
  const { passwordHash: _, ...safe } = user;
  return NextResponse.json({ user: safe });
}
