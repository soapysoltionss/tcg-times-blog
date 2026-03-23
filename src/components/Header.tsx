import Link from "next/link";
import { gameCategories } from "@/config/site";
import { siteConfig } from "@/config/site";

export default function Header() {
  return (
    <header className="w-full bg-[#fafaf8] border-b border-[#0a0a0a]">
      {/* Top utility bar */}
      <div className="border-b border-[#d6d3cc]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-9 flex items-center justify-between">
          <span className="label-upper text-[#6b6860]">
            Trading Card Game Theory &amp; Strategy
          </span>
          <span className="label-upper text-[#6b6860]">
            tcgtimes.blog
          </span>
        </div>
      </div>

      {/* Masthead */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-6 text-center">
        <Link href="/" className="inline-block group">
          <h1
            className="font-serif text-5xl md:text-7xl font-black tracking-tighter text-[#0a0a0a] leading-none group-hover:opacity-70 transition-opacity"
            style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
          >
            TCG TIMES
          </h1>
        </Link>
      </div>

      {/* Nav strip */}
      <div className="border-t border-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          {/* Desktop nav */}
          <nav className="hidden md:flex items-center justify-center gap-0 divide-x divide-[#d6d3cc]">
            {gameCategories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/category/${cat.slug}`}
                className="label-upper px-5 py-3 text-[#0a0a0a] hover:bg-[#0a0a0a] hover:text-[#fafaf8] transition-colors"
              >
                {cat.shortName}
              </Link>
            ))}
            <Link
              href="/blog"
              className="label-upper px-5 py-3 text-[#0a0a0a] hover:bg-[#0a0a0a] hover:text-[#fafaf8] transition-colors"
            >
              All Posts
            </Link>
            <Link
              href="/about"
              className="label-upper px-5 py-3 text-[#0a0a0a] hover:bg-[#0a0a0a] hover:text-[#fafaf8] transition-colors"
            >
              About
            </Link>
          </nav>

          {/* Mobile nav */}
          <details className="md:hidden">
            <summary className="label-upper py-3 cursor-pointer list-none flex items-center justify-between text-[#0a0a0a]">
              <span>Menu</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </summary>
            <div className="border-t border-[#d6d3cc] pb-3">
              {gameCategories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/category/${cat.slug}`}
                  className="label-upper block py-2.5 text-[#0a0a0a] border-b border-[#f0efec] hover:bg-[#f0efec] px-1 transition-colors"
                >
                  {cat.shortName}
                </Link>
              ))}
              <Link href="/blog" className="label-upper block py-2.5 text-[#0a0a0a] border-b border-[#f0efec] hover:bg-[#f0efec] px-1 transition-colors">All Posts</Link>
              <Link href="/about" className="label-upper block py-2.5 text-[#0a0a0a] hover:bg-[#f0efec] px-1 transition-colors">About</Link>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
