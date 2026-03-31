"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Listing, ListingCondition } from "@/types/post";
import CardAutocomplete from "@/components/CardAutocomplete";
import type { AnyCardResult } from "@/components/CardAutocomplete";
import FlipCard from "@/components/FlipCard";
import type { FabCardPrinting } from "@/app/api/fab-cards/route";
import type { JeuxProduct } from "@/lib/jeux";
import { getReprintRisk, REPRINT_RISK_STYLE, REPRINT_RISK_LABEL } from "@/lib/reprint-risk";

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

type ProductTypeFilter = "" | "card" | "sealed";
const PRODUCT_TYPES: { value: ProductTypeFilter; label: string }[] = [
  { value: "", label: "All" },
  { value: "card", label: "Singles" },
  { value: "sealed", label: "Sealed" },
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
  const reprintRisk = listing.listingType !== "sealed"
    ? getReprintRisk(listing.cardName)
    : null;

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
        {listing.listingType === "sealed" && (
          <span className="absolute bottom-2 left-2 label-upper text-[10px] bg-purple-600 text-white px-2 py-0.5">
            Sealed
          </span>
        )}
        {reprintRisk && (
          <span
            className={`absolute top-2 right-2 label-upper text-[10px] px-2 py-0.5 border ${REPRINT_RISK_STYLE[reprintRisk.risk]}`}
            title={reprintRisk.notes}
          >
            {REPRINT_RISK_LABEL[reprintRisk.risk]}
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
// Jeux Kingdom listing card
// ---------------------------------------------------------------------------

function JeuxListingCard({ product }: { product: JeuxProduct }) {
  const availableVariants = product.variants.filter((v) => v.available);
  const hasStock = availableVariants.length > 0;
  const [fallbackImg, setFallbackImg] = useState<string | null>(null);

  // Attempt to resolve a card image from the FaB / GA APIs if Shopify has no image
  useEffect(() => {
    if (product.imageUrl || !product.fallbackImageQuery) return;
    const q = encodeURIComponent(product.fallbackImageQuery);
    // Try FaB first, then GA
    fetch(`/api/fab-cards?q=${q}`)
      .then((r) => r.json())
      .then((d) => {
        const img = d.cards?.[0]?.imageUrl;
        if (img) { setFallbackImg(img); return; }
        return fetch(`/api/ga-cards?q=${q}`)
          .then((r) => r.json())
          .then((d2) => { if (d2.cards?.[0]?.imageUrl) setFallbackImg(d2.cards[0].imageUrl); });
      })
      .catch(() => {});
  }, [product.imageUrl, product.fallbackImageQuery]);

  const displayImage = product.imageUrl ?? fallbackImg;

  return (
    <Link
      href={`/marketplace/jeux/${product.handle}`}
      className="group border border-[var(--border)] hover:border-[var(--border-strong)] transition-colors bg-[var(--background)] flex flex-col"
    >
      {/* Image */}
      <div className="aspect-[3/4] bg-[var(--muted)] overflow-hidden relative">
        {displayImage ? (
          <Image
            src={displayImage}
            alt={product.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="label-upper text-[var(--text-muted)] text-[10px]">No Image</span>
          </div>
        )}
        <span className="absolute top-2 left-2 label-upper text-[10px] bg-amber-500 text-white px-2 py-0.5">
          Jeux
        </span>
        {product.listingType === "sealed" && (
          <span className="absolute bottom-2 left-2 label-upper text-[10px] bg-purple-600 text-white px-2 py-0.5">
            Sealed
          </span>
        )}
        {!hasStock && (
          <span className="absolute top-2 right-2 label-upper text-[10px] bg-[var(--foreground)] text-[var(--background)] px-2 py-0.5 opacity-70">
            Sold out
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col gap-1.5 flex-1">
        <p className="font-bold text-[var(--foreground)] leading-tight line-clamp-2 text-sm">
          {product.title}
        </p>
        <p className="label-upper text-[var(--text-muted)] text-[10px]">{product.productType}</p>

        {availableVariants.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {availableVariants.slice(0, 3).map((v) => (
              <span
                key={v.variantId}
                className={`label-upper text-[10px] px-1.5 py-0.5 rounded-sm ${conditionBadge(v.condition as ListingCondition)}`}
              >
                {v.condition}
              </span>
            ))}
            {availableVariants.length > 3 && (
              <span className="label-upper text-[10px] text-[var(--text-muted)] px-1 py-0.5">
                +{availableVariants.length - 3} more
              </span>
            )}
          </div>
        )}

        <div className="mt-auto pt-3 flex items-end justify-between gap-2">
          {product.lowestPriceSGD !== null ? (
            <span className="text-xl font-black text-[var(--foreground)]" style={{ fontFamily: "var(--font-serif, serif)" }}>
              S${(product.lowestPriceSGD / 100).toFixed(2)}
            </span>
          ) : (
            <span className="text-sm text-[var(--text-muted)]">—</span>
          )}
          <span className="label-upper text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
            View details →
          </span>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Store source filter types
// ---------------------------------------------------------------------------

type StoreSource = "all" | "tcgtimes" | "jeux";

const STORE_SOURCES: { value: StoreSource; label: string }[] = [
  { value: "all", label: "All Stores" },
  { value: "tcgtimes", label: "TCG Times Sellers" },
  { value: "jeux", label: "🏪 Jeux Kingdom" },
];

// ---------------------------------------------------------------------------
// Jeux credits badge (only visible when JEUX_SHOPIFY_ADMIN_TOKEN is set)
// ---------------------------------------------------------------------------

function JeuxCreditsBadge() {
  const [data, setData] = useState<{ enabled: boolean; creditSGD?: number; found?: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/jeux/credits")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data?.enabled) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-xs">
      <span className="label-upper text-[11px] text-amber-700 dark:text-amber-300 font-semibold">
        Jeux Credit
      </span>
      {data.found ? (
        <span className="font-black text-amber-800 dark:text-amber-200">
          S${((data.creditSGD ?? 0) / 100).toFixed(2)}
        </span>
      ) : (
        <a
          href="https://www.jeuxkingdom.com"
          target="_blank"
          rel="noopener noreferrer"
          className="label-upper text-[10px] text-amber-600 dark:text-amber-400 underline underline-offset-2 hover:opacity-70"
        >
          Link Jeux account ↗
        </a>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter panel (popover)
// ---------------------------------------------------------------------------

interface FilterPanelProps {
  tab: "store" | "community";
  storeSource: StoreSource;
  setStoreSource: (v: StoreSource) => void;
  productType: ProductTypeFilter;
  setProductType: (v: ProductTypeFilter) => void;
  game: string;
  setGame: (v: string) => void;
  showSoldOut: boolean;
  setShowSoldOut: (v: boolean) => void;
}

function FilterPanel({
  tab, storeSource, setStoreSource, productType, setProductType,
  game, setGame, showSoldOut, setShowSoldOut,
}: FilterPanelProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  // Count active non-default filters
  const activeCount = [
    tab === "store" && storeSource !== "all",
    productType !== "",
    game !== "",
    showSoldOut,
  ].filter(Boolean).length;

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 label-upper px-4 py-2.5 text-[11px] border transition-colors ${
          open || activeCount > 0
            ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
            : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)]"
        }`}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="2" y1="4" x2="14" y2="4" />
          <line x1="4" y1="8" x2="12" y2="8" />
          <line x1="6" y1="12" x2="10" y2="12" />
        </svg>
        Filters
        {activeCount > 0 && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold bg-[var(--background)] text-[var(--foreground)]">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 z-50 w-72 bg-[var(--background)] border border-[var(--border-strong)] shadow-xl p-4 flex flex-col gap-5">

          {/* Store source — only on Store tab */}
          {tab === "store" && (
            <div>
              <p className="label-upper text-[10px] text-[var(--text-muted)] mb-2">Store</p>
              <div className="flex flex-wrap gap-1.5">
                {STORE_SOURCES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setStoreSource(s.value)}
                    className={`label-upper px-3 py-1.5 text-[10px] border transition-colors ${
                      storeSource === s.value
                        ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                        : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Product type */}
          <div>
            <p className="label-upper text-[10px] text-[var(--text-muted)] mb-2">Product Type</p>
            <div className="flex flex-wrap gap-1.5">
              {PRODUCT_TYPES.map((pt) => (
                <button
                  key={pt.value}
                  onClick={() => setProductType(pt.value)}
                  className={`label-upper px-3 py-1.5 text-[10px] border transition-colors ${
                    productType === pt.value
                      ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                      : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  {pt.label === "All" ? "All Types" : pt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Game */}
          <div>
            <p className="label-upper text-[10px] text-[var(--text-muted)] mb-2">Game</p>
            <div className="flex flex-wrap gap-1.5">
              {GAMES.map((g) => (
                <button
                  key={g.value}
                  onClick={() => setGame(g.value)}
                  className={`label-upper px-3 py-1.5 text-[10px] border transition-colors ${
                    game === g.value
                      ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                      : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Show sold-out toggle */}
          {tab === "store" && (
            <div className="flex items-center justify-between pt-1 border-t border-[var(--border)]">
              <span className="label-upper text-[10px] text-[var(--text-muted)]">Show sold-out</span>
              <button
                onClick={() => setShowSoldOut(!showSoldOut)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                  showSoldOut ? "bg-[var(--foreground)]" : "bg-[var(--border-strong)]"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-[var(--background)] transition-transform ${
                    showSoldOut ? "translate-x-4" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          )}

          {/* Clear all */}
          {activeCount > 0 && (
            <button
              onClick={() => {
                setStoreSource("all");
                setProductType("");
                setGame("");
                setShowSoldOut(false);
              }}
              className="label-upper text-[10px] text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors underline underline-offset-2 text-left"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sell modal
// ---------------------------------------------------------------------------

function SellModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [listingType, setListingType] = useState<"card" | "sealed">("card");
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
        listingType,
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

        {/* Listing type toggle */}
        <div className="flex gap-2 mb-5">
          {(["card", "sealed"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setListingType(t);
                setCardName(""); setCardPrintings([]); setSetName("");
                setImageUrl(""); setBackImageUrl(undefined); setPriceSuggestion(null);
              }}
              className={`label-upper px-4 py-2 text-[11px] border transition-colors flex-1 ${
                listingType === t
                  ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                  : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {t === "card" ? "🃏 Single Card" : "📦 Sealed Product"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          {/* Card name — autocomplete for singles, plain text for sealed */}
          <div className="flex flex-col gap-1.5">
            <span className="label-upper text-[10px] text-[var(--text-muted)]">
              {listingType === "card" ? "Card Name *" : "Product Name *"}
            </span>
            {listingType === "card" ? (
              <>
                <CardAutocomplete
                  game={game as "flesh-and-blood" | "grand-archive" | "one-piece" | "pokemon"}
                  value={cardName}
                  onChange={(v) => { setCardName(v); setPriceSuggestion(null); setCardPrintings([]); }}
                  onSelect={handleCardSelect}
                />
                <p className="text-[10px] text-[var(--text-muted)]">
                  Search to load set options from the card database
                </p>
              </>
            ) : (
              <input
                type="text"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                required
                placeholder="e.g. Monarch Booster Box, Rhinar Blitz Deck…"
                className="border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--border-strong)] outline-none"
              />
            )}
          </div>

          {/* Card preview — singles only */}
          {listingType === "card" && imageUrl && (
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

          {/* Set name — only for singles */}
          {listingType === "card" && (
            <div className="flex flex-col gap-1.5">
              <span className="label-upper text-[10px] text-[var(--text-muted)]">Set Name *</span>
              <SetNameCombobox
                value={setName}
                printings={cardPrintings}
                onChange={(sn, img, back) => { setSetName(sn); if (img) setImageUrl(img); setBackImageUrl(back); }}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="label-upper text-[10px] text-[var(--text-muted)]">Game *</span>
              <select
                value={game} onChange={(e) => {
                  setGame(e.target.value);
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

            {/* Condition — singles only */}
            {listingType === "card" ? (
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
            ) : (
              <div className="flex flex-col gap-1.5">
                <span className="label-upper text-[10px] text-[var(--text-muted)]">Sealed Condition</span>
                <div className="border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-sm text-[var(--text-muted)]">
                  Factory Sealed / New
                </div>
              </div>
            )}
          </div>

          {/* Condition notes — singles only */}
          {listingType === "card" && (
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
          )}

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
  const [storeSource, setStoreSource] = useState<StoreSource>("all");
  const [productType, setProductType] = useState<ProductTypeFilter>("");
  const [listings, setListings] = useState<Listing[]>([]);
  const [jeuxProducts, setJeuxProducts] = useState<JeuxProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState("");
  const [card, setCard] = useState("");
  const [search, setSearch] = useState(""); // committed search term
  const [showSell, setShowSell] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  // Hide sold-out products by default; revealed via filter toggle or when searching
  const [showSoldOut, setShowSoldOut] = useState(false);

  // Check login state
  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(({ user }) => setIsLoggedIn(!!user));
  }, []);

  const fetchListings = useCallback(async () => {
    const params = new URLSearchParams({ marketplace: tab });
    if (game) params.set("game", game);
    if (search) params.set("card", search);
    if (productType) params.set("listingType", productType);
    const res = await fetch(`/api/marketplace?${params}`);
    const data = await res.json();
    setListings(data.listings ?? []);
  }, [tab, game, search, productType]);

  const fetchJeuxProducts = useCallback(async () => {
    if (tab !== "store") return;
    const params = new URLSearchParams();
    if (game) params.set("game", game);
    if (search) params.set("query", search);
    if (productType) params.set("listingType", productType);
    // Show sold-out only when explicitly toggled or when the user is searching
    const hideSoldOut = !showSoldOut && !search;
    if (!hideSoldOut) params.set("hideSoldOut", "false");
    const res = await fetch(`/api/jeux/products?${params}`);
    const data = await res.json();
    setJeuxProducts(data.products ?? []);
  }, [tab, game, search, productType, showSoldOut]);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      const needsTcgTimes = storeSource !== "jeux";
      const needsJeux = tab === "store" && storeSource !== "tcgtimes";
      await Promise.all([
        needsTcgTimes ? fetchListings() : Promise.resolve(),
        needsJeux ? fetchJeuxProducts() : Promise.resolve(),
      ]);
      setLoading(false);
    }
    fetchAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, game, search, storeSource, productType, showSoldOut]);

  function handleTabChange(t: "store" | "community") {
    setTab(t);
    if (t === "community") setStoreSource("all");
  }

  const showJeux = tab === "store" && (storeSource === "all" || storeSource === "jeux");
  const showTcgTimes = storeSource !== "jeux" || tab === "community";
  const hasAnyResults = (showTcgTimes && listings.length > 0) || (showJeux && jeuxProducts.length > 0);

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
        <div className="flex items-center gap-3 flex-wrap">
          <JeuxCreditsBadge />
          {isLoggedIn ? (
            <button
              onClick={() => setShowSell(true)}
              className="label-upper px-6 py-3 bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 transition-opacity self-start sm:self-auto"
            >
              + List a Card
            </button>
          ) : (
            <a href="/login" className="label-upper px-6 py-3 border border-[var(--border-strong)] text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors self-start sm:self-auto">
              Sign in to sell →
            </a>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)] mb-6">
        {(["store", "community"] as const).map((t) => (
          <button
            key={t}
            onClick={() => handleTabChange(t)}
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

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <FilterPanel
          tab={tab}
          storeSource={storeSource}
          setStoreSource={setStoreSource}
          productType={productType}
          setProductType={setProductType}
          game={game}
          setGame={setGame}
          showSoldOut={showSoldOut}
          setShowSoldOut={setShowSoldOut}
        />
        {/* Active filter chips */}
        {storeSource !== "all" && tab === "store" && (
          <span className="flex items-center gap-1 label-upper text-[10px] px-2.5 py-1.5 bg-[var(--muted)] border border-[var(--border)] text-[var(--foreground)]">
            {STORE_SOURCES.find((s) => s.value === storeSource)?.label}
            <button onClick={() => setStoreSource("all")} className="ml-0.5 opacity-50 hover:opacity-100">✕</button>
          </span>
        )}
        {productType && (
          <span className="flex items-center gap-1 label-upper text-[10px] px-2.5 py-1.5 bg-[var(--muted)] border border-[var(--border)] text-[var(--foreground)]">
            {PRODUCT_TYPES.find((p) => p.value === productType)?.label}
            <button onClick={() => setProductType("")} className="ml-0.5 opacity-50 hover:opacity-100">✕</button>
          </span>
        )}
        {game && (
          <span className="flex items-center gap-1 label-upper text-[10px] px-2.5 py-1.5 bg-[var(--muted)] border border-[var(--border)] text-[var(--foreground)]">
            {GAMES.find((g) => g.value === game)?.label}
            <button onClick={() => setGame("")} className="ml-0.5 opacity-50 hover:opacity-100">✕</button>
          </span>
        )}
        {showSoldOut && (
          <span className="flex items-center gap-1 label-upper text-[10px] px-2.5 py-1.5 bg-[var(--muted)] border border-[var(--border)] text-[var(--foreground)]">
            Incl. sold out
            <button onClick={() => setShowSoldOut(false)} className="ml-0.5 opacity-50 hover:opacity-100">✕</button>
          </span>
        )}
      </div>

      {/* Card / product search */}
      <div className="flex mb-8 max-w-sm">
        <input
          value={card}
          onChange={(e) => setCard(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") setSearch(card); }}
          placeholder="Search card or product name…"
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
      ) : !hasAnyResults ? (
        <div className="text-center py-20 border border-dashed border-[var(--border)]">
          <p className="label-upper text-[var(--text-muted)] mb-2">No listings found</p>
          <p className="text-sm text-[var(--text-muted)]">
            {tab === "store" ? "No store listings match your filters." : "Be the first to list a card in the community marketplace."}
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Jeux Kingdom products */}
          {showJeux && jeuxProducts.length > 0 && (
            <div>
              {storeSource === "all" && (
                <div className="flex items-center gap-3 mb-4">
                  <span className="label-upper text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                    🏪 Jeux Kingdom
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {jeuxProducts.length} product{jeuxProducts.length !== 1 ? "s" : ""} · live stock · prices in SGD
                  </span>
                  <a
                    href="https://www.jeuxkingdom.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="label-upper text-[10px] text-[var(--text-muted)] hover:text-[var(--foreground)] underline underline-offset-2 transition-colors ml-auto"
                  >
                    View full store ↗
                  </a>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {jeuxProducts.map((p) => <JeuxListingCard key={p.id} product={p} />)}
              </div>
            </div>
          )}

          {/* TCG Times listings */}
          {showTcgTimes && listings.length > 0 && (
            <div>
              {storeSource === "all" && tab === "store" && (
                <div className="flex items-center gap-3 mb-4">
                  <span className="label-upper text-[11px] text-[var(--text-muted)] font-semibold">
                    TCG Times Sellers
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {listings.length} listing{listings.length !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sell modal */}
      {showSell && (
        <SellModal onClose={() => setShowSell(false)} onCreated={fetchListings} />
      )}
    </div>
  );
}
