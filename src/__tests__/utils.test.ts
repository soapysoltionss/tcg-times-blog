import { describe, it, expect } from "vitest";
import { formatDate, slugify } from "@/lib/utils";

describe("formatDate", () => {
  it("formats a valid ISO date string", () => {
    expect(formatDate("2024-03-15")).toBe("March 15, 2024");
  });

  it("formats January correctly (month 1)", () => {
    expect(formatDate("2025-01-01")).toBe("January 1, 2025");
  });

  it("formats December correctly (month 12)", () => {
    expect(formatDate("2023-12-31")).toBe("December 31, 2023");
  });

  it("returns the raw string on invalid input rather than throwing", () => {
    const result = formatDate("not-a-date");
    expect(typeof result).toBe("string");
    // Should not throw; returns the raw string
    expect(result).toBe("not-a-date");
  });

  it("returns the raw string for an empty string", () => {
    const result = formatDate("");
    expect(typeof result).toBe("string");
  });
});

describe("slugify", () => {
  it("converts a simple string to lowercase with hyphens", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("strips leading and trailing hyphens", () => {
    expect(slugify("  TCG Times Blog  ")).toBe("tcg-times-blog");
  });

  it("collapses multiple non-alphanumeric chars to a single hyphen", () => {
    expect(slugify("Flesh & Blood TCG!")).toBe("flesh-blood-tcg");
  });

  it("returns an empty string for an empty input", () => {
    expect(slugify("")).toBe("");
  });

  it("handles numbers in the string", () => {
    expect(slugify("Set 2024 News")).toBe("set-2024-news");
  });

  it("handles already-slugified input unchanged", () => {
    expect(slugify("already-slugified")).toBe("already-slugified");
  });

  it("handles strings with only special characters", () => {
    // Should produce empty string after stripping
    expect(slugify("!@#$%")).toBe("");
  });
});
