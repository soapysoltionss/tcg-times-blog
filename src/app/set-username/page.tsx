"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AuthCard from "@/components/AuthCard";
import AuthField from "@/components/AuthField";

export default function SetUsernamePage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "taken" | "ok" | "invalid">("idle");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  // Load the current user so we can show their Google avatar + name
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(({ user }) => {
        if (!user) { router.replace("/login"); return; }
        // If they already have a username, skip this page
        if (!user.needsUsername) { router.replace("/profile"); return; }
        setAvatarUrl(user.avatarUrl ?? null);
        setDisplayName(user.firstName ?? null);
      });
  }, [router]);

  // Live availability check
  useEffect(() => {
    if (!username) { setStatus("idle"); return; }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) { setStatus("invalid"); return; }

    setStatus("checking");
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(username)}`);
      const data = await res.json();
      setStatus(data.available ? "ok" : "taken");
    }, 400);
    return () => clearTimeout(timer);
  }, [username]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status !== "ok") return;
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/set-username", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });

    if (res.ok) {
      // Full navigation so UserMenu re-mounts and fetches the updated session
      window.location.href = "/profile";
    } else {
      const data = await res.json();
      setError(data.error ?? "Something went wrong.");
      setLoading(false);
    }
  }

  const hint =
    status === "checking" ? "Checking…" :
    status === "taken"    ? "Username taken." :
    status === "invalid"  ? "3–20 chars, letters, numbers and underscores only." :
    status === "ok"       ? "Available ✓" :
    "";

  const hintColor =
    status === "ok"                   ? "text-green-600 dark:text-green-400" :
    status === "taken" || status === "invalid" ? "text-red-500" :
    "text-[var(--text-muted)]";

  return (
    <AuthCard
      title="Choose your username"
      subtitle={
        displayName
          ? `Welcome, ${displayName}! Pick a username for your TCG Times account.`
          : "Pick a username for your TCG Times account."
      }
    >
      {/* Google avatar preview */}
      {avatarUrl && (
        <div className="flex justify-center mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarUrl}
            alt="Your Google avatar"
            referrerPolicy="no-referrer"
            className="w-16 h-16 rounded-full border-2 border-[var(--border-strong)]"
          />
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <AuthField
            label="Username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. card_shark42"
            autoFocus
            autoComplete="off"
          />
          {hint && (
            <p className={`text-[11px] mt-1.5 ${hintColor}`}>{hint}</p>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || status !== "ok"}
          className="w-full py-3 px-4 bg-[var(--foreground)] text-[var(--background)] label-upper text-xs font-bold tracking-widest hover:opacity-80 transition-opacity disabled:opacity-40"
        >
          {loading ? "Saving…" : "Set Username →"}
        </button>
      </form>
    </AuthCard>
  );
}
