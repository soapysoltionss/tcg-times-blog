"use client";

import { useState } from "react";

export default function ComingSoonPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError("");

    const res = await fetch("/api/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      // Hard navigation so the proxy re-reads the new cookie server-side
      window.location.href = "/";
    } else {
      setError("Incorrect password.");
      setLoading(false);
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
      <form onSubmit={handleSubmit} className="w-full max-w-xs flex flex-col gap-3">
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
            disabled={!password.trim() || loading}
            className="label-upper px-5 py-3 bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 transition-opacity disabled:opacity-30"
          >
            {loading ? "…" : "Enter"}
          </button>
        </div>
        {error && (
          <p className="label-upper text-center text-[var(--text-muted)]">{error}</p>
        )}
      </form>
    </div>
  );
}
