"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { FabCardResult } from "@/app/api/fab-cards/route";
import type { GaCardResult } from "@/app/api/ga-cards/route";
import type { OpCardResult } from "@/app/api/op-cards/route";
import type { PokemonCardResult } from "@/app/api/pokemon-cards/route";

/** Normalised card shape shared by all game endpoints */
export type AnyCardResult = FabCardResult | GaCardResult | OpCardResult | PokemonCardResult;

type SupportedGame = "flesh-and-blood" | "grand-archive" | "one-piece" | "pokemon";

const ENDPOINT: Record<SupportedGame, string> = {
  "flesh-and-blood": "/api/fab-cards",
  "grand-archive": "/api/ga-cards",
  "one-piece": "/api/op-cards",
  "pokemon": "/api/pokemon-cards",
};

const PLACEHOLDER: Record<SupportedGame, string> = {
  "flesh-and-blood": "e.g. Iyslander, Stormbind",
  "grand-archive": "e.g. Merlin, Nameless Champion",
  "one-piece": "e.g. Monkey.D.Luffy, Nami",
  "pokemon": "e.g. Charizard, Pikachu",
};

type Props = {
  /** Which game's card database to search */
  game?: SupportedGame;
  value: string;
  onChange: (value: string) => void;
  onSelect: (card: AnyCardResult) => void;
  placeholder?: string;
  disabled?: boolean;
};

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function CardAutocomplete({
  game = "flesh-and-blood",
  value,
  onChange,
  onSelect,
  placeholder,
  disabled,
}: Props) {
  const [results, setResults] = useState<AnyCardResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(value, 300);
  const abortRef = useRef<AbortController | null>(null);

  // Reset results when game changes
  useEffect(() => {
    setResults([]);
    setOpen(false);
  }, [game]);

  // Fetch suggestions whenever the debounced query changes
  const fetchSuggestions = useCallback(async (q: string) => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const endpoint = ENDPOINT[game] ?? ENDPOINT["flesh-and-blood"];
      const res = await fetch(`${endpoint}?q=${encodeURIComponent(q)}`, { signal: controller.signal });
      const data = await res.json();
      setResults(data.cards ?? []);
      setOpen((data.cards ?? []).length > 0);
      setActiveIdx(-1);
    } catch (err) {
      // Ignore aborted requests — don't wipe results
      if ((err as { name?: string }).name !== "AbortError") setResults([]);
    } finally {
      setLoading(false);
    }
  }, [game]);

  useEffect(() => {
    fetchSuggestions(debouncedQuery);
  }, [debouncedQuery, fetchSuggestions]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelect(card: AnyCardResult) {
    // Kill any pending fetch so it can't re-open the dropdown
    abortRef.current?.abort();
    abortRef.current = null;
    onSelect(card);
    setOpen(false);
    setResults([]);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      handleSelect(results[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          disabled={disabled}
          placeholder={placeholder ?? PLACEHOLDER[game] ?? "Search cards…"}
          autoComplete="off"
          className="w-full border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--border-strong)] outline-none pr-8"
        />
        {/* Spinner / search icon */}
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
          {loading ? (
            <span className="w-3.5 h-3.5 border-2 border-[var(--border)] border-t-[var(--foreground)] rounded-full animate-spin block" />
          ) : (
            <svg className="w-3.5 h-3.5 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
            </svg>
          )}
        </div>
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-0.5 border border-[var(--border-strong)] bg-[var(--background)] shadow-lg max-h-72 overflow-y-auto">
          {results.map((card, idx) => (
            <li key={card.identifier}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleSelect(card); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                  idx === activeIdx
                    ? "bg-[var(--muted)]"
                    : "hover:bg-[var(--muted)]"
                }`}
              >
                {/* Thumbnail */}
                <div className="w-8 h-11 shrink-0 bg-[var(--muted)] border border-[var(--border)] overflow-hidden">
                  {card.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={card.imageUrl}
                      alt={card.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-[8px] text-[var(--text-muted)]">?</span>
                    </div>
                  )}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--foreground)] truncate">{card.name}</p>
                  <p className="label-upper text-[10px] text-[var(--text-muted)] truncate">{card.setName}</p>
                </div>

                {/* Price hint */}
                {card.marketPriceCents !== null && (
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="label-upper text-[10px] text-[var(--text-muted)]">
                      ~${(card.marketPriceCents / 100).toFixed(2)}
                    </span>
                    {card.priceChangePct !== null && card.priceChangePct !== 0 && (
                      <span
                        className={`text-[10px] font-bold tabular-nums leading-none ${
                          card.priceChangePct > 0
                            ? "text-emerald-500 dark:text-emerald-400"
                            : "text-red-500 dark:text-red-400"
                        }`}
                      >
                        {card.priceChangePct > 0 ? "▲" : "▼"}
                        {Math.abs(card.priceChangePct).toFixed(1)}%
                      </span>
                    )}
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* No results */}
      {open && !loading && results.length === 0 && value.length >= 2 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-0.5 border border-[var(--border)] bg-[var(--background)] px-3 py-2.5">
          <p className="label-upper text-[10px] text-[var(--text-muted)]">No cards found — type the name manually</p>
        </div>
      )}
    </div>
  );
}
