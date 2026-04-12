import { describe, it, expect } from "vitest";
import { xpToLevel, TASK_CATALOGUE } from "@/lib/xp";

describe("xpToLevel", () => {
  it("returns level 1 (Novice Duelist) at 0 XP", () => {
    const result = xpToLevel(0);
    expect(result.level).toBe(1);
    expect(result.title).toBe("Novice Duelist");
  });

  it("returns level 1 just below level 2 threshold (99 XP)", () => {
    const result = xpToLevel(99);
    expect(result.level).toBe(1);
  });

  it("returns level 2 (Apprentice) at exactly 100 XP", () => {
    const result = xpToLevel(100);
    expect(result.level).toBe(2);
    expect(result.title).toBe("Apprentice");
  });

  it("returns level 4 (Strategist) at 600 XP", () => {
    const result = xpToLevel(600);
    expect(result.level).toBe(4);
    expect(result.title).toBe("Strategist");
  });

  it("returns level 8 (Master) at exactly 3000 XP", () => {
    const result = xpToLevel(3000);
    expect(result.level).toBe(8);
    expect(result.title).toBe("Master");
  });

  it("returns level 8 (Master) for XP well above max threshold", () => {
    const result = xpToLevel(99999);
    expect(result.level).toBe(8);
    expect(result.title).toBe("Master");
  });

  it("returns level 8 (Master) at 2999 XP (just below max threshold)", () => {
    const result = xpToLevel(2999);
    expect(result.level).toBe(7);
    expect(result.title).toBe("Grand Champion");
  });

  it("currentLevelXp is always <= xp passed in", () => {
    [0, 50, 100, 300, 600, 1000, 1500, 2200, 3000, 5000].forEach((xp) => {
      const result = xpToLevel(xp);
      expect(result.currentLevelXp).toBeLessThanOrEqual(xp);
    });
  });

  it("nextLevelXp is > currentLevelXp for all levels below max", () => {
    const levels = [0, 100, 300, 600, 1000, 1500, 2200];
    levels.forEach((xp) => {
      const result = xpToLevel(xp);
      expect(result.nextLevelXp).toBeGreaterThan(result.currentLevelXp);
    });
  });
});

describe("TASK_CATALOGUE", () => {
  it("has the 'register' task with 50 XP", () => {
    const task = TASK_CATALOGUE.find((t) => t.id === "register");
    expect(task).toBeDefined();
    expect(task?.xpReward).toBe(50);
  });

  it("has no duplicate task ids", () => {
    const ids = TASK_CATALOGUE.map((t) => t.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("every task has a positive XP reward", () => {
    TASK_CATALOGUE.forEach((t) => {
      expect(t.xpReward).toBeGreaterThan(0);
    });
  });

  it("every task has a non-empty label and description", () => {
    TASK_CATALOGUE.forEach((t) => {
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(0);
    });
  });
});
