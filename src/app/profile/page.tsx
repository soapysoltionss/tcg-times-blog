"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AuthField from "@/components/AuthField";
import { TASK_CATALOGUE, xpToLevel } from "@/lib/xp";
import type { User, TaskDefinition } from "@/lib/xp";
import { SUPPORTED_REGIONS } from "@/lib/ai-coach";
import type { MessageThread, Message } from "@/types/post";

type SafeUser = Omit<User, "passwordHash"> & { linkedProviders?: string[] };

// XP progress bar component
function XpBar({ xp }: { xp: number }) {
  const { level, title, currentLevelXp, nextLevelXp } = xpToLevel(xp);
  const isMaxLevel = nextLevelXp === currentLevelXp;
  const progress = isMaxLevel
    ? 100
    : Math.round(((xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100);

  return (
    <div className="border border-[var(--border)] p-6 mb-8 animate-in fade-in duration-500">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="label-upper text-[var(--text-muted)] mb-1">Level {level}</p>
          <h2
            className="text-2xl font-black text-[var(--foreground)] leading-tight"
            style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
          >
            {title}
          </h2>
        </div>
        <div className="text-right">
          <span
            className="text-4xl font-black text-[var(--foreground)]"
            style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
          >
            {xp}
          </span>
          <p className="label-upper text-[var(--text-muted)] text-[10px]">XP</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-[var(--muted)] overflow-hidden">
        <div
          className="h-full bg-[var(--foreground)] transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] text-[var(--text-muted)] label-upper">{currentLevelXp} XP</span>
        {!isMaxLevel && (
          <span className="text-[10px] text-[var(--text-muted)] label-upper">
            {nextLevelXp - xp} XP to Level {level + 1}
          </span>
        )}
        {isMaxLevel && (
          <span className="text-[10px] text-[var(--text-muted)] label-upper">Max level 🏆</span>
        )}
      </div>
    </div>
  );
}

// Single task row
function TaskRow({
  task,
  completedAt,
  index,
}: {
  task: TaskDefinition;
  completedAt: string | null;
  index: number;
}) {
  const done = !!completedAt;
  return (
    <div
      className={`flex items-center gap-4 py-4 border-b border-[var(--border)] last:border-0 transition-opacity animate-in fade-in slide-in-from-left-2 duration-300`}
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: "both" }}
    >
      {/* Checkbox */}
      <div
        className={`w-5 h-5 shrink-0 border-2 flex items-center justify-center transition-colors ${
          done
            ? "bg-[var(--foreground)] border-[var(--foreground)]"
            : "border-[var(--border)]"
        }`}
      >
        {done && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--background)]" />
          </svg>
        )}
      </div>

      {/* Icon + text */}
      <span className="text-xl shrink-0">{task.icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold leading-tight ${done ? "line-through text-[var(--text-muted)]" : "text-[var(--foreground)]"}`}>
          {task.label}
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">{task.description}</p>
      </div>

      {/* XP badge */}
      <span
        className={`label-upper text-[10px] px-2 py-1 shrink-0 ${
          done
            ? "bg-[var(--muted)] text-[var(--text-muted)]"
            : "bg-[var(--foreground)] text-[var(--background)]"
        }`}
      >
        +{task.xpReward} XP
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inbox
// ---------------------------------------------------------------------------

function InboxPanel({ userId }: { userId: string }) {
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  useEffect(() => {
    fetch("/api/messages/inbox")
      .then((r) => r.json())
      .then(({ threads: t }) => { setThreads(t ?? []); setLoading(false); });
  }, []);

  async function openThread(listingId: string) {
    setActiveThread(listingId);
    setThreadLoading(true);
    const res = await fetch(`/api/messages?listingId=${listingId}`);
    const data = await res.json();
    setMessages(data.messages ?? []);
    setThreadLoading(false);
    // Update unread count in thread list
    setThreads((prev) =>
      prev.map((t) => t.listingId === listingId ? { ...t, unreadCount: 0 } : t)
    );
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyBody.trim() || !activeThread) return;
    setSending(true); setSendError("");

    // Determine toUserId: find the other person in the thread
    const other = messages.find((m) => m.fromUserId !== userId);
    const body: Record<string, string> = { listingId: activeThread, body: replyBody.trim() };
    if (other) body.toUserId = other.fromUserId;

    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) { setSendError(data.error ?? "Failed."); setSending(false); return; }
    setMessages((prev) => [...prev, data.message]);
    setReplyBody("");
    setSending(false);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="w-5 h-5 border-2 border-[var(--border)] border-t-[var(--foreground)] rounded-full animate-spin" />
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="border border-dashed border-[var(--border)] p-12 text-center">
        <p className="label-upper text-[var(--text-muted)] mb-2">No messages yet</p>
        <p className="text-sm text-[var(--text-muted)]">
          When you contact a seller or receive a message, it will appear here.
        </p>
        <Link href="/marketplace" className="label-upper text-[10px] text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors mt-4 inline-block">
          Browse marketplace →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex border border-[var(--border)] min-h-[400px]">
      {/* Thread list */}
      <div className="w-1/3 border-r border-[var(--border)] flex flex-col overflow-y-auto">
        {threads.map((t) => (
          <button
            key={t.listingId}
            onClick={() => openThread(t.listingId)}
            className={`flex items-start gap-3 p-3 text-left border-b border-[var(--border)] transition-colors ${
              activeThread === t.listingId
                ? "bg-[var(--muted)]"
                : "hover:bg-[var(--muted)]"
            }`}
          >
            {/* Card thumbnail */}
            {t.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.imageUrl} alt={t.cardName} className="w-8 h-11 object-cover shrink-0 border border-[var(--border)]" />
            ) : (
              <div className="w-8 h-11 bg-[var(--muted)] border border-[var(--border)] shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <p className="text-xs font-semibold text-[var(--foreground)] truncate">{t.cardName}</p>
                {t.unreadCount > 0 && (
                  <span className="label-upper text-[9px] bg-[var(--foreground)] text-[var(--background)] px-1.5 py-0.5 shrink-0">
                    {t.unreadCount}
                  </span>
                )}
              </div>
              <p className="label-upper text-[9px] text-[var(--text-muted)]">@{t.otherUsername}</p>
              <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">{t.lastMessage}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Message pane */}
      <div className="flex-1 flex flex-col">
        {!activeThread && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-[var(--text-muted)]">Select a conversation</p>
          </div>
        )}
        {activeThread && (
          <>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {threadLoading && (
                <div className="flex justify-center py-8">
                  <span className="w-5 h-5 border-2 border-[var(--border)] border-t-[var(--foreground)] rounded-full animate-spin" />
                </div>
              )}
              {!threadLoading && messages.map((msg) => {
                const isOwn = msg.fromUserId === userId;
                return (
                  <div key={msg.id} className={`flex flex-col gap-0.5 ${isOwn ? "items-end" : "items-start"}`}>
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
            </div>
            <form onSubmit={handleReply} className="border-t border-[var(--border)] p-3 flex gap-2">
              <input
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder="Write a reply…"
                maxLength={2000}
                className="flex-1 border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--border-strong)] outline-none"
              />
              <button
                type="submit"
                disabled={sending || !replyBody.trim()}
                className="label-upper px-4 py-2 bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 disabled:opacity-30 transition-opacity text-[10px] shrink-0"
              >
                {sending ? "…" : "Send"}
              </button>
            </form>
            {sendError && <p className="px-4 pb-2 text-xs text-red-500">{sendError}</p>}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile page
// ---------------------------------------------------------------------------

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-[60vh] flex items-center justify-center">
        <span className="w-6 h-6 border-2 border-[var(--border)] border-t-[var(--foreground)] rounded-full animate-spin" />
      </div>
    }>
      <ProfilePageInner />
    </Suspense>
  );
}

function ProfilePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<SafeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkedProviders, setLinkedProviders] = useState<string[]>([]);
  const [patreonJustLinked, setPatreonJustLinked] = useState(false);

  // Edit form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [region, setRegion] = useState("");
  const [additionalRegions, setAdditionalRegions] = useState<string[]>([]);
  const [city, setCity] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "messages" | "edit">("overview");
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Sync subscription status first (re-mints session cookie with correct
    // isSubscriber flag and awards the subscribe quest if needed).
    fetch("/api/auth/sync-subscription", { method: "POST" }).catch(() => {/* non-fatal */});

    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(({ user }) => {
        if (!user) {
          router.push("/login");
          return;
        }
        setUser(user);
        setLinkedProviders(user.linkedProviders ?? []);
        setFirstName(user.firstName);
        setLastName(user.lastName);
        setEmail(user.email ?? "");
        setRegion(user.region ?? "");
        setAdditionalRegions(user.additionalRegions ?? []);
        setCity(user.city ?? "");
      })
      .finally(() => setLoading(false));

    // Fetch unread message count for tab badge
    fetch("/api/messages/inbox")
      .then((r) => r.json())
      .then(({ unreadCount: n }) => setUnreadCount(n ?? 0))
      .catch(() => {/* non-fatal */});

    // Show a success banner if we just came back from Patreon OAuth
    if (searchParams.get("patreon") === "linked") {
      setPatreonJustLinked(true);
      // Clean the URL without a page reload
      window.history.replaceState({}, "", "/profile");
    }
  }, [router, searchParams]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword && newPassword !== confirmPassword) {
      setSaveError("Passwords do not match.");
      return;
    }
    setSaving(true);
    setSaveError("");
    setSaveSuccess(false);

    const body: Record<string, unknown> = { firstName, lastName, email, region, additionalRegions, city };
    if (newPassword) {
      body.currentPassword = currentPassword;
      body.newPassword = newPassword;
    }

    const res = await fetch("/api/auth/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (res.ok) {
      setUser(data.user);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } else {
      setSaveError(data.error ?? "Something went wrong.");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <span className="w-6 h-6 border-2 border-[var(--border)] border-t-[var(--foreground)] rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const completedCount = user.tasks.filter((t) => t.completedAt).length;
  const totalCount = TASK_CATALOGUE.length;

  return (
    <div className="max-w-3xl mx-auto px-6 lg:px-10 py-14 animate-in fade-in duration-400">
      {/* Header */}
      <div className="border-b-2 border-[var(--border-strong)] pb-6 mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="label-upper text-[var(--text-muted)] mb-2">Profile</p>
          <h1
            className="text-4xl font-black text-[var(--foreground)] leading-none"
            style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
          >
            {user.firstName} {user.lastName}
          </h1>
          <p className="label-upper text-[var(--text-muted)] mt-2">@{user.username}</p>
          {user.verifiedSeller && (
            <span className="inline-flex items-center gap-1.5 mt-2 label-upper text-[9px] px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
              ✦ Verified Seller
            </span>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="label-upper text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors shrink-0 mt-1"
        >
          Sign out
        </button>
      </div>

      {/* XP Bar */}
      <XpBar xp={user.xp} />

      {/* Patreon just-linked banner */}
      {patreonJustLinked && (
        <div className="border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 p-4 mb-6 flex items-center justify-between gap-4 animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <span className="text-lg">🎉</span>
            <div>
              <p className="text-sm font-semibold text-green-800 dark:text-green-300">Patreon connected!</p>
              <p className="text-xs text-green-700 dark:text-green-400">Your subscription status has been synced.</p>
            </div>
          </div>
          <button
            onClick={() => setPatreonJustLinked(false)}
            className="label-upper text-[10px] text-green-700 dark:text-green-400 hover:text-green-900 transition-colors"
          >✕</button>
        </div>
      )}

      {/* Subscription status card */}
      {user.subscription ? (
        <div className="border border-[var(--border)] p-5 mb-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex flex-col gap-2">
              <p className="label-upper text-[10px] text-[var(--text-muted)]">Patreon Subscription</p>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Tier badge */}
                <span
                  className={`label-upper text-[10px] px-2.5 py-1 font-black ${
                    (user.subscription.tierLevel ?? 1) >= 2
                      ? "bg-yellow-400 text-yellow-900"
                      : "bg-[var(--muted)] border border-[var(--border)] text-[var(--foreground)]"
                  }`}
                >
                  {user.subscription.tierName}
                </span>
                {/* Status badge */}
                <span
                  className={`label-upper px-2 py-0.5 text-[10px] border ${
                    user.subscription.status === "active"
                      ? "border-green-400 text-green-700 dark:text-green-400"
                      : user.subscription.status === "declined"
                      ? "border-yellow-400 text-yellow-700 dark:text-yellow-400"
                      : "border-[var(--border)] text-[var(--text-muted)] line-through"
                  }`}
                >
                  {user.subscription.status}
                </span>
              </div>
              {user.subscription.currentPeriodEnd && (
                <p className="label-upper text-[var(--text-muted)] text-[10px]">
                  Next charge:{" "}
                  {new Date(user.subscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              )}
            </div>
            {/* Manage on Patreon */}
            <a
              href="https://www.patreon.com/settings/memberships"
              target="_blank"
              rel="noopener noreferrer"
              className="label-upper text-[10px] text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors shrink-0 mt-1"
            >
              Manage ↗
            </a>
          </div>
          {/* Show connect button even if they have a subscription record but haven't linked OAuth */}
          {!linkedProviders.includes("patreon") && (
            <div className="border-t border-[var(--border)] pt-4">
              <p className="text-xs text-[var(--text-muted)] mb-3">
                Link your Patreon account to automatically sync your subscription status.
              </p>
              <a
                href="/api/auth/signin/patreon"
                className="label-upper px-4 py-2 border border-[var(--border-strong)] text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors text-[10px] inline-block"
              >
                🔗 Connect Patreon
              </a>
            </div>
          )}
          {linkedProviders.includes("patreon") && (
            <div className="border-t border-[var(--border)] pt-3 flex items-center gap-2">
              <span className="text-green-600 dark:text-green-400 text-sm">✓</span>
              <span className="label-upper text-[10px] text-[var(--text-muted)]">Patreon account linked</span>
            </div>
          )}
        </div>
      ) : (
        <div className="border border-[var(--border)] p-5 mb-8">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <p className="label-upper text-[var(--text-muted)] mb-1">Subscription</p>
              <p className="text-sm text-[var(--text-muted)]">No active subscription</p>
            </div>
            <a
              href="/subscribe"
              className="label-upper px-4 py-2 bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 transition-opacity text-[10px]"
            >
              Subscribe
            </a>
          </div>
          {/* Connect Patreon — for users who subscribed outside the app */}
          <div className="border-t border-[var(--border)] pt-4">
            {linkedProviders.includes("patreon") ? (
              <div className="flex items-center gap-2">
                <span className="text-green-600 dark:text-green-400 text-sm">✓</span>
                <span className="label-upper text-[10px] text-[var(--text-muted)]">Patreon account linked</span>
              </div>
            ) : (
              <>
                <p className="text-xs text-[var(--text-muted)] mb-3">
                  Already a Patreon supporter? Connect your account to unlock subscriber content.
                </p>
                <a
                  href="/api/auth/signin/patreon"
                  className="label-upper px-4 py-2 border border-[var(--border-strong)] text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors text-[10px] inline-block"
                >
                  🔗 Connect Patreon
                </a>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)] mb-8">
        {(["overview", "messages", "edit"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`label-upper px-5 py-3 transition-colors capitalize flex items-center gap-2 ${
              activeTab === tab
                ? "border-b-2 border-[var(--border-strong)] text-[var(--foreground)] -mb-px"
                : "text-[var(--text-muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {tab === "overview" ? "Achievements" : tab === "messages" ? "Messages" : "Edit Profile"}
            {tab === "messages" && unreadCount > 0 && (
              <span className="label-upper text-[9px] bg-[var(--foreground)] text-[var(--background)] px-1.5 py-0.5 rounded-sm">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Overview — task checklist */}
      {activeTab === "overview" && (
        <div className="animate-in fade-in duration-300">
          <div className="flex items-baseline justify-between mb-4">
            <p
              className="text-lg font-black text-[var(--foreground)]"
              style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
            >
              Quests
            </p>
            <span className="label-upper text-[var(--text-muted)] text-[10px]">
              {completedCount}/{totalCount} complete
            </span>
          </div>

          <div className="border border-[var(--border)] px-4">
            {TASK_CATALOGUE.map((task, i) => {
              const userTask = user.tasks.find((t) => t.id === task.id);
              return (
                <TaskRow
                  key={task.id}
                  task={task}
                  completedAt={userTask?.completedAt ?? null}
                  index={i}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Messages inbox */}
      {activeTab === "messages" && (
        <div className="animate-in fade-in duration-300">
          <div className="flex items-baseline justify-between mb-4">
            <p
              className="text-lg font-black text-[var(--foreground)]"
              style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
            >
              Messages
            </p>
            {unreadCount > 0 && (
              <span className="label-upper text-[10px] text-[var(--text-muted)]">
                {unreadCount} unread
              </span>
            )}
          </div>
          <InboxPanel userId={user.id} />
        </div>
      )}

      {/* Edit profile */}
      {activeTab === "edit" && (
        <form onSubmit={handleSave} className="flex flex-col gap-5 animate-in fade-in duration-300">
          <div className="grid grid-cols-2 gap-4">
            <AuthField
              label="First Name"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              index={0}
            />
            <AuthField
              label="Last Name"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              index={1}
            />
          </div>
          <AuthField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            index={2}
            hint="Used for future password recovery."
          />

          {/* Region */}
          <div className="flex flex-col gap-1.5">
            <label className="label-upper text-[10px] text-[var(--text-muted)]">
              Your Region
            </label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-2.5 text-sm focus:border-[var(--border-strong)] outline-none"
            >
              <option value="">— Not specified —</option>
              {SUPPORTED_REGIONS.map((r) => (
                <option key={r.code} value={r.code}>{r.name} ({r.code})</option>
              ))}
            </select>
            <p className="text-[10px] text-[var(--text-muted)]">
              Used to tailor AI coaching advice, pricing references, and marketplace insights.
            </p>
          </div>

          {/* City / suburb for local pickup */}
          <div className="flex flex-col gap-1.5">
            <label className="label-upper text-[10px] text-[var(--text-muted)]">
              City / Suburb <span className="opacity-50">(optional)</span>
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Singapore, Melbourne CBD, Tokyo"
              maxLength={100}
              className="border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-2.5 text-sm focus:border-[var(--border-strong)] outline-none"
            />
            <p className="text-[10px] text-[var(--text-muted)]">
              Shown on listings where you offer local pickup or meetup.
            </p>
          </div>

          {/* Additional regions (store accounts only) */}
          {user?.role === "store" && (
            <div className="flex flex-col gap-1.5">
              <label className="label-upper text-[10px] text-[var(--text-muted)]">
                Additional Regions (Store)
              </label>
              <p className="text-[10px] text-[var(--text-muted)] mb-1">
                Select all regions your store ships to, or &ldquo;Global&rdquo; for worldwide.
              </p>
              <div className="flex flex-wrap gap-2">
                {[{ code: "GLOBAL", name: "Global (worldwide / online)" }, ...SUPPORTED_REGIONS].map((r) => {
                  const checked = additionalRegions.includes(r.code);
                  return (
                    <label key={r.code} className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 border cursor-pointer transition-colors ${
                      checked
                        ? "border-[var(--border-strong)] bg-[var(--foreground)] text-[var(--background)]"
                        : "border-[var(--border)] text-[var(--foreground)] hover:border-[var(--border-strong)]"
                    }`}>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() => {
                          setAdditionalRegions((prev) =>
                            checked ? prev.filter((c) => c !== r.code) : [...prev, r.code]
                          );
                        }}
                      />
                      {r.code === "GLOBAL" ? "🌐" : ""} {r.name}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="border-t border-[var(--border)] pt-5 mt-1">
            <p className="label-upper text-[var(--text-muted)] mb-4 text-[10px]">Change Password (optional)</p>
            <div className="flex flex-col gap-4">
              <AuthField
                label="Current Password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                index={3}
              />
              <AuthField
                label="New Password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="••••••••"
                index={4}
                hint="Leave blank to keep current password."
              />
              <AuthField
                label="Confirm New Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="••••••••"
                index={5}
              />
            </div>
          </div>

          {saveError && (
            <p className="text-sm text-red-500 animate-in fade-in duration-200">{saveError}</p>
          )}
          {saveSuccess && (
            <p className="text-sm text-green-600 animate-in fade-in duration-200">✓ Profile updated.</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="label-upper py-4 bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 transition-opacity disabled:opacity-30"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Saving…
              </span>
            ) : (
              "Save Changes →"
            )}
          </button>
        </form>
      )}
    </div>
  );
}
