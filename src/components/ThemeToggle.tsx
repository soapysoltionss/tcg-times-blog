"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <span className="w-8 h-8 inline-block" />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="label-upper text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors px-2 py-1 border border-[var(--border)] hover:border-[var(--foreground)]"
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? "☀ Light" : "☾ Dark"}
    </button>
  );
}
