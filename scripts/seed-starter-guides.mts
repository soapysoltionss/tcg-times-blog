import { neon } from "@neondatabase/serverless";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local manually
const envPath = resolve(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf8");
const env = Object.fromEntries(
  envContent
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^"|"$/g, "")];
    })
);

const DB_URL = env.DATABASE_URL;
const ANTHROPIC_KEY = env.ANTHROPIC_API_KEY;

if (!DB_URL || !ANTHROPIC_KEY) {
  console.error("Missing DATABASE_URL or ANTHROPIC_API_KEY in .env.local");
  process.exit(1);
}

const db = neon(DB_URL);
const client = new Anthropic({ apiKey: ANTHROPIC_KEY });

const TODAY = new Date().toISOString().slice(0, 10);

const GAMES = [
  {
    slug: "flesh-and-blood-starter-guide",
    category: "flesh-and-blood",
    name: "Flesh and Blood",
    prompt: `Write a practical starter buying guide for a new Flesh and Blood TCG player asking "What should I buy first?". 

Cover:
1. What makes FaB unique (Living Legend system, Classic Constructed vs Blitz formats)
2. Best starting products: pre-constructed blitz decks (name 3-4 currently available ones with approximate prices)
3. Budget upgrade path from blitz deck to competitive Classic Constructed
4. Key sets in the current meta (mention sets available as of early 2026)
5. What to avoid as a beginner (expensive sealed products, specific Legendary cards)
6. Where to buy (LGS, TCGPlayer, community groups)
7. Short FAQ: "Do I need a full set?" and "What is the cheapest competitive deck?"

Use markdown headers (## for sections) and bullet points. Under 800 words. Specific about real product names.`,
  },
  {
    slug: "grand-archive-starter-guide",
    category: "grand-archive",
    name: "Grand Archive",
    prompt: `Write a practical starter buying guide for a new Grand Archive TCG player asking "What should I buy first?".

Cover:
1. What makes Grand Archive unique (anime art, champion system, collector appeal, lore)
2. Best starting products: trial decks and starter products currently available (~$15-25)
3. Budget upgrade path from starter deck to competitive
4. Key sets to know (Dawn of Ashes, Mercurial Heart, etc.) — which matter for new players
5. What to avoid early on (expensive SR/collector foils before learning the game)
6. Where to buy (official store, TCGPlayer, local communities)
7. Short FAQ: "Is GA worth getting into?" and "Which champion should I start with?"

Use markdown headers (## for sections) and bullet points. Under 800 words.`,
  },
  {
    slug: "one-piece-tcg-starter-guide",
    category: "one-piece-tcg",
    name: "One Piece TCG",
    prompt: `Write a practical starter buying guide for a new One Piece Card Game player asking "What should I buy first?".

Cover:
1. What makes OPCG unique (leader system, color identity, event cards, no rotation)
2. Best starting products: starter decks currently available, name 3-4 with what playstyle they suit
3. Budget upgrade path from starter deck to tournament-ready
4. Key booster sets in the current format and which are worth buying for upgrades
5. What to avoid (chasing premium alternate art cards before learning the game)
6. Where to buy (LGS, TCGPlayer, Japanese imports for value)
7. Short FAQ: "Which leader is best for beginners?" and "Do I need two starter decks?"

Use markdown headers (## for sections) and bullet points. Under 800 words.`,
  },
];

async function seed() {
  for (const game of GAMES) {
    console.log(`\nGenerating guide for ${game.name}...`);
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1400,
      messages: [{ role: "user", content: game.prompt }],
      system: `You are a TCG expert writing evergreen buying guides for TCG Times (tcgtimes.blog). Today's date: ${TODAY}. Write in a friendly, direct tone for new players. Use markdown formatting. Be specific about real products and realistic prices.`,
    });

    const content =
      response.content[0].type === "text" ? response.content[0].text : "";

    if (!content) {
      console.error(`Empty response for ${game.name}`);
      continue;
    }

    const fm = JSON.stringify({
      title: `${game.name} Starter Guide`,
      date: TODAY,
      excerpt: `Everything you need to know to start buying ${game.name} cards — best products for new players, budget upgrade paths, and what to avoid.`,
      author: "TCG Times AI",
      authorUsername: "tcgtimes",
      category: game.category,
      tags: ["buying-guide", "starter", "budget"],
      featured: false,
      pinned: true,
    });

    await db`
      INSERT INTO posts (slug, frontmatter, content, updated_at)
      VALUES (${game.slug}, ${fm}::jsonb, ${content}, now())
      ON CONFLICT (slug) DO UPDATE
        SET frontmatter = EXCLUDED.frontmatter,
            content     = EXCLUDED.content,
            updated_at  = now()
    `;

    console.log(`✅ ${game.name} — slug: ${game.slug} — ~${content.split(/\s+/).length} words`);
  }
  console.log("\n✅ All starter guides seeded!");
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
