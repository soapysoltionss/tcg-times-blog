"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { xpToLevel } from "@/lib/xp";
import { useCurrency, CURRENCIES } from "@/lib/currency";

type SessionUser = {
  username: string;
  firstName: string;
  xp: number;
  avatarUrl?: string;
  needsUsername?: boolean;
};

export default function UserMenu() {
  const [user, setUser] = useState<SessionUser | null | "loading">("loading");
  const [open, setOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { currency, setCurrencyCode } = useCurrency();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(({ user }) => setUser(user ?? null));
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  if (user === "loading") {
    return <div className="w-20 h-4 bg-[var(--muted)] rounded animate-pulse" />;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-3">
        <Link
          href="/login"
          className="label-upper text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
        >
          Sign In
        </Link>
        <Link
          href="/register"
          className="label-upper px-3 py-1.5 bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 transition-opacity text-[10px]"
        >
          Register
        </Link>
      </div>
    );
  }

  const { level, title } = xpToLevel(user.xp);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 hover:opacity-70 transition-opacity"
      >
        {/* Avatar circle */}
        <div className="w-6 h-6 rounded-full bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            user.firstName.charAt(0).toUpperCase()
          )}
        </div>
        <span className="label-upper text-[var(--foreground)] hidden sm:inline">
          Welcome, @{user.username}
        </span>
        <span className="label-upper text-[var(--text-muted)] text-[9px] hidden sm:inline">
          Lv.{level}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 border border-[var(--border)] bg-[var(--background)] shadow-lg z-50 animate-in fade-in slide-in-from-top-1 duration-150">
          {/* User info header */}
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <p className="text-sm font-semibold text-[var(--foreground)]">@{user.username}</p>
            <p className="label-upper text-[var(--text-muted)] text-[9px] mt-0.5">
              {title} · {user.xp} XP · Level {level}
            </p>
          </div>

          {/* XP mini-bar */}
          <div className="px-4 py-2 border-b border-[var(--border)]">
            {(() => {
              const { currentLevelXp, nextLevelXp } = xpToLevel(user.xp);
              const isMax = nextLevelXp === currentLevelXp;
              const pct = isMax ? 100 : Math.round(((user.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100);
              return (
                <div className="w-full h-1.5 bg-[var(--muted)]">
                  <div className="h-full bg-[var(--foreground)] transition-all" style={{ width: `${pct}%` }} />
                </div>
              );
            })()}
          </div>

          {/* Currency selector */}
          <div className="px-4 py-2 border-b border-[var(--border)]">
            <p className="label-upper text-[var(--text-muted)] text-[9px] mb-1.5">Currency</p>
            <div className="relative">
              <button
                onClick={() => setCurrencyOpen((o) => !o)}
                className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-sm border border-[var(--border)] bg-[var(--muted)] hover:bg-[var(--background)] transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <span>{currency.flag}</span>
                  <span className="font-medium text-[var(--foreground)]">{currency.code}</span>
                  <span className="text-[var(--text-muted)] text-xs">{currency.symbol}</span>
                </span>
                <span className="text-[var(--text-muted)] text-[10px]">▾</span>
              </button>

              {currencyOpen && (
                <div className="absolute left-0 top-full mt-1 w-full z-50 border border-[var(--border)] bg-[var(--background)] shadow-lg max-h-48 overflow-y-auto">
                  {CURRENCIES.map((c) => (
                    <button
                      key={c.code}
                      onClick={() => {
                        setCurrencyCode(c.code);
                        setCurrencyOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-[var(--muted)] ${
                        c.code === currency.code
                          ? "bg-[var(--foreground)] text-[var(--background)]"
                          : "text-[var(--foreground)]"
                      }`}
                    >
                      <span>{c.flag}</span>
                      <span className="font-medium">{c.code}</span>
                      <span className={`text-xs ml-auto ${c.code === currency.code ? "text-[var(--background)]" : "text-[var(--text-muted)]"}`}>
                        {c.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Links */}
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
          >
            <span>👤</span> My Profile
          </Link>
          <Link
            href="/subscribe"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
          >
            <span>⭐</span> Subscribe
          </Link>

          <div className="border-t border-[var(--border)]">
            <button
              onClick={logout}
              className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-muted)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              <span>→</span> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
