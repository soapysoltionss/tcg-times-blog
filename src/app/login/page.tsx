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
