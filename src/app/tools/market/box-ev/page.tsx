"use client";

import { useState } from "react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Pull {
  id: number;
  cardName: string;
  priceCents: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function parseDollars(s: string): number {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round(n * 100);
}

// ---------------------------------------------------------------------------
// Rarity presets (pulls per box × expected rarity rates)
// These are rough community-consensus pull rates for common TCG sealed products.
// ---------------------------------------------------------------------------

interface RarityPreset {
  label: string;
  packsPerBox: number;
  cardsPerPack: number;
  /** Expected pulls of each rarity tier per box */
  pulls: { rarity: string; expectedCount: number; placeholder: string }[];
}

const PRESETS: Record<string, RarityPreset> = {
  "fab-booster": {
    label: "FaB Booster Box (24 packs)",
    packsPerBox: 24,
    cardsPerPack: 16,
    pulls: [
      { rarity: "Majestic",       expectedCount: 2.4,  placeholder: "e.g. Warmonger Intimidation" },
      { rarity: "Cold Foil",      expectedCount: 0.3,  placeholder: "e.g. Heartened Cross Strap" },
      { rarity: "Marvel",         expectedCount: 0.05, placeholder: "e.g. Prism, Sculptor of Arc Light" },
      { rarity: "Legendary",      expectedCount: 0.1,  placeholder: "e.g. Anothos" },
      { rarity: "Rare (playset)", expectedCount: 48,   placeholder: "e.g. Sink Below" },
    ],
  },
  "pokemon-booster": {
    label: "Pokémon Booster Box (36 packs)",
    packsPerBox: 36,
    cardsPerPack: 10,
    pulls: [
      { rarity: "EX / Full Art",   expectedCount: 3,   placeholder: "e.g. Charizard ex" },
      { rarity: "Rare Holo",        expectedCount: 36,  placeholder: "e.g. Arcanine" },
      { rarity: "Illustration Rare",expectedCount: 1.8, placeholder: "e.g. Squirtle" },
      { rarity: "Special Art Rare", expectedCount: 0.9, placeholder: "e.g. Iono" },
      { rarity: "Hyper Rare",       expectedCount: 0.3, placeholder: "e.g. Pecharunt ex" },
    ],
  },
  "ga-booster": {
    label: "Grand Archive Booster Box (24 packs)",
    packsPerBox: 24,
    cardsPerPack: 10,
    pulls: [
      { rarity: "Rare",      expectedCount: 24,  placeholder: "e.g. Silvie, Beloved Steeple" },
      { rarity: "Epic",      expectedCount: 4.8, placeholder: "e.g. Rai, Hope's Guiding Light" },
      { rarity: "Legendary", expectedCount: 0.5, placeholder: "e.g. Merlin" },
    ],
  },
  "custom": {
    label: "Custom",
    packsPerBox: 24,
    cardsPerPack: 10,
    pulls: [
      { rarity: "Hit",        expectedCount: 1,  placeholder: "Best pull" },
      { rarity: "Semi-Hit",   expectedCount: 4,  placeholder: "Good card" },
      { rarity: "Bulk Rare",  expectedCount: 24, placeholder: "Filler rare" },
    ],
  },
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function BoxEvPage() {
  const [preset, setPreset] = useState<string>("fab-booster");
  const [boxCostStr, setBoxCostStr] = useState("");
  const [pulls, setPulls] = useState<Pull[]>([{ id: 1, cardName: "", priceCents: 0 }]);
  const [nextId, setNextId] = useState(2);

  const currentPreset = PRESETS[preset];
  const boxCostCents = parseDollars(boxCostStr);

  function updatePull(id: number, field: "cardName" | "priceCents", value: string) {
    setPulls((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, [field]: field === "priceCents" ? parseDollars(value) : value }
          : p
      )
    );
  }

  function addPull() {
    setPulls((prev) => [...prev, { id: nextId, cardName: "", priceCents: 0 }]);
    setNextId((n) => n + 1);
  }

  function removePull(id: number) {
    setPulls((prev) => prev.filter((p) => p.id !== id));
  }

  // ── Calculations ──────────────────────────────────────────────────────────

  const totalPullValueCents = pulls.reduce((s, p) => s + p.priceCents, 0);
  const profitLossCents = totalPullValueCents - boxCostCents;
  const roi = boxCostCents > 0 ? (profitLossCents / boxCostCents) * 100 : 0;
  const breakevenPerPull = pulls.length > 0 && boxCostCents > 0
    ? boxCostCents / pulls.length
    : 0;

  // Expected EV using preset pull rates
  const presetEv = currentPreset.pulls.reduce(
    (sum, tier) => sum + tier.expectedCount * (pulls.find((p) => p.cardName)?.priceCents ?? 0),
    0
  );

  const isProfit = profitLossCents >= 0;

  return (
    <div className="max-w-4xl mx-auto px-6 lg:px-10 py-10">
      {/* Header */}
      <div className="border-b-2 border-[var(--border-strong)] pb-6 mb-8">
        <nav className="flex items-center gap-2 mb-4 label-upper text-[10px] text-[var(--text-muted)]">
          <Link href="/tools" className="hover:text-[var(--foreground)] transition-colors">Tools</Link>
          <span>/</span>
          <Link href="/tools/market" className="hover:text-[var(--foreground)] transition-colors">Market Index</Link>
          <span>/</span>
          <span>Box EV Calculator</span>
        </nav>
        <p className="label-upper text-[var(--text-muted)] mb-1">TCG Times Tools</p>
        <h1
          className="text-4xl font-black text-[var(--foreground)] leading-none mb-3"
          style={{ fontFamily: "var(--font-serif, serif)" }}
        >
          Box EV Calculator
        </h1>
        <p className="text-sm text-[var(--text-muted)] max-w-2xl">
          Enter what you pulled from a sealed box and see the expected value against what you paid.
          Use this to decide whether opening or buying singles makes more financial sense.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-8">
        {/* ── Left: Inputs ── */}
        <div className="flex flex-col gap-6">
          {/* Preset selector */}
          <div>
            <label className="label-upper text-[10px] text-[var(--text-muted)] block mb-2">Product Type</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PRESETS).map(([key, p]) => (
                <button
                  key={key}
                  onClick={() => setPreset(key)}
                  className={`label-upper px-3 py-2 text-[10px] border transition-colors ${
                    preset === key
                      ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                      : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Box cost */}
          <div>
            <label className="label-upper text-[10px] text-[var(--text-muted)] block mb-2">
              Box / Product Cost (SGD)
            </label>
            <div className="flex items-center gap-2">
              <span className="label-upper text-sm text-[var(--text-muted)]">S$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={boxCostStr}
                onChange={(e) => setBoxCostStr(e.target.value)}
                placeholder="e.g. 168.00"
                className="border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--border-strong)] outline-none w-40"
              />
            </div>
          </div>

          {/* Pulls */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label-upper text-[10px] text-[var(--text-muted)]">
                Your Pulls ({pulls.length})
              </label>
              <button
                onClick={addPull}
                className="label-upper text-[10px] text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors underline underline-offset-2"
              >
                + Add pull
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {pulls.map((pull, idx) => (
                <div key={pull.id} className="flex gap-2 items-center">
                  <span className="label-upper text-[10px] text-[var(--text-muted)] w-5 shrink-0">
                    {idx + 1}.
                  </span>
                  <input
                    type="text"
                    value={pull.cardName}
                    onChange={(e) => updatePull(pull.id, "cardName", e.target.value)}
                    placeholder="Card name"
                    className="flex-1 border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--border-strong)] outline-none"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="label-upper text-[10px] text-[var(--text-muted)]">S$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={pull.priceCents > 0 ? (pull.priceCents / 100).toFixed(2) : ""}
                      onChange={(e) => updatePull(pull.id, "priceCents", e.target.value)}
                      placeholder="0.00"
                      className="border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-sm text-[var(--foreground)] focus:border-[var(--border-strong)] outline-none w-24"
                    />
                  </div>
                  <button
                    onClick={() => removePull(pull.id)}
                    disabled={pulls.length === 1}
                    className="label-upper text-[10px] text-[var(--text-muted)] hover:text-red-500 transition-colors disabled:opacity-20 shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Preset pull rates reference */}
          <div className="border border-[var(--border)] p-4">
            <p className="label-upper text-[10px] text-[var(--text-muted)] mb-3">
              {currentPreset.label} — Expected Pull Rates
            </p>
            <p className="text-xs text-[var(--text-muted)] mb-3">
              {currentPreset.packsPerBox} packs · {currentPreset.cardsPerPack} cards per pack ·{" "}
              {currentPreset.packsPerBox * currentPreset.cardsPerPack} total cards
            </p>
            <div className="flex flex-col gap-1.5">
              {currentPreset.pulls.map((tier) => (
                <div key={tier.rarity} className="flex items-center justify-between gap-4 text-xs">
                  <span className="text-[var(--foreground)] font-medium w-36 shrink-0">{tier.rarity}</span>
                  <span className="text-[var(--text-muted)] flex-1 truncate">{tier.placeholder}</span>
                  <span className="label-upper text-[10px] text-[var(--text-muted)] shrink-0">
                    ~{tier.expectedCount < 1
                      ? `1 in ${Math.round(1 / tier.expectedCount)}`
                      : `${tier.expectedCount.toFixed(1)}× per box`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: Results ── */}
        <div className="flex flex-col gap-4 md:pt-0">
          {/* Main verdict */}
          <div className={`p-5 border-2 ${
            isProfit && boxCostCents > 0
              ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
              : boxCostCents > 0
              ? "border-red-400 bg-red-50 dark:bg-red-950/30"
              : "border-[var(--border)] bg-[var(--muted)]"
          }`}>
            <p className="label-upper text-[10px] text-[var(--text-muted)] mb-1">Net P&L</p>
            <p
              className={`text-4xl font-black leading-none ${
                boxCostCents === 0
                  ? "text-[var(--text-muted)]"
                  : isProfit
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-red-700 dark:text-red-300"
              }`}
              style={{ fontFamily: "var(--font-serif, serif)" }}
            >
              {boxCostCents > 0
                ? `${isProfit ? "+" : ""}${formatPrice(profitLossCents)}`
                : "—"}
            </p>
            {boxCostCents > 0 && (
              <p className={`label-upper text-[11px] mt-1 ${isProfit ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                ROI: {roi.toFixed(1)}%
              </p>
            )}
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-2 gap-px bg-[var(--border)]">
            {[
              { label: "Box Cost", value: boxCostCents > 0 ? formatPrice(boxCostCents) : "—" },
              { label: "Pull Value", value: formatPrice(totalPullValueCents) },
              { label: "Pulls Added", value: String(pulls.length) },
              { label: "Avg Per Pull", value: pulls.length > 0 ? formatPrice(Math.round(totalPullValueCents / pulls.length)) : "—" },
            ].map((s) => (
              <div key={s.label} className="bg-[var(--background)] p-3 text-center">
                <p className="label-upper text-[9px] text-[var(--text-muted)]">{s.label}</p>
                <p className="label-upper text-[12px] font-bold text-[var(--foreground)]">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Breakeven */}
          {boxCostCents > 0 && pulls.length > 0 && (
            <div className="p-3 border border-[var(--border)]">
              <p className="label-upper text-[10px] text-[var(--text-muted)] mb-1">Breakeven Per Pull</p>
              <p className="font-black text-lg text-[var(--foreground)]" style={{ fontFamily: "var(--font-serif, serif)" }}>
                {formatPrice(breakevenPerPull)}
              </p>
              <p className="label-upper text-[9px] text-[var(--text-muted)] mt-0.5">
                Each pull needs to average this value for you to break even
              </p>
            </div>
          )}

          {/* Verdict */}
          {boxCostCents > 0 && (
            <div className="p-3 border border-[var(--border)] bg-[var(--muted)]">
              <p className="label-upper text-[10px] text-[var(--text-muted)] mb-1.5">Verdict</p>
              {isProfit ? (
                <p className="text-xs text-[var(--foreground)] leading-relaxed">
                  ✅ You made more than you spent. Your pulls are worth{" "}
                  <strong>{formatPrice(profitLossCents)}</strong> more than the box cost —
                  a good result. Consider selling into demand while prices hold.
                </p>
              ) : (
                <p className="text-xs text-[var(--foreground)] leading-relaxed">
                  ⚠️ Your pulls are worth <strong>{formatPrice(Math.abs(profitLossCents))}</strong> less
                  than the box cost. Singles were likely the better buy this time.
                </p>
              )}
            </div>
          )}

          {/* CTA */}
          <Link
            href="/marketplace"
            className="label-upper py-3 text-center text-[11px] bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 transition-opacity"
          >
            List your pulls on Marketplace →
          </Link>

          <Link
            href="/tools/market"
            className="label-upper text-[10px] text-center text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors underline underline-offset-2"
          >
            ← Market Index
          </Link>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mt-10 p-4 border border-[var(--border)] text-xs text-[var(--text-muted)] leading-relaxed">
        <strong>Disclaimer:</strong> Pull rates are community estimates and may vary between print runs.
        Card prices reflect your manually entered values — connect to the Marketplace or TCGPlayer for
        real-time pricing. This tool is for informational purposes only.
      </div>
    </div>
  );
}
