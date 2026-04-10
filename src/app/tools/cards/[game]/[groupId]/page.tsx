"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { use } from "react";
import { useSearchParams } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { PriceGraph, PricePoint } from "@/components/PriceGraph";
import { getReprintRisk, REPRINT_RISK_STYLE, REPRINT_RISK_LABEL } from "@/lib/reprint-risk";

gsap.registerPlugin(ScrollTrigger);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PriceTier {
  label: string;
  marketCents: number | null;
  midCents: number | null;
}

interface CardData {
  productId: number | string;
  name: string;
  cleanName: string;
  number: string | null;
  rarity: string | null;
  subtypes?: string[];                  // pokemontcg.io subtypes (ex, V, VMAX…)
  imageUrl: string | null;
  marketPriceCents: number | null;
  midPriceCents: number | null;
  subTypeName: string;
  allPriceTiers?: PriceTier[];          // all TCGPlayer price variants
  priceUpdatedAt?: string | null;
  cardmarketAvg?: {
    avg1?: number | null;
    avg7?: number | null;
    avg30?: number | null;
    trend?: number | null;
    sell?: number | null;
    rhAvg1?: number | null;
    rhAvg7?: number | null;
    rhAvg30?: number | null;
    rhTrend?: number | null;
  } | null;
}

interface SetData {
  groupId: number | string;
  name: string;
  game: string;
  categoryId: number;
  publishedOn: string | null;
  totalCards: number;
  cards: CardData[];
}

// ---------------------------------------------------------------------------
// Game config (visual theming)
// ---------------------------------------------------------------------------

const GAME_META: Record<string, { label: string; emoji: string; accent: string; badge: string; backBg: string }> = {
  pokemon: {
    label: "Pokémon",
    emoji: "⚡",
    accent: "#e3350d",
    badge: "bg-red-900/60 text-red-200 border-red-700/50",
    backBg: "from-red-950 to-yellow-950",
  },
  "flesh-and-blood": {
    label: "Flesh and Blood",
    emoji: "🩸",
    accent: "#dc2626",
    badge: "bg-rose-900/60 text-rose-200 border-rose-700/50",
    backBg: "from-rose-950 to-red-950",
  },
  "grand-archive": {
    label: "Grand Archive",
    emoji: "📖",
    accent: "#7c3aed",
    badge: "bg-violet-900/60 text-violet-200 border-violet-700/50",
    backBg: "from-violet-950 to-purple-950",
  },
  "one-piece": {
    label: "One Piece TCG",
    emoji: "🏴‍☠️",
    accent: "#d97706",
    badge: "bg-amber-900/60 text-amber-200 border-amber-700/50",
    backBg: "from-amber-950 to-orange-950",
  },
};

const CARD_BACKS: Record<string, string> = {
  "flesh-and-blood": "/fab-card-back.png",
  "grand-archive":   "/ga-card-back.jpg",
  "one-piece":       "/op-card-back.svg",
  "pokemon":         "/pokemon-card-back.png",
};

// ---------------------------------------------------------------------------
// Hit / Playable classifiers
// ---------------------------------------------------------------------------

// Rarities that are NOT hits (commons, uncommons, base rares + all holo variants)
const NON_HIT_RARITIES = new Set([
  "Common",
  "Uncommon",
  "Rare",
  "Rare Holo",
  "Rare Holo EX",
  "Rare Holo GX",
  "Rare Holo V",
  "Rare Holo VMAX",
  "Rare Holo VSTAR",
  "Rare Holo Star",
  "Rare Holo LV.X",
  "Rare Prime",
  "Rare ACE",
  "Rare BREAK",
  "Promo",
]);

// Subtypes that mark a card as competitively playable
// Double Rare = ex Pokémon, so it lives here rather than in hits
const PLAYABLE_SUBTYPES = new Set([
  "ex", "EX", "GX", "V", "VMAX", "VSTAR",
  "Prism Star", "BREAK", "Radiant",
  "Supporter", "Item", "Pokémon Tool",
  "Stadium", "Technical Machine",
]);

function isHit(card: CardData): boolean {
  const rarity = card.rarity ?? "";
  // Anything with a rarity that isn't a common/uncommon/rare is a hit,
  // but Double Rares (ex Pokémon) belong under Playables instead
  if (rarity === "Double Rare") return false;
  return rarity !== "" && !NON_HIT_RARITIES.has(rarity);
}

function isPlayable(card: CardData): boolean {
  // Double Rare = ex Pokémon → always playable
  if (card.rarity === "Double Rare") return true;
  if (card.subtypes && card.subtypes.some(s => PLAYABLE_SUBTYPES.has(s))) return true;
  // Fallback for non-pokemontcg.io data: subTypeName contains the TCGPlayer price variant label
  if (card.subTypeName && PLAYABLE_SUBTYPES.has(card.subTypeName)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SortKey = "number" | "name" | "price-asc" | "price-desc" | "rarity";

function sortCards(cards: CardData[], key: SortKey): CardData[] {
  return [...cards].sort((a, b) => {
    switch (key) {
      case "number": {
        const na = parseInt(a.number ?? "9999", 10);
        const nb = parseInt(b.number ?? "9999", 10);
        return na - nb;
      }
      case "name":
        return a.name.localeCompare(b.name);
      case "price-asc":
        return (a.marketPriceCents ?? 0) - (b.marketPriceCents ?? 0);
      case "price-desc":
        return (b.marketPriceCents ?? 0) - (a.marketPriceCents ?? 0);
      case "rarity":
        return (a.rarity ?? "").localeCompare(b.rarity ?? "");
      default:
        return 0;
    }
  });
}

function formatCents(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  // tcgcsv returns "2025-01-17T00:00:00" (no timezone) — parse as UTC date only
  const datePart = iso.split("T")[0];
  const [y, m, d] = datePart.split("-").map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d));
  return utcDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

// ---------------------------------------------------------------------------
// CardItem — card in the grid with hover tilt, click → modal
// ---------------------------------------------------------------------------

function CardItem({
  card,
  game,
  onSelect,
}: {
  card: CardData;
  game: string;
  onSelect: (card: CardData) => void;
}) {
  const ref     = useRef<HTMLButtonElement>(null);
  const reprisk = getReprintRisk(card.name);
  const meta    = GAME_META[game] ?? GAME_META["pokemon"];

  function handleMouseMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width  - 0.5;
    const cy = (e.clientY - rect.top)  / rect.height - 0.5;
    gsap.to(el, {
      rotateY: cx * 18,
      rotateX: -cy * 12,
      scale: 1.04,
      duration: 0.2,
      ease: "power2.out",
      transformPerspective: 700,
    });
  }

  function handleMouseLeave() {
    const el = ref.current;
    if (!el) return;
    gsap.to(el, {
      rotateY: 0,
      rotateX: 0,
      scale: 1,
      duration: 0.6,
      ease: "elastic.out(1, 0.5)",
      transformPerspective: 700,
    });
  }

  return (
    <button
      ref={ref}
      onClick={() => onSelect(card)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="card-item group relative flex flex-col text-left cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded-xl"
      style={{ willChange: "transform", transformStyle: "preserve-3d" }}
      aria-label={`View details for ${card.name}`}
    >
      {/* Card image */}
      <div className="relative w-full aspect-[2.5/3.5] rounded-xl overflow-hidden shadow-md bg-[var(--surface)]">
        {card.imageUrl ? (
          <Image
            src={card.imageUrl}
            alt={card.name}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 14vw"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${meta.backBg} flex items-center justify-center text-4xl`}>
            {meta.emoji}
          </div>
        )}

        {/* Reprint risk badge */}
        {reprisk && (
          <span className={`absolute top-1.5 left-1.5 label-upper text-[8px] px-1.5 py-0.5 rounded border ${REPRINT_RISK_STYLE[reprisk.risk]}`}>
            {REPRINT_RISK_LABEL[reprisk.risk]}
          </span>
        )}

        {/* Price badge */}
        {card.marketPriceCents != null && (
          <span className="absolute bottom-1.5 right-1.5 bg-black/75 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
            {formatCents(card.marketPriceCents)}
          </span>
        )}
      </div>

      {/* Info below image */}
      <div className="mt-1.5 px-0.5">
        <p className="text-xs font-semibold text-[var(--foreground)] leading-snug truncate group-hover:text-white transition-colors">
          {card.name}
        </p>
        <div className="flex items-center justify-between mt-0.5 gap-1">
          {card.number && (
            <span className="label-upper text-[9px] text-[var(--text-muted)]">#{card.number}</span>
          )}
          {card.rarity && (
            <span className="label-upper text-[9px] text-[var(--text-muted)] truncate">{card.rarity}</span>
          )}
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// CardLightbox — full-screen holographic card viewer (click card in modal)
// ---------------------------------------------------------------------------

function CardLightbox({
  card,
  meta,
  onClose,
}: {
  card: CardData;
  meta: typeof GAME_META[string];
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const wrapRef    = useRef<HTMLDivElement>(null);
  const cardRef    = useRef<HTMLDivElement>(null);
  const glareRef   = useRef<HTMLDivElement>(null);
  const foilRef    = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fade in backdrop
    gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.25 });
    // Flip card in from the back (rotateY: -180 → 0), like turning a card over
    gsap.fromTo(cardRef.current,
      { rotateY: -180, scale: 0.85, opacity: 0 },
      {
        rotateY: 0,
        scale: 1,
        opacity: 1,
        duration: 0.6,
        ease: "power3.out",
        transformPerspective: 1000,
        // Once the flip lands, spring forward slightly then settle
        onComplete: () => {
          gsap.to(cardRef.current, { scale: 1.02, duration: 0.15, yoyo: true, repeat: 1, ease: "power1.inOut" });
        },
      }
    );
  }, []);

  function dismiss() {
    gsap.to(cardRef.current,   { scale: 0.7, rotateY: 90, opacity: 0, duration: 0.3, ease: "power2.in", transformPerspective: 1000 });
    gsap.to(overlayRef.current,{ opacity: 0, duration: 0.3, onComplete: onClose });
  }

  function onMouseMove(e: React.MouseEvent) {
    const wrap  = wrapRef.current;
    const card  = cardRef.current;
    const glare = glareRef.current;
    const foil  = foilRef.current;
    if (!wrap || !card || !glare || !foil) return;
    const rect = wrap.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top)  / rect.height;
    gsap.to(card, {
      rotateY: (x - 0.5) * 30,
      rotateX: -(y - 0.5) * 22,
      duration: 0.12,
      ease: "power2.out",
      transformPerspective: 1000,
    });
    glare.style.background = `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(255,255,255,0.5) 0%, transparent 65%)`;
    glare.style.opacity = "1";
    foil.style.backgroundPosition = `${x * 100}% ${y * 100}%`;
    foil.style.opacity = "0.7";
  }

  function onMouseLeave() {
    gsap.to(cardRef.current, { rotateY: 0, rotateX: 0, duration: 0.9, ease: "elastic.out(1, 0.35)", transformPerspective: 1000 });
    if (glareRef.current) glareRef.current.style.opacity = "0";
    if (foilRef.current)  foilRef.current.style.opacity  = "0";
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") dismiss(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) dismiss(); }}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black/95 backdrop-blur-xl"
    >
      {/* Close */}
      <button
        onClick={dismiss}
        className="absolute top-5 right-5 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors text-lg"
        aria-label="Close"
      >✕</button>

      {/* Card name */}
      <p className="label-upper text-[10px] text-white/40 mb-4 tracking-widest">{meta.emoji} {card.name}</p>

      {/* The card */}
      <div
        ref={wrapRef}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        className="relative select-none"
        style={{ perspective: "1000px", width: "min(80vw, 340px)" }}
      >
        <div
          ref={cardRef}
          className="relative w-full aspect-[2.5/3.5] rounded-2xl overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.8)]"
          style={{ transformStyle: "preserve-3d", willChange: "transform" }}
        >
          {card.imageUrl ? (
            <Image src={card.imageUrl} alt={card.name} fill className="object-cover" unoptimized sizes="340px" draggable={false} />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${meta.backBg} flex items-center justify-center text-7xl`}>
              {meta.emoji}
            </div>
          )}

          {/* Rainbow foil */}
          <div
            ref={foilRef}
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              opacity: 0,
              background: `repeating-linear-gradient(
                115deg,
                rgba(255,0,120,0.4)  0%,  rgba(255,165,0,0.4)  8%,
                rgba(255,255,0,0.4)  16%, rgba(0,255,100,0.4)  24%,
                rgba(0,200,255,0.4)  32%, rgba(100,0,255,0.4)  40%,
                rgba(255,0,120,0.4)  48%
              )`,
              backgroundSize: "300% 300%",
              mixBlendMode: "color-dodge",
              transition: "opacity 0.1s",
            }}
          />
          {/* Glare */}
          <div
            ref={glareRef}
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{ opacity: 0, mixBlendMode: "overlay", transition: "opacity 0.1s" }}
          />
          {/* Edge shine */}
          <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ boxShadow: "inset 0 0 40px rgba(255,255,255,0.1)" }} />
        </div>
      </div>

      <p className="label-upper text-[9px] text-white/25 mt-6 tracking-widest">Move mouse · Esc to close</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HoloCard — 3D holographic card with mouse-tracked tilt + rainbow shimmer
// ---------------------------------------------------------------------------

function HoloCard({
  card,
  meta,
  onEnlarge,
}: {
  card: CardData;
  meta: typeof GAME_META[string];
  onEnlarge?: () => void;
}) {
  const wrapRef  = useRef<HTMLDivElement>(null);
  const cardRef  = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const foilRef  = useRef<HTMLDivElement>(null);
  const isActive = useRef(false);

  function onMouseMove(e: React.MouseEvent) {
    const wrap = wrapRef.current;
    const card = cardRef.current;
    const glare = glareRef.current;
    const foil = foilRef.current;
    if (!wrap || !card || !glare || !foil) return;

    const rect = wrap.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;   // 0–1
    const y = (e.clientY - rect.top)  / rect.height;  // 0–1
    const cx = x - 0.5;  // -0.5 to 0.5
    const cy = y - 0.5;

    isActive.current = true;

    gsap.to(card, {
      rotateY: cx * 28,
      rotateX: -cy * 22,
      scale: 1.04,
      duration: 0.15,
      ease: "power2.out",
      transformPerspective: 900,
      transformOrigin: "center center",
    });

    // Move glare spotlight
    glare.style.background = `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(255,255,255,0.45) 0%, transparent 65%)`;
    glare.style.opacity = "1";

    // Shift the rainbow foil based on mouse position
    foil.style.backgroundPosition = `${x * 100}% ${y * 100}%`;
    foil.style.opacity = "0.65";
  }

  function onMouseLeave() {
    const card = cardRef.current;
    const glare = glareRef.current;
    const foil = foilRef.current;
    if (!card || !glare || !foil) return;
    isActive.current = false;

    gsap.to(card, {
      rotateY: 0, rotateX: 0, scale: 1,
      duration: 0.8,
      ease: "elastic.out(1, 0.4)",
      transformPerspective: 900,
    });
    glare.style.opacity = "0";
    foil.style.opacity = "0";
  }

  return (
    <div
      ref={wrapRef}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className="relative flex items-center justify-center select-none"
      style={{ perspective: "900px", width: "100%", maxWidth: 260 }}
    >
      <div
        ref={cardRef}
        onClick={onEnlarge}
        className={`relative w-full aspect-[2.5/3.5] rounded-2xl overflow-hidden shadow-2xl ${onEnlarge ? "cursor-zoom-in" : "cursor-grab"}`}
        style={{ transformStyle: "preserve-3d", willChange: "transform" }}
      >
        {/* Card image */}
        {card.imageUrl ? (
          <Image
            src={card.imageUrl}
            alt={card.name}
            fill
            className="object-cover rounded-2xl"
            unoptimized
            sizes="260px"
            draggable={false}
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${meta.backBg} flex items-center justify-center text-6xl`}>
            {meta.emoji}
          </div>
        )}

        {/* Rainbow foil shimmer layer */}
        <div
          ref={foilRef}
          className="absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-150"
          style={{
            opacity: 0,
            background: `
              repeating-linear-gradient(
                115deg,
                rgba(255,0,120,0.35)   0%,
                rgba(255,165,0,0.35)   8%,
                rgba(255,255,0,0.35)   16%,
                rgba(0,255,100,0.35)   24%,
                rgba(0,200,255,0.35)   32%,
                rgba(100,0,255,0.35)   40%,
                rgba(255,0,120,0.35)   48%
              )
            `,
            backgroundSize: "300% 300%",
            mixBlendMode: "color-dodge",
          }}
        />

        {/* Glare spotlight */}
        <div
          ref={glareRef}
          className="absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-100"
          style={{ opacity: 0, mixBlendMode: "overlay" }}
        />

        {/* Edge glow */}
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{ boxShadow: "inset 0 0 30px rgba(255,255,255,0.08)" }}
        />

        {/* Enlarge hint */}
        {onEnlarge && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200 rounded-2xl pointer-events-none">
            <span className="bg-black/60 backdrop-blur-sm text-white label-upper text-[9px] px-3 py-1.5 rounded-lg">
              ⛶ Full screen
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CardModal
// ---------------------------------------------------------------------------

function CardModal({
  card,
  game,
  setName,
  onClose,
}: {
  card: CardData;
  game: string;
  setName: string;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);
  const reprisk    = getReprintRisk(card.name);
  const meta       = GAME_META[game] ?? GAME_META["pokemon"];

  // Entrance animation
  useEffect(() => {
    const overlay = overlayRef.current;
    const panel   = panelRef.current;
    if (!overlay || !panel) return;
    gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.25 });
    gsap.fromTo(panel,   { opacity: 0, y: 40, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: "power3.out" });
  }, []);

  function handleClose() {
    const overlay = overlayRef.current;
    const panel   = panelRef.current;
    if (!overlay || !panel) { onClose(); return; }
    gsap.to(panel,   { opacity: 0, y: 24, scale: 0.95, duration: 0.2, ease: "power2.in" });
    gsap.to(overlay, { opacity: 0, duration: 0.25, onComplete: onClose });
  }

  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === overlayRef.current) handleClose();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  function buildSyntheticHistory(card: CardData): PricePoint[] {
    const today = card.marketPriceCents;
    if (today == null) return [];

    const todayStr = new Date().toISOString().slice(0, 10);
    const dAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

    // Show a flat line at today's price while real data loads.
    // We do NOT use cardmarket avg1/avg7/avg30 as historical points because
    // those are rolling averages computed today — not actual past prices —
    // so plotting them creates a fabricated and misleading trend.
    return [
      { date: dAgo(30), priceCents: today, synthetic: true },
      { date: todayStr, priceCents: today, synthetic: true },
    ];
  }

  useEffect(() => {
    if (game !== "pokemon") {
      setPriceHistory(buildSyntheticHistory(card));
      return;
    }
    setPriceHistory(buildSyntheticHistory(card));
    setHistoryLoading(true);
    const params = new URLSearchParams({ cardId: String(card.productId) });
    if (card.marketPriceCents != null) params.set("priceCents", String(card.marketPriceCents));
    if (setName) params.set("setName", setName);
    fetch(`/api/pokemon-price-history?${params}`)
      .then(r => r.json())
      .then((d: { history?: PricePoint[] }) => {
        if (d.history && d.history.length >= 2) {
          // Pin the last point to exactly match the displayed price so the
          // graph endpoint always equals what the user sees on the card.
          const history = [...d.history];
          if (card.marketPriceCents != null) {
            const todayStr = new Date().toISOString().slice(0, 10);
            const last = history[history.length - 1];
            if (last.date === todayStr) {
              history[history.length - 1] = { ...last, priceCents: card.marketPriceCents };
            } else {
              history.push({ date: todayStr, priceCents: card.marketPriceCents });
            }
          }
          setPriceHistory(history);
        }
        setHistoryLoading(false);
      })
      .catch(() => setHistoryLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.productId]);

  const cm = card.cardmarketAvg;
  const psaName = encodeURIComponent(card.name);
  const ebayQuery = encodeURIComponent(`${card.name} pokemon card graded`);

  // Build display tiers: prefer allPriceTiers, fall back to marketPriceCents/midPriceCents
  const displayTiers: PriceTier[] = (card.allPriceTiers && card.allPriceTiers.length > 0)
    ? card.allPriceTiers
    : (card.marketPriceCents != null || card.midPriceCents != null)
      ? [{ label: card.subTypeName && card.subTypeName !== "Normal" ? card.subTypeName : "Market Price", marketCents: card.marketPriceCents, midCents: card.midPriceCents }]
      : [];

  return (
    <>
      {/* Full-screen lightbox */}
      {lightboxOpen && (
        <CardLightbox card={card} meta={meta} onClose={() => setLightboxOpen(false)} />
      )}

    <div
      ref={overlayRef}
      onClick={handleBackdrop}
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-6 bg-black/85 backdrop-blur-md overflow-y-auto"
    >
      <div
        ref={panelRef}
        className="relative w-full max-w-3xl bg-[var(--background)] border border-[var(--border-strong)] rounded-2xl shadow-2xl overflow-hidden mb-6"
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-[var(--surface)] hover:bg-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
          aria-label="Close"
        >
          ✕
        </button>

        <div className="grid grid-cols-1 sm:grid-cols-[260px_1fr] gap-0">

          {/* ── Left: holographic card ── */}
          <div className={`bg-gradient-to-br ${meta.backBg} p-8 flex flex-col items-center justify-center gap-4 min-h-[320px]`}>
            <HoloCard card={card} meta={meta} onEnlarge={() => setLightboxOpen(true)} />
            <p className="label-upper text-[8px] text-white/40 text-center">Move mouse · Click to expand</p>
          </div>

          {/* ── Right: details ── */}
          <div className="p-5 overflow-y-auto max-h-[90vh]">
            {/* Breadcrumb */}
            <p className="label-upper text-[9px] text-[var(--text-muted)] mb-1">
              {meta.emoji} {meta.label} · {setName}
            </p>

            {/* Card name */}
            <h2 className="text-xl font-black text-[var(--foreground)] leading-tight mb-3" style={{ fontFamily: "var(--font-serif, serif)" }}>
              {card.name}
            </h2>

            {/* Meta pills */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {card.number && (
                <span className="label-upper text-[9px] px-2 py-0.5 rounded border border-[var(--border)] text-[var(--text-muted)]">#{card.number}</span>
              )}
              {card.rarity && (
                <span className="label-upper text-[9px] px-2 py-0.5 rounded border border-[var(--border)] text-[var(--text-muted)]">{card.rarity}</span>
              )}
              {card.subTypeName && card.subTypeName !== "Normal" && (
                <span className="label-upper text-[9px] px-2 py-0.5 rounded border border-[var(--border)] text-[var(--text-muted)]">{card.subTypeName}</span>
              )}
              {reprisk && (
                <span className={`label-upper text-[9px] px-2 py-0.5 rounded border ${REPRINT_RISK_STYLE[reprisk.risk]}`}>
                  {REPRINT_RISK_LABEL[reprisk.risk]}
                </span>
              )}
            </div>

            {/* ── TCGPlayer prices — all tiers ── */}
            <div className="mb-4">
              <p className="label-upper text-[9px] text-[var(--text-muted)] mb-2">TCGPlayer Prices</p>
              {displayTiers.length > 0 ? (
                <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[var(--surface)]">
                        <th className="text-left px-3 py-2 label-upper text-[8px] text-[var(--text-muted)] font-medium">Variant</th>
                        <th className="text-right px-3 py-2 label-upper text-[8px] text-[var(--text-muted)] font-medium">Market</th>
                        <th className="text-right px-3 py-2 label-upper text-[8px] text-[var(--text-muted)] font-medium">Mid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayTiers.map((tier, i) => (
                        <tr key={i} className="border-t border-[var(--border)] hover:bg-[var(--surface)] transition-colors">
                          <td className="px-3 py-2 text-[var(--foreground)] font-medium">{tier.label}</td>
                          <td className="px-3 py-2 text-right font-black text-[var(--foreground)]">{formatCents(tier.marketCents)}</td>
                          <td className="px-3 py-2 text-right text-[var(--text-muted)]">{formatCents(tier.midCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-[var(--text-muted)] italic">No TCGPlayer pricing available yet.</p>
              )}
              {card.priceUpdatedAt && (
                <p className="label-upper text-[8px] text-[var(--text-muted)] mt-1">Updated {card.priceUpdatedAt}</p>
              )}
            </div>

            {/* ── Cardmarket prices (EUR) ── */}
            {cm && (cm.avg1 != null || cm.avg7 != null || cm.avg30 != null) && (
              <div className="mb-4">
                <p className="label-upper text-[9px] text-[var(--text-muted)] mb-2">Cardmarket (EUR)</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "1-Day Avg",  val: cm.avg1 },
                    { label: "7-Day Avg",  val: cm.avg7 },
                    { label: "30-Day Avg", val: cm.avg30 },
                  ].filter(r => r.val != null).map(row => (
                    <div key={row.label} className="bg-[var(--surface)] rounded-lg p-2.5">
                      <p className="label-upper text-[8px] text-[var(--text-muted)] mb-0.5">{row.label}</p>
                      <p className="text-sm font-black text-[var(--foreground)]">€{row.val!.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
                {cm.trend != null && (
                  <p className="label-upper text-[8px] text-[var(--text-muted)] mt-1.5">
                    Trend: €{cm.trend.toFixed(2)}
                    {cm.rhTrend != null && <span className="ml-2">· RH Trend: €{cm.rhTrend.toFixed(2)}</span>}
                  </p>
                )}
              </div>
            )}

            {/* ── Graded prices (PSA / BGS) ── */}
            <div className="mb-4">
              <p className="label-upper text-[9px] text-[var(--text-muted)] mb-2">Graded Prices</p>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {[
                  { label: "PSA 10",  grade: "10", slab: "PSA" },
                  { label: "PSA 9",   grade: "9",  slab: "PSA" },
                  { label: "BGS 9.5", grade: "9.5",slab: "BGS" },
                ].map(g => (
                  <a
                    key={g.label}
                    href={`https://www.ebay.com/sch/i.html?_nkw=${ebayQuery}+${encodeURIComponent(g.slab)}+${encodeURIComponent(g.grade)}&LH_Sold=1&LH_Complete=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-[var(--surface)] rounded-lg p-2.5 border border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--muted)] transition-colors group"
                  >
                    <p className="label-upper text-[8px] text-[var(--text-muted)] mb-1">{g.label}</p>
                    <p className="text-[10px] font-semibold text-[var(--foreground)] group-hover:underline">eBay Sold ↗</p>
                  </a>
                ))}
              </div>
              <div className="flex gap-2">
                <a
                  href={`https://www.psacard.com/pop/tcg-cards/17/pokemon/${psaName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 label-upper text-[9px] px-3 py-2 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition-colors text-center"
                >
                  PSA Pop Report ↗
                </a>
                <a
                  href={`https://www.beckett.com/grading`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 label-upper text-[9px] px-3 py-2 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition-colors text-center"
                >
                  BGS Grading ↗
                </a>
              </div>
            </div>

            {/* ── Reprint risk ── */}
            {reprisk && (
              <div className={`text-xs px-3 py-2 rounded-lg border mb-4 ${REPRINT_RISK_STYLE[reprisk.risk]}`}>
                <span className="font-bold">{REPRINT_RISK_LABEL[reprisk.risk]}: </span>
                {reprisk.notes}
              </div>
            )}

            {/* ── Price graph ── */}
            {(card.marketPriceCents != null || priceHistory.length >= 2) && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="label-upper text-[9px] text-[var(--text-muted)]">Price History</p>
                  {historyLoading && (
                    <span className="label-upper text-[8px] text-[var(--text-muted)] animate-pulse">loading…</span>
                  )}
                </div>
                <PriceGraph cardName={card.name} data={priceHistory} showDrawdown />
              </div>
            )}

            {/* ── Actions ── */}
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/marketplace?game=${game}&search=${encodeURIComponent(card.name)}`}
                className="label-upper text-[10px] px-4 py-2 bg-[var(--foreground)] text-[var(--background)] rounded-lg hover:opacity-90 transition-opacity"
              >
                Marketplace →
              </Link>
              <a
                href={`https://www.tcgplayer.com/search/all/product?q=${encodeURIComponent(card.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="label-upper text-[10px] px-4 py-2 border border-[var(--border)] text-[var(--text-muted)] rounded-lg hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition-colors"
              >
                TCGPlayer ↗
              </a>
              <a
                href={`https://www.ebay.com/sch/i.html?_nkw=${ebayQuery}&LH_Sold=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="label-upper text-[10px] px-4 py-2 border border-[var(--border)] text-[var(--text-muted)] rounded-lg hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition-colors"
              >
                eBay Sold ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Stats bar
// ---------------------------------------------------------------------------

function StatsBar({ cards, game }: { cards: CardData[]; game: string }) {
  const priced = cards.filter(c => c.marketPriceCents != null);
  const total  = cards.length;
  const avgCents = priced.length
    ? Math.round(priced.reduce((s, c) => s + (c.marketPriceCents ?? 0), 0) / priced.length)
    : null;
  const maxCard = priced.reduce<CardData | null>(
    (best, c) => (best == null || (c.marketPriceCents ?? 0) > (best.marketPriceCents ?? 0) ? c : best),
    null
  );

  const rarities = Array.from(new Set(cards.map(c => c.rarity).filter(Boolean)));

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {[
        { label: "Total Cards",    value: total.toString() },
        { label: "With Prices",    value: `${priced.length}` },
        { label: "Avg Market",     value: formatCents(avgCents) },
        { label: "Top Card",       value: maxCard?.name ?? "—", sub: formatCents(maxCard?.marketPriceCents ?? null) },
      ].map((s) => (
        <div key={s.label} className="bg-[var(--surface)] rounded-xl p-3 border border-[var(--border)]">
          <p className="label-upper text-[9px] text-[var(--text-muted)] mb-0.5">{s.label}</p>
          <p
            className="text-base font-black text-[var(--foreground)] leading-tight truncate"
            title={s.value}
          >
            {s.value}
          </p>
          {s.sub && (
            <p className="label-upper text-[9px] text-[var(--text-muted)] mt-0.5">{s.sub}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SetGalleryPage({
  params,
}: {
  params: Promise<{ game: string; groupId: string }>;
}) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-[var(--text-muted)]">Loading…</div>}>
      <SetGalleryPageInner params={params} />
    </Suspense>
  );
}

function SetGalleryPageInner({
  params,
}: {
  params: Promise<{ game: string; groupId: string }>;
}) {
  const { game, groupId } = use(params);
  const searchParams = useSearchParams();
  const srcOverride = searchParams.get("src"); // "tcgcsv" = force market-set endpoint

  const [setData,  setSetData]   = useState<SetData | null>(null);
  const [loading,  setLoading]   = useState(true);
  const [error,    setError]     = useState("");
  const [query,    setQuery]     = useState("");
  const [sortKey,  setSortKey]   = useState<SortKey>("number");
  const [rarityFilter, setRarityFilter] = useState("all");
  const [viewMode, setViewMode]  = useState<"all" | "hits" | "playables">("all");
  const [selected, setSelected]  = useState<CardData | null>(null);

  const gridRef  = useRef<HTMLDivElement>(null);
  const heroRef  = useRef<HTMLDivElement>(null);

  // Fetch set data
  useEffect(() => {
    // game=pokemon uses pokemontcg.io UNLESS ?src=tcgcsv is set
    // (tcgcsv is used for promo groups not yet in pokemontcg.io)
    const useTcgCsv = srcOverride === "tcgcsv" || game !== "pokemon";
    const endpoint = useTcgCsv
      ? `/api/market-set?game=${encodeURIComponent(game)}&groupId=${encodeURIComponent(groupId)}`
      : `/api/pokemon-set?setId=${encodeURIComponent(groupId)}`;
    fetch(endpoint)
      .then(r => r.json())
      .then((d: SetData & { error?: string }) => {
        if (d.error) { setError(d.error); setLoading(false); return; }
        setSetData(d);
        setLoading(false);
      })
      .catch(() => { setError("Failed to load set."); setLoading(false); });
  }, [game, groupId]);

  // Hero entrance
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    gsap.fromTo(
      el.querySelectorAll(".hero-animate"),
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.5, ease: "power2.out", stagger: 0.08 }
    );
  }, [setData]);

  // Card grid stagger animation (runs when visible cards change)
  const animateGrid = useCallback(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const cards = Array.from(grid.querySelectorAll<HTMLElement>(".card-item"));
    gsap.fromTo(
      cards,
      { opacity: 0, y: 36, scale: 0.94 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.4,
        ease: "power2.out",
        stagger: 0.025,
        clearProps: "transform,opacity",
      }
    );
  }, []);

  // Trigger stagger when sort/filter/search/viewMode changes
  useEffect(() => {
    animateGrid();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortKey, rarityFilter, query, viewMode]);

  // Also trigger once data loads
  useEffect(() => {
    if (!loading && setData) {
      animateGrid();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const meta = GAME_META[game] ?? GAME_META["pokemon"];

  // Build filtered + sorted card list
  const allCards    = setData?.cards ?? [];
  const rarities    = Array.from(new Set(allCards.map(c => c.rarity).filter(Boolean))) as string[];
  const filtered    = allCards.filter(c => {
    const matchQ = !query || c.name.toLowerCase().includes(query.toLowerCase());
    const matchR = rarityFilter === "all" || c.rarity === rarityFilter;
    const matchV = viewMode === "all"
      ? true
      : viewMode === "hits"
      ? isHit(c)
      : isPlayable(c);
    return matchQ && matchR && matchV;
  });
  const sorted      = sortCards(filtered, sortKey);

  // ---------------------------------------------------------------------------
  // Loading / error states
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--text-muted)]">
        <span className="animate-pulse">Loading set…</span>
      </div>
    );
  }

  if (error || !setData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-red-400">
        <p>{error || "Set not found."}</p>
        <Link href="/tools/cards" className="label-upper text-[10px] text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors">
          ← Back to sets
        </Link>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[var(--background)]">

      {/* ── Hero ── */}
      <div
        ref={heroRef}
        className={`relative overflow-hidden border-b border-[var(--border-strong)] bg-gradient-to-br ${meta.backBg}`}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12 md:py-16">
          {/* Breadcrumb */}
          <div className="hero-animate flex items-center gap-2 mb-4 text-white/40 text-xs">
            <Link href="/tools/cards" className="hover:text-white/70 transition-colors">
              Card Gallery
            </Link>
            <span>/</span>
            <span>{meta.emoji} {meta.label}</span>
          </div>

          <h1
            className="hero-animate text-4xl md:text-5xl font-black text-white leading-none tracking-tight mb-2"
            style={{ fontFamily: "var(--font-serif, serif)" }}
          >
            {setData.name}
          </h1>

          <div className="hero-animate flex flex-wrap items-center gap-3 mt-3">
            <span className="label-upper text-[10px] text-white/50">
              {formatDate(setData.publishedOn)}
            </span>
            <span className="label-upper text-[10px] px-2 py-0.5 rounded border border-white/20 text-white/60 bg-white/5">
              {setData.totalCards} cards
            </span>
          </div>
        </div>

        {/* Decorative lines */}
        <div className="absolute inset-0 pointer-events-none">
          {[0.15, 0.4, 0.65, 0.85].map((x, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 w-px bg-white/5"
              style={{ left: `${x * 100}%` }}
            />
          ))}
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="sticky top-0 z-30 bg-[var(--background)]/95 backdrop-blur-md border-b border-[var(--border-strong)]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-2.5 flex flex-wrap items-center gap-2">

          {/* View mode toggle — Hits / All / Playables */}
          {game === "pokemon" && (
            <div className="flex items-center rounded-lg overflow-hidden border border-[var(--border)] shrink-0">
              {(["hits", "all", "playables"] as const).map(mode => {
                const labels: Record<string, string> = {
                  hits: "✨ Hits",
                  all: "All",
                  playables: "🎮 Playables",
                };
                return (
                  <button
                    key={mode}
                    onClick={() => { setViewMode(mode); setRarityFilter("all"); }}
                    className={`label-upper text-[9px] px-3 py-1.5 transition-colors ${
                      viewMode === mode
                        ? "bg-[var(--foreground)] text-[var(--background)]"
                        : "text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)]"
                    }`}
                  >
                    {labels[mode]}
                  </button>
                );
              })}
            </div>
          )}

          {/* Search */}
          <input
            type="search"
            placeholder="Search cards…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 min-w-[140px] max-w-xs text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-[var(--foreground)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--border-strong)]"
          />

          {/* Rarity filter — hidden when Hits/Playables view is active */}
          {rarities.length > 0 && viewMode === "all" && (
            <select
              value={rarityFilter}
              onChange={e => setRarityFilter(e.target.value)}
              className="text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-[var(--foreground)] focus:outline-none"
            >
              <option value="all">All Rarities</option>
              {rarities.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          )}

          {/* Sort */}
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
            className="text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-[var(--foreground)] focus:outline-none"
          >
            <option value="number">Sort: Number</option>
            <option value="name">Sort: Name</option>
            <option value="price-desc">Sort: Price ↓</option>
            <option value="price-asc">Sort: Price ↑</option>
            <option value="rarity">Sort: Rarity</option>
          </select>

          {/* Result count + Limitless link for playables */}
          <div className="flex items-center gap-2 ml-auto shrink-0">
            {viewMode === "playables" && game === "pokemon" && (
              <a
                href="https://limitlesstcg.com/decks?format=standard&game=POKEMON"
                target="_blank"
                rel="noopener noreferrer"
                className="label-upper text-[8px] text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                via Limitless ↗
              </a>
            )}
            <span className="label-upper text-[9px] text-[var(--text-muted)]">
              {sorted.length} / {allCards.length}
            </span>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-8">

        {/* Stats — only when there are cards */}
        {allCards.length > 0 && <StatsBar cards={allCards} game={game} />}

        {/* Card grid */}
        {allCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <span className="text-5xl">{meta.emoji}</span>
            <p className="text-[var(--foreground)] font-bold text-lg">
              Individual cards not yet listed
            </p>
            <p className="text-[var(--text-muted)] text-sm max-w-sm leading-relaxed">
              TCGPlayer hasn&apos;t added individual card listings for{" "}
              <span className="text-[var(--foreground)] font-semibold">{setData.name}</span>{" "}
              yet. Check back after the set releases or once singles go on sale.
            </p>
            <a
              href={`https://www.tcgplayer.com/search/${game}/product?q=${encodeURIComponent(setData.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="label-upper text-[10px] px-4 py-2 border border-[var(--border)] text-[var(--text-muted)] rounded-lg hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition-colors"
            >
              Search on TCGPlayer ↗
            </a>
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16 text-[var(--text-muted)] text-sm">
            No cards match your filters.
          </div>
        ) : (
          <div
            ref={gridRef}
            className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3"
          >
            {sorted.map(card => (
              <CardItem
                key={card.productId}
                card={card}
                game={game}
                onSelect={setSelected}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {selected && (
        <CardModal
          card={selected}
          game={game}
          setName={setData.name}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
