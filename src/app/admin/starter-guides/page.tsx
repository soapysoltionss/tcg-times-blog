"use client";

import { useState } from "react";

const GAMES = [
  { key: "flesh-and-blood", label: "Flesh and Blood", emoji: "🩸" },
  { key: "grand-archive",   label: "Grand Archive",   emoji: "⚔️" },
  { key: "one-piece-tcg",   label: "One Piece TCG",   emoji: "🏴‍☠️" },
];

type Status = "idle" | "loading" | "done" | "error";

export default function AdminStarterGuidesPage() {
  const [statuses, setStatuses] = useState<Record<string, Status>>(
    Object.fromEntries(GAMES.map((g) => [g.key, "idle"]))
  );
  const [results, setResults] = useState<Record<string, string>>({});

  async function regenerate(game: string) {
    setStatuses((s) => ({ ...s, [game]: "loading" }));
    setResults((r) => ({ ...r, [game]: "" }));
    try {
      const res = await fetch(`/api/starter-guide/${game}/regenerate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setStatuses((s) => ({ ...s, [game]: "error" }));
        setResults((r) => ({ ...r, [game]: data.error ?? "Unknown error" }));
      } else {
        setStatuses((s) => ({ ...s, [game]: "done" }));
        setResults((r) => ({
          ...r,
          [game]: `✅ Generated — slug: ${data.slug} · ~${data.wordCount} words · ${data.generatedAt}`,
        }));
      }
    } catch (e) {
      setStatuses((s) => ({ ...s, [game]: "error" }));
      setResults((r) => ({ ...r, [game]: String(e) }));
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-14">
      <div className="border-b-2 border-[var(--border-strong)] pb-6 mb-10">
        <p className="label-upper text-[var(--text-muted)] mb-2">Admin</p>
        <h1
          className="text-4xl font-black text-[var(--foreground)]"
          style={{ fontFamily: "var(--font-serif, serif)" }}
        >
          Starter Guides
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-2">
          Regenerate AI-written starter guides. Each guide is published as a pinned "Start Here" post on its category page.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {GAMES.map((game) => {
          const status = statuses[game.key];
          const result = results[game.key];
          return (
            <div key={game.key} className="border border-[var(--border)] p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-[var(--foreground)]">
                    {game.emoji} {game.label}
                  </p>
                  <p className="label-upper text-[9px] text-[var(--text-muted)] mt-0.5">
                    /blog/{game.key}-starter-guide
                  </p>
                </div>
                <button
                  onClick={() => regenerate(game.key)}
                  disabled={status === "loading"}
                  className="label-upper text-[10px] px-4 py-2 bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 disabled:opacity-30 transition-opacity shrink-0"
                >
                  {status === "loading" ? "Generating…" : "Regenerate with AI"}
                </button>
              </div>
              {result && (
                <p className={`text-xs ${status === "error" ? "text-red-500" : "text-[var(--text-muted)]"}`}>
                  {result}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-10 text-xs text-[var(--text-muted)] border-t border-[var(--border)] pt-6">
        Regenerating replaces the current guide. The new version goes live instantly as a pinned post. Re-run after major set releases, banlists, or price shifts.
      </p>
    </div>
  );
}
