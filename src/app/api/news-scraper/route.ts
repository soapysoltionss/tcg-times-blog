import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { upsertNewsItems } from "@/lib/db";
import type { NewsGame, NewsTag } from "@/types/post";

/**
 * GET /api/news-scraper
 * Vercel Cron endpoint — runs daily at 06:00 UTC.
 * Hits the Reddit JSON API for TCG-related subreddits and upserts
 * top posts into the news_items table.
 *
 * Protected by CRON_SECRET header (set in Vercel environment variables).
 */

interface RedditPost {
  data: {
    id: string;
    title: string;
    url: string;
    permalink: string;
    selftext?: string;
    created_utc: number;
    score: number;
    link_flair_text?: string | null;
  };
}

interface RedditResponse {
  data: {
    children: RedditPost[];
  };
}

const SUBREDDITS: Array<{
  subreddit: string;
  game: NewsGame;
  keywords: string[];
}> = [
  {
    subreddit: "PokemonTCG",
    game: "pokemon",
    keywords: ["ban", "banned", "rotation", "rotated", "new set", "set reveal", "regulation", "tournament", "top 8", "winner", "limitless"],
  },
  {
    subreddit: "PokemonTCGDeals",
    game: "pokemon",
    keywords: ["ban", "rotation", "new set", "reveal", "reprint"],
  },
  {
    subreddit: "FleshandBlood",
    game: "fab",
    keywords: ["ban", "banned", "suspended", "watch list", "restricted", "rotation", "new set", "calling", "nationals", "top 8", "banned and suspended"],
  },
  {
    subreddit: "GrandArchive",
    game: "grand-archive",
    keywords: ["ban", "banned", "errata", "new set", "set reveal", "rotation", "tournament", "announcement"],
  },
  {
    subreddit: "OnePieceTCG",
    game: "one-piece",
    keywords: ["ban", "banned", "limited", "new set", "set reveal", "tournament", "deck", "forbidden"],
  },
];

/**
 * Classify a post's tags from its title + flair.
 */
function classifyTags(title: string, flair: string | null | undefined): NewsTag[] {
  const text = (title + " " + (flair ?? "")).toLowerCase();
  const tags: NewsTag[] = [];

  if (/ban|suspend|watch.?list|restrict|forbidden|limit/i.test(text)) tags.push("ban");
  if (/rotat|format.?change|standard.?legal|set.?retire/i.test(text)) tags.push("rotation");
  if (/tournament|calling|nationals|regionals|top.?8|winner|champion|deck.?list|results/i.test(text)) tags.push("tournament");
  if (/new.?set|set.?reveal|spoiler|preview|release|expansion/i.test(text)) tags.push("new-set");

  return tags;
}

/** Fetch top posts from a subreddit (last 24h hot posts). */
async function fetchSubreddit(subreddit: string): Promise<RedditPost[]> {
  const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=25&t=day`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "TCGTimes/1.0 (https://tcgtimes.blog; automated news aggregator)",
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    console.error(`[news-scraper] Reddit fetch failed for r/${subreddit}: ${res.status}`);
    return [];
  }
  const json = (await res.json()) as RedditResponse;
  return json.data?.children ?? [];
}

export async function GET(req: NextRequest) {
  // Validate cron secret
  const secret = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (process.env.CRON_SECRET && secret !== expected) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let totalInserted = 0;
  const errors: string[] = [];

  for (const config of SUBREDDITS) {
    try {
      const posts = await fetchSubreddit(config.subreddit);

      // Filter: must contain at least one keyword OR have relevant flair
      const relevant = posts.filter((p) => {
        const text = (p.data.title + " " + (p.data.link_flair_text ?? "")).toLowerCase();
        return config.keywords.some((kw) => text.includes(kw));
      });

      const items = relevant.map((p) => {
        const tags = classifyTags(p.data.title, p.data.link_flair_text);
        // If no tags but it's in our list, tag as general (won't show in filtered views)
        const finalTags: NewsTag[] = tags.length > 0 ? tags : [];

        // Prefer the external URL; fall back to Reddit thread
        const isRedditLink = p.data.url.includes("reddit.com") || p.data.url.startsWith("/r/");
        const url = isRedditLink
          ? `https://reddit.com${p.data.permalink}`
          : p.data.url;

        // Build a short summary from selftext (first 200 chars)
        const summary = p.data.selftext
          ? p.data.selftext.slice(0, 200).trim() + (p.data.selftext.length > 200 ? "…" : "")
          : null;

        return {
          id: nanoid(),
          game: config.game,
          source: "reddit" as const,
          subreddit: config.subreddit,
          title: p.data.title,
          url,
          summary: summary ?? undefined,
          publishedAt: new Date(p.data.created_utc * 1000).toISOString(),
          tags: finalTags,
        };
      });

      if (items.length > 0) {
        const inserted = await upsertNewsItems(items);
        totalInserted += inserted;
      }
    } catch (err) {
      const msg = `r/${config.subreddit}: ${err instanceof Error ? err.message : String(err)}`;
      errors.push(msg);
      console.error(`[news-scraper] ${msg}`);
    }
  }

  return NextResponse.json({
    ok: true,
    totalInserted,
    errors: errors.length > 0 ? errors : undefined,
  });
}
