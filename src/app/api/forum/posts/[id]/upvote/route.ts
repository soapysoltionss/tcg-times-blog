import { NextRequest, NextResponse } from "next/server";
import { toggleForumUpvote } from "@/lib/db-neon";
import { getSession } from "@/lib/session";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { targetType } = (await req.json().catch(() => ({}))) as { targetType?: string };
  const type = targetType === "comment" ? "comment" : "post";

  const result = await toggleForumUpvote(session.userId, id, type);
  return NextResponse.json(result);
}
