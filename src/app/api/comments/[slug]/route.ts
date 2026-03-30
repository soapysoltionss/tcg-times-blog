import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getComments, addComment, getUserById } from "@/lib/db";
import { filterProfanity } from "@/lib/profanity";
import { getPostBySlug } from "@/lib/posts";
import { v4 as uuidv4 } from "uuid";

type Params = { params: Promise<{ slug: string }> };

// ---------------------------------------------------------------------------
// GET /api/comments/[slug]
// Returns approved comments + the current user's own pending comments.
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const session = await getSession();
  const comments = await getComments(slug, session?.userId);
  return NextResponse.json({ comments });
}

// ---------------------------------------------------------------------------
// POST /api/comments/[slug]
// Body: { body: string }
//
// Auto-approval rules:
//   community post  → approved immediately
//   professional post → approved after 2 hours (cron job)
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest, { params }: Params) {
  const { slug } = await params;

  // Must be logged in
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "You must be signed in to comment." }, { status: 401 });
  }

  const { body } = await req.json().catch(() => ({ body: "" }));
  if (!body || typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "Comment cannot be empty." }, { status: 400 });
  }
  if (body.trim().length > 2000) {
    return NextResponse.json({ error: "Comment must be 2000 characters or less." }, { status: 400 });
  }

  // Profanity filter — always clean the text before saving
  const { clean, flagged } = filterProfanity(body.trim());
  void flagged; // we save the cleaned version regardless; no hard block

  // Resolve the post to determine article type
  let articleType: "community" | "professional" = "community";
  try {
    const post = await getPostBySlug(slug);
    if (post.articleType === "professional") articleType = "professional";
  } catch {
    // Slug not found — 404
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  // Verify user still exists
  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 401 });
  }

  // Community posts: approve immediately.
  // Professional posts: hold for 2 hours.
  const now = new Date();
  const approvedImmediately = articleType === "community";
  const approvedAt = approvedImmediately
    ? now.toISOString()
    : new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(); // scheduled time

  const comment = await addComment({
    id: uuidv4(),
    slug,
    authorId: user.id,
    body: clean,
    approved: approvedImmediately,
    approvedAt: approvedImmediately ? now.toISOString() : null,
    articleType,
  });

  return NextResponse.json({
    comment,
    pending: !approvedImmediately,
    message: approvedImmediately
      ? "Comment posted."
      : "Your comment will appear within 2 hours.",
  });
}
