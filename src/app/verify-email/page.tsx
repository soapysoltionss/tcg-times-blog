"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import AuthCard from "@/components/AuthCard";

function VerifyEmailForm() {
  const params = useSearchParams();
  const email = params.get("email") ?? "";

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first input
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  function handleDigit(index: number, value: string) {
    // Allow pasting the full code into the first box
    if (value.length > 1) {
      const digits = value.replace(/\D/g, "").slice(0, 6).split("");
      const next = [...code];
      digits.forEach((d, i) => { if (i < 6) next[i] = d; });
      setCode(next);
      inputRefs.current[Math.min(digits.length, 5)]?.focus();
      return;
    }
    const digit = value.replace(/\D/g, "");
    const next = [...code];
    next[index] = digit;
    setCode(next);
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  const fullCode = code.join("");
  const isComplete = fullCode.length === 6;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isComplete) return;
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code: fullCode }),
    });

    if (res.ok) {
      window.location.href = "/profile";
    } else {
      const data = await res.json();
      setError(data.error ?? "Something went wrong.");
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setResent(false);
    setError("");
    const res = await fetch("/api/auth/verify-email", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setResending(false);
    if (res.ok) {
      setResent(true);
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to resend.");
    }
  }

  return (
    <AuthCard
      title="Check your email"
      subtitle={
        email
          ? `We sent a 6-digit code to ${email}`
          : "Enter the 6-digit code we sent to your email."
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* 6-digit code input */}
        <div className="flex gap-2 justify-center">
          {code.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={digit}
              onChange={(e) => handleDigit(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="w-11 h-14 text-center text-xl font-bold border border-[var(--border)] bg-transparent focus:outline-none focus:border-[var(--foreground)] transition-colors caret-transparent"
              style={{ fontVariantNumeric: "tabular-nums" }}
              aria-label={`Digit ${i + 1}`}
            />
          ))}
        </div>

        {error && (
          <p className="text-sm text-red-500 text-center animate-in fade-in duration-200">
            {error}
          </p>
        )}

        {resent && (
          <p className="text-sm text-green-600 text-center animate-in fade-in duration-200">
            ✓ New code sent — check your inbox.
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !isComplete}
          className="label-upper py-4 bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 transition-opacity disabled:opacity-30"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Verifying…
            </span>
          ) : (
            "Verify Email →"
          )}
        </button>
      </form>

      {/* Resend link */}
      <p className="text-sm text-[var(--text-muted)] text-center mt-2">
        Didn&apos;t get it?{" "}
        <button
          type="button"
          onClick={handleResend}
          disabled={resending || !email}
          className="text-[var(--foreground)] font-semibold hover:opacity-60 transition-opacity disabled:opacity-30"
        >
          {resending ? "Sending…" : "Resend code"}
        </button>
      </p>
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailForm />
    </Suspense>
  );
}
