import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Subscribe",
  description: "Unlock full access to subscriber-only TCG Times articles.",
};

const plans = [
  {
    name: "Monthly",
    price: "$5",
    period: "/ month",
    description: "Full access to all subscriber articles. Cancel anytime.",
    cta: "Start Monthly",
    highlight: false,
  },
  {
    name: "Annual",
    price: "$40",
    period: "/ year",
    description: "Full access at a 33% discount. Best value for serious players.",
    cta: "Start Annual",
    highlight: true,
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
          Subscriber articles go deep — full engine breakdowns, sideboard tables,
          EV data, and matchup guides. Free articles remain free, always.
        </p>
      </div>

      {/* Plans */}
      <div id="plans" className="py-16 grid grid-cols-1 md:grid-cols-2 gap-0 max-w-2xl mx-auto border-t-0">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`border-2 p-10 flex flex-col gap-5 ${
              plan.highlight
                ? "border-[var(--border-strong)] bg-[var(--foreground)] text-[var(--background)]"
                : "border-[var(--border)] text-[var(--foreground)]"
            }`}
          >
            <span className={`label-upper ${plan.highlight ? "opacity-60" : "text-[var(--text-muted)]"}`}>
              {plan.name}
            </span>
            <div className="flex items-baseline gap-1">
              <span
                className="text-5xl font-black leading-none"
                style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
              >
                {plan.price}
              </span>
              <span className={`label-upper ${plan.highlight ? "opacity-60" : "text-[var(--text-muted)]"}`}>
                {plan.period}
              </span>
            </div>
            <p className={`text-sm leading-relaxed ${plan.highlight ? "opacity-80" : "text-[var(--text-muted)]"}`}>
              {plan.description}
            </p>
            <button
              className={`label-upper px-6 py-4 mt-auto transition-opacity hover:opacity-70 ${
                plan.highlight
                  ? "bg-[var(--background)] text-[var(--foreground)]"
                  : "bg-[var(--foreground)] text-[var(--background)]"
              }`}
            >
              {plan.cta}
            </button>
          </div>
        ))}
      </div>

      {/* What's included */}
      <div className="border-t border-[var(--border)] py-16 max-w-2xl mx-auto">
        <p className="label-upper text-[var(--text-muted)] mb-8">What subscribers get</p>
        <ul className="space-y-4">
          {[
            "Full access to all paywalled articles, past and future",
            "Deep-dive engine breakdowns & EV theory",
            "Complete sideboard guides for key matchups",
            "Game data logs and conversion tracking",
            "Early access to new content before public release",
          ].map((item) => (
            <li key={item} className="flex items-start gap-4">
              <span className="font-black text-[var(--foreground)] shrink-0 mt-0.5">—</span>
              <span className="text-sm text-[var(--foreground)] leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Already subscribed */}
      <div className="border-t border-[var(--border)] py-10 text-center">
        <p className="label-upper text-[var(--text-muted)]">
          Already a subscriber?{" "}
          <Link href="/login" className="text-[var(--foreground)] underline underline-offset-2 hover:opacity-60 transition-opacity">
            Sign in to your account
          </Link>
        </p>
      </div>
    </div>
  );
}
