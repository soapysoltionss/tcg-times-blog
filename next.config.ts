import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.shopify.com",
        pathname: "/**",
      },
    ],
  },

  headers: async () => [
    // ── Auth / write API routes — never cache ──────────────────────────────
    {
      source: "/api/auth/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "private, no-cache, no-store, max-age=0, must-revalidate",
        },
      ],
    },
    // ── Marketplace write + personal routes — never cache ─────────────────
    {
      source: "/api/marketplace",
      headers: [
        {
          key: "Cache-Control",
          value: "private, no-cache, no-store, max-age=0, must-revalidate",
        },
      ],
    },
    // ── Blog post pages — subscriber-gated, personalised ──────────────────
    {
      source: "/blog/:slug*",
      headers: [
        {
          key: "Cache-Control",
          value: "private, no-cache, no-store, max-age=0, must-revalidate",
        },
      ],
    },

    // ── Public read-only API — short CDN cache with SWR ───────────────────
    {
      // Pokémon daily answer: same answer all day, safe to CDN-cache 30 min
      source: "/api/pokemon-guess",
      headers: [
        {
          key: "Cache-Control",
          value: "public, s-maxage=1800, stale-while-revalidate=86400",
        },
      ],
    },
    {
      // Market ticker data changes infrequently
      source: "/api/ticker",
      headers: [
        {
          key: "Cache-Control",
          value: "public, s-maxage=300, stale-while-revalidate=600",
        },
      ],
    },
    {
      // Forum listing — hot-sort changes slowly
      source: "/api/forum",
      headers: [
        {
          key: "Cache-Control",
          value: "public, s-maxage=60, stale-while-revalidate=300",
        },
      ],
    },
    {
      // Card autocomplete lookups are effectively immutable
      source: "/api/fab-cards",
      headers: [
        {
          key: "Cache-Control",
          value: "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      ],
    },
    {
      source: "/api/ga-cards",
      headers: [
        {
          key: "Cache-Control",
          value: "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      ],
    },
    {
      source: "/api/op-cards",
      headers: [
        {
          key: "Cache-Control",
          value: "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      ],
    },
    {
      source: "/api/market-set/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "public, s-maxage=300, stale-while-revalidate=600",
        },
      ],
    },

    // ── Static assets — long-lived browser cache ──────────────────────────
    {
      source: "/_next/static/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=31536000, immutable",
        },
      ],
    },
    {
      source: "/images/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=86400, stale-while-revalidate=604800",
        },
      ],
    },
  ],
};

export default nextConfig;
