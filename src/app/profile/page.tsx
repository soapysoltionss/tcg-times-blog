"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AuthField from "@/components/AuthField";
import { TASK_CATALOGUE, xpToLevel } from "@/lib/xp";
import type { User, TaskDefinition } from "@/lib/xp";

type SafeUser = Omit<User, "passwordHash">;

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

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<SafeUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "edit">("overview");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(({ user }) => {
        if (!user) {
          router.push("/login");
          return;
        }
        setUser(user);
        setFirstName(user.firstName);
        setLastName(user.lastName);
        setEmail(user.email ?? "");
      })
      .finally(() => setLoading(false));
  }, [router]);

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

    const body: Record<string, string> = { firstName, lastName, email };
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

      {/* Subscription status card */}
      {user.subscription ? (
        <div className="border border-[var(--border)] p-5 mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="label-upper text-[var(--text-muted)] mb-1">Patreon Subscription</p>
            <p className="font-bold text-[var(--foreground)]">{user.subscription.tierName}</p>
            {user.subscription.currentPeriodEnd && (
              <p className="label-upper text-[var(--text-muted)] text-[10px] mt-1">
                Next charge:{" "}
                {new Date(user.subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            )}
          </div>
          <span
            className={`label-upper px-2 py-1 text-[10px] border ${
              user.subscription.status === "active"
                ? "border-[var(--border-strong)] text-[var(--foreground)]"
                : user.subscription.status === "declined"
                ? "border-[var(--border)] text-[var(--text-muted)]"
                : "border-[var(--border)] text-[var(--text-muted)] line-through"
            }`}
          >
            {user.subscription.status}
          </span>
        </div>
      ) : (
        <div className="border border-[var(--border)] p-5 mb-8 flex items-center justify-between gap-4">
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
      )}

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)] mb-8">
        {(["overview", "edit"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`label-upper px-5 py-3 transition-colors capitalize ${
              activeTab === tab
                ? "border-b-2 border-[var(--border-strong)] text-[var(--foreground)] -mb-px"
                : "text-[var(--text-muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {tab === "overview" ? "Achievements" : "Edit Profile"}
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
