import Link from "next/link";
import { gameCategories } from "@/config/site";
import { siteConfig } from "@/config/site";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-950/90 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:supports-[backdrop-filter]:bg-gray-950/70">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-2xl">🃏</span>
            <div className="leading-none">
              <span className="font-extrabold text-lg text-gray-900 dark:text-white tracking-tight group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                {siteConfig.name}
              </span>
              <span className="hidden sm:block text-[10px] text-gray-500 dark:text-gray-400 tracking-wide uppercase">
                tcgtimes.blog
              </span>
            </div>
          </Link>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {gameCategories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/category/${cat.slug}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
              >
                <span>{cat.emoji}</span>
                <span>{cat.shortName}</span>
              </Link>
            ))}
            <Link
              href="/blog"
              className="ml-2 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
            >
              All Posts
            </Link>
            <Link
              href="/about"
              className="ml-1 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
            >
              About
            </Link>
          </nav>

          {/* Mobile menu placeholder */}
          <details className="md:hidden relative">
            <summary className="list-none cursor-pointer p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <svg className="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </summary>
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-2">
              {gameCategories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/category/${cat.slug}`}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.name}</span>
                </Link>
              ))}
              <div className="border-t border-gray-200 dark:border-gray-700 mt-2 pt-2">
                <Link href="/blog" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">All Posts</Link>
                <Link href="/about" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">About</Link>
              </div>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
