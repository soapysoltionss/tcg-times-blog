"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { gameCategories } from "@/config/site";
import type { ForumPost, ForumComment } from "@/types/post";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function getCatMeta(slug: string) {
  return gameCategories.find(c => c.slug === slug) ?? {
    name: "General TCG", shortName: "TCG", emoji: "🃏",
    badgeColor: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  };
}

// Upvote button (reusable for post + comments)
function UpvoteBtn({
  count, voted, onUpvote, size = "md",
}: {
  count: number; voted: boolean; onUpvote: () => void; size?: "sm" | "md";
}) {
  return (
    <button
      onClick={onUpvote}
      className={`flex items-center gap-1 group transition-opacity ${size === "sm" ? "text-xs" : "text-sm"}`}
      aria-label="Upvote"
    >
      <svg
        className={`${size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} ${voted ? "text-[var(--foreground)]" : "text-[var(--text-muted)] group-hover:text-[var(--foreground)]"} transition-colors`}
        fill={voted ? "currentColor" : "none"}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
      <span className={`font-bold tabular-nums ${voted ? "text-[var(--foreground)]" : "text-[var(--text-muted)] group-hover:text-[var(--foreground)]"} transition-colors`}>
        {count}
      </span>
    </button>
  );
}

// Single comment (recursive for nested replies)
function CommentItem({
  comment, depth = 0,
}: {
  comment: ForumComment; depth?: number;
}) {
  const [upvotes, setUpvotes]   = useState(comment.upvotes);
  const [upvoted, setUpvoted]   = useState(comment.viewerHasUpvoted ?? false);
  const [replying, setReplying] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replies, setReplies]   = useState<ForumComment[]>(comment.replies ?? []);
  const params = useParams();
  const postId = params.id as string;

  async function handleUpvote() {
    const res = await fetch(`/api/forum/posts/${comment.id}/upvote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType: "comment" }),
    });
    if (res.status === 401) { window.location.href = "/login"; return; }
    if (res.ok) {
      const data = await res.json() as { upvotes: number; hasUpvoted: boolean };
      setUpvotes(data.upvotes);
      setUpvoted(data.hasUpvoted);
    }
  }

  async function submitReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyBody.trim() || submitting) return;
    setSubmitting(true);
    const res = await fetch(`/api/forum/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: replyBody.trim(), parentCommentId: comment.id }),
    });
    if (res.status === 401) { window.location.href = "/login"; return; }
    if (res.ok) {
      const c = await res.json() as ForumComment;
      setReplies(prev => [...prev, c]);
      setReplyBody("");
      setReplying(false);
    }
    setSubmitting(false);
  }

  return (
    <div className={`${depth > 0 ? "border-l-2 border-[var(--border)] pl-4 ml-4" : ""}`}>
      <div className="py-3">
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-1.5">
          <span className="font-medium text-[var(--foreground)]">{comment.authorUsername}</span>
          <span>·</span>
          <span>{timeAgo(comment.createdAt)}</span>
        </div>
        <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap leading-relaxed">
          {comment.body}
        </p>
        <div className="flex items-center gap-3 mt-2">
          <UpvoteBtn count={upvotes} voted={upvoted} onUpvote={handleUpvote} size="sm" />
          {depth < 2 && (
            <button
              onClick={() => setReplying(r => !r)}
              className="label-upper text-[10px] text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
            >
              Reply
            </button>
          )}
        </div>
        {replying && (
          <form onSubmit={submitReply} className="mt-3 flex flex-col gap-2">
            <textarea
              value={replyBody}
              onChange={e => setReplyBody(e.target.value)}
              placeholder="Write a reply…"
              rows={3}
              className="w-full border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--foreground)] transition-colors"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting || !replyBody.trim()}
                className="label-upper text-xs px-4 py-1.5 bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 transition-opacity disabled:opacity-40"
              >
                {submitting ? "Posting…" : "Reply"}
              </button>
              <button
                type="button"
                onClick={() => setReplying(false)}
                className="label-upper text-xs px-4 py-1.5 border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
      {replies.map(r => (
        <CommentItem key={r.id} comment={r} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function ForumPostPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.id as string;

  const [post,       setPost]       = useState<ForumPost | null>(null);
  const [comments,   setComments]   = useState<ForumComment[]>([]);
  const [postLoading, setPostLoading] = useState(true);
  const [upvotes,    setUpvotes]    = useState(0);
  const [upvoted,    setUpvoted]    = useState(false);

  const [body,       setBody]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitErr,  setSubmitErr]  = useState("");

  useEffect(() => {
    async function loadPost() {
      const [pRes, cRes] = await Promise.all([
        fetch(`/api/forum/posts/${postId}`),
        fetch(`/api/forum/posts/${postId}/comments`),
      ]);
      if (!pRes.ok) { router.replace("/forum"); return; }
      const p  = await pRes.json() as ForumPost;
      const cs = await cRes.json() as ForumComment[];
      setPost(p);
      setUpvotes(p.upvotes);
      setUpvoted(p.viewerHasUpvoted ?? false);
      setComments(cs);
      setPostLoading(false);
    }
    loadPost();
  }, [postId, router]);

  async function handlePostUpvote() {
    const res = await fetch(`/api/forum/posts/${postId}/upvote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType: "post" }),
    });
    if (res.status === 401) { window.location.href = "/login"; return; }
    if (res.ok) {
      const data = await res.json() as { upvotes: number; hasUpvoted: boolean };
      setUpvotes(data.upvotes);
      setUpvoted(data.hasUpvoted);
    }
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || submitting) return;
    setSubmitting(true);
    setSubmitErr("");
    const res = await fetch(`/api/forum/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: body.trim() }),
    });
    if (res.status === 401) { window.location.href = "/login"; return; }
    if (!res.ok) {
      const err = await res.json() as { error: string };
      setSubmitErr(err.error ?? "Failed to post comment");
    } else {
      const c = await res.json() as ForumComment;
      setComments(prev => [...prev, c]);
      setBody("");
    }
    setSubmitting(false);
  }

  if (postLoading) {
    return (
      <div className="py-32 text-center text-[var(--text-muted)]">
        <div className="w-8 h-8 border-2 border-[var(--border)] border-t-[var(--foreground)] rounded-full animate-spin mx-auto" />
      </div>
    );
  }
  if (!post) return null;

  const cat = getCatMeta(post.category);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-6">
        <Link href="/forum" className="hover:text-[var(--foreground)] transition-colors">Forum</Link>
        <span>›</span>
        <span className={`label-upper text-[10px] px-1.5 py-0.5 rounded ${cat.badgeColor}`}>
          {cat.emoji} {cat.name}
        </span>
      </div>

      {/* Post */}
      <article>
        <div className="flex items-center gap-2 mb-3">
          {post.flair && (
            <span className="label-upper text-[10px] px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--text-muted)]">
              {post.flair}
            </span>
          )}
        </div>
        <h1
          className="text-3xl md:text-4xl font-black text-[var(--foreground)] leading-tight mb-4"
          style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
        >
          {post.title}
        </h1>
        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] mb-6">
          <span>by <span className="font-medium text-[var(--foreground)]">{post.authorUsername}</span></span>
          <span>·</span>
          <span>{timeAgo(post.createdAt)}</span>
        </div>
        <div className="prose prose-sm dark:prose-invert max-w-none text-[var(--foreground)] border-b border-[var(--border)] pb-6 mb-6 whitespace-pre-wrap">
          {post.body}
        </div>
        <div className="flex items-center gap-4">
          <UpvoteBtn count={upvotes} voted={upvoted} onUpvote={handlePostUpvote} />
          <span className="text-sm text-[var(--text-muted)] flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {comments.length} comment{comments.length !== 1 ? "s" : ""}
          </span>
        </div>
      </article>

      {/* Comment form */}
      <section className="mt-10">
        <h2 className="text-lg font-black text-[var(--foreground)] mb-4">
          Leave a Comment
        </h2>
        <form onSubmit={submitComment} className="flex flex-col gap-3">
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Share your thoughts…"
            rows={4}
            className="w-full border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-4 py-3 text-sm resize-y focus:outline-none focus:border-[var(--foreground)] transition-colors"
          />
          {submitErr && <p className="text-red-500 text-sm">{submitErr}</p>}
          <button
            type="submit"
            disabled={submitting || !body.trim()}
            className="self-start label-upper px-6 py-2.5 bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 transition-opacity disabled:opacity-40"
          >
            {submitting ? "Posting…" : "Post Comment"}
          </button>
        </form>
      </section>

      {/* Comments */}
      <section className="mt-8">
        <h2 className="text-lg font-black text-[var(--foreground)] mb-2 border-b border-[var(--border-strong)] pb-3">
          {comments.length} Comment{comments.length !== 1 ? "s" : ""}
        </h2>
        {comments.length === 0 ? (
          <p className="py-8 text-center text-[var(--text-muted)]">
            No comments yet. Be the first!
          </p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {comments.map(c => <CommentItem key={c.id} comment={c} />)}
          </div>
        )}
      </section>
    </div>
  );
}
