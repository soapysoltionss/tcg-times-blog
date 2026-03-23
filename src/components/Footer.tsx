import Link from "next/link";
import { siteConfig, gameCategories } from "@/config/site";

export default function Footer() {
  return (
    <footer className="mt-24 bg-[var(--background)] border-t-2 border-[var(--border-strong)]">
      {/* Wordmark row */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12 text-center border-b border-[var(--border)]">
        <p
          className="text-6xl md:text-8xl font-black tracking-tighter text-[var(--foreground)] leading-none"
          style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
        >
          TCG TIMES
        </p>
        <p className="label-upper text-[var(--text-muted)] mt-3">{siteConfig.tagline}</p>
      </div>

      {/* Links grid */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 border-b border-[var(--border)]">
        {/* Games */}
        <div>
          <p className="label-upper text-[var(--foreground)] mb-4">Games</p>
          <ul className="space-y-2.5">
            {gameCategories.map((cat) => (
              <li key={cat.slug}>
                <Link
                  href={`/category/${cat.slug}`}
                  className="text-sm text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  {cat.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Site */}
        <div>
          <p className="label-upper text-[var(--foreground)] mb-4">Site</p>
          <ul className="space-y-2.5">
            {[
              { href: "/blog", label: "All Posts" },
              { href: "/about", label: "About" },
            ].map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Copyright */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-5 flex items-center justify-between">
        <span className="label-upper text-[var(--text-muted)]">
          © {new Date().getFullYear()} TCG Times
        </span>
        <span className="label-upper text-[var(--text-muted)]">tcgtimes.blog</span>
      </div>
    </footer>
  );
}
