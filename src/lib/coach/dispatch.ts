/**
 * coach/dispatch.ts
 * Model dispatch layer — calls the right AI provider.
 * Each function is isolated so it can be tested or swapped independently.
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { CoachMessage } from "./types";

// Keep only the last N messages to control token spend
const HISTORY_WINDOW = 8;

// ---------------------------------------------------------------------------
// Claude (Anthropic)
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
// GPT (OpenAI)
// ---------------------------------------------------------------------------

export async function callGPT(
  model: string,
  system: string,
  messages: CoachMessage[]
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const client = new OpenAI({ apiKey });
  const res = await client.chat.completions.create({
    model,
    max_tokens: 500,
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

// ---------------------------------------------------------------------------
// Gemini (Google)
// ---------------------------------------------------------------------------

export async function callGemini(
  model: string,
  system: string,
  messages: CoachMessage[]
): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY is not set");

  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({
    model,
    systemInstruction: system,
  });

  const trimmed = messages.slice(-HISTORY_WINDOW);
  const last = trimmed[trimmed.length - 1];
  const history = trimmed.slice(0, -1).map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.content }],
  }));

  const chat = geminiModel.startChat({ history });
  const res = await chat.sendMessage(last?.content ?? "");
  return res.response.text();
}
