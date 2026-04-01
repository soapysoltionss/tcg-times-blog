import { NextRequest, NextResponse } from "next/server";
import { getForumPosts, createForumPost } from "@/lib/db-neon";
import { getSession } from "@/lib/session";
import { nanoid } from "nanoid";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const category = searchParams.get("category") ?? undefined;
  const sort     = (searchParams.get("sort") ?? "new") as "new" | "hot";
  const limit    = Math.min(Number(searchParams.get("limit") ?? 30), 100);
  const offset   = Number(searchParams.get("offset") ?? 0);

  const session = await getSession();
  const viewerUserId = session?.userId;

  const posts = await getForumPosts({ category, sort, limit, offset, viewerUserId });
  return NextResponse.json(posts);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const userId = session?.userId;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, content, category, flair } = body as {
    title?: string;
    content?: string;
    category?: string;
    flair?: string;
  };

  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
  }
  if (title.length > 300) {
    return NextResponse.json({ error: "Title too long (max 300 chars)" }, { status: 400 });
  }
  if (content.length > 40000) {
    return NextResponse.json({ error: "Post too long (max 40 000 chars)" }, { status: 400 });
  }

  const validCategories = ["grand-archive", "flesh-and-blood", "one-piece-tcg", "general"];
  const cat = validCategories.includes(category ?? "") ? category! : "general";

  const post = await createForumPost({
    id:       nanoid(),
    authorId: userId,
    category: cat,
    title:    title.trim(),
    body:     content.trim(),
    flair:    flair?.trim() || undefined,
  });

  return NextResponse.json(post, { status: 201 });
}
