/**
 * Auth.js (NextAuth v5) configuration.
 *
 * Handles Google + Patreon OAuth. After a successful OAuth sign-in, we
 * upsert the user into our own JSON DB and issue our own JWT session cookie
 * (tcgt_session) so the rest of the app keeps working exactly the same way.
 */

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { OAuthUserConfig } from "next-auth/providers";
import { upsertOAuthUser } from "@/lib/db";
import { signSession } from "@/lib/session";
import { cookies } from "next/headers";

// ---------------------------------------------------------------------------
// Custom Patreon provider (not shipped in NextAuth v5)
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
// NextAuth config
// ---------------------------------------------------------------------------

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Patreon({
      clientId: process.env.PATREON_CLIENT_ID!,
      clientSecret: process.env.PATREON_CLIENT_SECRET!,
    }),
  ],

  // We don't use NextAuth sessions — we issue our own JWT cookie.
  session: { strategy: "jwt" },

  callbacks: {
    /**
     * Called after a successful OAuth sign-in.
     * Upsert the user in our DB, issue our own session cookie, return true.
     */
    async signIn({ user, account }) {
      if (!account || account.type !== "oauth") return true;

      try {
        const dbUser = upsertOAuthUser({
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          email: user.email ?? "",
          name: user.name ?? "User",
          image: user.image ?? undefined,
        });

        // Issue our own tcgt_session cookie
        const token = await signSession({
          userId: dbUser.id,
          username: dbUser.username,
        });
        const cookieStore = await cookies();
        cookieStore.set("tcgt_session", token, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          secure: process.env.NODE_ENV === "production",
          maxAge: 60 * 60 * 24 * 30, // 30 days
        });
      } catch (err) {
        console.error("OAuth upsert error:", err);
        return false;
      }

      return true;
    },
  },

  // Redirect after OAuth login
  pages: {
    signIn: "/login",
    error: "/login",
  },
});

