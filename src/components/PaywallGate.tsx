"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Props = {
  title: string;
  /** Server-side subscriber hint — may be stale; client will verify via /api/auth/me */
  isSubscriber?: boolean;
  /** Server-side tier level hint */
  tierLevel?: number;
  /**
   * Minimum tier required to view this content.
   * 1 = any subscriber (Monthly or Annual), 2 = Annual only.
   * Defaults to 1.
   */
  requiredTier?: number;
};

export default function PaywallGate({
  title,
  isSubscriber: serverHint,
  tierLevel: serverTierLevel,
  requiredTier = 1,
}: Props) {
  const [isSubscriber, setIsSubscriber] = useState(serverHint === true);
  const [tierLevel, setTierLevel] = useState(serverTierLevel ?? 0);
  const [tierName, setTierName] = useState<string | null>(null);
  const [checked, setChecked] = useState(serverHint === true);

  useEffect(() => {
    if (serverHint) { setChecked(true); return; }
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(({ isSubscriber: sub, tierLevel: lvl, tierName: name }) => {
        setIsSubscriber(!!sub);
        setTierLevel(lvl ?? 0);
        setTierName(name ?? null);
        setChecked(true);
      })
      .catch(() => setChecked(true));
  }, [serverHint]);

  // Has access if subscriber AND tier is sufficient
  const hasAccess = isSubscriber && tierLevel >= requiredTier;

  // Don't flash the gate before we've verified
  if (!checked) return null;
  if (hasAccess) return null;

  // Subscriber but wrong tier — show upgrade prompt instead of full gate
  if (isSubscriber && tierLevel < requiredTier) {
    return (
      <div className="relative my-12">
        <div
          className="absolute -top-24 left-0 right-0 h-24 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, transparent, var(--background))" }}
        />
        <div className="border-t-2 border-b-2 border-[var(--border-strong)] py-10 px-6 text-center">
          <span className="label-upper text-[var(--text-muted)] block mb-5">Annual Subscribers Only</span>
          <h2
            className="text-3xl font-black text-[var(--foreground)] mb-4"
            style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
          >
            This content requires the Annual plan
          </h2>
          <p className="text-[var(--text-muted)] max-w-sm mx-auto text-sm leading-relaxed mb-8">
            You&apos;re on the <strong>{tierName ?? "Monthly"}</strong> plan. Upgrade to Annual on Patreon
            to unlock this content.
          </p>
          <a
            href={process.env.NEXT_PUBLIC_PATREON_ANNUAL_URL ?? "https://www.patreon.com"}
            target="_blank"
            rel="noopener noreferrer"
            className="label-upper bg-[var(--foreground)] text-[var(--background)] px-8 py-4 hover:opacity-70 transition-opacity inline-block"
          >
            Upgrade to Annual →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="relative my-12">
      {/* Fade-out overlay */}
      <div
        className="absolute -top-24 left-0 right-0 h-24 pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, transparent, var(--background))",
        }}
      />

      {/* Gate block */}
      <div className="border-t-2 border-b-2 border-[var(--border-strong)] py-10 px-6 text-center">
        <span className="label-upper text-[var(--text-muted)] block mb-5">
          Subscriber Content
        </span>

        <h2
          className="text-3xl md:text-4xl font-black text-[var(--foreground)] leading-tight tracking-tight mb-4 max-w-lg mx-auto"
          style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
        >
          The rest of this article is for subscribers
        </h2>

        <p className="text-[var(--text-muted)] max-w-sm mx-auto leading-relaxed mb-8 text-sm">
          <em>{title}</em> continues with the full engine breakdown, complete
          sideboard tables for every matchup, and game-by-game EV data.
          Subscribe to read it in full.
        </p>

        <ul className="inline-block text-left space-y-2 mb-10">
          {[
            "Phoenix Flame engine & chain loop theory",
            "Starters, extenders & finisher breakdowns",
            "Full pitch curve analysis",
            "8-cut sideboard guide for 5 matchups",
            "Logged game EV data across 5 games",
          ].map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-[var(--foreground)]">
              <span className="mt-0.5 font-bold shrink-0">—</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <a
            href={process.env.NEXT_PUBLIC_PATREON_MONTHLY_URL ?? "https://www.patreon.com"}
            target="_blank"
            rel="noopener noreferrer"
            className="label-upper bg-[var(--foreground)] text-[var(--background)] px-8 py-4 hover:opacity-70 transition-opacity w-full sm:w-auto text-center"
          >
            Subscribe on Patreon →
          </a>
          <Link
            href="/subscribe"
            className="label-upper border border-[var(--border-strong)] text-[var(--foreground)] px-8 py-4 hover:bg-[var(--muted)] transition-colors w-full sm:w-auto text-center"
          >
            View Plans
          </Link>
        </div>

        <p className="label-upper text-[var(--text-muted)] mt-6">
          Already a subscriber?{" "}
          <Link
            href="/login"
            className="text-[var(--foreground)] underline underline-offset-2 hover:opacity-60 transition-opacity"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
