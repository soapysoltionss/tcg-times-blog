"use client";

import { useState, useEffect } from "react";

const LS_KEY = "tcgt_interest_submitted";

export default function ComingSoonPage() {
  const [password, setPassword] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [unlockLoading, setUnlockLoading] = useState(false);

  const [interestEmail, setInterestEmail] = useState("");
  const [interestState, setInterestState] = useState<"idle" | "loading" | "done" | "already" | "error">("idle");
  const [interestError, setInterestError] = useState("");

  // Restore persisted "already submitted" state on mount
  useEffect(() => {
    try {
      if (localStorage.getItem(LS_KEY)) setInterestState("done");
    } catch { /* localStorage may be blocked */ }
  }, []);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setUnlockLoading(true);
    setUnlockError("");

    const res = await fetch("/api/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      window.location.href = "/";
    } else {
      setUnlockError("Incorrect password.");
      setUnlockLoading(false);
    }
  }

  async function handleInterest(e: React.FormEvent) {
    e.preventDefault();
    // Prevent double-submit
    if (interestState === "loading" || interestState === "done" || interestState === "already") return;
    if (!interestEmail.trim()) return;

    setInterestState("loading");
    setInterestError("");

    try {
      const res = await fetch("/api/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: interestEmail.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        const nextState = data.alreadyRegistered ? "already" : "done";
        setInterestState(nextState);
        // Persist so re-opening the page keeps the button locked
        try { localStorage.setItem(LS_KEY, "1"); } catch { /* blocked */ }
      } else if (res.status === 429) {
        setInterestError("Too many requests — please wait a moment and try again.");
        setInterestState("error");
      } else {
        const data = await res.json().catch(() => ({}));
        setInterestError((data as { error?: string }).error ?? "Something went wrong. Please try again.");
        setInterestState("error");
      }
    } catch {
      setInterestError("Network error — please check your connection.");
      setInterestState("error");
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[var(--background)]">
      {/* Masthead */}
      <div className="text-center mb-14">
        <p className="label-upper text-[var(--text-muted)] mb-5 tracking-widest">
          tcgtimes.blog
        </p>
        <h1
          className="text-6xl md:text-8xl font-black text-[var(--foreground)] leading-none tracking-tight mb-6"
          style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
        >
          TCG Times
        </h1>
        <div className="w-16 h-px bg-[var(--border-strong)] mx-auto mb-6" />
        <p className="text-[var(--text-muted)] max-w-xs mx-auto leading-relaxed text-sm">
          Theory, strategy &amp; stories from the card table.
          <br />
          Launching soon.
        </p>
      </div>

      {/* Password form */}
      <form onSubmit={handleUnlock} className="w-full max-w-xs flex flex-col gap-3">
        <div className="border border-[var(--border)] flex">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Preview password"
            autoComplete="current-password"
            className="flex-1 px-4 py-3 bg-transparent text-[var(--foreground)] placeholder:text-[var(--text-muted)] text-sm focus:outline-none"
          />
          <button
            type="submit"
            disabled={!password.trim() || unlockLoading}
            className="label-upper px-5 py-3 bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 transition-opacity disabled:opacity-30"
          >
            {unlockLoading ? "…" : "Enter"}
          </button>
        </div>
        {unlockError && (
          <p className="label-upper text-center text-[var(--text-muted)]">{unlockError}</p>
        )}
      </form>

      {/* Divider */}
      <div className="w-full max-w-xs flex items-center gap-4 my-8">
        <div className="flex-1 h-px bg-[var(--border)]" />
        <span className="label-upper text-[var(--text-muted)] text-[10px]">or</span>
        <div className="flex-1 h-px bg-[var(--border)]" />
      </div>

      {/* Interest / notify-me form */}
      <div className="w-full max-w-xs flex flex-col gap-3">
        <p className="text-center text-sm text-[var(--text-muted)] leading-relaxed">
          No password? Leave your email and we&rsquo;ll notify you when we launch.
        </p>

        {interestState === "done" ? (
          <p className="label-upper text-center text-[var(--foreground)] py-3">
            ✓ You&rsquo;re on the list — we&rsquo;ll be in touch!
          </p>
        ) : interestState === "already" ? (
          <p className="label-upper text-center text-[var(--text-muted)] py-3">
            You&rsquo;re already signed up — we&rsquo;ll let you know!
          </p>
        ) : (
          <form onSubmit={handleInterest} className="flex flex-col gap-3">
            <div className="border border-[var(--border)] flex">
              <input
                type="email"
                value={interestEmail}
                onChange={(e) => setInterestEmail(e.target.value)}
                placeholder="your@email.com"
                autoComplete="email"
                className="flex-1 px-4 py-3 bg-transparent text-[var(--foreground)] placeholder:text-[var(--text-muted)] text-sm focus:outline-none"
              />
              <button
                type="submit"
                disabled={!interestEmail.trim() || interestState === "loading"}
                className="label-upper px-5 py-3 bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 transition-opacity disabled:opacity-30"
              >
                {interestState === "loading" ? "…" : "Notify me"}
              </button>
            </div>
            {interestState === "error" && (
              <p className="label-upper text-center text-[var(--text-muted)]">{interestError}</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

