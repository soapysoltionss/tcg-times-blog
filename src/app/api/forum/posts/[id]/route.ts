import { NextRequest, NextResponse } from "next/server";
import { getForumPostById, deleteForumPost } from "@/lib/db-neon";
import { getSession } from "@/lib/session";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  const post = await getForumPostById(id, session?.userId);
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(post);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ok = await deleteForumPost(id, session.userId);
  if (!ok) return NextResponse.json({ error: "Not found or not your post" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
