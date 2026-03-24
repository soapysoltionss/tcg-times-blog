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
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [oauthProviders, setOauthProviders] = useState<{ google: boolean; patreon: boolean } | null>(null);
  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/auth/oauth-providers")
      .then((r) => r.json())
      .then(setOauthProviders)
      .catch(() => setOauthProviders({ google: false, patreon: false }));
  }, []);

  const showOAuth = oauthProviders && (oauthProviders.google || oauthProviders.patreon);

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
    if (!form.email.trim()) e.email = "Required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email.";
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
      const data = await res.json();
      window.location.href = `/verify-email?email=${encodeURIComponent(data.email)}`;
    } else {
      const data = await res.json();
      setGlobalError(data.error ?? "Something went wrong.");
      setLoading(false);
    }
  }

  async function handleOAuth(provider: "google" | "patreon") {
    setOauthLoading(provider);
    try {
      const csrfRes = await fetch("/api/auth/csrf");
      const { csrfToken } = await csrfRes.json();
      const form = document.createElement("form");
      form.method = "POST";
      form.action = `/api/auth/signin/${provider}`;
      const csrfInput = document.createElement("input");
      csrfInput.type = "hidden";
      csrfInput.name = "csrfToken";
      csrfInput.value = csrfToken;
      form.appendChild(csrfInput);
      const callbackInput = document.createElement("input");
      callbackInput.type = "hidden";
      callbackInput.name = "callbackUrl";
      callbackInput.value = "/profile";
      form.appendChild(callbackInput);
      document.body.appendChild(form);
      form.submit();
    } catch {
      setOauthLoading(null);
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
      {/* OAuth buttons — only shown when provider credentials are configured */}
      {showOAuth && (
        <>
          <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {oauthProviders?.google && (
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
            )}

            {oauthProviders?.patreon && (
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
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 border-t border-[var(--border)]" />
            <span className="text-xs text-[var(--text-muted)] label-upper">or register with email</span>
            <div className="flex-1 border-t border-[var(--border)]" />
          </div>
        </>
      )}

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

        {/* Email (required) */}
        <AuthField
          label="Email"
          type="email"
          value={form.email}
          onChange={set("email")}
          placeholder="you@example.com"
          autoComplete="email"
          required
          index={3}
          error={errors.email}
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
