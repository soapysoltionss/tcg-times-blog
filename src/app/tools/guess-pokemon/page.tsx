"use client";

import { useEffect, useCallback, useState } from "react";
import Link from "next/link";

type TileState = "correct" | "present" | "absent" | "empty" | "active";
type Row = Array<{ letter: string; state: TileState }>;
type DailyData = { pokemonId: number; pokemonName: string; date: string };
type GuessResult = { correct: boolean; pokemonName: string | null; xpAwarded: number; alreadyGuessed: boolean };

const MAX_GUESSES = 6;

function capitalize(s: string) {
  return s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function spriteUrl(id: number) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}
function scoreGuess(guess: string, answer: string): TileState[] {
  const result: TileState[] = Array(guess.length).fill("absent");
  const pool = answer.split("");
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === answer[i]) { result[i] = "correct"; pool[i] = ""; }
  }
  for (let i = 0; i < guess.length; i++) {
    if (result[i] === "correct") continue;
    const j = pool.indexOf(guess[i]);
    if (j !== -1) { result[i] = "present"; pool[j] = ""; }
  }
  return result;
}

const TILE_CLS: Record<TileState, string> = {
  correct: "bg-emerald-500 border-emerald-500 text-white",
  present: "bg-yellow-400 border-yellow-400 text-white",
  absent:  "bg-[var(--muted)] border-[var(--muted)] text-[var(--text-muted)]",
  empty:   "bg-transparent border-[var(--border)] text-[var(--foreground)]",
  active:  "bg-transparent border-[var(--border-strong)] text-[var(--foreground)]",
};
const KEY_CLS: Record<string, string> = {
  correct: "bg-emerald-500 text-white border-emerald-500",
  present: "bg-yellow-400 text-white border-yellow-400",
  absent:  "bg-[var(--muted)] text-[var(--text-muted)] border-[var(--muted)]",
  default: "bg-[var(--background)] text-[var(--foreground)] border-[var(--border)] hover:border-[var(--border-strong)]",
};

function Tile({ letter, state }: { letter: string; state: TileState }) {
  return (
    <div className={`w-12 h-12 sm:w-14 sm:h-14 border-2 flex items-center justify-center text-lg sm:text-xl font-black uppercase select-none ${TILE_CLS[state]}`}>
      {letter}
    </div>
  );
}

function KbKey({ label, state, onClick, wide }: { label: string; state?: string; onClick: (k: string) => void; wide?: boolean }) {
  const cls = state && state !== "default" ? KEY_CLS[state] : KEY_CLS.default;
  return (
    <button onClick={() => onClick(label)} className={`${wide ? "px-3 sm:px-4" : "w-8 sm:w-10"} h-12 sm:h-14 border text-[10px] font-bold transition-colors select-none ${cls}`}>
      {label}
    </button>
  );
}

export default function GuessPokemonPage() {
  const [daily, setDaily]           = useState<DailyData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [current, setCurrent]       = useState("");
  const [rows, setRows]             = useState<Row[]>([]);
  const [shakeRow, setShakeRow]     = useState(false);
  const [gameOver, setGameOver]     = useState(false);
  const [won, setWon]               = useState(false);
  const [xpEarned, setXpEarned]     = useState(0);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [countdown, setCountdown]   = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [letterStates, setLetterStates] = useState<Record<string, TileState>>({});

  useEffect(() => {
    fetch("/api/pokemon-guess")
      .then(r => r.json())
      .then((data: DailyData) => {
        setDaily(data);
        const saved = localStorage.getItem("pokemon_wordle_" + data.date);
        if (saved) {
          try {
            const s = JSON.parse(saved) as { rows: Row[]; won: boolean; gameOver: boolean; letterStates: Record<string, TileState> };
            setRows(s.rows ?? []);
            setWon(s.won ?? false);
            setGameOver(s.gameOver ?? false);
            setLetterStates(s.letterStates ?? {});
            if (s.gameOver) setAlreadyDone(true);
          } catch { /* ignore */ }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!gameOver) return;
    const tick = () => {
      const now = new Date();
      const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      const ms = midnight.getTime() - now.getTime();
      setCountdown(`${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m ${Math.floor((ms % 60_000) / 1_000)}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [gameOver]);

  const submitGuess = useCallback(async () => {
    if (!daily || gameOver || submitting) return;
    const g = current.toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (g.length < 2) { setShakeRow(true); setTimeout(() => setShakeRow(false), 600); return; }

    const answer = daily.pokemonName.toLowerCase();
    const states = scoreGuess(g, answer);
    const newRow: Row = g.split("").map((letter, i) => ({ letter, state: states[i] }));
    const correct = g === answer || g === answer.replace(/-/g, "");

    const priority: Record<TileState, number> = { correct: 3, present: 2, absent: 1, empty: 0, active: 0 };
    const nextLetterStates = { ...letterStates };
    newRow.forEach(({ letter, state }) => {
      if ((priority[state] ?? 0) > (priority[nextLetterStates[letter]] ?? 0)) nextLetterStates[letter] = state;
    });
    setLetterStates(nextLetterStates);

    const nextRows = [...rows, newRow];
    setRows(nextRows);
    setCurrent("");

    const isGameOver = correct || nextRows.length >= MAX_GUESSES;
    if (correct) setWon(true);
    if (isGameOver) {
      setGameOver(true);
      localStorage.setItem("pokemon_wordle_" + daily.date, JSON.stringify({ rows: nextRows, won: correct, gameOver: true, letterStates: nextLetterStates }));
      if (correct) {
        setSubmitting(true);
        try {
          const res = await fetch("/api/pokemon-guess", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ guess: g }) });
          const data: GuessResult = await res.json();
          setXpEarned(data.xpAwarded ?? 0);
        } catch { /* ignore */ }
        setSubmitting(false);
      }
    }
  }, [daily, gameOver, current, rows, submitting, letterStates]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Enter") { submitGuess(); return; }
      if (e.key === "Backspace") { setCurrent(p => p.slice(0, -1)); return; }
      if (/^[a-zA-Z]$/.test(e.key)) setCurrent(p => p.length < 20 ? p + e.key.toLowerCase() : p);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submitGuess]);

  const onKeyPress = (k: string) => {
    if (gameOver) return;
    if (k === "ENTER") { submitGuess(); return; }
    if (k === "⌫") { setCurrent(p => p.slice(0, -1)); return; }
    if (/^[a-z]$/.test(k)) setCurrent(p => p.length < 20 ? p + k : p);
  };

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><span className="w-6 h-6 border-2 border-[var(--border)] border-t-[var(--foreground)] rounded-full animate-spin" /></div>;
  }
  if (!daily) {
    return <div className="max-w-xl mx-auto px-6 py-20 text-center"><p className="text-[var(--text-muted)]">Failed to load today&apos;s Pokémon.</p></div>;
  }

  const answer = daily.pokemonName.toLowerCase();
  const rowLen = Math.max(answer.length, 3);
  const guessCount = rows.length;

  type DC = { letter: string; state: TileState };
  const displayRows: DC[][] = [];
  for (let i = 0; i < MAX_GUESSES; i++) {
    const c = rows[i];
    if (c) {
      displayRows.push(Array.from({ length: rowLen }, (_, ci) => ({ letter: c[ci]?.letter ?? "", state: c[ci]?.state ?? "absent" })));
    } else if (i === guessCount && !gameOver) {
      displayRows.push(Array.from({ length: rowLen }, (_, ci) => ({ letter: current[ci] ?? "", state: (current[ci] ? "active" : "empty") as TileState })));
    } else {
      displayRows.push(Array.from({ length: rowLen }, () => ({ letter: "", state: "empty" as TileState })));
    }
  }

  const KB = [
    ["q","w","e","r","t","y","u","i","o","p"],
    ["a","s","d","f","g","h","j","k","l"],
    ["ENTER","z","x","c","v","b","n","m","⌫"],
  ];

  return (
    <div className="max-w-lg mx-auto px-4 py-10 flex flex-col items-center">
      <nav className="self-start mb-6">
        <Link href="/" className="label-upper text-[10px] text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors">← Home</Link>
      </nav>

      <div className="text-center mb-6 border-b border-[var(--border)] pb-6 w-full">
        <p className="label-upper text-[10px] text-[var(--text-muted)] mb-1">Daily · Gen 1 · 6 Attempts</p>
        <h1 className="text-3xl font-black text-[var(--foreground)] leading-tight" style={{ fontFamily: "var(--font-serif, serif)" }}>
          Guess That Pokémon!
        </h1>
        <p className="text-xs text-[var(--text-muted)] mt-1.5">🟩 right place &nbsp;·&nbsp; 🟨 wrong place &nbsp;·&nbsp; ⬛ not in name</p>
      </div>

      <div className="mb-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={spriteUrl(daily.pokemonId)}
          alt={gameOver ? capitalize(daily.pokemonName) : "Mystery Pokémon"}
          width={144} height={144} draggable={false}
          className={`w-36 h-36 object-contain select-none transition-all duration-700 ${gameOver ? "drop-shadow-[0_0_16px_rgba(250,204,21,0.5)]" : ""}`}
          style={gameOver ? {} : { filter: "brightness(0) saturate(0)", imageRendering: "pixelated" }}
        />
      </div>

      {gameOver && (
        <div className={`w-full mb-6 p-4 text-center border ${won ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20" : "border-red-400 bg-red-50 dark:bg-red-900/20"}`}>
          {won ? (
            <>
              <p className="font-black text-lg text-emerald-700 dark:text-emerald-300">🎉 {capitalize(daily.pokemonName)}!</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                {alreadyDone ? "Already solved today ✓" : `Solved in ${guessCount} guess${guessCount !== 1 ? "es" : ""}!${xpEarned > 0 ? ` · +${xpEarned} XP` : ""}`}
              </p>
            </>
          ) : (
            <>
              <p className="font-black text-lg text-red-700 dark:text-red-300">It was {capitalize(daily.pokemonName)}!</p>
              <p className="text-xs text-red-500 dark:text-red-400 mt-1">Better luck tomorrow!</p>
            </>
          )}
          {countdown && (
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <p className="label-upper text-[9px] text-[var(--text-muted)] mb-1">Next Pokémon in</p>
              <p className="text-2xl font-black text-[var(--foreground)] tabular-nums" style={{ fontFamily: "var(--font-serif, serif)" }}>{countdown}</p>
            </div>
          )}
        </div>
      )}

      <div className={`flex flex-col gap-1.5 mb-6 ${shakeRow ? "animate-shake" : ""}`}>
        {displayRows.map((row, ri) => (
          <div key={ri} className="flex gap-1.5">
            {row.map((cell, ci) => <Tile key={ci} letter={cell.letter} state={cell.state} />)}
          </div>
        ))}
      </div>

      {!gameOver && (
        <p className="label-upper text-[9px] text-[var(--text-muted)] mb-4">
          {answer.length} letters &nbsp;·&nbsp; type or tap keys · Enter to submit
        </p>
      )}

      {!gameOver && (
        <div className="flex flex-col gap-1.5 items-center mb-4 w-full">
          {KB.map((row, ri) => (
            <div key={ri} className="flex gap-1">
              {row.map(k => <KbKey key={k} label={k} state={letterStates[k] ?? "default"} onClick={onKeyPress} wide={k === "ENTER" || k === "⌫"} />)}
            </div>
          ))}
        </div>
      )}

      {!gameOver && current && (
        <p className="label-upper text-[10px] text-[var(--text-muted)] mb-2 tracking-widest">{current.split("").join(" ")}</p>
      )}

      <NotLoggedInNudge />
    </div>
  );
}

function NotLoggedInNudge() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(({ user }) => { if (!user) setShow(true); });
  }, []);
  if (!show) return null;
  return (
    <div className="mt-6 border border-[var(--border)] p-5 text-center w-full">
      <p className="text-sm text-[var(--text-muted)] mb-3">Sign in to earn <span className="font-semibold text-[var(--foreground)]">+50 XP</span> and track your streak.</p>
      <a href="/login" className="label-upper px-5 py-2.5 bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 transition-opacity text-[10px] inline-block">Sign in →</a>
    </div>
  );
}
