/**
 * coach/models.ts
 * Model catalogue, tier-to-model resolution, and UI metadata.
 *
 * Pricing reference (1 USD ≈ 1.35 SGD, March 2026):
 * ─────────────────────────────────────────────────────────────
 * Claude Haiku 4-5:    $0.80/M in  $4.00/M out  ≈ SGD $0.0041/msg
 * Claude Sonnet 4-5:   $3.00/M in  $15.00/M out ≈ SGD $0.0176/msg
 * GPT-4o-mini:         $0.15/M in  $0.60/M out  ≈ SGD $0.0020/msg
 * GPT-4o:              $2.50/M in  $10.00/M out ≈ SGD $0.0135/msg
 * Gemini 1.5 Flash:    $0.075/M in $0.30/M out  ≈ SGD $0.0011/msg
 * Gemini 1.5 Pro:      $1.25/M in  $5.00/M out  ≈ SGD $0.0095/msg
 *
 * Tier cost model (per subscriber per month at realistic usage):
 * ─────────────────────────────────────────────────────────────
 * FREE     (5/day,  haiku only):        SGD $0.62   — site absorbs
 * STARTER  (10/day, mid models):        SGD $0.90   → price SGD 6   (6.7× margin)
 * BASIC    (30/day, mid models + arts): SGD $5.33   → price SGD 18  (3.4× margin)
 * PRO      (100/day, best + pro arts):  SGD $27.20  → price SGD 48  (1.8× margin)
 *
 * "Basic" article cost: SGD 100/article × 2/mo ÷ 100 subscribers = SGD $2/subscriber
 * "Pro"   article cost: SGD 500/article × 2/mo ÷ 50  subscribers = SGD $20/subscriber
 */

import type { ModelChoice, ModelMeta, TierLevel } from "./types";

// ---------------------------------------------------------------------------
// Model options (exported for the UI picker)
// ---------------------------------------------------------------------------

export const MODEL_OPTIONS: ModelMeta[] = [
  {
    id: "claude",
    label: "Claude",
    provider: "Anthropic",
    tagline: "Deep rules analysis & card text parsing",
    strengths: [
      "Precise card text and rules interactions",
      "Layer-by-layer timing analysis",
      "Structured deckbuilding breakdowns",
      "Long, detailed responses",
    ],
    bestFor: "Rules questions, card interactions, detailed deckbuilding advice",
    badge: "⚖️",
    tierRequired: 0, // available to all tiers
  },
  {
    id: "gpt",
    label: "ChatGPT",
    provider: "OpenAI",
    tagline: "Critical thinking & strategic planning",
    strengths: [
      "Nuanced competitive matchup strategy",
      "Multi-step game plan reasoning",
      "Sideboard philosophy and theory",
      "Conversational coaching style",
    ],
    bestFor: "Matchup strategy, tournament prep, meta positioning",
    badge: "🧠",
    tierRequired: 1, // Starter+
  },
  {
    id: "gemini",
    label: "Gemini",
    provider: "Google",
    tagline: "Current prices & recent set awareness",
    strengths: [
      "Up-to-date card pricing knowledge",
      "Recent set and banned/restricted awareness",
      "Platform comparison (TCGPlayer vs regional stores)",
      "Budget building with current market context",
    ],
    bestFor: "Prices, recent spoilers, where to buy, budget decks",
    badge: "🔍",
    tierRequired: 1, // Starter+
  },
];

// ---------------------------------------------------------------------------
// Model resolution — maps (choice, tier) → concrete model ID
// ---------------------------------------------------------------------------

/** Haiku is always used for the cheap router classification step. */
export const ROUTER_MODEL = "claude-haiku-4-5";

/**
 * Maps a user's chosen model + their tier to the best available
 * version of that model.
 *   tier 0–2 → base model (fast, cost-efficient)
 *   tier 3   → premium model (best quality)
 */
export function resolveModel(choice: ModelChoice, tier: TierLevel): string {
  const isPro = tier >= 3;
  if (choice === "claude")  return isPro ? "claude-sonnet-4-5"  : "claude-haiku-4-5";
  if (choice === "gpt")     return isPro ? "gpt-4o"             : "gpt-4o-mini";
  if (choice === "gemini")  return isPro ? "gemini-1.5-pro"     : "gemini-1.5-flash";
  return ROUTER_MODEL;
}

/**
 * Enforces tier requirements. If the user's tier is too low for their
 * chosen model, falls back to Claude (always available).
 */
export function effectiveModelChoice(
  choice: ModelChoice,
  tier: TierLevel
): ModelChoice {
  const meta = MODEL_OPTIONS.find((m) => m.id === choice);
  if (!meta || tier < meta.tierRequired) return "claude";
  return choice;
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
// Tier display metadata (used in coach UI + subscribe page)
// ---------------------------------------------------------------------------

export type TierMeta = {
  level: TierLevel;
  name: string;
  priceSGD: number;
  /** Monthly message limit */
  dailyLimit: number;
  /** Best model available at this tier */
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
    topModel: "Claude Haiku",
    color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
    models: ["claude"],
    articles: "none",
  },
  1: {
    level: 1,
    name: "Starter",
    priceSGD: 6,
    dailyLimit: 10,
    topModel: "Claude Haiku / GPT-4o-mini / Gemini Flash",
    color: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
    models: ["claude", "gpt", "gemini"],
    articles: "starter",
  },
  2: {
    level: 2,
    name: "Basic",
    priceSGD: 18,
    dailyLimit: 30,
    topModel: "Claude Haiku / GPT-4o-mini / Gemini Flash",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    models: ["claude", "gpt", "gemini"],
    articles: "basic",
  },
  3: {
    level: 3,
    name: "Pro",
    priceSGD: 48,
    dailyLimit: 100,
    topModel: "Claude Sonnet / GPT-4o / Gemini Pro",
    color: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
    models: ["claude", "gpt", "gemini"],
    articles: "pro",
  },
};
