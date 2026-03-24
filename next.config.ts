import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure auth/API routes are never cached by Vercel's CDN or Cloudflare.
  // Without this, Vercel adds `cache-control: public, max-age=0` which causes
  // Cloudflare to strip Set-Cookie headers, breaking OAuth state/PKCE cookies.
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
  ],
};

export default nextConfig;
