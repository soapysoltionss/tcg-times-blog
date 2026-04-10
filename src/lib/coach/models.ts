/**
 * coach/models.ts
 * Model catalogue and tier metadata.
 *
 * All AI responses use Qwen3-235B-A22B via OpenRouter (free tier).
 * Claude Haiku is still used for the cheap router/guard classification steps.
 */

import type { ModelChoice, ModelMeta, TierLevel } from "./types";

// ---------------------------------------------------------------------------
// Model options — single entry, Qwen only
// ---------------------------------------------------------------------------

export const MODEL_OPTIONS: ModelMeta[] = [
  {
    id: "qwen",
    label: "Qwen 3.6 Plus",
    provider: "Alibaba / OpenRouter",
    tagline: "Powerful open-source model — rules, strategy, prices",
    strengths: [
      "Deep card rules and interaction analysis",
      "Competitive deckbuilding and strategy",
      "Market pricing and budget advice",
      "Matchup analysis and sideboard theory",
    ],
    bestFor: "All TCG questions — rules, deckbuilding, prices, matchups",
    badge: "🤖",
    tierRequired: 0,
  },
];

// ---------------------------------------------------------------------------
// Router model — Claude Haiku for cheap classification steps
// ---------------------------------------------------------------------------

/** Always Haiku for the intent router and off-topic guard — keeps costs minimal. */
export const ROUTER_MODEL = "claude-haiku-4-5";

/** The Qwen model ID used for all main coach responses. */
export const QWEN_MODEL = "qwen/qwen3.6-plus:free";

/**
 * Always returns the Qwen model — tier only affects daily message limits,
 * not model quality (everyone gets the same powerful model for free).
 */
export function resolveModel(_choice: ModelChoice, _tier: TierLevel): string {
  return QWEN_MODEL;
}

/**
 * Always returns "qwen" — no tier enforcement needed since there is only
 * one model and it's available to all tiers.
 */
export function effectiveModelChoice(
  _choice: ModelChoice,
  _tier: TierLevel
): ModelChoice {
  return "qwen";
}

// ---------------------------------------------------------------------------
// Rate limits per tier (messages per calendar day)
// ---------------------------------------------------------------------------

export const TIER_LIMITS: Record<TierLevel, number> = {
  0: 5,    // Free
  1: 10,   // Starter
  2: 30,   // Basic
  3: 100,  // Pro
};

// ---------------------------------------------------------------------------
// Tier display metadata
// ---------------------------------------------------------------------------

export type TierMeta = {
  level: TierLevel;
  name: string;
  priceSGD: number;
  dailyLimit: number;
  topModel: string;
  color: string;
  models: ModelChoice[];
  articles: "none" | "starter" | "basic" | "pro";
};

export const TIER_META: Record<TierLevel, TierMeta> = {
  0: {
    level: 0,
    name: "Free",
    priceSGD: 0,
    dailyLimit: 5,
    topModel: "Qwen 3.6 Plus",
    color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
    models: ["qwen"],
    articles: "none",
  },
  1: {
    level: 1,
    name: "Starter",
    priceSGD: 6,
    dailyLimit: 10,
    topModel: "Qwen 3.6 Plus",
    color: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
    models: ["qwen"],
    articles: "starter",
  },
  2: {
    level: 2,
    name: "Basic",
    priceSGD: 18,
    dailyLimit: 30,
    topModel: "Qwen 3.6 Plus",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    models: ["qwen"],
    articles: "basic",
  },
  3: {
    level: 3,
    name: "Pro",
    priceSGD: 48,
    dailyLimit: 100,
    topModel: "Qwen 3.6 Plus",
    color: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
    models: ["qwen"],
    articles: "pro",
  },
};
