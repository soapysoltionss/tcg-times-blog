"use client";

import Link from "next/link";
import { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export default function AuthCard({ title, subtitle, children, footer }: Props) {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16">
      <div
        className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500"
        style={{ animationFillMode: "both" }}
      >
        {/* Logo */}
        <Link href="/" className="block text-center mb-10 group">
          <span
            className="text-2xl font-black text-[var(--foreground)] group-hover:opacity-70 transition-opacity"
            style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
          >
            TCG Times
          </span>
        </Link>

        {/* Card */}
        <div className="border border-[var(--border)] bg-[var(--background)]">
          <div className="border-b border-[var(--border)] px-8 py-6">
            <h1
              className="text-2xl font-black text-[var(--foreground)] leading-tight"
              style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
            >
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-[var(--text-muted)] mt-1">{subtitle}</p>
            )}
          </div>
          <div className="px-8 py-7">{children}</div>
        </div>

        {/* Footer links */}
        {footer && (
          <div className="text-center mt-6 text-sm text-[var(--text-muted)]">{footer}</div>
        )}
      </div>
    </div>
  );
}
