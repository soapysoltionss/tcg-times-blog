"use client";

import { useRef, useState, useCallback, useMemo } from "react";

export interface PricePoint {
  date: string;       // "YYYY-MM-DD"
  priceCents: number;
  synthetic?: boolean;
}

interface Props {
  cardName: string;
  data: PricePoint[];
  /** Show the drawdown % from the peak */
  showDrawdown?: boolean;
}

type Range = "1M" | "3M" | "6M" | "1Y" | "ALL";

const RANGES: { label: Range; days: number | null }[] = [
  { label: "1M",  days: 30  },
  { label: "3M",  days: 90  },
  { label: "6M",  days: 182 },
  { label: "1Y",  days: 365 },
  { label: "ALL", days: null },
];

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDateShort(date: string) {
  const [, m, d] = date.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`;
}

function subtractDays(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// SVG line chart with time-range toggle and hover crosshair
// ---------------------------------------------------------------------------

export function PriceGraph({ cardName, data, showDrawdown = false }: Props) {
  const W = 500;
  const H = 150;
  const PAD = { top: 16, right: 20, bottom: 36, left: 56 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const TOOLTIP_W = 92;
  const TOOLTIP_H = 36;

  // ── ALL hooks unconditionally (Rules of Hooks) ────────────────────────────
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const sorted = useMemo(
    () => [...data].sort((a, b) => a.date.localeCompare(b.date)),
    [data]
  );

  // A range is "available" only if the oldest data point is on or before the
  // cutoff — meaning we actually have data covering that full window.
  const availableRanges = useMemo(() => {
    const oldest = sorted[0]?.date ?? "";
    return RANGES.map(r => {
      if (r.days == null) {
        // ALL is always available as long as we have ≥2 points
        return { ...r, available: sorted.length >= 2 };
      }
      const cutoff = subtractDays(r.days);
      // Available only if oldest data reaches back to (or before) the cutoff
      return { ...r, available: sorted.length >= 2 && oldest <= cutoff };
    });
  }, [sorted]);

  // Default to the smallest available range so the initial view always has data
  const defaultRange = useMemo<Range>(() => {
    for (const r of RANGES) {
      const ar = availableRanges.find(a => a.label === r.label);
      if (ar?.available) return r.label;
    }
    return "ALL";
  }, [availableRanges]);

  const [range, setRange] = useState<Range | null>(null);
  // Use the computed default when no explicit selection has been made,
  // OR when the previously selected range is no longer available.
  const activeRange: Range = (() => {
    if (range == null) return defaultRange;
    const ar = availableRanges.find(a => a.label === range);
    return ar?.available ? range : defaultRange;
  })();

  // Filter data to the selected time window
  const filtered = useMemo(() => {
    const rangeDef = RANGES.find(r => r.label === activeRange)!;
    if (rangeDef.days == null) return sorted;
    const cutoff = subtractDays(rangeDef.days);
    const within = sorted.filter(p => p.date >= cutoff);
    // If the window has fewer than 2 points, show all data rather than a
    // deceptive 2-point stub — this shouldn't normally happen because
    // unavailable ranges are disabled, but guards against edge cases.
    return within.length >= 2 ? within : sorted;
  }, [sorted, activeRange]);

  // Derived chart geometry — recomputed when filtered slice changes
  const { coords, yTicks, xLabels, area, lineColor, gradId, drawdownLabel, drawdownColor, hasData } =
    useMemo(() => {
      if (filtered.length < 2) {
        return {
          coords: [], yTicks: [], xLabels: [], area: "",
          lineColor: "#22c55e", gradId: "pg-empty",
          drawdownLabel: "", drawdownColor: "", hasData: false,
        };
      }
      const n = filtered.length;
      const prices = filtered.map(p => p.priceCents);
      const minP = Math.min(...prices);
      const maxP = Math.max(...prices);
      const rangeP = maxP - minP || 1;

      const coords = filtered.map((p, i) => ({
        x: PAD.left + (i / (n - 1)) * innerW,
        y: PAD.top + (1 - (p.priceCents - minP) / rangeP) * innerH,
        price: p.priceCents,
        date: p.date,
        synthetic: p.synthetic ?? false,
      }));

      const area =
        `M ${coords[0].x},${coords[0].y} ` +
        coords.slice(1).map(c => `L ${c.x},${c.y}`).join(" ") +
        ` L ${coords[n - 1].x},${H - PAD.bottom} L ${coords[0].x},${H - PAD.bottom} Z`;

      const yTicks = [0, 0.5, 1].map(t => ({
        y: PAD.top + (1 - t) * innerH,
        label: formatPrice(Math.round(minP + t * rangeP)),
      }));

      const xLabelCount = Math.min(n, 4);
      const xLabels = Array.from({ length: xLabelCount }, (_, i) => {
        const idx = xLabelCount === 1 ? 0 : Math.round((i / (xLabelCount - 1)) * (n - 1));
        return { x: coords[idx].x, label: formatDateShort(filtered[idx].date) };
      });

      // Drawdown vs peak within the selected window
      const peakPrice = Math.max(...prices);
      const currentPrice = prices[prices.length - 1];
      const drawdownPct = peakPrice > 0 ? ((currentPrice - peakPrice) / peakPrice) * 100 : 0;
      const isAtPeak = currentPrice >= peakPrice;
      const drawdownLabel = isAtPeak ? "At peak" : `${drawdownPct.toFixed(1)}% from peak`;
      const drawdownColor = isAtPeak
        ? "text-emerald-500 dark:text-emerald-400"
        : drawdownPct < -30
        ? "text-red-500 dark:text-red-400"
        : "text-amber-500 dark:text-amber-400";

      const trendUp = prices[prices.length - 1] >= prices[0];
      const lineColor = trendUp ? "#22c55e" : "#ef4444";
      const gradId = `pg-${cardName.replace(/[^a-z0-9]/gi, "")}`;

      return { coords, yTicks, xLabels, area, lineColor, gradId, drawdownLabel, drawdownColor, hasData: true };
    }, [filtered, cardName]);

  const getClosestIdx = useCallback((clientX: number): number => {
    const svg = svgRef.current;
    if (!svg || coords.length === 0) return 0;
    const rect = svg.getBoundingClientRect();
    const svgX = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestDist = Math.abs(coords[0].x - svgX);
    for (let i = 1; i < coords.length; i++) {
      const d = Math.abs(coords[i].x - svgX);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  }, [coords]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    setHoverIdx(getClosestIdx(e.clientX));
  }, [getClosestIdx]);

  const handleTouchMove = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    e.preventDefault();
    const t = e.touches[0];
    if (t) setHoverIdx(getClosestIdx(t.clientX));
  }, [getClosestIdx]);

  // Early return AFTER all hooks
  if (!hasData) return null;

  const hovered = hoverIdx != null ? coords[hoverIdx] : null;
  const tipRight = hovered ? hovered.x < W * 0.65 : true;
  const tipX = hovered ? (tipRight ? hovered.x + 10 : hovered.x - 10 - TOOLTIP_W) : 0;
  const tipY = hovered
    ? Math.max(PAD.top, Math.min(hovered.y - TOOLTIP_H / 2, H - PAD.bottom - TOOLTIP_H))
    : 0;

  const hasEstimates = filtered.some(p => p.synthetic);

  return (
    <div className="w-full select-none">
      {/* Range toggle + metadata row */}
      <div className="flex items-center justify-between mb-1.5">
        {/* Range buttons */}
        <div className="flex items-center gap-0.5">
          {availableRanges.map(r => (
            <button
              key={r.label}
              onClick={() => { setRange(r.label); setHoverIdx(null); }}
              disabled={!r.available}
              className={[
                "label-upper text-[9px] px-2 py-0.5 rounded transition-colors",
                r.label === activeRange
                  ? "bg-[var(--foreground)] text-[var(--background)]"
                  : r.available
                  ? "text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)]"
                  : "text-[var(--text-muted)] opacity-30 cursor-not-allowed",
              ].join(" ")}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Right badges */}
        <div className="flex items-center gap-2">
          {showDrawdown && (
            <span className={`label-upper text-[10px] font-semibold ${drawdownColor}`}>
              {drawdownLabel}
            </span>
          )}
          {hasEstimates && (
            <span className="label-upper text-[9px] px-1.5 py-0.5 bg-[var(--muted)] text-[var(--text-muted)] border border-[var(--border)] rounded">
              est.
            </span>
          )}
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full border border-[var(--border)] bg-[var(--muted)] cursor-crosshair touch-none"
        aria-label={`Price history chart for ${cardName}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.2" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yTicks.map((t, i) => (
          <line key={i}
            x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y}
            stroke="currentColor" strokeOpacity="0.1" strokeWidth="1" strokeDasharray="4 3"
          />
        ))}

        {/* Area fill */}
        <path d={area} fill={`url(#${gradId})`} />

        {/* Segments — dashed where synthetic */}
        {coords.slice(0, -1).map((c, i) => {
          const isSynth = c.synthetic || coords[i + 1].synthetic;
          return (
            <line key={i}
              x1={c.x} y1={c.y} x2={coords[i + 1].x} y2={coords[i + 1].y}
              stroke={lineColor} strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray={isSynth ? "5 3" : undefined}
              opacity={isSynth ? 0.5 : 1}
            />
          );
        })}

        {/* Dots — only render if few enough points to avoid clutter */}
        {coords.length <= 60 && coords.map((c, i) => (
          <circle key={i}
            cx={c.x} cy={c.y}
            r={hoverIdx === i ? 5 : 2.5}
            fill={hoverIdx === i ? lineColor : "var(--background)"}
            stroke={lineColor} strokeWidth={hoverIdx === i ? 2 : 1.5}
            style={{ transition: "r 60ms ease, fill 60ms ease" }}
          />
        ))}

        {/* Crosshair + tooltip */}
        {hovered && (
          <>
            <line
              x1={hovered.x} y1={PAD.top} x2={hovered.x} y2={H - PAD.bottom}
              stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="3 3"
            />
            <rect
              x={tipX} y={tipY}
              width={TOOLTIP_W} height={TOOLTIP_H}
              rx="4" fill="var(--background)"
              stroke="var(--border-strong)" strokeWidth="0.75"
              opacity="0.96"
            />
            <text x={tipX + 8} y={tipY + 14} fontSize="12" fontWeight="700" fill="currentColor">
              {formatPrice(hovered.price)}
            </text>
            <text x={tipX + 8} y={tipY + 27} fontSize="9" fill="currentColor" fillOpacity="0.5">
              {formatDateShort(hovered.date)}{hovered.synthetic ? " (est.)" : ""}
            </text>
          </>
        )}

        {/* Y axis labels */}
        {yTicks.map((t, i) => (
          <text key={i}
            x={PAD.left - 6} y={t.y + 4}
            textAnchor="end" fontSize="9" fontFamily="monospace"
            fill="currentColor" fillOpacity="0.45"
          >
            {t.label}
          </text>
        ))}

        {/* X axis labels */}
        {xLabels.map((l, i) => (
          <text key={i}
            x={l.x} y={H - PAD.bottom + 14}
            textAnchor="middle" fontSize="9"
            fill="currentColor" fillOpacity="0.45"
          >
            {l.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
