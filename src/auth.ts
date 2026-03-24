/**
 * Auth.js (NextAuth v5) configuration.
 *
 * Handles Google + Patreon OAuth.
 *
 * Flow:
 *  1. User clicks "Continue with Google"
 *  2. NextAuth handles the OAuth dance with Google
 *  3. On success, the `events.signIn` hook upserts the user into our DB
 *  4. The `redirect` callback sends to /api/auth/complete?userId=...
 *  5. /api/auth/complete sets our tcgt_session cookie + redirects to /profile
 */

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { OAuthUserConfig } from "next-auth/providers";

// ---------------------------------------------------------------------------
// Custom Patreon provider (not built in to NextAuth v5)
// ---------------------------------------------------------------------------

interface PatreonProfile {
  data: {
    id: string;
    attributes: {
      email: string;
      full_name: string;
      image_url: string;
    };
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Patreon(options: OAuthUserConfig<PatreonProfile>): any {
  return {
    id: "patreon",
    name: "Patreon",
    type: "oauth",
    authorization: {
      url: "https://www.patreon.com/oauth2/authorize",
      params: { scope: "identity identity[email]" },
    },
    token: "https://www.patreon.com/api/oauth2/token",
    userinfo:
      "https://www.patreon.com/api/oauth2/v2/identity?fields[user]=email,full_name,image_url",
    profile(profile: PatreonProfile) {
      const attr = profile.data.attributes;
      return {
        id: profile.data.id,
        name: attr.full_name,
        email: attr.email,
        image: attr.image_url,
      };
    },
    ...options,
  };
}

// ---------------------------------------------------------------------------
// Build provider list — only include providers with credentials set
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const providers: any[] = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

if (process.env.PATREON_CLIENT_ID && process.env.PATREON_CLIENT_SECRET) {
  providers.push(
    Patreon({
      clientId: process.env.PATREON_CLIENT_ID,
      clientSecret: process.env.PATREON_CLIENT_SECRET,
    })
  );
}

// ---------------------------------------------------------------------------
// NextAuth config
// ---------------------------------------------------------------------------

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers,

  // We manage our own sessions — NextAuth only handles the OAuth dance
  session: { strategy: "jwt" },

  callbacks: {
    // Embed OAuth profile data into the JWT so we can read it in `redirect`
    async jwt({ token, account, user }) {
      if (account && user) {
        token.provider = account.provider;
        token.providerAccountId = account.providerAccountId;
        token.oauthEmail = user.email ?? "";
        token.oauthName = user.name ?? "";
        token.oauthImage = user.image ?? "";
      }
      return token;
    },

    // After sign-in, bounce through /api/auth/complete to set our cookie
    async redirect({ url, baseUrl }) {
      // If this is the post-signin redirect, send to our complete handler
      if (url === `${baseUrl}/profile` || url === "/profile") {
        return `${baseUrl}/api/auth/complete`;
      }
      // Allow relative and same-origin URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return baseUrl;
    },
  },

  events: {
    // Upsert the user into our DB as soon as OAuth succeeds
    async signIn({ user, account }) {
      if (!account || account.type !== "oauth") return;
      const { upsertOAuthUser } = await import("@/lib/db");
      try {
        upsertOAuthUser({
          provider: account.provider,
          providerAccountId: account.providerAccountId ?? "",
          email: user.email ?? "",
          name: user.name ?? "User",
          image: user.image ?? undefined,
        });
      } catch (err) {
        console.error("OAuth upsert error:", err);
      }
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
});

