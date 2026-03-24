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
// NextAuth config — minimal, no custom callbacks
// ---------------------------------------------------------------------------

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers,
  pages: {
    signIn: "/login",
    error: "/login",
  },
});

