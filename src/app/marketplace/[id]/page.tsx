"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Listing, ListingCondition, Message, FeedbackRating } from "@/types/post";
import { PriceGraph } from "@/components/PriceGraph";
import FlipCard from "@/components/FlipCard";
import { getReprintRisk, REPRINT_RISK_STYLE, REPRINT_RISK_LABEL } from "@/lib/reprint-risk";
import { BanListWidget } from "@/components/BanListWidget";

// ---------------------------------------------------------------------------
// Feedback modal
// ---------------------------------------------------------------------------

const RATING_META: Record<FeedbackRating, { emoji: string; label: string; color: string }> = {
  positive: { emoji: "👍", label: "Positive", color: "border-emerald-400 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700" },
  neutral:  { emoji: "😐", label: "Neutral",  color: "border-yellow-400 bg-yellow-50 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700" },
  negative: { emoji: "👎", label: "Negative", color: "border-red-400 bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700" },
};

function FeedbackModal({
  listingId,
  onClose,
  onDone,
}: {
  listingId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [rating, setRating] = useState<FeedbackRating | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) { setError("Please select a rating."); return; }
    setSubmitting(true); setError("");
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, rating, note: note.trim() || undefined }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Failed to submit."); setSubmitting(false); return; }
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-md bg-[var(--background)] border border-[var(--border-strong)] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <p className="label-upper text-[10px] font-bold text-[var(--foreground)]">Leave Seller Feedback</p>
          <button onClick={onClose} className="label-upper text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-5">
          {/* Rating buttons */}
          <div>
            <p className="label-upper text-[10px] text-[var(--text-muted)] mb-3">How was your experience?</p>
            <div className="flex gap-3">
              {(["positive", "neutral", "negative"] as FeedbackRating[]).map((r) => {
                const meta = RATING_META[r];
                const selected = rating === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRating(r)}
                    className={`flex-1 flex flex-col items-center gap-1.5 py-3 px-2 border-2 transition-all ${
                      selected ? meta.color : "border-[var(--border)] bg-[var(--muted)] text-[var(--text-muted)]"
                    }`}
                  >
                    <span className="text-xl">{meta.emoji}</span>
                    <span className="label-upper text-[10px] font-bold">{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional note */}
          <div>
            <label className="label-upper text-[10px] text-[var(--text-muted)] block mb-2">
              Add a note <span className="opacity-50">(optional)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="e.g. Fast shipping, well packaged, exactly as described."
              className="w-full border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--border-strong)] outline-none resize-none"
            />
            <p className="text-[10px] text-[var(--text-muted)] mt-1">{note.length}/500</p>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !rating}
            className="label-upper py-2.5 bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 disabled:opacity-30 transition-opacity text-[10px]"
          >
            {submitting ? "Submitting…" : "Submit Feedback"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// In-page message thread
// ---------------------------------------------------------------------------

function MessagePanel({
  listingId,
  sellerId,
  isSeller,
  currentUserId,
  onClose,
}: {
  listingId: string;
  sellerId: string;
  isSeller: boolean;
  currentUserId: string;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgBody, setMsgBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // The seller needs to know who to reply to — use the first message's fromUserId
  const buyerId = messages.find((m) => m.fromUserId !== sellerId)?.fromUserId;

  async function fetchThread() {
    const res = await fetch(`/api/messages?listingId=${listingId}`);
    const data = await res.json();
    setMessages(data.messages ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchThread(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [listingId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!msgBody.trim()) return;
    setSending(true); setError("");
    const body: Record<string, string> = { listingId, body: msgBody.trim() };
    if (isSeller && buyerId) body.toUserId = buyerId;
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Failed to send."); setSending(false); return; }
    setMessages((prev) => [...prev, data.message]);
    setMsgBody("");
    setSending(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-lg bg-[var(--background)] border border-[var(--border-strong)] flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <p className="label-upper text-[10px] text-[var(--foreground)] font-bold">Messages</p>
          <button onClick={onClose} className="label-upper text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors">✕</button>
        </div>

        {/* Thread */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-[200px]">
          {loading && (
            <div className="flex justify-center py-8">
              <span className="w-5 h-5 border-2 border-[var(--border)] border-t-[var(--foreground)] rounded-full animate-spin" />
            </div>
          )}
          {!loading && messages.length === 0 && (
            <p className="text-sm text-[var(--text-muted)] text-center py-8">
              No messages yet. Send the first one below.
            </p>
          )}
          {messages.map((msg) => {
            const isOwn = msg.fromUserId === currentUserId;
            return (
              <div key={msg.id} className={`flex flex-col gap-1 ${isOwn ? "items-end" : "items-start"}`}>
                <span className="label-upper text-[9px] text-[var(--text-muted)]">
                  @{msg.fromUsername} · {new Date(msg.createdAt).toLocaleString()}
                </span>
                <div className={`max-w-[80%] px-3 py-2 text-sm leading-relaxed ${
                  isOwn
                    ? "bg-[var(--foreground)] text-[var(--background)]"
                    : "bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)]"
                }`}>
                  {msg.body}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Compose */}
        {isSeller && !buyerId && messages.length === 0 ? (
          <p className="p-4 text-xs text-[var(--text-muted)] border-t border-[var(--border)]">
            You can reply once a buyer sends the first message.
          </p>
        ) : (
          <form onSubmit={handleSend} className="border-t border-[var(--border)] p-3 flex gap-2">
            <input
              value={msgBody}
              onChange={(e) => setMsgBody(e.target.value)}
              placeholder="Write a message…"
              maxLength={2000}
              className="flex-1 border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--border-strong)] outline-none"
            />
            <button
              type="submit"
              disabled={sending || !msgBody.trim()}
              className="label-upper px-4 py-2 bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 disabled:opacity-30 transition-opacity text-[10px] shrink-0"
            >
              {sending ? "…" : "Send"}
            </button>
          </form>
        )}
        {error && <p className="px-4 pb-3 text-xs text-red-500">{error}</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function conditionBadge(c: ListingCondition) {
  const map: Record<ListingCondition, string> = {
    "Near Mint": "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    "Lightly Played": "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    "Moderately Played": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
    "Heavily Played": "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    "Damaged": "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  };
  return map[c] ?? "";
}

const LOREM_INSIGHTS = [
  `Based on recent sales data, this card has been trending upward in competitive play. Demand from the 
   tournament circuit has been pushing prices higher, with near-mint copies particularly scarce in the 
   secondary market.`,
  `This card sees moderate play across multiple archetypes, making it a stable hold. Casual demand 
   remains consistent, and the card's playability in both competitive and budget builds keeps its 
   floor relatively high compared to similar rarity cards.`,
  `Rotation risk is low for this card as it sits in a legal set for the foreseeable future. New set 
   releases could introduce synergies that drive further price appreciation — one to watch heading 
   into the next major event season.`,
  `Supply appears tightening on the secondary market. Fewer copies are being listed week-over-week, 
   suggesting that most copies have found long-term homes in active collections or are being held 
   by speculators anticipating future price movement.`,
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ListingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [showMessages, setShowMessages] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(false);
  const [feedbackSummary, setFeedbackSummary] = useState<{ positive: number; neutral: number; negative: number; total: number } | null>(null);

  // Fetch listing
  useEffect(() => {
    fetch(`/api/marketplace/${id}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return null; }
        return r.json();
      })
      .then((data) => {
        if (data) {
          setListing(data.listing);
          setLoading(false);
          // Fetch feedback summary for the seller
          if (data.listing?.sellerId) {
            fetch(`/api/feedback?sellerId=${data.listing.sellerId}`)
              .then(r => r.json())
              .then(d => { if (d.summary) setFeedbackSummary(d.summary); })
              .catch(() => {});
          }
        }
      });
  }, [id]);

  // Check current user
  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(({ user }) => {
      if (user) setUserId(user.id ?? user.userId ?? null);
    });
  }, []);

  async function handleMarkSold() {
    if (!confirm("Mark this listing as sold?")) return;
    setActionLoading(true); setActionError("");
    const res = await fetch(`/api/marketplace/${id}`, { method: "PATCH" });
    const data = await res.json();
    if (!res.ok) { setActionError(data.error ?? "Error."); setActionLoading(false); return; }
    setListing((prev) => prev ? { ...prev, sold: true } : prev);
    setActionLoading(false);
  }

  async function handleDelete() {
    if (!confirm("Remove this listing? This cannot be undone.")) return;
    setActionLoading(true); setActionError("");
    const res = await fetch(`/api/marketplace/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setActionError(data.error ?? "Error."); setActionLoading(false); return;
    }
    router.push("/marketplace");
  }

  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <span className="w-6 h-6 border-2 border-[var(--border)] border-t-[var(--foreground)] rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !listing) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <p className="label-upper text-[var(--text-muted)] mb-4">Listing not found</p>
        <Link href="/marketplace" className="label-upper text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors">
          ← Back to Marketplace
        </Link>
      </div>
    );
  }

  const isSeller = userId === listing.sellerId;
  const reprintRisk = listing.listingType !== "sealed"
    ? getReprintRisk(listing.cardName)
    : null;

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10">
      {/* Breadcrumb */}
      <div className="mb-8 flex items-center gap-2 label-upper text-[10px] text-[var(--text-muted)]">
        <Link href="/marketplace" className="hover:text-[var(--foreground)] transition-colors">Marketplace</Link>
        <span>/</span>
        <span>{listing.cardName}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
        {/* ------------------------------------------------------------------ */}
        {/* Left / main column                                                  */}
        {/* ------------------------------------------------------------------ */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Card image + basic info */}
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Image */}
            <div className="w-full sm:w-48 flex-shrink-0">
              {listing.imageUrl ? (
                <FlipCard
                  frontSrc={listing.imageUrl}
                  alt={listing.cardName}
                  game={listing.game}
                  className="w-full shadow-md"
                />
              ) : (
                <div className="aspect-[3/4] bg-[var(--muted)] border border-[var(--border)] flex items-center justify-center">
                  <span className="label-upper text-[10px] text-[var(--text-muted)]">No Image</span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex flex-col gap-3">
              {listing.sold && (
                <span className="label-upper text-[10px] px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800 self-start">
                  SOLD
                </span>
              )}

              <div>
                <p className="label-upper text-[10px] text-[var(--text-muted)] mb-1">{listing.setName}</p>
                <h1 className="text-3xl font-black text-[var(--foreground)] leading-tight" style={{ fontFamily: "var(--font-serif, serif)" }}>
                  {listing.cardName}
                </h1>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <span className={`label-upper text-[10px] px-2 py-0.5 rounded-sm ${conditionBadge(listing.condition)}`}>
                  {listing.condition}
                </span>
                {listing.marketplace === "store" && (
                  <span className="label-upper text-[10px] px-2 py-0.5 bg-[var(--foreground)] text-[var(--background)]">
                    Store Listing
                  </span>
                )}
                {listing.marketplace === "community" && (
                  <span className="label-upper text-[10px] px-2 py-0.5 border border-[var(--border)] text-[var(--text-muted)]">
                    Community
                  </span>
                )}
                {reprintRisk && (
                  <span
                    className={`label-upper text-[10px] px-2 py-0.5 border ${REPRINT_RISK_STYLE[reprintRisk.risk]}`}
                    title={reprintRisk.notes}
                  >
                    ⚠ {REPRINT_RISK_LABEL[reprintRisk.risk]}
                  </span>
                )}
              </div>

              {listing.conditionNotes && (
                <p className="text-xs text-[var(--text-muted)] italic leading-relaxed max-w-sm">
                  Condition note: {listing.conditionNotes}
                </p>
              )}

              <p className="text-4xl font-black text-[var(--foreground)]" style={{ fontFamily: "var(--font-serif, serif)" }}>
                {formatPrice(listing.priceCents)}
              </p>

              <p className="label-upper text-[10px] text-[var(--text-muted)]">
                Qty: {listing.quantity} &nbsp;·&nbsp; Game: {listing.game}
              </p>

              {listing.description && (
                <p className="text-sm text-[var(--text-muted)] leading-relaxed max-w-sm">{listing.description}</p>
              )}

              {/* Seller */}
              <div className="flex flex-col gap-1.5 mt-1 border border-[var(--border)] p-3">
                <p className="label-upper text-[10px] text-[var(--text-muted)]">Seller</p>
                <div className="flex items-center gap-2.5">
                  {listing.sellerAvatarUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={listing.sellerAvatarUrl} alt={listing.sellerUsername} className="w-8 h-8 rounded-full shrink-0" />
                  )}
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-[var(--foreground)]">@{listing.sellerUsername}</span>
                      {listing.sellerIsTrusted && (
                        <span className="relative group/trusted inline-block">
                          <span className="label-upper text-[9px] px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 cursor-default select-none">
                            ✓ Trusted Seller
                          </span>
                          {/* Tooltip */}
                          <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded bg-[var(--foreground)] text-[var(--background)] text-[10px] leading-snug px-3 py-2 opacity-0 group-hover/trusted:opacity-100 transition-opacity duration-150 z-50 text-center shadow-lg">
                            This seller has completed 10+ sales on TCG Times, earning the Trusted Seller badge from the community.
                            <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[var(--foreground)]" />
                          </span>
                        </span>
                      )}
                      {listing.sellerIsVerified && (
                        <span className="relative group/verified inline-block">
                          <span className="label-upper text-[9px] px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-300 dark:border-blue-700 cursor-default select-none">
                            ✦ Verified Seller
                          </span>
                          {/* Tooltip */}
                          <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded bg-[var(--foreground)] text-[var(--background)] text-[10px] leading-snug px-3 py-2 opacity-0 group-hover/verified:opacity-100 transition-opacity duration-150 z-50 text-center shadow-lg">
                            This seller's identity has been verified by TCG Times staff.
                            <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[var(--foreground)]" />
                          </span>
                        </span>
                      )}
                      {listing.marketplace === "store" && (
                        <span className="label-upper text-[9px] px-2 py-0.5 bg-[var(--foreground)] text-[var(--background)]">
                          Store
                        </span>
                      )}
                    </div>
                    {(listing.sellerTotalSales ?? 0) > 0 ? (
                      <span className="label-upper text-[10px] text-[var(--text-muted)]">
                        {listing.sellerTotalSales} completed sale{listing.sellerTotalSales !== 1 ? "s" : ""}
                        {feedbackSummary && feedbackSummary.total > 0 && (
                          <span className="ml-1 opacity-70">
                            · {Math.round((feedbackSummary.positive / feedbackSummary.total) * 100)}% positive ({feedbackSummary.total} review{feedbackSummary.total !== 1 ? "s" : ""})
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="label-upper text-[10px] text-[var(--text-muted)] opacity-50">New seller</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              {!listing.sold && !isSeller && userId && (
                <div className="flex flex-wrap gap-3 mt-2">
                  <button
                    onClick={() => setShowMessages(true)}
                    className="label-upper px-5 py-2.5 bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 transition-opacity text-[10px]"
                  >
                    Message Seller →
                  </button>
                </div>
              )}
              {/* Leave feedback on a sold listing */}
              {listing.sold && !isSeller && userId && (
                <div className="flex flex-wrap gap-3 mt-2">
                  {feedbackDone ? (
                    <span className="label-upper text-[10px] text-emerald-600 dark:text-emerald-400 py-2.5">
                      ✓ Feedback submitted
                    </span>
                  ) : (
                    <button
                      onClick={() => setShowFeedback(true)}
                      className="label-upper px-5 py-2.5 border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors text-[10px]"
                    >
                      Leave Feedback
                    </button>
                  )}
                </div>
              )}
              {!listing.sold && !isSeller && !userId && (
                <div className="flex flex-wrap gap-3 mt-2">
                  <a
                    href="/login"
                    className="label-upper px-5 py-2.5 bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 transition-opacity text-[10px]"
                  >
                    Sign in to Contact →
                  </a>
                </div>
              )}
              {!listing.sold && isSeller && (
                <div className="flex flex-wrap gap-3 mt-2">
                  <button
                    onClick={() => setShowMessages(true)}
                    className="label-upper px-5 py-2.5 border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors text-[10px]"
                  >
                    Messages
                  </button>
                  <button
                    onClick={handleMarkSold}
                    disabled={actionLoading}
                    className="label-upper px-5 py-2.5 border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors disabled:opacity-40 text-[10px]"
                  >
                    Mark as Sold
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={actionLoading}
                    className="label-upper px-5 py-2.5 border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40 text-[10px]"
                  >
                    Remove Listing
                  </button>
                </div>
              )}
              {actionError && <p className="text-sm text-red-500">{actionError}</p>}
            </div>
          </div>

          {/* Price graph */}
          <div>
            <PriceGraph cardName={listing.cardName} data={[]} showDrawdown />
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Right / sidebar                                                     */}
        {/* ------------------------------------------------------------------ */}
        <aside className="flex flex-col gap-6">
          {/* AI Insights */}
          <div className="border border-[var(--border)] bg-[var(--muted)] p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="label-upper text-[10px] text-[var(--text-muted)]">AI Insights</span>
              <span className="label-upper text-[10px] px-1.5 py-0.5 bg-[var(--background)] border border-[var(--border)] text-[var(--text-muted)]">
                Coming Soon
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {LOREM_INSIGHTS.map((para, i) => (
                <p key={i} className="text-xs leading-relaxed text-[var(--text-muted)]">
                  {para}
                </p>
              ))}
            </div>

            <p className="label-upper text-[10px] text-[var(--text-muted)] mt-4 pt-4 border-t border-[var(--border)]">
              Real AI analysis coming in a future update.
            </p>
          </div>

          {/* Ban list widget */}
          <BanListWidget
            game={
              listing.game === "Flesh and Blood" ? "fab"
              : listing.game === "Grand Archive"  ? "grand-archive"
              : listing.game === "One Piece TCG"  ? "one-piece"
              : listing.game === "Pokémon"         ? "pokemon"
              : "all"
            }
            limit={4}
            title="Recent Ban News"
          />

          {/* Similar listings placeholder */}
          <div className="border border-[var(--border)] p-5">
            <p className="label-upper text-[10px] text-[var(--text-muted)] mb-3">Similar Listings</p>
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-[var(--muted)] border border-[var(--border)] animate-pulse" />
              ))}
              <p className="label-upper text-[10px] text-[var(--text-muted)] mt-1">
                Similar listing recommendations coming soon.
              </p>
            </div>
          </div>

          {/* Back link */}
          <Link
            href="/marketplace"
            className="label-upper text-[10px] text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
          >
            ← Back to Marketplace
          </Link>
        </aside>
      </div>

      {/* In-site message panel */}
      {showMessages && userId && listing && (
        <MessagePanel
          listingId={listing.id}
          sellerId={listing.sellerId}
          isSeller={isSeller}
          currentUserId={userId}
          onClose={() => setShowMessages(false)}
        />
      )}

      {/* Feedback modal */}
      {showFeedback && listing && (
        <FeedbackModal
          listingId={listing.id}
          onClose={() => setShowFeedback(false)}
          onDone={() => { setShowFeedback(false); setFeedbackDone(true); }}
        />
      )}
    </div>
  );
}
