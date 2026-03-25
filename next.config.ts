import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure auth/API routes and subscriber-gated pages are never cached by
  // Vercel's CDN or Cloudflare. Without this, Vercel adds
  // `cache-control: public, max-age=0` which allows Cloudflare to serve stale
  // pages — meaning a subscriber would still see the paywall from a cached
  // pre-auth render. Blog pages are force-dynamic but still need private headers
  // to prevent CDN caching of personalised responses.
  headers: async () => [
    {
      source: "/api/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "private, no-cache, no-store, max-age=0, must-revalidate",
        },
      ],
    },
    {
      // Blog post pages are personalised (paywall depends on subscriber status)
      source: "/blog/:slug*",
      headers: [
        {
          key: "Cache-Control",
          value: "private, no-cache, no-store, max-age=0, must-revalidate",
        },
      ],
    },
  ],
};

export default nextConfig;
