import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock @neondatabase/serverless so the route can be imported without a real DB
// ---------------------------------------------------------------------------
vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => {
    // Return a tagged-template function that returns an empty array by default.
    // Individual tests override this with vi.mocked().
    const fn = async () => [];
    // Make it callable as a tagged template literal: fn`SELECT ...`
    const proxy = new Proxy(fn, {
      apply: (_t, _this, args) => {
        if (Array.isArray(args[0])) return Promise.resolve([]);
        return Promise.resolve([]);
      },
    });
    return proxy;
  }),
}));

// ---------------------------------------------------------------------------
// Mock posts lib
// ---------------------------------------------------------------------------
vi.mock("@/lib/posts", () => ({
  getPostsByCardTag: vi.fn(async () => []),
}));

import { GET } from "@/app/api/price-tracker/route";
import { NextRequest } from "next/server";
import { getPostsByCardTag } from "@/lib/posts";

function makeRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/price-tracker");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

describe("GET /api/price-tracker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = "postgres://mock";
  });

  it("returns 400 when cardName is missing", async () => {
    const req = makeRequest({});
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/cardName/i);
  });

  it("returns 400 when cardName is blank whitespace", async () => {
    const req = makeRequest({ cardName: "   " });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 with correct shape when no rows exist in DB", async () => {
    const req = makeRequest({ cardName: "Charizard ex" });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      cardName: "Charizard ex",
      history: [],
      mentionedIn: [],
      latestPriceCents: null,
      dayChangePct: null,
    });
  });

  it("passes the cardName through to getPostsByCardTag", async () => {
    const req = makeRequest({ cardName: "Pikachu" });
    await GET(req);
    expect(getPostsByCardTag).toHaveBeenCalledWith("Pikachu");
  });

  it("includes game: null when no game param provided", async () => {
    const req = makeRequest({ cardName: "Pikachu" });
    const res = await GET(req);
    const body = await res.json();
    expect(body.game).toBeNull();
  });

  it("includes game value when game param provided", async () => {
    const req = makeRequest({ cardName: "Pikachu", game: "pokemon" });
    const res = await GET(req);
    const body = await res.json();
    expect(body.game).toBe("pokemon");
  });

  it("returns mentionedIn articles from getPostsByCardTag", async () => {
    vi.mocked(getPostsByCardTag).mockResolvedValueOnce([
      {
        slug: "charizard-article",
        title: "Charizard Spike Analysis",
        date: "2026-03-01",
        excerpt: "Why Charizard spiked this week.",
        coverImage: "/images/charizard.jpg",
        category: "pokemon",
        tags: [],
        cardTags: ["Charizard ex"],
        featured: false,
        pinned: false,
        paywalled: false,
        author: "Javier",
        readingTime: "3 min read",
      },
    ]);
    const req = makeRequest({ cardName: "Charizard ex" });
    const res = await GET(req);
    const body = await res.json();
    expect(body.mentionedIn).toHaveLength(1);
    expect(body.mentionedIn[0].slug).toBe("charizard-article");
    expect(body.mentionedIn[0].title).toBe("Charizard Spike Analysis");
  });
});
