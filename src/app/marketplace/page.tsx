"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import type { Listing, ListingCondition } from "@/types/post";
import CardAutocomplete from "@/components/CardAutocomplete";
import type { AnyCardResult } from "@/components/CardAutocomplete";
import FlipCard from "@/components/FlipCard";
import type { FabCardPrinting } from "@/app/api/fab-cards/route";

// ---------------------------------------------------------------------------
// SetNameCombobox
// When `printings` is provided (a card was autocompleted), the dropdown shows
// only the sets/arts that card actually exists in. Selecting one also swaps
// the card preview image. When `printings` is empty, falls back to free-text.
// ---------------------------------------------------------------------------
function SetNameCombobox({
  value,
  onChange,
  printings,
}: {
  value: string;
  onChange: (setName: string, imageUrl?: string, backImageUrl?: string) => void;
  printings: FabCardPrinting[];
}) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter printings for the dropdown (show all when open, since input is read-only)
  const options = printings;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelect(p: FabCardPrinting) {
    // Store the clean set name, pass the image and back image so the preview updates
    onChange(p.setName, p.imageUrl, p.backImageUrl);
    setOpen(false);
    setActiveIdx(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || options.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      handleSelect(options[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          value={value
            ? (printings.find((p) => p.setName === value)?.label ?? value)
            : ""}
          onChange={() => {/* read-only — selection only via dropdown */}}
          onFocus={() => options.length > 0 && setOpen(true)}
          onClick={() => options.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          required
          readOnly
          placeholder={printings.length > 0 ? "Select a set / printing…" : "Search a card first"}
          className="w-full border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--border-strong)] outline-none pr-7 cursor-pointer"
        />
        {printings.length > 0 && (
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--foreground)]"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>

      {open && options.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-0.5 border border-[var(--border-strong)] bg-[var(--background)] shadow-lg max-h-52 overflow-y-auto">
          {options.map((p, idx) => (
            <li key={p.label}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleSelect(p); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                  idx === activeIdx ? "bg-[var(--muted)]" : "hover:bg-[var(--muted)]"
                } text-[var(--foreground)]`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.imageUrl} alt={p.label} className="w-6 h-8 object-cover shrink-0 border border-[var(--border)]" />
                <span>{p.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GAMES = [
  { value: "", label: "All" },
  { value: "flesh-and-blood", label: "Flesh and Blood" },
  { value: "grand-archive", label: "Grand Archive" },
  { value: "one-piece", label: "One Piece" },
  { value: "magic", label: "Magic" },
  { value: "pokemon", label: "Pokémon" },
  { value: "other", label: "Other" },
];

const CONDITIONS: ListingCondition[] = [
  "Near Mint",
  "Lightly Played",
  "Moderately Played",
  "Heavily Played",
  "Damaged",
];

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function conditionBadge(c: ListingCondition) {
  const map: Record<ListingCondition, string> = {
    "Near Mint": "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    "Lightly Played": "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    "Moderately Played": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
    "Heavily Played": "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    "Damaged": "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  };
  return map[c] ?? "";
}

// ---------------------------------------------------------------------------
// Listing card
// ---------------------------------------------------------------------------

function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Link
      href={`/marketplace/${listing.id}`}
      className="group border border-[var(--border)] hover:border-[var(--border-strong)] transition-colors bg-[var(--background)] flex flex-col"
    >
      {/* Image */}
      <div className="aspect-[3/4] bg-[var(--muted)] overflow-hidden relative">
        {listing.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.imageUrl}
            alt={listing.cardName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="label-upper text-[var(--text-muted)] text-[10px]">No Image</span>
          </div>
        )}
        {listing.marketplace === "store" && (
          <span className="absolute top-2 left-2 label-upper text-[10px] bg-[var(--foreground)] text-[var(--background)] px-2 py-0.5">
            Store
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col gap-1.5 flex-1">
        <p className="font-bold text-[var(--foreground)] leading-tight line-clamp-2 text-sm">
          {listing.cardName}
        </p>
        <p className="label-upper text-[var(--text-muted)] text-[10px]">{listing.setName}</p>

        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className={`label-upper text-[10px] px-1.5 py-0.5 rounded-sm ${conditionBadge(listing.condition)}`}>
            {listing.condition}
          </span>
          <span className="label-upper text-[10px] text-[var(--text-muted)]">×{listing.quantity}</span>
        </div>

        <div className="mt-auto pt-3 flex items-end justify-between gap-2">
          <span className="text-xl font-black text-[var(--foreground)]" style={{ fontFamily: "var(--font-serif, serif)" }}>
            {formatPrice(listing.priceCents)}
          </span>
          <div className="flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-1">
              {listing.sellerIsTrusted && (
                <span className="relative group/trusted inline-block">
                  <span title="" className="label-upper text-[9px] text-emerald-700 dark:text-emerald-400 cursor-default">✓</span>
                  <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 rounded bg-[var(--foreground)] text-[var(--background)] text-[10px] leading-snug px-3 py-2 opacity-0 group-hover/trusted:opacity-100 transition-opacity duration-150 z-50 text-center shadow-lg">
                    Trusted Seller — 10+ completed sales on TCG Times.
                    <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[var(--foreground)]" />
                  </span>
                </span>
              )}
              {listing.sellerIsVerified && (
                <span className="relative group/verified inline-block">
                  <span title="" className="label-upper text-[9px] text-blue-700 dark:text-blue-400 cursor-default">✦</span>
                  <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 rounded bg-[var(--foreground)] text-[var(--background)] text-[10px] leading-snug px-3 py-2 opacity-0 group-hover/verified:opacity-100 transition-opacity duration-150 z-50 text-center shadow-lg">
                    Verified Seller — identity verified by TCG Times staff.
                    <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[var(--foreground)]" />
                  </span>
                </span>
              )}
              <span className="label-upper text-[10px] text-[var(--text-muted)]">@{listing.sellerUsername}</span>
            </div>
            {(listing.sellerTotalSales ?? 0) > 0 && (
              <span className="label-upper text-[9px] text-[var(--text-muted)] opacity-60">
                {listing.sellerTotalSales} sale{listing.sellerTotalSales !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Sell modal
// ---------------------------------------------------------------------------

function SellModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [cardName, setCardName] = useState("");
  const [setName, setSetName] = useState("");
  const [cardPrintings, setCardPrintings] = useState<FabCardPrinting[]>([]);
  const [game, setGame] = useState("flesh-and-blood");
  const [condition, setCondition] = useState<ListingCondition>("Near Mint");
  const [conditionNotes, setConditionNotes] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [priceSuggestion, setPriceSuggestion] = useState<number | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [imageUrl, setImageUrl] = useState("");
  const [backImageUrl, setBackImageUrl] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Called when user picks a card from the autocomplete dropdown
  function handleCardSelect(card: AnyCardResult) {
    setCardName(card.name);
    setCardPrintings(card.printings as FabCardPrinting[]);
    // Pre-select the first printing so the image shows immediately
    const first = card.printings[0] ?? null;
    setSetName(first ? first.setName : "");
    setImageUrl(first ? first.imageUrl : "");
    setBackImageUrl((first as FabCardPrinting | undefined)?.backImageUrl);
    if (card.marketPriceCents !== null) {
      setPriceSuggestion(card.marketPriceCents);
      if (!priceStr) setPriceStr((card.marketPriceCents / 100).toFixed(2));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const price = Math.round(parseFloat(priceStr) * 100);
    if (isNaN(price) || price < 1) { setError("Enter a valid price."); return; }
    setSaving(true);
    setError("");
    const res = await fetch("/api/marketplace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardName, setName, game, condition,
        conditionNotes: conditionNotes.trim() || undefined,
        priceCents: price,
        quantity: parseInt(quantity, 10) || 1,
        imageUrl: imageUrl || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Something went wrong."); setSaving(false); return; }
    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div
        className="w-full max-w-lg bg-[var(--background)] border border-[var(--border-strong)] p-6 overflow-y-auto max-h-[90vh]"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-[var(--foreground)]" style={{ fontFamily: "var(--font-serif, serif)" }}>
            List a Card
          </h2>
          <button onClick={onClose} className="label-upper text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          {/* Card name with autocomplete */}
          <div className="flex flex-col gap-1.5">
            <span className="label-upper text-[10px] text-[var(--text-muted)]">Card Name *</span>
            <CardAutocomplete
              game={game as "flesh-and-blood" | "grand-archive" | "one-piece"}
              value={cardName}
              onChange={(v) => { setCardName(v); setPriceSuggestion(null); setCardPrintings([]); }}
              onSelect={handleCardSelect}
            />
            <p className="text-[10px] text-[var(--text-muted)]">
              Search to load set options from the card database
            </p>
          </div>

          {/* Card preview when image is filled */}
          {imageUrl && (
            <div className="flex flex-col items-center gap-2 p-4 border border-[var(--border)] bg-[var(--muted)]">
              <FlipCard
                frontSrc={imageUrl}
                backSrc={backImageUrl}
                alt={cardName}
                className="w-full max-w-[200px] shadow-md"
              />
              <div className="text-center">
                <p className="text-sm font-semibold text-[var(--foreground)]">{cardName}</p>
                <p className="label-upper text-[10px] text-[var(--text-muted)]">
                  {cardPrintings.find((p) => p.imageUrl === imageUrl)?.label ?? setName}
                </p>
                {priceSuggestion !== null && (
                  <p className="label-upper text-[10px] text-[var(--text-muted)] mt-0.5">
                    Market ~${(priceSuggestion / 100).toFixed(2)}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <span className="label-upper text-[10px] text-[var(--text-muted)]">Set Name *</span>
            <SetNameCombobox
              value={setName}
              printings={cardPrintings}
              onChange={(sn, img, back) => { setSetName(sn); if (img) setImageUrl(img); setBackImageUrl(back); }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="label-upper text-[10px] text-[var(--text-muted)]">Game *</span>
              <select
                value={game} onChange={(e) => {
                  setGame(e.target.value);
                  // Clear card data when switching games so old results don't carry over
                  setCardName("");
                  setCardPrintings([]);
                  setSetName("");
                  setImageUrl("");
                  setBackImageUrl(undefined);
                  setPriceSuggestion(null);
                }}
                className="border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--border-strong)] outline-none"
              >
              {GAMES.filter(g => g.value).map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="label-upper text-[10px] text-[var(--text-muted)]">Condition *</span>
                <a
                  href="/tools/condition-guide"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="label-upper text-[10px] text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors underline underline-offset-2"
                >
                  Guide ↗
                </a>
              </div>
              <select
                value={condition} onChange={(e) => setCondition(e.target.value as ListingCondition)}
                className="border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--border-strong)] outline-none"
              >
                {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>

          {/* Condition notes */}
          <label className="flex flex-col gap-1.5">
            <span className="label-upper text-[10px] text-[var(--text-muted)]">Condition Notes <span className="opacity-50">(optional)</span></span>
            <input
              type="text"
              value={conditionNotes}
              onChange={(e) => setConditionNotes(e.target.value)}
              placeholder="e.g. minor edge wear on top-right corner"
              maxLength={200}
              className="border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--border-strong)] outline-none"
            />
            <p className="text-[10px] text-[var(--text-muted)]">Describe any specific flaws so buyers know exactly what to expect.</p>
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="label-upper text-[10px] text-[var(--text-muted)]">Price (USD) *</span>
                {priceSuggestion !== null && (
                  <button
                    type="button"
                    onClick={() => setPriceStr((priceSuggestion / 100).toFixed(2))}
                    className="label-upper text-[10px] text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
                  >
                    Use ~${(priceSuggestion / 100).toFixed(2)}
                  </button>
                )}
              </div>
              <input
                type="number" min="0.01" step="0.01"
                value={priceStr} onChange={(e) => setPriceStr(e.target.value)} required
                className="border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--border-strong)] outline-none"
                placeholder="4.99"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="label-upper text-[10px] text-[var(--text-muted)]">Quantity *</span>
              <input
                type="number" min="1" step="1"
                value={quantity} onChange={(e) => setQuantity(e.target.value)} required
                className="border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--border-strong)] outline-none"
              />
            </label>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit" disabled={saving}
            className="label-upper py-3 bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 transition-opacity disabled:opacity-30 mt-2"
          >
            {saving ? "Listing…" : "Post Listing →"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function MarketplacePage() {
  const [tab, setTab] = useState<"store" | "community">("store");
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState("");
  const [card, setCard] = useState("");
  const [search, setSearch] = useState(""); // committed search term
  const [showSell, setShowSell] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Check login state
  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(({ user }) => setIsLoggedIn(!!user));
  }, []);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ marketplace: tab });
    if (game) params.set("game", game);
    if (search) params.set("card", search);
    const res = await fetch(`/api/marketplace?${params}`);
    const data = await res.json();
    setListings(data.listings ?? []);
    setLoading(false);
  }, [tab, game, search]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10">
      {/* Header */}
      <div className="border-b-2 border-[var(--border-strong)] pb-6 mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="label-upper text-[var(--text-muted)] mb-1">TCG Times</p>
          <h1 className="text-4xl font-black text-[var(--foreground)] leading-none" style={{ fontFamily: "var(--font-serif, serif)" }}>
            Marketplace
          </h1>
        </div>
        {isLoggedIn && (
          <button
            onClick={() => setShowSell(true)}
            className="label-upper px-6 py-3 bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 transition-opacity self-start sm:self-auto"
          >
            + List a Card
          </button>
        )}
        {!isLoggedIn && (
          <a href="/login" className="label-upper px-6 py-3 border border-[var(--border-strong)] text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors self-start sm:self-auto">
            Sign in to sell →
          </a>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)] mb-6">
        {(["store", "community"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`label-upper px-6 py-3 capitalize transition-colors ${
              tab === t
                ? "border-b-2 border-[var(--border-strong)] text-[var(--foreground)] -mb-px"
                : "text-[var(--text-muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {t === "store" ? "🏪 Store" : "👥 Community"}
          </button>
        ))}
      </div>

      {/* Game filter tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {GAMES.map((g) => (
          <button
            key={g.value}
            onClick={() => setGame(g.value)}
            className={`label-upper px-4 py-2 text-[11px] border transition-colors ${
              game === g.value
                ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)]"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Card search */}
      <div className="flex mb-8 max-w-sm">
        <input
          value={card}
          onChange={(e) => setCard(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") setSearch(card); }}
          placeholder="Search card name…"
          className="flex-1 border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--border-strong)] outline-none"
        />
        <button
          onClick={() => setSearch(card)}
          className="label-upper px-4 py-2 border border-l-0 border-[var(--border)] bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--border)] transition-colors text-[10px]"
        >
          Search
        </button>
      </div>

      {/* Listing grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <span className="w-6 h-6 border-2 border-[var(--border)] border-t-[var(--foreground)] rounded-full animate-spin" />
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-[var(--border)]">
          <p className="label-upper text-[var(--text-muted)] mb-2">No listings yet</p>
          <p className="text-sm text-[var(--text-muted)]">
            {tab === "store" ? "No store listings found." : "Be the first to list a card in the community marketplace."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
        </div>
      )}

      {/* Sell modal */}
      {showSell && (
        <SellModal onClose={() => setShowSell(false)} onCreated={fetchListings} />
      )}
    </div>
  );
}
