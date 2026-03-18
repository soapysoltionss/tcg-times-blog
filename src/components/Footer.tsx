import Link from "next/link";
import { siteConfig, gameCategories } from "@/config/site";

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 mt-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🃏</span>
              <span className="font-extrabold text-gray-900 dark:text-white text-lg">{siteConfig.name}</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              {siteConfig.tagline}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-600 mt-4">
              © {new Date().getFullYear()} {siteConfig.name} · tcgtimes.blog
            </p>
          </div>

          {/* Games */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wider">Games</h3>
            <ul className="space-y-2">
              {gameCategories.map((cat) => (
                <li key={cat.slug}>
                  <Link
                    href={`/category/${cat.slug}`}
                    className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                  >
                    <span>{cat.emoji}</span>
                    <span>{cat.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Links */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wider">Site</h3>
            <ul className="space-y-2">
              {[
                { href: "/blog", label: "All Posts" },
                { href: "/about", label: "About" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
