import { NextRequest, NextResponse } from "next/server";
import { getForumComments, createForumComment } from "@/lib/db-neon";
import { getSession } from "@/lib/session";
import { nanoid } from "nanoid";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  const comments = await getForumComments(id, session?.userId);
  return NextResponse.json(comments);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { body, parentCommentId } = await req.json() as {
    body?: string;
    parentCommentId?: string;
  };

  if (!body?.trim()) return NextResponse.json({ error: "Body is required" }, { status: 400 });
  if (body.length > 10000) return NextResponse.json({ error: "Comment too long" }, { status: 400 });

  const comment = await createForumComment({
    id:              nanoid(),
    postId:          id,
    authorId:        session.userId,
    body:            body.trim(),
    parentCommentId: parentCommentId || undefined,
  });

  return NextResponse.json(comment, { status: 201 });
}
