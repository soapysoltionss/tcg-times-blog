import { NextRequest, NextResponse } from "next/server";
import { getUserByUsername } from "@/lib/db";

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("username") ?? "";
  if (!username) {
    return NextResponse.json({ taken: false });
  }
  const existing = getUserByUsername(username);
  return NextResponse.json({ available: !existing, taken: !!existing });
}
