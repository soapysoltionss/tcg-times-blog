"use client";

import { useState, useEffect, useRef } from "react";
import type { PostComment } from "@/types/post";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/** Avatar initials fallback */
function Initials({ name }: { name: string }) {
  const letter = (name[0] ?? "?").toUpperCase();
  return (
    <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-[var(--muted)] border border-[var(--border)] text-[var(--foreground)] text-xs font-bold select-none">
      {letter}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-comment translate button
// Uses the MyMemory free translation API (no key required, 5k req/day)
// Falls back gracefully if it fails.
// ---------------------------------------------------------------------------

type TranslateState = "idle" | "loading" | "done" | "error";

function TranslateButton({ text, onTranslated }: { text: string; onTranslated: (t: string | null) => void }) {
  const [state, setState] = useState<TranslateState>("idle");
  const targetLang = typeof navigator !== "undefined"
    ? (navigator.language ?? "en").split("-")[0]
    : "en";

  async function translate() {
    if (state === "done") {
      onTranslated(null); // toggle off
      setState("idle");
      return;
    }
    setState("loading");
    try {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=autodetect|${targetLang}`;
      const res = await fetch(url);
      const data = await res.json() as { responseData?: { translatedText?: string } };
      const translated = data?.responseData?.translatedText ?? null;
      if (translated && translated !== text) {
        onTranslated(translated);
        setState("done");
      } else {
        onTranslated(null);
        setState("idle");
      }
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2000);
    }
  }

  return (
    <button
      onClick={translate}
      disabled={state === "loading"}
      className="label-upper text-[9px] tracking-widest text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-40"
      title={state === "done" ? "Show original" : "Translate to your language"}
    >
      {state === "loading" ? "…" : state === "error" ? "error" : state === "done" ? "original" : "translate"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Single comment row
// ---------------------------------------------------------------------------

function CommentRow({
  comment,
  isPending,
}: {
  comment: PostComment;
  isPending: boolean;
}) {
  const [translated, setTranslated] = useState<string | null>(null);

  return (
    <div className={`flex gap-4 py-5 border-b border-[var(--border)] last:border-b-0 ${isPending ? "opacity-60" : ""}`}>
      {/* Avatar */}
      {comment.authorAvatarUrl ? (
        <img
          src={comment.authorAvatarUrl}
          alt={comment.authorUsername}
          width={32}
          height={32}
          className="w-8 h-8 flex-shrink-0 rounded-none object-cover border border-[var(--border)]"
        />
      ) : (
        <Initials name={comment.authorUsername} />
      )}

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-2 mb-1.5">
          <span className="text-sm font-bold text-[var(--foreground)]">
            @{comment.authorUsername}
          </span>
          <span className="label-upper text-[var(--text-muted)] text-[10px]">
            {timeAgo(comment.createdAt)}
          </span>
          {isPending && (
            <span className="label-upper text-[10px] text-[var(--text-muted)] border border-[var(--border)] px-1.5 py-0.5">
              pending · visible within 2h
            </span>
          )}
        </div>

        <p className="text-sm text-[var(--foreground)] leading-relaxed whitespace-pre-wrap break-words">
          {translated ?? comment.body}
        </p>

        <div className="mt-1.5">
          <TranslateButton
            text={comment.body}
            onTranslated={(t) => setTranslated(t)}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main CommentsSection
// ---------------------------------------------------------------------------

type Props = {
  slug: string;
  articleType?: "community" | "professional";
};

export default function CommentsSection({ slug, articleType = "community" }: Props) {
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch current user + comments in parallel
  useEffect(() => {
    let alive = true;

    async function load() {
      const [meRes, commentsRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch(`/api/comments/${slug}`),
      ]);

      if (!alive) return;

      const meData = await meRes.json() as { user?: { id: string } };
      setCurrentUserId(meData.user?.id ?? null);

      const cData = await commentsRes.json() as { comments?: PostComment[] };
      setComments(cData.comments ?? []);
      setLoading(false);
    }

    load().catch(() => setLoading(false));
    return () => { alive = false; };
  }, [slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || submitting) return;
    setSubmitting(true);
    setSubmitMsg(null);

    const res = await fetch(`/api/comments/${slug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: body.trim() }),
    });

    const data = await res.json() as {
      comment?: PostComment;
      pending?: boolean;
      message?: string;
      error?: string;
    };

    if (res.ok && data.comment) {
      setComments((prev) => [...prev, data.comment!]);
      setBody("");
      setSubmitMsg({ text: data.message ?? "Comment posted.", ok: true });
    } else {
      setSubmitMsg({ text: data.error ?? "Something went wrong.", ok: false });
    }

    setSubmitting(false);
  }

  const approved = comments.filter((c) => c.approved);
  const pending  = comments.filter((c) => !c.approved && c.authorId === currentUserId);

  return (
    <section className="mt-14 pt-8 border-t-2 border-[var(--border-strong)]">
      {/* Heading */}
      <div className="flex items-baseline gap-3 mb-6">
        <h2
          className="text-2xl font-black text-[var(--foreground)] leading-none tracking-tight"
          style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
        >
          Comments
        </h2>
        {!loading && (
          <span className="label-upper text-[var(--text-muted)]">
            {approved.length}
          </span>
        )}
        {articleType === "professional" && (
          <span className="label-upper text-[10px] text-[var(--text-muted)] border border-[var(--border)] px-2 py-1 ml-auto">
            moderated · up to 2h delay
          </span>
        )}
      </div>

      {/* Comment list */}
      {loading ? (
        <p className="label-upper text-[var(--text-muted)] py-8 text-center">Loading…</p>
      ) : approved.length === 0 && pending.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] py-8 text-center">
          No comments yet. Be the first!
        </p>
      ) : (
        <div className="mb-8">
          {approved.map((c) => (
            <CommentRow key={c.id} comment={c} isPending={false} />
          ))}
          {pending.map((c) => (
            <CommentRow key={c.id} comment={c} isPending={true} />
          ))}
        </div>
      )}

      {/* Submit form */}
      {currentUserId ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {articleType === "professional" && (
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Comments on professional articles are reviewed before appearing — yours will be visible within 2 hours.
            </p>
          )}
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment…"
            rows={4}
            maxLength={2000}
            className="w-full border border-[var(--border)] bg-transparent text-[var(--foreground)] placeholder:text-[var(--text-muted)] text-sm px-4 py-3 resize-none focus:outline-none focus:border-[var(--border-strong)] transition-colors"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="label-upper text-[var(--text-muted)] text-[10px]">
              {body.length}/2000
            </span>
            <button
              type="submit"
              disabled={!body.trim() || submitting}
              className="label-upper px-6 py-2.5 bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 transition-opacity disabled:opacity-30"
            >
              {submitting ? "Posting…" : "Post comment"}
            </button>
          </div>
          {submitMsg && (
            <p className={`label-upper text-sm ${submitMsg.ok ? "text-[var(--foreground)]" : "text-[var(--text-muted)]"}`}>
              {submitMsg.ok ? "✓ " : ""}{submitMsg.text}
            </p>
          )}
        </form>
      ) : (
        <p className="text-sm text-[var(--text-muted)]">
          <a href="/login" className="underline hover:text-[var(--foreground)] transition-colors">
            Sign in
          </a>{" "}
          to leave a comment.
        </p>
      )}
    </section>
  );
}
