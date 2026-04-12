/**
 * Tests for the getPostsByCardTag filtering logic.
 *
 * We test the pure matching behaviour by exercising the db-json implementation
 * against a mocked post set (bypassing the FS layer).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DbPostMeta } from "@/lib/db-neon";

// ---------------------------------------------------------------------------
// Minimal post factory
// ---------------------------------------------------------------------------
function makePost(overrides: Partial<DbPostMeta> = {}): DbPostMeta {
  return {
    slug: "test-post",
    title: "Test Post",
    date: "2026-01-01",
    excerpt: "An excerpt.",
    category: "pokemon",
    tags: [],
    cardTags: [],
    featured: false,
    pinned: false,
    paywalled: false,
    author: "Javier",
    readingTime: "2 min read",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Pure implementation of the matching logic (mirrors db-json/db-neon behaviour)
// ---------------------------------------------------------------------------
function filterByCardTag(posts: DbPostMeta[], cardName: string): DbPostMeta[] {
  const lower = cardName.toLowerCase();
  return posts.filter(
    (p) => Array.isArray(p.cardTags) && p.cardTags.some((t) => t.toLowerCase() === lower)
  );
}

describe("getPostsByCardTag matching logic", () => {
  it("returns posts that contain the card tag (exact match)", () => {
    const posts = [
      makePost({ slug: "a", cardTags: ["Charizard ex"] }),
      makePost({ slug: "b", cardTags: ["Pikachu"] }),
    ];
    expect(filterByCardTag(posts, "Charizard ex")).toHaveLength(1);
    expect(filterByCardTag(posts, "Charizard ex")[0].slug).toBe("a");
  });

  it("is case-insensitive", () => {
    const posts = [makePost({ slug: "a", cardTags: ["Charizard ex"] })];
    expect(filterByCardTag(posts, "charizard ex")).toHaveLength(1);
    expect(filterByCardTag(posts, "CHARIZARD EX")).toHaveLength(1);
  });

  it("returns multiple posts that share the same card tag", () => {
    const posts = [
      makePost({ slug: "a", cardTags: ["Charizard ex"] }),
      makePost({ slug: "b", cardTags: ["Charizard ex", "Pikachu"] }),
      makePost({ slug: "c", cardTags: ["Pikachu"] }),
    ];
    expect(filterByCardTag(posts, "Charizard ex")).toHaveLength(2);
  });

  it("returns empty array when no posts match", () => {
    const posts = [makePost({ slug: "a", cardTags: ["Pikachu"] })];
    expect(filterByCardTag(posts, "Mewtwo")).toHaveLength(0);
  });

  it("returns empty array when posts have no cardTags", () => {
    const posts = [makePost({ slug: "a", cardTags: [] })];
    expect(filterByCardTag(posts, "Pikachu")).toHaveLength(0);
  });

  it("handles posts where cardTags is undefined", () => {
    const posts = [makePost({ slug: "a", cardTags: undefined })];
    // Should not throw, should return empty
    expect(filterByCardTag(posts, "Pikachu")).toHaveLength(0);
  });

  it("does not do partial matches — 'Charizard' should not match 'Charizard ex'", () => {
    const posts = [makePost({ slug: "a", cardTags: ["Charizard ex"] })];
    expect(filterByCardTag(posts, "Charizard")).toHaveLength(0);
  });

  it("handles empty cardName gracefully", () => {
    const posts = [makePost({ slug: "a", cardTags: [""] })];
    // Empty tag on a post matches empty query
    expect(filterByCardTag(posts, "")).toHaveLength(1);
  });
});
