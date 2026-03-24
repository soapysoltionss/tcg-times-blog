"use client";

import { useState } from "react";
import Link from "next/link";
import AuthCard from "@/components/AuthCard";
import AuthField from "@/components/AuthField";

type Step = "username" | "reset" | "done";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("username");
  const [username, setUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (step === "username") {
      // Just move to next step — we don't leak whether username exists here
      setStep("reset");
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, newPassword, confirmPassword }),
    });

    if (res.ok) {
      setStep("done");
    } else {
      const data = await res.json();
      setError(data.error ?? "Something went wrong.");
    }
    setLoading(false);
  }

  if (step === "done") {
    return (
      <AuthCard
        title="Password reset"
        footer={
          <Link href="/login" className="text-[var(--foreground)] font-semibold hover:opacity-60 transition-opacity">
            Back to sign in
          </Link>
        }
      >
        <div className="flex flex-col items-center gap-4 py-4 animate-in fade-in duration-500">
          <span className="text-4xl">✓</span>
          <p className="text-sm text-[var(--text-muted)] text-center leading-relaxed">
            If that username exists, its password has been updated.
            <br />You can now sign in with your new password.
          </p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset password"
      subtitle={step === "username" ? "Enter your username to continue." : `Setting a new password for @${username}`}
      footer={
        <Link href="/login" className="text-[var(--foreground)] font-semibold hover:opacity-60 transition-opacity">
          ← Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {step === "username" && (
          <AuthField
            label="Username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="your_username"
            autoComplete="username"
            required
            index={0}
          />
        )}

        {step === "reset" && (
          <>
            <AuthField
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
              index={0}
              hint="At least 8 characters."
            />
            <AuthField
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
              index={1}
            />
          </>
        )}

        {error && (
          <p className="text-sm text-red-500 animate-in fade-in duration-200">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !username.trim()}
          className="label-upper py-4 bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 transition-opacity disabled:opacity-30 mt-1"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              {step === "username" ? "Continuing…" : "Resetting…"}
            </span>
          ) : (
            step === "username" ? "Continue →" : "Set New Password →"
          )}
        </button>
      </form>
    </AuthCard>
  );
}
