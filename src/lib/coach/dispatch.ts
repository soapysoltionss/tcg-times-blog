/**
 * coach/dispatch.ts
 * Model dispatch layer — calls the right AI provider.
 * Each function is isolated so it can be tested or swapped independently.
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { CoachMessage } from "./types";

// Keep only the last N messages to control token spend
const HISTORY_WINDOW = 8;

// ---------------------------------------------------------------------------
// Claude (Anthropic) — used for the cheap router/guard steps only
// ---------------------------------------------------------------------------

export async function callClaude(
  client: Anthropic,
  model: string,
  system: string,
  messages: CoachMessage[]
): Promise<string> {
  const res = await client.messages.create({
    model,
    max_tokens: 500,
    system,
    messages: messages.slice(-HISTORY_WINDOW),
  });
  return res.content[0].type === "text" ? res.content[0].text : "";
}

// ---------------------------------------------------------------------------
// Qwen via OpenRouter (free, OpenAI-compatible)
// Model: qwen/qwen3.6-plus:free
// ---------------------------------------------------------------------------

export async function callQwen(
  model: string,
  system: string,
  messages: CoachMessage[]
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  const client = new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "https://www.tcgtimes.blog",
      "X-Title": "TCG Times AI Coach",
    },
  });

  const res = await client.chat.completions.create({
    model,
    max_tokens: 800,
    messages: [
      { role: "system", content: system },
      ...messages.slice(-HISTORY_WINDOW).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ],
  });
  return res.choices[0]?.message?.content ?? "";
}
