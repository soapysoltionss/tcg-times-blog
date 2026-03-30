import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Subscribe",
  description: "Unlock full access to subscriber-only TCG Times articles and AI coaching.",
};

const plans = [
  {
    name: "Free",
    price: "SGD 0",
    period: "",
    description: "Get started with TCG Times. No card required.",
    cta: "You're already on Free",
    href: null,
    highlight: false,
    badge: null,
    tierLevel: 0,
    perks: [
      "All free articles, always",
      "Community comments",
      "TCG AI Coach — 5 questions/day",
      "Claude Haiku (fast model)",
    ],
  },
  {
    name: "Starter",
    price: "SGD 6",
    period: "/ month",
    description: "Step up your coaching game. All three AI models, more questions.",
    cta: "Subscribe Starter on Patreon",
    href: process.env.NEXT_PUBLIC_PATREON_STARTER_URL ?? "https://www.patreon.com",
    highlight: false,
    badge: "Best value",
    tierLevel: 1,
    perks: [
      "All free articles, always",
      "Community comments",
      "TCG AI Coach — 10 questions/day",
      "All 3 AI models (Claude, GPT, Gemini)",
      "Region-aware AI insights",
      "Cancel anytime from Patreon",
    ],
  },
  {
    name: "Basic",
    price: "SGD 18",
    period: "/ month",
    description: "Full article access plus a serious daily AI coaching allowance.",
    cta: "Subscribe Basic on Patreon",
    href: process.env.NEXT_PUBLIC_PATREON_MONTHLY_URL ?? "https://www.patreon.com",
    highlight: false,
    badge: null,
    tierLevel: 2,
    perks: [
      "All paywalled articles unlocked",
      "Deep-dive engine breakdowns & EV theory",
      "Complete sideboard guides",
      "TCG AI Coach — 30 questions/day",
      "All 3 AI models (Claude, GPT, Gemini)",
      "Region-aware AI insights",
      "Cancel anytime from Patreon",
    ],
  },
  {
    name: "Pro",
    price: "SGD 48",
    period: "/ month",
    description: "Everything in Basic, plus premium AI models and cross-region market intelligence.",
    cta: "Subscribe Pro on Patreon",
    href: process.env.NEXT_PUBLIC_PATREON_ANNUAL_URL ?? "https://www.patreon.com",
    highlight: true,
    badge: "Most powerful",
    tierLevel: 3,
    perks: [
      "Everything in Basic",
      "TCG AI Coach — 100 questions/day",
      "Premium AI models (Claude Sonnet, GPT-4o, Gemini Pro)",
      "Cross-region market insights",
      "Early access to new tools",
      "Game data logs & conversion tracking",
    ],
  },
];

export default function SubscribePage() {
  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10">
      {/* Header */}
      <div className="border-b-2 border-[var(--border-strong)] py-14 text-center">
        <span className="label-upper text-[var(--text-muted)] block mb-4">Subscribe</span>
        <h1
          className="text-5xl md:text-6xl font-black text-[var(--foreground)] leading-none tracking-tight mb-5"
          style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
        >
          Unlock Every Article
        </h1>
        <p className="text-[var(--text-muted)] max-w-md mx-auto leading-relaxed">
          Premium articles, AI coaching, and deep-dive analysis. Free articles always stay free.
        </p>
      </div>

      {/* Plans */}
      <div id="plans" className="py-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0 max-w-6xl mx-auto">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`relative border-2 p-8 flex flex-col gap-4 ${
              plan.highlight
                ? "border-[var(--border-strong)] bg-[var(--foreground)] text-[var(--background)]"
                : "border-[var(--border)] text-[var(--foreground)]"
            }`}
          >
            {plan.badge && (
              <span className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-widest px-3 py-1 ${
                plan.highlight
                  ? "bg-[var(--foreground)] text-[var(--background)] border border-[var(--border-strong)]"
                  : "bg-[var(--background)] text-[var(--foreground)] border border-[var(--border-strong)]"
              }`}>
                {plan.badge}
              </span>
            )}
            <span className={`label-upper ${plan.highlight ? "opacity-60" : "text-[var(--text-muted)]"}`}>
              {plan.name}
            </span>
            <div className="flex items-baseline gap-1">
              <span
                className="text-4xl font-black leading-none"
                style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
              >
                {plan.price}
              </span>
              {plan.period && (
                <span className={`label-upper ${plan.highlight ? "opacity-60" : "text-[var(--text-muted)]"}`}>
                  {plan.period}
                </span>
              )}
            </div>
            <p className={`text-sm leading-relaxed ${plan.highlight ? "opacity-80" : "text-[var(--text-muted)]"}`}>
              {plan.description}
            </p>
            <ul className="space-y-2 flex-1">
              {plan.perks.map((perk) => (
                <li key={perk} className={`flex items-start gap-2 text-sm ${plan.highlight ? "opacity-90" : "text-[var(--foreground)]"}`}>
                  <span className="font-black shrink-0 mt-0.5">—</span>
                  <span>{perk}</span>
                </li>
              ))}
            </ul>
            {plan.href ? (
              <a
                href={plan.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`label-upper px-5 py-4 mt-2 text-center transition-opacity hover:opacity-70 ${
                  plan.highlight
                    ? "bg-[var(--background)] text-[var(--foreground)]"
                    : "bg-[var(--foreground)] text-[var(--background)]"
                }`}
              >
                {plan.cta} →
              </a>
            ) : (
              <span className={`label-upper px-5 py-4 mt-2 text-center opacity-40 ${
                plan.highlight ? "bg-[var(--background)] text-[var(--foreground)]" : "bg-[var(--foreground)] text-[var(--background)]"
              }`}>
                {plan.cta}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* AI Coach comparison */}
      <div className="border-t border-[var(--border)] py-16 max-w-5xl mx-auto">
        <p className="label-upper text-[var(--text-muted)] text-center mb-8">AI Coach comparison</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-[var(--border-strong)]">
                <th className="py-3 pr-6 text-[var(--text-muted)] label-upper font-normal">Feature</th>
                <th className="py-3 pr-6 text-[var(--text-muted)] label-upper font-normal">Free</th>
                <th className="py-3 pr-6 text-[var(--text-muted)] label-upper font-normal">Starter SGD 6</th>
                <th className="py-3 pr-6 text-[var(--text-muted)] label-upper font-normal">Basic SGD 18</th>
                <th className="py-3 text-[var(--foreground)] label-upper font-semibold">Pro SGD 48</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {[
                ["Daily questions", "5", "10", "30", "100"],
                ["AI models", "Claude", "Claude · GPT · Gemini", "Claude · GPT · Gemini", "Claude · GPT · Gemini"],
                ["Model quality", "Haiku (fast)", "Base tier", "Base tier", "Premium (Sonnet / 4o / Pro)"],
                ["Specialist routing", "✓", "✓", "✓", "✓"],
                ["Rules agent", "✓", "✓", "✓", "✓"],
                ["Deckbuilding agent", "✓", "✓", "✓", "✓"],
                ["Prices agent", "✓", "✓", "✓", "✓"],
                ["Matchup agent", "✓", "✓", "✓", "✓"],
                ["Region-aware insights", "—", "✓", "✓", "✓"],
                ["Cross-region market intel", "—", "—", "—", "✓"],
                ["Paywalled articles", "—", "—", "✓", "✓"],
                ["Article tier", "Free only", "Free only", "Basic articles", "Pro articles"],
              ].map(([feature, free, starter, basic, pro]) => (
                <tr key={feature}>
                  <td className="py-3 pr-6 text-[var(--foreground)]">{feature}</td>
                  <td className="py-3 pr-6 text-[var(--text-muted)]">{free}</td>
                  <td className="py-3 pr-6 text-[var(--text-muted)]">{starter}</td>
                  <td className="py-3 pr-6 text-[var(--text-muted)]">{basic}</td>
                  <td className="py-3 font-semibold text-[var(--foreground)]">{pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-4 text-center">
          All limits reset daily at midnight UTC · No API key required
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-2 text-center">
          Prices in SGD · Charged in USD via Patreon at current exchange rate
        </p>
      </div>

      {/* How it works */}
      <div className="border-t border-[var(--border)] py-16 max-w-2xl mx-auto text-center">
        <p className="label-upper text-[var(--text-muted)] mb-4">How it works</p>
        <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto leading-relaxed">
          Subscribe on Patreon, then sign in here with your Patreon account (or connect Patreon from
          your profile). Your subscription tier syncs automatically — articles unlock and AI limits
          upgrade instantly.
        </p>
        <div className="mt-6">
          <Link
            href="/tools/tcg-coach"
            className="inline-block label-upper px-6 py-3 bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 transition-opacity"
          >
            Try AI Coach free →
          </Link>
        </div>
      </div>

      {/* Already subscribed */}
      <div className="border-t border-[var(--border)] py-10 text-center">
        <p className="label-upper text-[var(--text-muted)]">
          Already subscribed on Patreon?{" "}
          <Link href="/login" className="text-[var(--foreground)] underline underline-offset-2 hover:opacity-60 transition-opacity">
            Sign in to connect your account
          </Link>
        </p>
      </div>
    </div>
  );
}
