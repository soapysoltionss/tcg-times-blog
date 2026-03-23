import Link from "next/link";

type Props = {
  title: string;
};

export default function PaywallGate({ title }: Props) {
  return (
    <div className="relative my-12">
      {/* Fade-out overlay on the content above */}
      <div
        className="absolute -top-24 left-0 right-0 h-24 pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, transparent, #fafaf8)",
        }}
      />

      {/* Gate block */}
      <div className="border-t-2 border-b-2 border-[#0a0a0a] py-10 px-6 text-center">
        {/* Label */}
        <span className="label-upper text-[#6b6860] block mb-5">
          Subscriber Content
        </span>

        {/* Headline */}
        <h2
          className="text-3xl md:text-4xl font-black text-[#0a0a0a] leading-tight tracking-tight mb-4 max-w-lg mx-auto"
          style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
        >
          The rest of this article is for subscribers
        </h2>

        {/* Subtext */}
        <p className="text-[#6b6860] max-w-sm mx-auto leading-relaxed mb-8 text-sm">
          <em>{title}</em> continues with the full engine breakdown, complete
          sideboard tables for every matchup, and game-by-game EV data.
          Subscribe to read it in full.
        </p>

        {/* What's included list */}
        <ul className="inline-block text-left space-y-2 mb-10">
          {[
            "Phoenix Flame engine & chain loop theory",
            "Starters, extenders & finisher breakdowns",
            "Full pitch curve analysis",
            "8-cut sideboard guide for 5 matchups",
            "Logged game EV data across 5 games",
          ].map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-[#0a0a0a]">
              <span className="mt-0.5 text-[#0a0a0a] font-bold shrink-0">—</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Link
            href="/subscribe"
            className="label-upper bg-[#0a0a0a] text-[#fafaf8] px-8 py-4 hover:opacity-70 transition-opacity w-full sm:w-auto text-center"
          >
            Subscribe — Unlock Full Access
          </Link>
          <Link
            href="/subscribe#plans"
            className="label-upper border border-[#0a0a0a] text-[#0a0a0a] px-8 py-4 hover:bg-[#f0efec] transition-colors w-full sm:w-auto text-center"
          >
            View Plans
          </Link>
        </div>

        {/* Fine print */}
        <p className="label-upper text-[#6b6860] mt-6">
          Already a subscriber?{" "}
          <Link href="/login" className="text-[#0a0a0a] underline underline-offset-2 hover:opacity-60 transition-opacity">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
