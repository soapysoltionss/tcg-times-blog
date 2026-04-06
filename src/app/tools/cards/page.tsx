"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SetInfo {
  groupId: string;
  name: string;
  publishedOn: string | null;
  categoryId: number;
  totalCards?: number;
  setSymbolUrl?: string;
  source?: "pokemontcg" | "tcgcsv";
}

// ---------------------------------------------------------------------------
// Game config
// ---------------------------------------------------------------------------

const GAMES = [
  {
    slug: "pokemon",
    label: "Pokémon",
    shortLabel: "PKM",
    emoji: "⚡",
    accent: "#e3350d",
    bg: "from-red-950/80 to-yellow-950/80",
    border: "border-red-700/40",
    badge: "bg-red-900/60 text-red-200 border-red-700/50",
    description: "All sets from Scarlet & Violet, Sword & Shield, and beyond.",
  },
  {
    slug: "flesh-and-blood",
    label: "Flesh and Blood",
    shortLabel: "FaB",
    emoji: "🩸",
    accent: "#dc2626",
    bg: "from-rose-950/80 to-red-950/80",
    border: "border-rose-700/40",
    badge: "bg-rose-900/60 text-rose-200 border-rose-700/50",
    description: "Every FaB set from Alpha to the latest release.",
  },
  {
    slug: "grand-archive",
    label: "Grand Archive",
    shortLabel: "GA",
    emoji: "📖",
    accent: "#7c3aed",
    bg: "from-violet-950/80 to-purple-950/80",
    border: "border-violet-700/40",
    badge: "bg-violet-900/60 text-violet-200 border-violet-700/50",
    description: "From Dawn of Ashes through the latest Grand Archive expansion.",
  },
  {
    slug: "one-piece",
    label: "One Piece TCG",
    shortLabel: "OP",
    emoji: "🏴‍☠️",
    accent: "#d97706",
    bg: "from-amber-950/80 to-orange-950/80",
    border: "border-amber-700/40",
    badge: "bg-amber-900/60 text-amber-200 border-amber-700/50",
    description: "All One Piece card sets from OP01 to present.",
  },
] as const;

type GameSlug = (typeof GAMES)[number]["slug"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse the date-only part of an ISO string as UTC to avoid timezone drift. */
function parseDate(iso: string): Date {
  // tcgcsv returns "2025-01-17T00:00:00" (no timezone) — treat as UTC date
  const datePart = iso.split("T")[0]; // "2025-01-17"
  const [y, m, d] = datePart.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return parseDate(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", timeZone: "UTC" });
}

// ---------------------------------------------------------------------------
// SetGrid — renders a game's sets with GSAP stagger
// ---------------------------------------------------------------------------

function SetGrid({ game, sets }: { game: typeof GAMES[number]; sets: SetInfo[] }) {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || sets.length === 0) return;

    const cards = Array.from(grid.querySelectorAll<HTMLElement>(".set-card"));
    gsap.fromTo(
      cards,
      { opacity: 0, y: 40, scale: 0.95 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.45,
        ease: "power2.out",
        stagger: 0.035,
        clearProps: "transform,opacity",
        scrollTrigger: {
          trigger: grid,
          start: "top 90%",
          once: true,
        },
      }
    );

    return () => { ScrollTrigger.getAll().forEach(t => t.kill()); };
  }, [sets]);

  if (sets.length === 0) {
    return (
      <div className="text-center py-16 text-[var(--text-muted)] text-sm">
        No sets found.
      </div>
    );
  }

  return (
    <div
      ref={gridRef}
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3"
    >
      {sets.map((set) => (
        <SetCard key={set.groupId} set={set} game={game} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SetCard — individual set tile with hover tilt effect
// ---------------------------------------------------------------------------

function SetCard({ set, game }: { set: SetInfo; game: typeof GAMES[number] }) {
  const cardRef = useRef<HTMLAnchorElement>(null);

  function handleMouseMove(e: React.MouseEvent<HTMLAnchorElement>) {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width  - 0.5;
    const cy = (e.clientY - rect.top)  / rect.height - 0.5;
    gsap.to(el, {
      rotateY: cx * 14,
      rotateX: -cy * 10,
      duration: 0.2,
      ease: "power2.out",
      transformPerspective: 600,
    });
  }

  function handleMouseLeave() {
    const el = cardRef.current;
    if (!el) return;
    gsap.to(el, {
      rotateY: 0,
      rotateX: 0,
      duration: 0.5,
      ease: "elastic.out(1, 0.6)",
      transformPerspective: 600,
    });
  }

  const year = set.publishedOn ? parseDate(set.publishedOn).getUTCFullYear() : null;

  return (
    <Link
      ref={cardRef}
      href={`/tools/cards/${game.slug}/${set.groupId}${set.source === "tcgcsv" ? "?src=tcgcsv" : ""}`}
      className={`set-card group relative flex flex-col justify-between p-3.5 rounded-lg border ${game.border} bg-gradient-to-br ${game.bg} backdrop-blur-sm hover:brightness-110 transition-[filter] cursor-pointer`}
      style={{ willChange: "transform", transformStyle: "preserve-3d" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Year badge top-right */}
      {year && (
        <span className={`absolute top-2 right-2 label-upper text-[9px] px-1.5 py-0.5 rounded border ${game.badge}`}>
          {year}
        </span>
      )}

      {/* Game emoji icon */}
      <span className="text-2xl mb-3 block leading-none">{game.emoji}</span>

      {/* Set name */}
      <p
        className="text-xs font-bold text-white/90 leading-snug group-hover:text-white transition-colors"
        style={{ fontFamily: "var(--font-serif, serif)" }}
      >
        {set.name}
      </p>

      {/* Date */}
      <p className="label-upper text-[9px] text-white/40 mt-2">
        {formatDate(set.publishedOn)}
      </p>

      {/* Arrow on hover */}
      <span className="absolute bottom-2.5 right-3 text-white/0 group-hover:text-white/60 transition-colors text-xs">→</span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// LoadingSkeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {Array.from({ length: 18 }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-white/10 bg-white/5 h-24 animate-pulse"
          style={{ animationDelay: `${i * 0.04}s` }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CardsIndexPage() {
  const [activeGame, setActiveGame] = useState<GameSlug>("pokemon");
  const [sets, setSets] = useState<SetInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const heroRef = useRef<HTMLDivElement>(null);

  // Hero entrance animation
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    gsap.fromTo(
      el.querySelectorAll(".hero-animate"),
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.6, ease: "power2.out", stagger: 0.1 }
    );
  }, []);

  // Fetch sets when game tab changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setSets([]);

    fetch(`/api/sets?game=${activeGame}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data.error) { setError(data.error); setLoading(false); return; }
        setSets(data.sets ?? []);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) { setError("Failed to load sets."); setLoading(false); }
      });

    return () => { cancelled = true; };
  }, [activeGame]);

  const activeGameMeta = GAMES.find(g => g.slug === activeGame)!;

  return (
    <div className="min-h-screen bg-[var(--background)]">

      {/* ── Hero ── */}
      <div
        ref={heroRef}
        className="relative overflow-hidden border-b border-[var(--border-strong)]"
        style={{
          background: "linear-gradient(135deg, var(--background) 0%, color-mix(in srgb, var(--foreground) 4%, var(--background)) 100%)",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-14 md:py-20">
          <p className="hero-animate label-upper text-[10px] text-[var(--text-muted)] mb-3">TCG Times — Card Database</p>
          <h1
            className="hero-animate text-4xl md:text-6xl font-black text-[var(--foreground)] leading-none tracking-tight mb-4"
            style={{ fontFamily: "var(--font-serif, serif)" }}
          >
            Card Gallery
          </h1>
          <p className="hero-animate text-[var(--text-muted)] text-base max-w-xl leading-relaxed">
            Browse every set across Pokémon, Flesh and Blood, Grand Archive, and One Piece TCG.
            Live market prices, rarity breakdowns, and full card details.
          </p>
        </div>

        {/* Decorative lines */}
        <div className="absolute inset-0 pointer-events-none">
          {[0.2, 0.45, 0.7, 0.88].map((x, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 w-px bg-[var(--border)]"
              style={{ left: `${x * 100}%`, opacity: 0.3 }}
            />
          ))}
        </div>
      </div>

      {/* ── Game tabs ── */}
      <div className="sticky top-0 z-30 bg-[var(--background)]/95 backdrop-blur-md border-b border-[var(--border-strong)]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="flex items-center gap-0 divide-x divide-[var(--border)] overflow-x-auto">
            {GAMES.map((g) => (
              <button
                key={g.slug}
                onClick={() => setActiveGame(g.slug)}
                className={`flex-shrink-0 flex items-center gap-2 px-5 py-3.5 label-upper text-[11px] transition-colors ${
                  activeGame === g.slug
                    ? "bg-[var(--foreground)] text-[var(--background)]"
                    : "text-[var(--text-muted)] hover:text-[var(--foreground)]"
                }`}
              >
                <span>{g.emoji}</span>
                <span>{g.shortLabel}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-8">

        {/* Game header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-4">
          <div>
            <h2
              className="text-2xl font-black text-[var(--foreground)] flex items-center gap-2"
              style={{ fontFamily: "var(--font-serif, serif)" }}
            >
              <span>{activeGameMeta.emoji}</span>
              <span>{activeGameMeta.label}</span>
            </h2>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">{activeGameMeta.description}</p>
          </div>
          {!loading && sets.length > 0 && (
            <span className="label-upper text-[10px] text-[var(--text-muted)] sm:ml-auto shrink-0">
              {sets.length} sets
            </span>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="text-red-400 text-sm text-center py-10">{error}</div>
        )}

        {/* Sets grid */}
        {loading
          ? <LoadingSkeleton />
          : <SetGrid game={activeGameMeta} sets={sets} />
        }
      </div>
    </div>
  );
}
