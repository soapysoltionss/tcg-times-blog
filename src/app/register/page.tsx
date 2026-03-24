"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import AuthCard from "@/components/AuthCard";
import AuthField from "@/components/AuthField";

type FieldErrors = Partial<Record<string, string>>;

export default function RegisterPage() {
  const [form, setForm] = useState({
    username: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "taken" | "available">("idle");
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState("");
  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
      setErrors((err) => ({ ...err, [field]: undefined }));
    };
  }

  // Debounced username check
  useEffect(() => {
    const u = form.username.trim();
    if (!u || !/^[a-zA-Z0-9_]{3,20}$/.test(u)) {
      setUsernameStatus("idle");
      return;
    }
    setUsernameStatus("checking");
    if (usernameTimer.current) clearTimeout(usernameTimer.current);
    usernameTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(u)}`);
      const data = await res.json();
      setUsernameStatus(data.taken ? "taken" : "available");
    }, 400);
    return () => { if (usernameTimer.current) clearTimeout(usernameTimer.current); };
  }, [form.username]);

  function validate(): boolean {
    const e: FieldErrors = {};
    if (!form.username.trim()) e.username = "Required.";
    else if (!/^[a-zA-Z0-9_]{3,20}$/.test(form.username))
      e.username = "3–20 characters: letters, numbers, underscores.";
    if (usernameStatus === "taken") e.username = "That username is already taken.";
    if (!form.firstName.trim()) e.firstName = "Required.";
    if (!form.lastName.trim()) e.lastName = "Required.";
    if (!form.password) e.password = "Required.";
    else if (form.password.length < 8) e.password = "At least 8 characters.";
    if (form.password !== form.confirmPassword) e.confirmPassword = "Passwords do not match.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setGlobalError("");

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      window.location.href = "/profile";
    } else {
      const data = await res.json();
      setGlobalError(data.error ?? "Something went wrong.");
      setLoading(false);
    }
  }

  const usernameHint =
    usernameStatus === "checking" ? "Checking…" :
    usernameStatus === "taken" ? undefined :
    usernameStatus === "available" ? "✓ Available" : undefined;

  const usernameError =
    errors.username ?? (usernameStatus === "taken" ? "That username is already taken." : undefined);

  return (
    <AuthCard
      title="Create account"
      subtitle="Join TCG Times — it's free."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--foreground)] font-semibold hover:opacity-60 transition-opacity">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Username */}
        <AuthField
          label="Username"
          type="text"
          value={form.username}
          onChange={set("username")}
          placeholder="cool_duelist"
          autoComplete="username"
          required
          index={0}
          error={usernameError}
          hint={usernameHint}
        />

        {/* Name row */}
        <div className="grid grid-cols-2 gap-3">
          <AuthField
            label="First Name"
            type="text"
            value={form.firstName}
            onChange={set("firstName")}
            placeholder="Alex"
            autoComplete="given-name"
            required
            index={1}
            error={errors.firstName}
          />
          <AuthField
            label="Last Name"
            type="text"
            value={form.lastName}
            onChange={set("lastName")}
            placeholder="Smith"
            autoComplete="family-name"
            required
            index={2}
            error={errors.lastName}
          />
        </div>

        {/* Email (optional) */}
        <AuthField
          label="Email (optional)"
          type="email"
          value={form.email}
          onChange={set("email")}
          placeholder="you@example.com"
          autoComplete="email"
          index={3}
          hint="Used for future password recovery."
        />

        <div className="w-full h-px bg-[var(--border)] my-1" />

        {/* Password */}
        <AuthField
          label="Password"
          type="password"
          value={form.password}
          onChange={set("password")}
          placeholder="••••••••"
          autoComplete="new-password"
          required
          index={4}
          error={errors.password}
          hint={!errors.password ? "At least 8 characters." : undefined}
        />
        <AuthField
          label="Confirm Password"
          type="password"
          value={form.confirmPassword}
          onChange={set("confirmPassword")}
          placeholder="••••••••"
          autoComplete="new-password"
          required
          index={5}
          error={errors.confirmPassword}
        />

        {globalError && (
          <p className="text-sm text-red-500 animate-in fade-in duration-200">{globalError}</p>
        )}

        <button
          type="submit"
          disabled={loading || usernameStatus === "taken" || usernameStatus === "checking"}
          className="label-upper py-4 bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 transition-opacity disabled:opacity-30 mt-1 animate-in fade-in slide-in-from-bottom-2 duration-400"
          style={{ animationDelay: "450ms", animationFillMode: "both" }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Creating account…
            </span>
          ) : (
            "Create Account →"
          )}
        </button>
      </form>
    </AuthCard>
  );
}
