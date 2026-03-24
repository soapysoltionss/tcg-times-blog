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
    relationships?: {
      memberships?: {
        data: { id: string; type: string }[];
      };
    };
  };
  included?: {
    id: string;
    type: string;
    attributes: {
      patron_status?: string;
      next_charge_date?: string;
      title?: string;
    };
    relationships?: {
      currently_entitled_tiers?: {
        data: { id: string; type: string }[];
      };
    };
  }[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Patreon(options: OAuthUserConfig<PatreonProfile>): any {
  return {
    id: "patreon",
    name: "Patreon",
    type: "oauth",
    authorization: {
      url: "https://www.patreon.com/oauth2/authorize",
      params: { scope: "identity identity[email] identity.memberships" },
    },
    token: "https://www.patreon.com/api/oauth2/token",
    userinfo:
      "https://www.patreon.com/api/oauth2/v2/identity?fields[user]=email,full_name,image_url&include=memberships&fields[member]=patron_status,currently_entitled_amount_cents,pledge_relationship_start,next_charge_date&fields[tier]=title",
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
      // Explicitly set authorization URL to avoid OIDC discovery fetch at runtime
      authorization: {
        url: "https://accounts.google.com/o/oauth2/v2/auth",
        params: {
          scope: "openid email profile",
          response_type: "code",
        },
      },
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
// NextAuth config — minimal, no custom callbacks
// ---------------------------------------------------------------------------

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers,
  trustHost: true,

  callbacks: {
    // Embed provider info into the JWT so we can read it later
    async jwt({ token, account, user }) {
      if (account && user) {
        token.provider = account.provider;
        token.providerAccountId = account.providerAccountId;
        token.oauthEmail = user.email ?? "";
        token.oauthName = user.name ?? "";
        token.oauthImage = user.image ?? "";
        // Store Patreon access token so complete/route.ts can call the Patreon API
        if (account.provider === "patreon" && account.access_token) {
          token.patreonAccessToken = account.access_token;
        }
      }
      return token;
    },

    // Expose on session object
    async session({ session, token }) {
      (session as any).provider = token.provider;
      (session as any).providerAccountId = token.providerAccountId;
      (session as any).oauthEmail = token.oauthEmail;
      (session as any).oauthName = token.oauthName;
      (session as any).oauthImage = token.oauthImage;
      return session;
    },

    // After sign-in, redirect to /api/auth/complete
    // Pass email in URL (signed via AUTH_SECRET already protects the session)
    async redirect({ url, baseUrl }) {
      if (url.includes("/profile") || url === baseUrl || url === `${baseUrl}/`) {
        return `${baseUrl}/api/auth/complete`;
      }
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return `${baseUrl}/api/auth/complete`;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
});

