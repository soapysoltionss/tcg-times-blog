import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Card Condition Guide",
  description:
    "The TCG Times standardised condition grading guide. Know exactly what Near Mint, Lightly Played, Moderately Played, Heavily Played, and Damaged mean before you buy or sell.",
};

// ---------------------------------------------------------------------------
// Condition definitions
// ---------------------------------------------------------------------------

const CONDITIONS = [
  {
    grade: "Near Mint",
    short: "NM",
    colour: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    border: "border-green-300 dark:border-green-700",
    summary: "Essentially perfect. Suitable for tournament play or grading submission without concern.",
    front: [
      "No visible scratches or scuffs on front face",
      "No print lines, ink spots, or factory defects",
      "Corners sharp and undamaged",
      "Edges clean with no nicks or whitening",
      "Surface gloss intact, no clouding",
    ],
    back: [
      "No scratches visible when light hits the back",
      "Corners crisp — no bending or softening",
      "No water marks, stains, or creases",
      "Cardboard feels firm, not bent or warped",
    ],
    note: "A card can be Near Mint and still have minor factory imperfections such as a very slight print line. The key is zero play or handling wear.",
  },
  {
    grade: "Lightly Played",
    short: "LP",
    colour: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    border: "border-blue-300 dark:border-blue-700",
    summary: "Minimal wear from light handling. Playable without sleeves but most players will sleeve these.",
    front: [
      "Very light surface scratches visible only at certain angles",
      "Corners may show barely perceptible softening",
      "One or two very minor edge nicks (not whitening)",
      "No creases or bends on the face",
    ],
    back: [
      "Slight scratching on the back surface",
      "Corners very slightly rounded or soft",
      "No creases, stains, or water damage",
    ],
    note: "This is the most common condition for cards that have been sleeved but opened from packs and shuffled a few times. Often indistinguishable from NM at arm's length.",
  },
  {
    grade: "Moderately Played",
    short: "MP",
    colour: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
    border: "border-yellow-300 dark:border-yellow-700",
    summary: "Visible wear but structurally sound. Always sleeve before play. Fine for casual games.",
    front: [
      "Noticeable scratches or scuffs on the face",
      "Mild edge whitening on one or two corners",
      "No deep creases or bends that affect the face image",
      "Surface may have lost some gloss in places",
    ],
    back: [
      "Obvious scratching on back",
      "Corner whitening or rounding on one to three corners",
      "No deep creases, holes, or water damage",
    ],
    note: "Moderately Played cards are still completely playable in sleeves. The condition is usually obvious when held, but the card is not damaged or marked.",
  },
  {
    grade: "Heavily Played",
    short: "HP",
    colour: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    border: "border-orange-300 dark:border-orange-700",
    summary: "Significant wear. Structurally intact but noticeably rough. Must be sleeved; may be rejected at some tournaments.",
    front: [
      "Heavy scratching or scuffing across the face",
      "Obvious corner whitening on multiple corners",
      "Possible light crease or bend not breaking the card surface",
      "Noticeable loss of surface gloss",
    ],
    back: [
      "Heavy scratching, corner whitening on most corners",
      "Possible writing or small sticker residue (disclosed)",
      "Possible light crease — no holes or tears",
    ],
    note: "Always disclose specific flaws in the listing description. Cards with writing, heavy creasing, or sticker residue should be graded HP at minimum and explicitly noted.",
  },
  {
    grade: "Damaged",
    short: "DMG",
    colour: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    border: "border-red-300 dark:border-red-700",
    summary: "Structurally compromised. Holes, tears, deep creases, water damage, or heavy markings.",
    front: [
      "Deep crease or bend that breaks card surface",
      "Holes, tears, or missing pieces",
      "Significant water damage, warping, or staining",
      "Heavy writing or permanent ink marks",
      "Peeling layers",
    ],
    back: [
      "Any of the above on the back",
      "Structural integrity compromised — card may flex abnormally",
    ],
    note: "Damaged cards should not be listed without clear photos and a full description. They are typically collector pieces, extras for proxies, or tokens only.",
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ConditionGuidePage() {
  return (
    <div className="max-w-4xl mx-auto px-6 lg:px-10 py-14">
      {/* Header */}
      <div className="border-b-2 border-[var(--border-strong)] pb-6 mb-10">
        <p className="label-upper text-[var(--text-muted)] mb-2">TCG Times Tools</p>
        <h1
          className="text-5xl md:text-6xl font-black text-[var(--foreground)] leading-none tracking-tight mb-3"
          style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
        >
          Card Condition Guide
        </h1>
        <p className="text-[var(--text-muted)] text-base max-w-2xl">
          A standardised grading system used by all TCG Times marketplace listings.
          Before buying or selling, familiarise yourself with each grade so there are
          no surprises on either side of the transaction.
        </p>
      </div>

      {/* Quick-jump */}
      <div className="flex flex-wrap gap-2 mb-12">
        {CONDITIONS.map((c) => (
          <a
            key={c.short}
            href={`#${c.short}`}
            className={`label-upper text-[11px] px-4 py-2 border rounded-sm transition-colors ${c.colour} ${c.border}`}
          >
            {c.short} — {c.grade}
          </a>
        ))}
      </div>

      {/* Condition cards */}
      <div className="flex flex-col gap-12">
        {CONDITIONS.map((c) => (
          <section key={c.short} id={c.short} className={`border ${c.border} p-6 md:p-8`}>
            {/* Grade header */}
            <div className="flex items-center gap-3 mb-4">
              <span className={`label-upper text-[11px] px-3 py-1.5 rounded-sm font-bold ${c.colour}`}>
                {c.short}
              </span>
              <h2
                className="text-2xl font-black text-[var(--foreground)]"
                style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)" }}
              >
                {c.grade}
              </h2>
            </div>

            <p className="text-[var(--foreground)] mb-6 text-base leading-relaxed">{c.summary}</p>

            <div className="grid md:grid-cols-2 gap-6 mb-5">
              {/* Front */}
              <div>
                <p className="label-upper text-[10px] text-[var(--text-muted)] mb-2">Front / Face</p>
                <ul className="flex flex-col gap-1.5">
                  {c.front.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[var(--foreground)]">
                      <span className="mt-1 shrink-0 w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Back */}
              <div>
                <p className="label-upper text-[10px] text-[var(--text-muted)] mb-2">Back</p>
                <ul className="flex flex-col gap-1.5">
                  {c.back.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[var(--foreground)]">
                      <span className="mt-1 shrink-0 w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Note */}
            <div className="border-t border-[var(--border)] pt-4 mt-4">
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                <span className="label-upper text-[10px] mr-2">Note</span>
                {c.note}
              </p>
            </div>
          </section>
        ))}
      </div>

      {/* Footer CTA */}
      <div className="mt-14 pt-8 border-t-2 border-[var(--border-strong)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="font-bold text-[var(--foreground)]">Ready to buy or sell?</p>
          <p className="text-sm text-[var(--text-muted)]">All listings on TCG Times use these grades.</p>
        </div>
        <Link
          href="/marketplace"
          className="label-upper px-6 py-3 bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 transition-opacity"
        >
          Browse Marketplace →
        </Link>
      </div>
    </div>
  );
}
