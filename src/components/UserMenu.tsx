"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { xpToLevel } from "@/lib/xp";

type SessionUser = {
  username: string;
  firstName: string;
  xp: number;
};

export default function UserMenu() {
  const [user, setUser] = useState<SessionUser | null | "loading">("loading");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
        <div className="w-6 h-6 rounded-full bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center text-[10px] font-bold shrink-0">
          {user.firstName.charAt(0).toUpperCase()}
        </div>
        <span className="label-upper text-[var(--foreground)] hidden sm:inline">
          @{user.username}
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
