"use client";

/**
 * /tools/guess-pokemon
 *
 * Daily "Guess That Pokémon!" mini-game.
 * - Shows a black silhouette of today's Pokémon (sourced from PokeAPI sprites)
 * - User types a guess and submits
 * - Correct answer reveals the full-colour sprite and awards 50 XP
 * - Limited to 1 correct guess per UTC day
 * - Wrong guesses show a shake animation with a hint after 3 wrong attempts
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type DailyData = {
  pokemonId: number;
  pokemonName: string;
  date: string;
};

type GuessResult = {
  correct: boolean;
  pokemonName: string | null;
  xpAwarded: number;
  alreadyGuessed: boolean;
};

function capitalize(s: string) {
  return s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function spriteUrl(id: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}

export default function GuessPokemonPage() {
  const [daily, setDaily] = useState<DailyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [guess, setGuess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<GuessResult | null>(null);
  const [wrongCount, setWrongCount] = useState(0);
  const [shake, setShake] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/pokemon-guess")
      .then((r) => r.json())
      .then((data: DailyData) => {
        setDaily(data);
        // Check localStorage for today's completed guess (client-side fast path)
        const storedDate = localStorage.getItem("pokemon_guess_date");
        const storedName = localStorage.getItem("pokemon_guess_name");
        if (storedDate === data.date && storedName) {
          setRevealed(true);
          setResult({
            correct: true,
            pokemonName: storedName,
            xpAwarded: 0,
            alreadyGuessed: true,
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guess.trim() || submitting || !daily || revealed) return;
    setSubmitting(true);

    const res = await fetch("/api/pokemon-guess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guess }),
    });
    const data: GuessResult = await res.json();
    setSubmitting(false);

    if (data.correct) {
      setResult(data);
      setRevealed(true);
      setGuess("");
      // Persist to localStorage so page refresh shows the result without re-hitting the API
      if (daily && data.pokemonName) {
        localStorage.setItem("pokemon_guess_date", daily.date);
        localStorage.setItem("pokemon_guess_name", data.pokemonName);
      }
    } else {
      setWrongCount((n) => n + 1);
      setShake(true);
      setGuess("");
      setTimeout(() => setShake(false), 600);
      inputRef.current?.focus();
    }
  }

  // Compute next reset (midnight UTC)
  function nextResetMs(): number {
    const now = new Date();
    const midnight = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
    );
    return midnight.getTime() - now.getTime();
  }

  const [countdown, setCountdown] = useState("");
  useEffect(() => {
    if (!revealed) return;
    function tick() {
      const ms  = nextResetMs();
      const h   = Math.floor(ms / 3_600_000);
      const m   = Math.floor((ms % 3_600_000) / 60_000);
      const s   = Math.floor((ms % 60_000) / 1_000);
      setCountdown(`${h}h ${m}m ${s}s`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [revealed]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <span className="w-6 h-6 border-2 border-[var(--border)] border-t-[var(--foreground)] rounded-full animate-spin" />
      </div>
    );
  }

  if (!daily) {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center">
        <p className="text-[var(--text-muted)]">Failed to load today&apos;s Pokémon. Please try again later.</p>
      </div>
    );
  }

  const url = spriteUrl(daily.pokemonId);

  // Hint: show first letter after 3 wrong guesses
  const showHint = wrongCount >= 3 && !revealed;
  const hintText = showHint
    ? `Hint: starts with "${daily.pokemonName[0].toUpperCase()}"`
    : null;

  return (
    <div className="max-w-xl mx-auto px-6 py-14">
      {/* Breadcrumb */}
      <nav className="mb-8">
        <Link
          href="/"
          className="label-upper text-[10px] text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
        >
          ← Home
        </Link>
      </nav>

      {/* Header */}
      <div className="border-b-2 border-[var(--border-strong)] pb-6 mb-10 text-center">
        <p className="label-upper text-[var(--text-muted)] mb-2">Daily Mini-Game</p>
        <h1
          className="text-4xl font-black text-[var(--foreground)] leading-tight"
          style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
        >
          Guess That Pokémon!
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-2">
          One mystery Pokémon per day. Get it right and earn{" "}
          <span className="font-semibold text-[var(--foreground)]">50 XP</span>.
        </p>
      </div>

      {/* Sprite area */}
      <div className="flex flex-col items-center mb-10">
        <div className="relative w-52 h-52 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={revealed ? capitalize(daily.pokemonName) : "Mystery Pokémon silhouette"}
            width={208}
            height={208}
            className={`
              w-full h-full object-contain transition-all duration-700 select-none
              ${revealed
                ? "drop-shadow-[0_0_12px_rgba(250,204,21,0.4)]"
                : "brightness-0 dark:brightness-0 saturate-0 contrast-100"
              }
              ${shake ? "animate-shake" : ""}
            `}
            style={
              revealed
                ? {}
                : {
                    filter: "brightness(0) saturate(0)",
                    imageRendering: "pixelated",
                  }
            }
            draggable={false}
          />
        </div>

        {/* Who's that Pokémon label */}
        {!revealed && (
          <p
            className="text-2xl font-black text-[var(--foreground)] text-center"
            style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
          >
            Who&apos;s that Pokémon?
          </p>
        )}

        {/* Revealed name */}
        {revealed && result && (
          <div className="text-center animate-in fade-in slide-in-from-bottom-2 duration-500">
            <p
              className="text-3xl font-black text-[var(--foreground)]"
              style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
            >
              {capitalize(result.pokemonName ?? daily.pokemonName)}
            </p>
            {result.alreadyGuessed ? (
              <p className="text-sm text-[var(--text-muted)] mt-1">
                You already guessed today&apos;s Pokémon ✓
              </p>
            ) : (
              <div className="mt-3 flex flex-col items-center gap-2">
                <span className="label-upper text-[11px] px-4 py-2 bg-yellow-400 text-yellow-900 font-black">
                  ⚡ +{result.xpAwarded} XP Earned!
                </span>
                <p className="text-xs text-[var(--text-muted)]">
                  Great job! Come back tomorrow for a new Pokémon.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Guess form */}
      {!revealed && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {hintText && (
            <p className="text-sm text-[var(--text-muted)] text-center animate-in fade-in duration-300">
              {hintText}
            </p>
          )}

          {wrongCount > 0 && !revealed && (
            <p className="text-center text-sm text-red-500 animate-in fade-in duration-200">
              {wrongCount === 1
                ? "Not quite! Try again."
                : wrongCount === 2
                ? "Still not right…"
                : "Keep trying! A hint has appeared above."}
            </p>
          )}

          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              placeholder="Type a Pokémon name…"
              autoComplete="off"
              autoFocus
              className="flex-1 border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-4 py-3 text-sm focus:border-[var(--border-strong)] outline-none placeholder:text-[var(--text-muted)]"
            />
            <button
              type="submit"
              disabled={submitting || !guess.trim()}
              className="label-upper px-6 py-3 bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 transition-opacity disabled:opacity-30"
            >
              {submitting ? "…" : "Guess →"}
            </button>
          </div>

          <p className="text-[10px] text-[var(--text-muted)] text-center">
            Gen 1 Pokémon only (1–151). Typing is not case-sensitive.
          </p>
        </form>
      )}

      {/* Next reset countdown */}
      {revealed && countdown && (
        <div className="mt-10 border border-[var(--border)] p-5 text-center">
          <p className="label-upper text-[10px] text-[var(--text-muted)] mb-1">Next Pokémon in</p>
          <p
            className="text-3xl font-black text-[var(--foreground)] tabular-nums"
            style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
          >
            {countdown}
          </p>
        </div>
      )}

      {/* Not logged in nudge */}
      <NotLoggedInNudge />

      {/* Wrong guesses scoreboard */}
      {wrongCount > 0 && !revealed && (
        <p className="mt-6 text-center label-upper text-[10px] text-[var(--text-muted)]">
          Wrong guesses: {wrongCount}
        </p>
      )}
    </div>
  );
}

function NotLoggedInNudge() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(({ user }) => { if (!user) setShow(true); });
  }, []);

  if (!show) return null;

  return (
    <div className="mt-8 border border-[var(--border)] p-5 text-center animate-in fade-in duration-300">
      <p className="text-sm text-[var(--text-muted)] mb-3">
        Sign in to save your XP and track your guesses.
      </p>
      <a
        href="/login"
        className="label-upper px-5 py-2.5 bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 transition-opacity text-[10px] inline-block"
      >
        Sign in →
      </a>
    </div>
  );
}
