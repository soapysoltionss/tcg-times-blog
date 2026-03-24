import Link from "next/link";

type Props = {
  title: string;
  /** If true, the gate is bypassed and nothing is rendered */
  isSubscriber?: boolean;
};

export default function PaywallGate({ title, isSubscriber }: Props) {
  // Subscriber — no gate needed (full content already rendered by the page)
  if (isSubscriber) return null;

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
          <Link
            href="/subscribe"
            className="label-upper bg-[var(--foreground)] text-[var(--background)] px-8 py-4 hover:opacity-70 transition-opacity w-full sm:w-auto text-center"
          >
            Subscribe — Unlock Full Access
          </Link>
          <Link
            href="/subscribe#plans"
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
