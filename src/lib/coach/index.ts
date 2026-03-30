/**
 * coach/index.ts
 * Public API for the TCG AI Coach.
 *
 * Usage:
 *   import { runCoach, classifyIntent, MODEL_OPTIONS, SUPPORTED_REGIONS, TIER_META } from "@/lib/coach";
 */

import Anthropic from "@anthropic-ai/sdk";
import type { AgentIntent, CoachMessage, CoachResult, ModelChoice, RegionContext, TierLevel } from "./types";
import { ROUTER_PROMPT, OFF_TOPIC_PROMPT, buildSystemPrompt } from "./prompts";
import { ROUTER_MODEL, MODEL_OPTIONS, TIER_LIMITS, resolveModel, effectiveModelChoice } from "./models";
import { callClaude, callGPT, callGemini } from "./dispatch";

// ---------------------------------------------------------------------------
// Intent classification (always Claude Haiku — cheap + fast router)
// ---------------------------------------------------------------------------

export async function classifyIntent(
  anthropic: Anthropic,
  userMessage: string
): Promise<AgentIntent> {
  try {
    const res = await anthropic.messages.create({
      model: ROUTER_MODEL,
      max_tokens: 10,
      system: ROUTER_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });
    const text =
      res.content[0].type === "text" ? res.content[0].text.trim().toLowerCase() : "";
    const valid: AgentIntent[] = ["rules", "deckbuilding", "prices", "matchup", "general"];
    return valid.includes(text as AgentIntent) ? (text as AgentIntent) : "general";
  } catch {
    // If router fails, fall back to general — don't crash the whole request
    return "general";
  }
}

// ---------------------------------------------------------------------------
// Off-topic guard — Haiku check, ~$0.0003 per call, runs before the real call
// Returns true if the message is NOT related to TCGs.
// ---------------------------------------------------------------------------

export async function isOffTopic(
  anthropic: Anthropic,
  userMessage: string
): Promise<boolean> {
  try {
    const res = await anthropic.messages.create({
      model: ROUTER_MODEL,
      max_tokens: 5,
      system: OFF_TOPIC_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });
    const text =
      res.content[0].type === "text" ? res.content[0].text.trim().toLowerCase() : "yes";
    return text === "no";
  } catch {
    // If guard fails, allow through — don't block users on a guard error
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main coach entry point
// ---------------------------------------------------------------------------

export async function runCoach(
  anthropicClient: Anthropic,
  messages: CoachMessage[],
  tier: TierLevel,
  region: RegionContext = {},
  modelChoice: ModelChoice = "claude"
): Promise<CoachResult> {
  const chosen = effectiveModelChoice(modelChoice, tier);
  const chosenMeta = MODEL_OPTIONS.find((m) => m.id === chosen)!;

  const latestUserMsg =
    [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

  // Run off-topic guard and intent classifier in parallel (both use Haiku)
  const [offTopic, intent] = await Promise.all([
    isOffTopic(anthropicClient, latestUserMsg),
    classifyIntent(anthropicClient, latestUserMsg),
  ]);

  // Reject non-TCG questions before spending tokens on the specialist call
  if (offTopic) {
    return {
      reply:
        "I'm a TCG-only assistant — I can help with Flesh and Blood, Grand Archive, One Piece TCG, and other card games. I can't help with that topic. Try asking about rules, deckbuilding, card prices, or matchup strategy!",
      intent: "general",
      model: ROUTER_MODEL,
      provider: "Anthropic",
    };
  }

  const model = resolveModel(chosen, tier);
  const system = buildSystemPrompt(intent, region);

  let reply: string;
  if (chosen === "gpt") {
    reply = await callGPT(model, system, messages);
  } else if (chosen === "gemini") {
    reply = await callGemini(model, system, messages);
  } else {
    reply = await callClaude(anthropicClient, model, system, messages);
  }

  return { reply, intent, model, provider: chosenMeta.provider };
}

// ---------------------------------------------------------------------------
// Re-exports — consumers import from "@/lib/coach" only
// ---------------------------------------------------------------------------

export { MODEL_OPTIONS, TIER_LIMITS } from "./models";
export { SUPPORTED_REGIONS } from "./regions";
export { TIER_META } from "./models";
export type { TierLevel, ModelChoice, AgentIntent, CoachMessage, RegionContext, CoachResult, ModelMeta } from "./types";
