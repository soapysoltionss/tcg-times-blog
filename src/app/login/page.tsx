"use client";

import { useState } from "react";
import Link from "next/link";
import AuthCard from "@/components/AuthCard";
import AuthField from "@/components/AuthField";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (res.ok) {
      window.location.href = "/profile";
    } else {
      const data = await res.json();
      setError(data.error ?? "Something went wrong.");
      setLoading(false);
    }
  }

  async function handleOAuth(provider: "google" | "patreon") {
    setOauthLoading(provider);
    window.location.href = `/api/auth/signin/${provider}?callbackUrl=/profile`;
  }

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to your TCG Times account."
      footer={
        <>
          No account?{" "}
          <Link href="/register" className="text-[var(--foreground)] font-semibold hover:opacity-60 transition-opacity">
            Register
          </Link>
        </>
      }
    >
      {/* OAuth buttons */}
      <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <button
          type="button"
          onClick={() => handleOAuth("google")}
          disabled={!!oauthLoading || loading}
          className="flex items-center justify-center gap-3 w-full border border-[var(--border)] py-3 px-4 hover:border-[var(--border-strong)] hover:bg-[var(--muted)] transition-all disabled:opacity-40"
        >
          {oauthLoading === "google" ? (
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          <span className="text-sm font-medium">Continue with Google</span>
        </button>

        <button
          type="button"
          onClick={() => handleOAuth("patreon")}
          disabled={!!oauthLoading || loading}
          className="flex items-center justify-center gap-3 w-full border border-[var(--border)] py-3 px-4 hover:border-[var(--border-strong)] hover:bg-[var(--muted)] transition-all disabled:opacity-40"
        >
          {oauthLoading === "patreon" ? (
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <PatreonIcon />
          )}
          <span className="text-sm font-medium">Continue with Patreon</span>
        </button>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 my-1">
        <div className="flex-1 border-t border-[var(--border)]" />
        <span className="text-xs text-[var(--text-muted)] label-upper">or</span>
        <div className="flex-1 border-t border-[var(--border)]" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <AuthField
          label="Username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          placeholder="your_username"
          required
          index={0}
        />
        <AuthField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          placeholder="••••••••"
          required
          index={1}
          labelRight={
            <Link href="/forgot-password" className="hover:text-[var(--foreground)] transition-colors">
              Forgot password?
            </Link>
          }
        />

        {error && (
          <p className="text-sm text-red-500 animate-in fade-in duration-200 -mt-1">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !username.trim() || !password.trim()}
          className="label-upper py-4 bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 transition-opacity disabled:opacity-30 mt-1 animate-in fade-in slide-in-from-bottom-2 duration-400"
          style={{ animationDelay: "150ms", animationFillMode: "both" }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Signing in…
            </span>
          ) : (
            "Sign In →"
          )}
        </button>
      </form>
    </AuthCard>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  );
}

function PatreonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="11.5" cy="7" r="5.5" fill="#FF424D"/>
      <rect x="0" y="0" width="4" height="18" fill="#052d49"/>
    </svg>
  );
}

