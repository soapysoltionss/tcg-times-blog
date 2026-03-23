import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a friendly TCG assistant for TCG Times (tcgtimes.blog).
You help players with Grand Archive, Flesh and Blood, One Piece TCG, and general card game theory.
Keep every answer under 100 words. Be concise and direct.
If a question is outside TCG topics, politely say you can only help with card games.
Do not make up card rulings — if unsure, say so and suggest checking the official rulebook.`;

type Message = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  try {
    const { messages } = (await req.json()) as { messages: Message[] };

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Keep only last 6 messages to cap token usage
    const trimmed = messages.slice(-6) as Message[];

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 150,
      system: SYSTEM_PROMPT,
      messages: trimmed,
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({ reply: text });
  } catch (err) {
    console.error("[/api/chat]", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
