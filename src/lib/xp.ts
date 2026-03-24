/**
 * Pure type + constant definitions — no Node.js imports.
 * Safe to import in both server and client code.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UserTask = {
  id: string;
  completedAt: string | null;
};

/** A linked OAuth account (Google, Patreon, etc.) */
export type OAuthAccount = {
  provider: string;   // "google" | "patreon"
  providerAccountId: string;
  email?: string;
  name?: string;
  image?: string;
};

/**
 * Patreon subscription state.
 * Written when the user connects Patreon and refreshed via webhook.
 */
export type Subscription = {
  /** Patreon member object id (from the memberships endpoint) */
  patreonMemberId: string;
  /** Patreon campaign tier id */
  tierId: string;
  /** Human-readable tier name e.g. "Monthly" */
  tierName: string;
  /**
   * active   — currently paying, has access
   * declined — payment failed, grace period
   * cancelled — cancelled, access until currentPeriodEnd
   * expired  — access ended
   */
  status: "active" | "declined" | "cancelled" | "expired";
  /** ISO date string — when current paid period ends */
  currentPeriodEnd?: string;
  /** ISO date the subscription was last synced */
  syncedAt: string;
};

export type User = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  /** Bcrypt hash — empty string for OAuth-only users */
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
  xp: number;
  tasks: UserTask[];
  /**
   * Site role — controls what a user can publish and see.
   *  reader      — default, can comment only
   *  community   — can submit community articles
   *  professional — can publish professional articles
   *  admin       — full access
   */
  role?: "reader" | "community" | "professional" | "admin";
  /** Linked OAuth accounts */
  oauthAccounts?: OAuthAccount[];
  /** Avatar URL from OAuth provider */
  avatarUrl?: string;
  /** Whether the email address has been verified */
  emailVerified?: boolean;
  /** 6-digit code + expiry for email verification or password reset */
  verificationCode?: string;
  verificationCodeExpiresAt?: string;
  /** True for brand-new OAuth users who haven't chosen a username yet */
  needsUsername?: boolean;
  /** Patreon subscription — set when the user connects Patreon, synced via webhook */
  subscription?: Subscription;
};

// ---------------------------------------------------------------------------
// XP task catalogue
// ---------------------------------------------------------------------------

export type TaskDefinition = {
  id: string;
  label: string;
  description: string;
  xpReward: number;
  icon: string;
};

export const TASK_CATALOGUE: TaskDefinition[] = [
  {
    id: "register",
    label: "Create your account",
    description: "Welcome to TCG Times!",
    xpReward: 50,
    icon: "🎴",
  },
  {
    id: "complete_profile",
    label: "Complete your profile",
    description: "Add your first name, last name and email.",
    xpReward: 100,
    icon: "✏️",
  },
  {
    id: "first_comment",
    label: "Leave your first comment",
    description: "Join the conversation on any article.",
    xpReward: 75,
    icon: "💬",
  },
  {
    id: "first_post",
    label: "Publish your first post",
    description: "Submit a community article.",
    xpReward: 200,
    icon: "📝",
  },
  {
    id: "read_5_posts",
    label: "Read 5 articles",
    description: "Explore the TCG Times library.",
    xpReward: 50,
    icon: "📖",
  },
  {
    id: "subscribe",
    label: "Become a subscriber",
    description: "Unlock premium content.",
    xpReward: 150,
    icon: "⭐",
  },
];

// ---------------------------------------------------------------------------
// XP level thresholds
// ---------------------------------------------------------------------------

export function xpToLevel(xp: number): {
  level: number;
  title: string;
  nextLevelXp: number;
  currentLevelXp: number;
} {
  const levels = [
    { level: 1, title: "Novice Duelist", threshold: 0 },
    { level: 2, title: "Apprentice", threshold: 100 },
    { level: 3, title: "Journeyman", threshold: 300 },
    { level: 4, title: "Strategist", threshold: 600 },
    { level: 5, title: "Veteran", threshold: 1000 },
    { level: 6, title: "Champion", threshold: 1500 },
    { level: 7, title: "Grand Champion", threshold: 2200 },
    { level: 8, title: "Master", threshold: 3000 },
  ];

  let current = levels[0];
  for (const l of levels) {
    if (xp >= l.threshold) current = l;
    else break;
  }

  const idx = levels.indexOf(current);
  const next = levels[idx + 1];

  return {
    level: current.level,
    title: current.title,
    currentLevelXp: current.threshold,
    nextLevelXp: next?.threshold ?? current.threshold,
  };
}
