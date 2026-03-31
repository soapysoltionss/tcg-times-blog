"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { JeuxProduct, JeuxVariant } from "@/lib/jeux";
import type { ListingCondition } from "@/types/post";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function conditionBadge(c: string) {
  const map: Record<string, string> = {
    "Near Mint": "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    "Lightly Played": "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    "Moderately Played": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
    "Heavily Played": "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    "Damaged": "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  };
  return map[c] ?? "bg-[var(--muted)] text-[var(--foreground)]";
}

function gameLabel(slug: string): string {
  const map: Record<string, string> = {
    "flesh-and-blood": "Flesh and Blood",
    "grand-archive": "Grand Archive",
    "one-piece": "One Piece",
    "pokemon": "Pokémon",
    "magic": "Magic: The Gathering",
    "other": "Other",
  };
  return map[slug] ?? slug;
}

// ---------------------------------------------------------------------------
// Price breakdown section
// ---------------------------------------------------------------------------

function VariantTable({ variants }: { variants: JeuxVariant[] }) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b border-[var(--border)]">
          <th className="text-left label-upper text-[10px] text-[var(--text-muted)] py-2 pr-4">Condition / Variant</th>
          <th className="text-right label-upper text-[10px] text-[var(--text-muted)] py-2 pr-4">Price (SGD)</th>
          <th className="text-right label-upper text-[10px] text-[var(--text-muted)] py-2">Stock</th>
        </tr>
      </thead>
      <tbody>
        {variants.map((v) => (
          <tr key={v.variantId} className={`border-b border-[var(--border)] ${!v.available ? "opacity-40" : ""}`}>
            <td className="py-2.5 pr-4">
              <span className={`label-upper text-[10px] px-2 py-0.5 rounded-sm ${conditionBadge(v.condition as ListingCondition)}`}>
                {v.condition}
              </span>
            </td>
            <td className="py-2.5 pr-4 text-right font-black" style={{ fontFamily: "var(--font-serif, serif)" }}>
              S${(v.priceSGD / 100).toFixed(2)}
            </td>
            <td className="py-2.5 text-right">
              {v.available ? (
                <span className="label-upper text-[10px] text-green-600 dark:text-green-400">In stock</span>
              ) : (
                <span className="label-upper text-[10px] text-[var(--text-muted)]">Sold out</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Price insight panel
// ---------------------------------------------------------------------------

function PriceInsights({ product }: { product: JeuxProduct }) {
  const available = product.variants.filter((v) => v.available);
  const all = product.variants;
  const prices = available.map((v) => v.priceSGD);
  const allPrices = all.map((v) => v.priceSGD);

  const lowest = prices.length > 0 ? Math.min(...prices) : null;
  const highest = prices.length > 0 ? Math.max(...prices) : null;
  const spread = lowest !== null && highest !== null ? highest - lowest : null;

  const lowestEver = allPrices.length > 0 ? Math.min(...allPrices) : null;
  const highestEver = allPrices.length > 0 ? Math.max(...allPrices) : null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[var(--border)]">
      {[
        {
          label: "Lowest Available",
          value: lowest !== null ? `S$${(lowest / 100).toFixed(2)}` : "—",
          sub: "cheapest in-stock variant",
        },
        {
          label: "Highest Available",
          value: highest !== null ? `S$${(highest / 100).toFixed(2)}` : "—",
          sub: "premium variant price",
        },
        {
          label: "Price Spread",
          value: spread !== null ? `S$${(spread / 100).toFixed(2)}` : "—",
          sub: "between variants",
        },
        {
          label: "Variants",
          value: String(product.variants.length),
          sub: `${available.length} in stock`,
        },
      ].map((stat) => (
        <div key={stat.label} className="bg-[var(--background)] p-4">
          <p className="label-upper text-[10px] text-[var(--text-muted)] mb-1">{stat.label}</p>
          <p className="text-2xl font-black text-[var(--foreground)]" style={{ fontFamily: "var(--font-serif, serif)" }}>
            {stat.value}
          </p>
          <p className="label-upper text-[9px] text-[var(--text-muted)] mt-0.5">{stat.sub}</p>
        </div>
      ))}
      <div className="hidden">
        {/* Suppress unused — lowestEver / highestEver reserved for future price history chart */}
        {lowestEver}{highestEver}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fallback image loader (card APIs)
// ---------------------------------------------------------------------------

function useCardFallbackImage(product: JeuxProduct | null): string | null {
  const [img, setImg] = useState<string | null>(null);

  useEffect(() => {
    if (!product || product.imageUrl || !product.fallbackImageQuery) return;
    const q = encodeURIComponent(product.fallbackImageQuery);
    fetch(`/api/fab-cards?q=${q}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.cards?.[0]?.imageUrl) { setImg(d.cards[0].imageUrl); return; }
        return fetch(`/api/ga-cards?q=${q}`)
          .then((r) => r.json())
          .then((d2) => { if (d2.cards?.[0]?.imageUrl) setImg(d2.cards[0].imageUrl); });
      })
      .catch(() => {});
  }, [product]);

  return img;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function JeuxProductPage() {
  const { handle } = useParams<{ handle: string }>();
  const [product, setProduct] = useState<JeuxProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const fallbackImg = useCardFallbackImage(product);

  useEffect(() => {
    if (!handle) return;
    // Fetch all products and find by handle (cheap — cached for 5 min)
    fetch(`/api/jeux/products?hideSoldOut=false`)
      .then((r) => r.json())
      .then((d) => {
        const found = (d.products as JeuxProduct[]).find((p) => p.handle === handle);
        if (found) setProduct(found);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [handle]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <span className="w-6 h-6 border-2 border-[var(--border)] border-t-[var(--foreground)] rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <p className="label-upper text-[var(--text-muted)] mb-4">Product not found</p>
        <Link href="/marketplace" className="label-upper text-sm underline underline-offset-2 hover:opacity-70">
          ← Back to Marketplace
        </Link>
      </div>
    );
  }

  const displayImage = product.imageUrl ?? fallbackImg;
  const availableVariants = product.variants.filter((v) => v.available);
  const hasStock = availableVariants.length > 0;

  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-10 py-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 mb-8 text-[var(--text-muted)]">
        <Link href="/marketplace" className="label-upper text-[10px] hover:text-[var(--foreground)] transition-colors">
          Marketplace
        </Link>
        <span className="label-upper text-[10px]">/</span>
        <span className="label-upper text-[10px] text-amber-600 dark:text-amber-400">Jeux Kingdom</span>
        <span className="label-upper text-[10px]">/</span>
        <span className="label-upper text-[10px] text-[var(--foreground)] line-clamp-1">{product.title}</span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr] gap-10">
        {/* Left — image */}
        <div className="flex flex-col gap-4">
          <div className="aspect-[3/4] bg-[var(--muted)] overflow-hidden relative border border-[var(--border)]">
            {displayImage ? (
              <Image
                src={displayImage}
                alt={product.title}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 320px"
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                <span className="text-4xl opacity-20">🃏</span>
                <span className="label-upper text-[10px] text-[var(--text-muted)]">No image available</span>
              </div>
            )}
            {product.listingType === "sealed" && (
              <span className="absolute bottom-3 left-3 label-upper text-[10px] bg-purple-600 text-white px-2 py-0.5">
                Sealed
              </span>
            )}
            {!hasStock && (
              <div className="absolute inset-0 bg-[var(--background)]/60 flex items-center justify-center">
                <span className="label-upper text-sm font-bold text-[var(--foreground)]">Sold Out</span>
              </div>
            )}
          </div>

          {/* CTA */}
          <a
            href={product.jeuxUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`label-upper py-3 text-center text-[12px] font-bold transition-opacity ${
              hasStock
                ? "bg-amber-500 hover:bg-amber-600 text-white"
                : "bg-[var(--muted)] text-[var(--text-muted)] border border-[var(--border)] cursor-not-allowed"
            }`}
          >
            {hasStock ? "Buy on Jeux Kingdom →" : "Out of Stock"}
          </a>

          <p className="text-[10px] text-[var(--text-muted)] text-center label-upper">
            Fulfilled by{" "}
            <a
              href="https://www.jeuxkingdom.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-[var(--foreground)]"
            >
              jeuxkingdom.com
            </a>
            {" "}· SGD pricing
          </p>
        </div>

        {/* Right — details */}
        <div className="flex flex-col gap-8">
          {/* Title & meta */}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="label-upper text-[10px] bg-amber-500 text-white px-2 py-0.5">Jeux Kingdom</span>
              <span className="label-upper text-[10px] text-[var(--text-muted)]">{gameLabel(product.game)}</span>
              {product.productType && (
                <span className="label-upper text-[10px] text-[var(--text-muted)]">· {product.productType}</span>
              )}
            </div>
            <h1
              className="text-3xl lg:text-4xl font-black text-[var(--foreground)] leading-tight mb-3"
              style={{ fontFamily: "var(--font-serif, serif)" }}
            >
              {product.title}
            </h1>
            {hasStock && product.lowestPriceSGD !== null ? (
              <div className="flex items-baseline gap-2">
                <span
                  className="text-4xl font-black text-[var(--foreground)]"
                  style={{ fontFamily: "var(--font-serif, serif)" }}
                >
                  S${(product.lowestPriceSGD / 100).toFixed(2)}
                </span>
                <span className="label-upper text-[11px] text-[var(--text-muted)]">from (SGD)</span>
              </div>
            ) : (
              <p className="label-upper text-[11px] text-[var(--text-muted)]">Currently out of stock</p>
            )}
          </div>

          {/* Price insights */}
          <div>
            <h2 className="label-upper text-[10px] text-[var(--text-muted)] mb-3">Price Insights</h2>
            <PriceInsights product={product} />
          </div>

          {/* Variant table */}
          <div>
            <h2 className="label-upper text-[10px] text-[var(--text-muted)] mb-3">
              All Variants ({product.variants.length})
            </h2>
            <VariantTable variants={product.variants} />
          </div>

          {/* Tags */}
          {product.tags.length > 0 && (
            <div>
              <h2 className="label-upper text-[10px] text-[var(--text-muted)] mb-2">Tags</h2>
              <div className="flex flex-wrap gap-1.5">
                {product.tags.map((tag) => (
                  <span
                    key={tag}
                    className="label-upper text-[10px] px-2 py-1 border border-[var(--border)] text-[var(--text-muted)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Info notice */}
          <div className="p-4 border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 flex flex-col gap-2">
            <p className="label-upper text-[10px] font-bold text-amber-700 dark:text-amber-300">
              📦 Fulfilled by Jeux Kingdom
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
              This product is sold and shipped by Jeux Kingdom. TCG Times displays their live inventory
              to help you find cards in Singapore. Click{" "}
              <strong>"Buy on Jeux Kingdom"</strong> to complete your purchase on their website.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
