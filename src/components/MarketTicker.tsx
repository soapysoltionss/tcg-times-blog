"use client";

/**
 * MarketTicker — scrolling bulletin strip at the top of every page.
 *
 * Shows real-time price movers, recent listings and recent sales from
 * /api/ticker. The strip auto-scrolls via pure CSS animation so there is
 * no JS timer on the client. The items are duplicated once to create a
 * seamless infinite loop.
 *
 * Design: newspaper trading-floor ticker — dark bar, monospaced numbers,
 * green/red change indicators.
 */

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import type { TickerEvent } from "@/app/api/ticker/route";
import { useCurrency } from "@/lib/currency";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function KindBadge({ kind }: { kind: TickerEvent["kind"] }) {
  if (kind === "listed") {
    return (
      <span className="inline-block px-1.5 py-0 rounded-sm text-[9px] font-bold tracking-widest bg-blue-500/20 text-blue-300 border border-blue-500/30 mr-1.5 shrink-0">
        NEW
      </span>
    );
  }
  if (kind === "sold") {
    return (
      <span className="inline-block px-1.5 py-0 rounded-sm text-[9px] font-bold tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mr-1.5 shrink-0">
        SOLD
      </span>
    );
  }
  // price
  return (
    <span className="inline-block px-1.5 py-0 rounded-sm text-[9px] font-bold tracking-widest bg-amber-500/20 text-amber-300 border border-amber-500/30 mr-1.5 shrink-0">
      TCG
    </span>
  );
}

function ChangePill({ pct }: { pct: number }) {
  if (pct === 0) return null;
  const up = pct > 0;
  return (
    <span
      className={`ml-1 text-[10px] font-bold tabular-nums ${
        up ? "text-emerald-400" : "text-red-400"
      }`}
    >
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function TickerItem({ event }: { event: TickerEvent }) {
  const { formatPrice } = useCurrency();
  const inner = (
    <span className="flex items-center gap-1.5 whitespace-nowrap px-5 border-r border-white/10 h-full">
      <KindBadge kind={event.kind} />

      {/* Card thumbnail — only if image available */}
      {event.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.imageUrl}
          alt=""
          aria-hidden="true"
          className="h-5 w-auto rounded-[2px] shrink-0 opacity-80"
        />
      )}

      <span className="text-[11px] font-medium text-white/90 tracking-wide">
        {event.cardName}
      </span>

      {event.kind === "price" && event.priceCents !== null && (
        <>
          <span className="text-white/40 text-[10px] mx-0.5">·</span>
          <span className="text-[11px] font-bold tabular-nums text-white/80">
            {formatPrice(event.priceCents)}
          </span>
          {event.changePct !== undefined && event.changePct !== 0 && (
            <ChangePill pct={event.changePct} />
          )}
        </>
      )}

      {event.kind === "listed" && event.priceCents !== null && (
        <>
          <span className="text-white/40 text-[10px] mx-0.5">·</span>
          <span className="text-[11px] tabular-nums text-blue-200/80">
            {formatPrice(event.priceCents)}
          </span>
        </>
      )}

      {event.kind === "sold" && event.priceCents !== null && (
        <>
          <span className="text-white/40 text-[10px] mx-0.5">·</span>
          <span className="text-[11px] tabular-nums text-emerald-200/80 line-through decoration-emerald-400/60">
            {formatPrice(event.priceCents)}
          </span>
        </>
      )}
    </span>
  );

  if (event.listingId) {
    return (
      <Link
        href={`/marketplace/${event.listingId}`}
        className="flex items-center h-full hover:bg-white/5 transition-colors"
        tabIndex={-1}
      >
        {inner}
      </Link>
    );
  }

  return <span className="flex items-center h-full">{inner}</span>;
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function MarketTicker() {
  const [events, setEvents] = useState<TickerEvent[]>([]);
  const [paused, setPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const { formatPrice } = useCurrency();

  useEffect(() => {
    let mounted = true;
    fetch("/api/ticker")
      .then((r) => r.json())
      .then((data: { events?: TickerEvent[] }) => {
        if (mounted && data.events?.length) {
          setEvents(data.events);
        }
      })
      .catch(() => {/* silently ignore */});
    return () => { mounted = false; };
  }, []);

  // Skeleton while loading
  const placeholderEvents: TickerEvent[] = Array.from({ length: 12 }, (_, i) => ({
    id:        `placeholder-${i}`,
    kind:      (["listed", "sold", "price"] as const)[i % 3],
    cardName:  ["Charizard VMAX", "Phantom Ruler", "Prism Tiger", "Eevee ex", "Iyslander", "Uzuri"][i % 6],
    game:      ["pokemon", "flesh-and-blood", "grand-archive"][i % 3],
    label:     "",
    priceCents: (i + 1) * 1234,
    changePct: i % 3 === 0 ? 4.2 : i % 3 === 1 ? -2.1 : 0,
  }));

  const display = events.length > 0 ? events : placeholderEvents;
  // Duplicate for seamless loop
  const loopItems = [...display, ...display];

  // Calculate animation duration based on item count (~50px per item @ 40px/s)
  const durationSec = Math.max(20, display.length * 4);

  return (
    <div
      className="relative w-full overflow-hidden bg-[#0c0c0e] border-b border-white/10"
      style={{ height: "32px" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Left edge label */}
      <div className="absolute left-0 top-0 z-10 flex items-center h-full px-3 bg-[#0c0c0e] border-r border-white/10 gap-2 shrink-0">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="text-[9px] font-bold tracking-widest text-white/50 uppercase select-none">
          MARKET
        </span>
      </div>

      {/* Right edge fade mask */}
      <div
        className="absolute right-0 top-0 h-full w-16 z-10 pointer-events-none"
        style={{ background: "linear-gradient(to left, #0c0c0e, transparent)" }}
      />
      <div
        className="absolute left-[80px] top-0 h-full w-8 z-10 pointer-events-none"
        style={{ background: "linear-gradient(to right, #0c0c0e, transparent)" }}
      />

      {/* Scrolling track */}
      <div
        ref={trackRef}
        className="absolute top-0 left-[88px] flex items-center h-full"
        style={{
          animation: `ticker-scroll ${durationSec}s linear infinite`,
          animationPlayState: paused ? "paused" : "running",
          willChange: "transform",
        }}
      >
        {loopItems.map((event, i) => (
          <TickerItem key={`${event.id}-${i}`} event={event} />
        ))}
      </div>

      {/* Keyframe injected inline so we don't need a global CSS file entry */}
      <style>{`
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
