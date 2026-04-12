import { describe, it, expect } from "vitest";
import { getReprintRisk, REPRINT_RISK_LABEL, REPRINT_RISK_STYLE } from "@/lib/reprint-risk";

describe("getReprintRisk", () => {
  it("returns null for an unknown card", () => {
    expect(getReprintRisk("totally made up card name xyz")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(getReprintRisk("")).toBeNull();
  });

  it("is case-insensitive — lowercase input", () => {
    const result = getReprintRisk("charizard");
    expect(result).not.toBeNull();
    expect(result?.risk).toBe("confirmed");
  });

  it("is case-insensitive — mixed case input", () => {
    const result = getReprintRisk("CHarizaRD");
    expect(result).not.toBeNull();
    expect(result?.risk).toBe("confirmed");
  });

  it("trims leading/trailing whitespace", () => {
    const result = getReprintRisk("  charizard  ");
    expect(result).not.toBeNull();
  });

  it("returns 'confirmed' risk for Lightning Bolt (MTG)", () => {
    const result = getReprintRisk("lightning bolt");
    expect(result?.risk).toBe("confirmed");
    expect(result?.game).toBe("magic");
  });

  it("returns 'likely' risk for Winter's Wail (FaB)", () => {
    const result = getReprintRisk("winter's wail");
    expect(result?.risk).toBe("likely");
    expect(result?.game).toBe("flesh-and-blood");
  });

  it("returns notes string that is non-empty", () => {
    const result = getReprintRisk("sol ring");
    expect(result?.notes.length).toBeGreaterThan(0);
  });
});

describe("REPRINT_RISK_LABEL", () => {
  it("has entries for all three risk levels", () => {
    expect(REPRINT_RISK_LABEL.confirmed).toBeDefined();
    expect(REPRINT_RISK_LABEL.likely).toBeDefined();
    expect(REPRINT_RISK_LABEL.possible).toBeDefined();
  });
});

describe("REPRINT_RISK_STYLE", () => {
  it("has style strings for all three risk levels", () => {
    expect(REPRINT_RISK_STYLE.confirmed.length).toBeGreaterThan(0);
    expect(REPRINT_RISK_STYLE.likely.length).toBeGreaterThan(0);
    expect(REPRINT_RISK_STYLE.possible.length).toBeGreaterThan(0);
  });
});
