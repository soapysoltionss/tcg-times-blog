/**
 * coach/types.ts
 * Shared TypeScript types for the TCG AI Coach system.
 * No runtime dependencies — safe to import in client and server code.
 */

// ---------------------------------------------------------------------------
// Tier system
// ---------------------------------------------------------------------------

/**
 * Subscription tier level.
 *  0 = Free    (anonymous or registered, no subscription)
 *  1 = Starter (SGD 6/mo)  — AI only, no paywalled articles
 *  2 = Basic   (SGD 18/mo) — articles + mid-tier AI
 *  3 = Pro     (SGD 48/mo) — full access, best models, pro articles
 */
export type TierLevel = 0 | 1 | 2 | 3;

// ---------------------------------------------------------------------------
// Agent intents
// ---------------------------------------------------------------------------

export type AgentIntent =
  | "rules"       // card text, timing, legality, interactions
  | "deckbuilding"// ratios, synergies, upgrade paths
  | "prices"      // market values, where to buy, cross-region deals
  | "matchup"     // strategy, sideboard, meta positioning
  | "general";    // catch-all

// ---------------------------------------------------------------------------
// Model choices
// ---------------------------------------------------------------------------

/** Only Qwen is used — free via OpenRouter (qwen/qwen3-235b-a22b:free) */
export type ModelChoice = "qwen";

// ---------------------------------------------------------------------------
// Message format (matches both Anthropic and OpenAI conventions)
// ---------------------------------------------------------------------------

export type CoachMessage = { role: "user" | "assistant"; content: string };

// ---------------------------------------------------------------------------
// Region context
// ---------------------------------------------------------------------------

export type RegionContext = {
  /** ISO 3166-1 alpha-2 code for the player, e.g. "SG" */
  userRegion?: string;
  /** ISO 3166-1 alpha-2 code for a seller/counterparty in a marketplace question */
  counterpartyRegion?: string;
};

// ---------------------------------------------------------------------------
// Model metadata (used in the UI picker)
// ---------------------------------------------------------------------------

export type ModelMeta = {
  id: ModelChoice;
  label: string;
  provider: string;
  tagline: string;
  strengths: string[];
  bestFor: string;
  badge: string;
  /** Minimum TierLevel required to use this model */
  tierRequired: TierLevel;
};

// ---------------------------------------------------------------------------
// runCoach return type
// ---------------------------------------------------------------------------

export type CoachResult = {
  reply: string;
  intent: AgentIntent;
  /** Resolved model identifier, e.g. "claude-sonnet-4-5" */
  model: string;
  /** Provider display name, e.g. "Anthropic" */
  provider: string;
};
