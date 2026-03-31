/**
 * src/lib/reprint-risk.ts
 *
 * A curated map of card names (lowercase) that carry reprint risk —
 * i.e. they have been officially reprinted at least once, or are widely
 * expected to be reprinted based on publisher statements.
 *
 * Format: cardNameLower → { risk: "confirmed" | "likely" | "possible", notes }
 *
 * "confirmed" — already reprinted in a different product/set
 * "likely"    — publisher has hinted at or historically reprints this card type
 * "possible"  — community speculation; no official statement
 *
 * Add entries here as new reprints are announced.
 */

export type ReprintRiskLevel = "confirmed" | "likely" | "possible";

export interface ReprintRiskEntry {
  risk: ReprintRiskLevel;
  /** Short human-readable note shown in the badge tooltip */
  notes: string;
  game: string;
}

export const REPRINT_RISK: Record<string, ReprintRiskEntry> = {
  // ── Flesh and Blood ──────────────────────────────────────────────────────

  // Legendary cards reprinted in Classic Battles
  "ira, wielder of iron": {
    risk: "confirmed",
    notes: "Reprinted in Classic Battles: Rhinar vs Lexi",
    game: "flesh-and-blood",
  },
  "rhinar, reckless rampage": {
    risk: "confirmed",
    notes: "Reprinted in Classic Battles: Rhinar vs Lexi",
    game: "flesh-and-blood",
  },
  "lexi, livewire": {
    risk: "confirmed",
    notes: "Reprinted in Classic Battles: Rhinar vs Lexi",
    game: "flesh-and-blood",
  },
  "dorinthea ironsong": {
    risk: "confirmed",
    notes: "Reprinted in Classic Battles: Dorinthea vs Rhinar",
    game: "flesh-and-blood",
  },
  "katsu, the wanderer": {
    risk: "confirmed",
    notes: "Reprinted in Classic Battles",
    game: "flesh-and-blood",
  },
  "dawnblade": {
    risk: "confirmed",
    notes: "Reprinted across multiple sets and blitz decks",
    game: "flesh-and-blood",
  },
  "ancestral empowerment": {
    risk: "confirmed",
    notes: "Reprinted in History Pack 1",
    game: "flesh-and-blood",
  },
  "eye of ophidia": {
    risk: "confirmed",
    notes: "Reprinted in History Pack 1",
    game: "flesh-and-blood",
  },
  "beacon of victory": {
    risk: "confirmed",
    notes: "Reprinted in History Pack 1",
    game: "flesh-and-blood",
  },
  "winter's wail": {
    risk: "likely",
    notes: "High-demand weapon; LSS has reprinted similar equipment",
    game: "flesh-and-blood",
  },
  "pummel": {
    risk: "likely",
    notes: "Staple action; frequently included in preconstructed products",
    game: "flesh-and-blood",
  },
  "enlightened strike": {
    risk: "likely",
    notes: "Core ninja staple; appears in starter decks",
    game: "flesh-and-blood",
  },
  "sink below": {
    risk: "likely",
    notes: "Generic blue staple; candidates for future History Pack",
    game: "flesh-and-blood",
  },
  "remembrance": {
    risk: "possible",
    notes: "High-value card; reprint possible in future blitz decks",
    game: "flesh-and-blood",
  },

  // ── Pokémon ──────────────────────────────────────────────────────────────

  "charizard": {
    risk: "confirmed",
    notes: "Most reprinted Pokémon card in history; appears in nearly every major set",
    game: "pokemon",
  },
  "pikachu": {
    risk: "confirmed",
    notes: "Mascot card — reprinted continuously",
    game: "pokemon",
  },
  "mewtwo": {
    risk: "confirmed",
    notes: "Reprinted in multiple anniversary sets",
    game: "pokemon",
  },
  "gardevoir": {
    risk: "confirmed",
    notes: "Popular card reprinted across multiple generations",
    game: "pokemon",
  },
  "lugia": {
    risk: "likely",
    notes: "Highly popular; frequently included in special collections",
    game: "pokemon",
  },

  // ── Magic: The Gathering ─────────────────────────────────────────────────

  "lightning bolt": {
    risk: "confirmed",
    notes: "One of the most reprinted cards in MTG history",
    game: "magic",
  },
  "sol ring": {
    risk: "confirmed",
    notes: "Reprinted in every Commander precon since 2011",
    game: "magic",
  },
  "counterspell": {
    risk: "confirmed",
    notes: "Repeatedly reprinted; most recent in Modern Horizons 2",
    game: "magic",
  },
  "path to exile": {
    risk: "confirmed",
    notes: "Reprinted 20+ times across sets",
    game: "magic",
  },
  "swords to plowshares": {
    risk: "confirmed",
    notes: "Classic white removal; reprinted frequently",
    game: "magic",
  },
  "dark ritual": {
    risk: "confirmed",
    notes: "Classic black staple; reprinted many times",
    game: "magic",
  },
  "birds of paradise": {
    risk: "confirmed",
    notes: "Reprinted in nearly every core set",
    game: "magic",
  },
};

/**
 * Look up reprint risk for a card by name (case-insensitive).
 * Returns null if no risk entry exists.
 */
export function getReprintRisk(cardName: string): ReprintRiskEntry | null {
  return REPRINT_RISK[cardName.trim().toLowerCase()] ?? null;
}

/** Visual style for each risk level */
export const REPRINT_RISK_STYLE: Record<ReprintRiskLevel, string> = {
  confirmed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-300 dark:border-red-700",
  likely:    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300 dark:border-amber-700",
  possible:  "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700",
};

export const REPRINT_RISK_LABEL: Record<ReprintRiskLevel, string> = {
  confirmed: "Reprinted",
  likely:    "Reprint Likely",
  possible:  "Reprint Risk",
};
