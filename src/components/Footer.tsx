import Link from "next/link";
import { siteConfig, gameCategories } from "@/config/site";

export default function Footer() {
  return (
    <footer className="mt-24 bg-[#fafaf8] border-t-2 border-[#0a0a0a]">
      {/* Wordmark row */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12 text-center border-b border-[#d6d3cc]">
        <p
          className="text-6xl md:text-8xl font-black tracking-tighter text-[#0a0a0a] leading-none"
          style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
        >
          TCG TIMES
        </p>
        <p className="label-upper text-[#6b6860] mt-3">{siteConfig.tagline}</p>
      </div>

      {/* Links grid */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 border-b border-[#d6d3cc]">
        {/* Games */}
        <div>
          <p className="label-upper text-[#0a0a0a] mb-4">Games</p>
          <ul className="space-y-2.5">
            {gameCategories.map((cat) => (
              <li key={cat.slug}>
                <Link
                  href={`/category/${cat.slug}`}
                  className="text-sm text-[#6b6860] hover:text-[#0a0a0a] transition-colors"
                >
                  {cat.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Site */}
        <div>
          <p className="label-upper text-[#0a0a0a] mb-4">Site</p>
          <ul className="space-y-2.5">
            {[
              { href: "/blog", label: "All Posts" },
              { href: "/about", label: "About" },
            ].map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-[#6b6860] hover:text-[#0a0a0a] transition-colors"
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
        <span className="label-upper text-[#6b6860]">
          © {new Date().getFullYear()} TCG Times
        </span>
        <span className="label-upper text-[#6b6860]">tcgtimes.blog</span>
      </div>
    </footer>
  );
}
