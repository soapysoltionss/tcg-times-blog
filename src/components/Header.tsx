import Link from "next/link";
import { gameCategories } from "@/config/site";
import { siteConfig } from "@/config/site";
import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/UserMenu";

export default function Header() {
  return (
    <header className="w-full bg-[var(--background)] border-b border-[var(--border-strong)]">
      {/* Top utility bar */}
      <div className="border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-9 flex items-center justify-between">
          <span className="label-upper text-[var(--text-muted)]">
            Trading Card Game Theory &amp; Strategy
          </span>
          <div className="flex items-center gap-4">
            <UserMenu />
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Masthead */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-6 text-center">
        <Link href="/" className="inline-block group">
          <h1
            className="font-serif text-5xl md:text-7xl font-black tracking-tighter text-[var(--foreground)] leading-none group-hover:opacity-70 transition-opacity"
            style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
          >
            TCG TIMES
          </h1>
        </Link>
      </div>

      {/* Nav strip */}
      <div className="border-t border-[var(--border-strong)]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          {/* Desktop nav */}
          <nav className="hidden md:flex items-center justify-center gap-0 divide-x divide-[var(--border)]">
            {gameCategories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/category/${cat.slug}`}
                className="label-upper px-5 py-3 text-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors"
              >
                {cat.shortName}
              </Link>
            ))}
            <Link
              href="/blog"
              className="label-upper px-5 py-3 text-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors"
            >
              All Posts
            </Link>
            <Link
              href="/marketplace"
              className="label-upper px-5 py-3 text-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors"
            >
              Marketplace
            </Link>
            <Link
              href="/about"
              className="label-upper px-5 py-3 text-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors"
            >
              About
            </Link>
            <Link
              href="/tools/tcg-coach"
              className="label-upper px-5 py-3 text-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors"
            >
              AI Coach
            </Link>
            <Link
              href="/tools/market"
              className="label-upper px-5 py-3 text-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors"
            >
              Market
            </Link>
          </nav>

          {/* Mobile nav */}
          <details className="md:hidden">
            <summary className="label-upper py-3 cursor-pointer list-none flex items-center justify-between text-[var(--foreground)]">
              <span>Menu</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </summary>
            <div className="border-t border-[var(--border)] pb-3">
              {gameCategories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/category/${cat.slug}`}
                  className="label-upper block py-2.5 text-[var(--foreground)] border-b border-[var(--muted)] hover:bg-[var(--muted)] px-1 transition-colors"
                >
                  {cat.shortName}
                </Link>
              ))}
              <Link href="/blog" className="label-upper block py-2.5 text-[var(--foreground)] border-b border-[var(--muted)] hover:bg-[var(--muted)] px-1 transition-colors">All Posts</Link>
              <Link href="/marketplace" className="label-upper block py-2.5 text-[var(--foreground)] border-b border-[var(--muted)] hover:bg-[var(--muted)] px-1 transition-colors">Marketplace</Link>
              <Link href="/about" className="label-upper block py-2.5 text-[var(--foreground)] border-b border-[var(--muted)] hover:bg-[var(--muted)] px-1 transition-colors">About</Link>
              <Link href="/tools/tcg-coach" className="label-upper block py-2.5 text-[var(--foreground)] border-b border-[var(--muted)] hover:bg-[var(--muted)] px-1 transition-colors">AI Coach</Link>
              <Link href="/tools/market" className="label-upper block py-2.5 text-[var(--foreground)] border-b border-[var(--muted)] hover:bg-[var(--muted)] px-1 transition-colors">Market</Link>
              <Link href="/profile" className="label-upper block py-2.5 text-[var(--foreground)] border-b border-[var(--muted)] hover:bg-[var(--muted)] px-1 transition-colors">Profile</Link>
              <Link href="/login" className="label-upper block py-2.5 text-[var(--foreground)] hover:bg-[var(--muted)] px-1 transition-colors">Sign In</Link>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
