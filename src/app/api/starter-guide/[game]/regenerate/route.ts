/**
 * POST /api/starter-guide/[game]/regenerate
 *
 * Admin-only. Calls Claude to write a fresh "Start Here" buying/starter guide
 * for the given game, then upserts it as a pinned post in the database.
 *
 * The guide is automatically AI-generated and can be re-triggered any time
 * (e.g. after a new set release, meta shift, or banlist update) to keep it current.
 *
 * Supported games: flesh-and-blood | grand-archive | one-piece-tcg
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUserById, upsertPost } from "@/lib/db";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ---------------------------------------------------------------------------
// Per-game metadata
// ---------------------------------------------------------------------------

const GAME_META: Record<
  string,
  {
    name: string;
    category: string;
    slug: string;
    systemPrompt: string;
  }
> = {
  "flesh-and-blood": {
    name: "Flesh and Blood",
    category: "flesh-and-blood",
    slug: "flesh-and-blood-starter-guide",
    systemPrompt: `You are a TCG expert writing a comprehensive, up-to-date starter buying guide for Flesh and Blood (FaB) TCG on TCG Times (tcgtimes.blog). Today's date: ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}.

Write a practical guide for a new player asking "What should I buy first?" Cover:
1. What makes FaB unique as a game (Living Legend, no rotation in Classic Constructed)
2. Best starting point: pre-constructed blitz decks (~$15–25 AUD) — name 3–4 currently available ones and what heroes they're good for
3. What a budget-friendly Hero Deck upgrade path looks like (blitz → expanded blitz → Classic Constructed)
4. Key sets/products to know about in the current meta
5. What to avoid buying as a beginner (sealed packs, expensive legendaries)
6. Where to buy (LGS, TCGPlayer, local Facebook groups)
7. A short FAQ: "Do I need a complete set?" / "What's the cheapest competitive deck?"

Write in a friendly, direct tone. Use markdown headers and bullet points. Keep it under 800 words. Tag relevant cards and product names exactly as they appear in official releases. End with a "Buying Guide" tag note for readers.`,
  },
  "grand-archive": {
    name: "Grand Archive",
    category: "grand-archive",
    slug: "grand-archive-starter-guide",
    systemPrompt: `You are a TCG expert writing a comprehensive, up-to-date starter buying guide for Grand Archive TCG on TCG Times (tcgtimes.blog). Today's date: ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}.

Write a practical guide for a new player asking "What should I buy first?" Cover:
1. What makes Grand Archive unique (anime art, collector appeal, champion system)
2. Best starting point: starter decks and Lorraine trial decks — what's currently available and what archetype they support
3. Budget upgrade path from starter deck to competitive
4. Key sets to know (Dawn of Ashes, Mercurial Heart, etc.) and which matter for new players
5. What to avoid (expensive secret rares, chasing specific foils early)
6. Where to buy (GA Store, TCGPlayer, local community groups)
7. Short FAQ: "Is Grand Archive worth getting into?" / "Which champion should I start with?"

Write in a friendly, direct tone. Use markdown headers and bullet points. Keep it under 800 words. End with a "Buying Guide" tag note for readers.`,
  },
  "one-piece-tcg": {
    name: "One Piece TCG",
    category: "one-piece-tcg",
    slug: "one-piece-tcg-starter-guide",
    systemPrompt: `You are a TCG expert writing a comprehensive, up-to-date starter buying guide for the One Piece Card Game (OPCG) on TCG Times (tcgtimes.blog). Today's date: ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}.

Write a practical guide for a new player asking "What should I buy first?" Cover:
1. What makes the One Piece Card Game unique (leader system, color identity, events)
2. Best starting point: starter decks currently available (~$15–25) — name 3–4 decks and what playstyle they suit
3. Budget upgrade path from starter to tournament-ready
4. Key booster sets in the current format and which matter for upgrading
5. What to avoid (chasing premium alternates, buying singles before understanding the deck)
6. Where to buy (local game stores, TCGPlayer, Japanese imports)
7. Short FAQ: "Which leader is best for beginners?" / "Do I need two starter decks?"

Write in a friendly, direct tone. Use markdown headers and bullet points. Keep it under 800 words. End with a "Buying Guide" tag note for readers.`,
  },
};

// ---------------------------------------------------------------------------
// POST /api/starter-guide/[game]/regenerate
// ---------------------------------------------------------------------------

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ game: string }> }
) {
  const { game } = await params;
  const meta = GAME_META[game];
  if (!meta) {
    return NextResponse.json({ error: `Unknown game: ${game}` }, { status: 400 });
  }

  // Admin auth
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const admin = await getUserById(session.userId);
  if (!admin || admin.role !== "admin") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  // Generate guide via Claude
  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1200,
    messages: [
      {
        role: "user",
        content: "Write the starter guide now.",
      },
    ],
    system: meta.systemPrompt,
  });

  const content =
    response.content[0].type === "text" ? response.content[0].text : "";

  if (!content) {
    return NextResponse.json({ error: "AI returned empty response." }, { status: 500 });
  }

  const today = new Date().toISOString().slice(0, 10);

  // Upsert the post — pinned, tagged "buying-guide"
  await upsertPost(meta.slug, {
    title: `${meta.name} Starter Guide`,
    date: today,
    excerpt: `Everything you need to know to start buying ${meta.name} cards — best products for new players, budget upgrade paths, and what to avoid.`,
    author: "TCG Times AI",
    authorUsername: "tcgtimes",
    category: meta.category,
    tags: ["buying-guide", "starter", "budget"],
    featured: false,
    pinned: true,
  }, content);

  return NextResponse.json({
    ok: true,
    slug: meta.slug,
    game,
    generatedAt: today,
    wordCount: content.split(/\s+/).length,
  });
}
