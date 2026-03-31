"use client";

export interface PricePoint {
  date: string;      // e.g. "2025-01-15"
  priceCents: number;
}

interface Props {
  cardName: string;
  data: PricePoint[];
  /** When true, show the drawdown % from the peak price */
  showDrawdown?: boolean;
}

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Tiny SVG line chart — no dependencies
// ---------------------------------------------------------------------------

export function PriceGraph({ cardName, data, showDrawdown = false }: Props) {
  const W = 500;
  const H = 140;
  const PAD = { top: 16, right: 20, bottom: 36, left: 52 };

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  // Use placeholder data when no real data supplied
  const points: PricePoint[] =
    data.length >= 2
      ? data
      : [
          { date: "2025-01-01", priceCents: 1200 },
          { date: "2025-02-01", priceCents: 1350 },
          { date: "2025-03-01", priceCents: 1280 },
          { date: "2025-04-01", priceCents: 1490 },
          { date: "2025-05-01", priceCents: 1620 },
          { date: "2025-06-01", priceCents: 1555 },
          { date: "2025-07-01", priceCents: 1780 },
        ];

  const prices = points.map((p) => p.priceCents);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const rangeP = maxP - minP || 1;

  const n = points.length;

  // Map each point to (x, y) in SVG coords
  const coords = points.map((p, i) => ({
    x: PAD.left + (i / (n - 1)) * innerW,
    y: PAD.top + (1 - (p.priceCents - minP) / rangeP) * innerH,
    price: p.priceCents,
    date: p.date,
  }));

  // SVG polyline points string
  const polyline = coords.map((c) => `${c.x},${c.y}`).join(" ");

  // Filled area (close below the line)
  const area =
    `M ${coords[0].x},${coords[0].y} ` +
    coords.slice(1).map((c) => `L ${c.x},${c.y}`).join(" ") +
    ` L ${coords[n - 1].x},${H - PAD.bottom} L ${coords[0].x},${H - PAD.bottom} Z`;

  // Y axis labels (3 ticks)
  const yTicks = [0, 0.5, 1].map((t) => ({
    y: PAD.top + (1 - t) * innerH,
    label: formatPrice(minP + t * rangeP),
  }));

  // X axis labels (first + last)
  const xLabels = [
    { x: coords[0].x, label: points[0].date.slice(0, 7) },
    { x: coords[n - 1].x, label: points[n - 1].date.slice(0, 7) },
  ];

  const isPlaceholder = data.length < 2;

  // Drawdown: peak-to-current decline
  const peakPrice = Math.max(...points.map((p) => p.priceCents));
  const currentPrice = points[points.length - 1].priceCents;
  const drawdownPct = peakPrice > 0
    ? ((currentPrice - peakPrice) / peakPrice) * 100
    : 0;
  const isAtPeak = currentPrice >= peakPrice;
  const drawdownLabel = isAtPeak
    ? "At peak"
    : `${drawdownPct.toFixed(1)}% from peak`;
  const drawdownColor = isAtPeak
    ? "text-emerald-600 dark:text-emerald-400"
    : drawdownPct < -30
    ? "text-red-600 dark:text-red-400"
    : "text-amber-600 dark:text-amber-400";

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <p className="label-upper text-[var(--text-muted)] text-[10px]">Price History</p>
        <div className="flex items-center gap-2">
          {showDrawdown && !isPlaceholder && (
            <span className={`label-upper text-[10px] font-semibold ${drawdownColor}`}>
              {drawdownLabel}
            </span>
          )}
          {isPlaceholder && (
            <span className="label-upper text-[10px] px-2 py-0.5 bg-[var(--muted)] text-[var(--text-muted)] border border-[var(--border)]">
              Placeholder Data
            </span>
          )}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full border border-[var(--border)] bg-[var(--muted)]"
        aria-label={`Price history chart for ${cardName}`}
      >
        {/* Gradient fill */}
        <defs>
          <linearGradient id="price-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.15" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {yTicks.map((t, i) => (
          <line
            key={i}
            x1={PAD.left}
            y1={t.y}
            x2={W - PAD.right}
            y2={t.y}
            stroke="currentColor"
            strokeOpacity="0.12"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        ))}

        {/* Area fill */}
        <path d={area} fill="url(#price-fill)" className="text-[var(--foreground)]" />

        {/* Line */}
        <polyline
          points={polyline}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          className="text-[var(--foreground)]"
        />

        {/* Data dots */}
        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r="3"
            fill="var(--background)"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-[var(--foreground)]"
          />
        ))}

        {/* Y axis labels */}
        {yTicks.map((t, i) => (
          <text
            key={i}
            x={PAD.left - 6}
            y={t.y + 4}
            textAnchor="end"
            fontSize="10"
            fill="currentColor"
            fillOpacity="0.5"
            className="font-mono"
          >
            {t.label}
          </text>
        ))}

        {/* X axis labels */}
        {xLabels.map((l, i) => (
          <text
            key={i}
            x={l.x}
            y={H - PAD.bottom + 16}
            textAnchor="middle"
            fontSize="10"
            fill="currentColor"
            fillOpacity="0.5"
          >
            {l.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
