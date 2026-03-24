/**
 * Lightweight server-side profanity filter — no external dependency.
 *
 * Strategy: maintain a small list of the most common slurs / strong profanity.
 * Each word is tested case-insensitively and with common leet-speak substitutions
 * normalised first (e → 3, a → @, i → 1, o → 0, s → $).
 *
 * Returns:
 *   { clean: string, flagged: boolean }
 *
 * `clean`   — the original text with matched words replaced by asterisks
 * `flagged` — true if at least one match was found
 */

// ---------------------------------------------------------------------------
// Word list — extend as needed
// ---------------------------------------------------------------------------
const BLOCKED: string[] = [
  "fuck", "fucking", "fucker", "fucks",
  "shit", "shits", "shitting",
  "cunt", "cunts",
  "bitch", "bitches",
  "asshole", "assholes",
  "bastard", "bastards",
  "dick", "dicks",
  "cock", "cocks",
  "pussy", "pussies",
  "nigger", "niggers", "nigga",
  "faggot", "faggots", "fag",
  "retard", "retards",
  "whore", "whores",
  "slut", "sluts",
  "kike", "spic", "chink",
  "tranny", "trannies",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalise leet-speak so "f*ck" and "fvck" still match "fuck". */
function normaliseLeet(text: string): string {
  return text
    .toLowerCase()
    .replace(/3/g, "e")
    .replace(/@/g, "a")
    .replace(/1|!/g, "i")
    .replace(/0/g, "o")
    .replace(/\$/g, "s")
    .replace(/\*/g, "")   // "f*ck" → "fck" — still caught by most patterns
    .replace(/\+/g, "t");
}

/** Build a regex that matches a word with optional repeated chars and separators. */
function wordRegex(word: string): RegExp {
  // Allow any non-alphanumeric char between letters (e.g. "f-u-c-k")
  const pattern = word
    .split("")
    .map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[^a-z0-9]?");
  return new RegExp(`\\b${pattern}\\b`, "gi");
}

const COMPILED = BLOCKED.map((w) => ({
  word: w,
  re: wordRegex(w),
}));

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function filterProfanity(text: string): { clean: string; flagged: boolean } {
  const normalised = normaliseLeet(text);
  let flagged = false;
  let clean = text;

  for (const { word, re } of COMPILED) {
    // Test against the normalised version first
    if (re.test(normalised)) {
      flagged = true;
      // Replace in the *original* text using a position-aware approach:
      // re-build a simple word regex on the original text
      const originalRe = new RegExp(
        word.split("").map((c) => `[${c}${c.toUpperCase()}]`).join("[^a-zA-Z0-9]?"),
        "gi"
      );
      clean = clean.replace(originalRe, (match) => "*".repeat(match.length));
    }
    // Reset lastIndex for global regexes
    re.lastIndex = 0;
  }

  return { clean, flagged };
}
