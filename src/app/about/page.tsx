import type { Metadata } from "next";
import { siteConfig, gameCategories } from "@/config/site";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About",
  description: `Learn about TCG Times — ${siteConfig.tagline}`,
};

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <header className="mb-12">
        <div className="text-5xl mb-4">🃏</div>
        <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-4">
          About TCG Times
        </h1>
        <p className="text-xl text-gray-500 dark:text-gray-400 leading-relaxed">
          {siteConfig.tagline}
        </p>
      </header>

      <div className="prose prose-gray dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-violet-600 dark:prose-a:text-violet-400">
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

      {/* Game cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-8">
        {gameCategories.map((cat) => (
          <Link
            key={cat.slug}
            href={`/category/${cat.slug}`}
            className={`rounded-xl border p-5 flex gap-4 items-start hover:shadow-md transition-all hover:-translate-y-0.5 ${cat.bgColor} ${cat.borderColor}`}
          >
            <span className="text-3xl shrink-0">{cat.emoji}</span>
            <div>
              <h3 className={`font-bold text-base mb-1 ${cat.color}`}>{cat.name}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {cat.description}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <div className="prose prose-gray dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-violet-600 dark:prose-a:text-violet-400">
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
  );
}
