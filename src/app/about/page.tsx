import type { Metadata } from "next";
import { siteConfig, gameCategories } from "@/config/site";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About",
  description: `Learn about TCG Times — ${siteConfig.tagline}`,
};

export default function AboutPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10">
      {/* Page header */}
      <div className="border-b-2 border-[#0a0a0a] py-14">
        <span className="label-upper text-[#6b6860] block mb-4">About</span>
        <h1
          className="text-5xl md:text-7xl font-black text-[#0a0a0a] leading-none tracking-tight mb-6"
          style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
        >
          TCG Times
        </h1>
        <p className="text-xl text-[#6b6860] max-w-2xl leading-relaxed">
          {siteConfig.tagline}
        </p>
      </div>

      <div className="max-w-3xl py-12">
        <div className="prose prose-lg max-w-none">
          <h2>What is TCG Times?</h2>
          <p>
            TCG Times is a blog dedicated to trading card game theory, strategy, and community discussion.
            Whether you&apos;re preparing for the next Grand Archive Ascent, grinding Flesh and Blood Callings or Casuals, cracking
            packs of the latest sets, or just curious about where the card game
            hobby is heading — this is your home.
          </p>

          <h2>What We Cover</h2>
          <p>Our content spans four main areas:</p>
        </div>

        {/* Game cards — editorial list style */}
        <div className="border-t-2 border-[#0a0a0a] mt-8 mb-8">
          {gameCategories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/category/${cat.slug}`}
              className="group flex items-start gap-6 py-5 border-b border-[#d6d3cc] hover:bg-[#f0efec] transition-colors -mx-2 px-2"
            >
              <span className="label-upper text-[#6b6860] pt-1 w-8 shrink-0">{cat.emoji}</span>
              <div className="flex-1">
                <p
                  className="text-xl font-bold text-[#0a0a0a] group-hover:opacity-60 transition-opacity leading-tight mb-1"
                  style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
                >
                  {cat.name}
                </p>
                <p className="text-sm text-[#6b6860] leading-relaxed">{cat.description}</p>
              </div>
              <span className="label-upper text-[#6b6860] pt-1 group-hover:text-[#0a0a0a] transition-colors">→</span>
            </Link>
          ))}
        </div>

        <div className="prose prose-lg max-w-none">
          <h2>The Philosophy</h2>
          <p>
            TCG Times values <strong>depth over hype</strong>. You won&apos;t find pack-opening videos or
            speculative buylist spikes here. What you will find:
          </p>
          <ul>
            <li>Thoughtful card theory and analysis</li>
            <li>Deckbuilding philosophy, not just decklists</li>
            <li>Cross-game insights that make you a better player everywhere</li>
            <li>Honest takes on game design, good and bad</li>
          </ul>

          <h2>Future Games</h2>
          <p>
            The card game space is evolving rapidly. As new games emerge that deserve serious attention —
            whether that&apos;s an innovative indie release or a major publisher&apos;s new entry — TCG Times will
            cover them. The goal is always the same: explore what makes each game interesting and
            help players get the most out of the hobby.
          </p>

          <h2>Get in Touch</h2>
          <p>
            Have a theory you want to share? A game you think deserves more coverage? Reach out via the
            site&apos;s social links or submit your own content ideas.
          </p>
          <p>
            Welcome to the table. 🃏
          </p>
        </div>
      </div>
    </div>
  );
}
