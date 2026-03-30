/**
 * GET /api/starter-guide/cron
 *
 * Vercel cron job — runs every Monday at 03:00 UTC.
 * Regenerates all three starter guides so they stay current after
 * set releases, banlists, and meta shifts.
 *
 * Authenticated via Vercel's CRON_SECRET header (set automatically).
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { upsertPost } from "@/lib/db";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TODAY = () => new Date().toISOString().slice(0, 10);

const GAMES = [
  {
    slug: "flesh-and-blood-starter-guide",
    category: "flesh-and-blood",
    name: "Flesh and Blood",
    prompt: `Write a practical, up-to-date starter buying guide for a new Flesh and Blood TCG player asking "What should I buy first?". Cover: what makes FaB unique, best starter products with current prices, budget upgrade path from blitz to Classic Constructed, key sets in the current meta, what to avoid, where to buy, and a short FAQ. Use markdown headers and bullet points. Under 800 words.`,
  },
  {
    slug: "grand-archive-starter-guide",
    category: "grand-archive",
    name: "Grand Archive",
    prompt: `Write a practical, up-to-date starter buying guide for a new Grand Archive TCG player asking "What should I buy first?". Cover: what makes GA unique, best trial/starter decks currently available, budget upgrade path, key sets to know, what to avoid, where to buy, and a short FAQ including which champion to start with. Use markdown headers and bullet points. Under 800 words.`,
  },
  {
    slug: "one-piece-tcg-starter-guide",
    category: "one-piece-tcg",
    name: "One Piece TCG",
    prompt: `Write a practical, up-to-date starter buying guide for a new One Piece Card Game player asking "What should I buy first?". Cover: what makes OPCG unique, best starter decks currently available, budget upgrade path, key booster sets, what to avoid, where to buy, and a short FAQ including which leader is best for beginners. Use markdown headers and bullet points. Under 800 words.`,
  },
];

export async function GET(req: NextRequest) {
  // Verify Vercel cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = TODAY();
  const results: Record<string, string> = {};

  for (const game of GAMES) {
    try {
      const response = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 1200,
        messages: [{ role: "user", content: game.prompt }],
        system: `You are a TCG expert writing evergreen buying guides for TCG Times (tcgtimes.blog). Today: ${today}. Be specific about real products. Use markdown.`,
      });

      const content =
        response.content[0].type === "text" ? response.content[0].text : "";
      if (!content) { results[game.slug] = "empty response"; continue; }

      await upsertPost(
        game.slug,
        {
          title: `${game.name} Starter Guide`,
          date: today,
          excerpt: `Everything you need to know to start buying ${game.name} cards — best products for new players, budget upgrade paths, and what to avoid.`,
          author: "TCG Times AI",
          authorUsername: "tcgtimes",
          category: game.category,
          tags: ["buying-guide", "starter", "budget"],
          featured: false,
          pinned: true,
        },
        content
      );

      results[game.slug] = `ok (~${content.split(/\s+/).length} words)`;
    } catch (e) {
      results[game.slug] = `error: ${String(e).slice(0, 120)}`;
    }
  }

  return NextResponse.json({ ok: true, date: today, results });
}
