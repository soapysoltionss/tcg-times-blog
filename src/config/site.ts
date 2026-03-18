export const siteConfig = {
  name: "TCG Times",
  tagline: "Theory, Strategy & Stories from the Card Table",
  description:
    "In-depth card theories, strategic breakdowns, and community articles covering Grand Archive, Flesh and Blood, One Piece TCG, and more.",
  url: "https://tcgtimes.blog",
  ogImage: "/og-default.jpg",
  author: "TCG Times",
  twitter: "@tcgtimes",
  links: {
    twitter: "https://twitter.com/tcgtimes",
  },
};

export type GameCategory = {
  slug: string;
  name: string;
  shortName: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  badgeColor: string;
  emoji: string;
};

export const gameCategories: GameCategory[] = [
  {
    slug: "grand-archive",
    name: "Grand Archive",
    shortName: "GA",
    description:
      "Theory crafting, deck analysis, and card evaluations for Grand Archive TCG — the anime-inspired collector's dream.",
    color: "text-violet-700 dark:text-violet-400",
    bgColor: "bg-violet-50 dark:bg-violet-950",
    borderColor: "border-violet-200 dark:border-violet-800",
    badgeColor:
      "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
    emoji: "⚔️",
  },
  {
    slug: "flesh-and-blood",
    name: "Flesh and Blood",
    shortName: "FaB",
    description:
      "Deep dives into hero matchups, equipment choices, and the evolving meta of Flesh and Blood.",
    color: "text-red-700 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950",
    borderColor: "border-red-200 dark:border-red-800",
    badgeColor: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    emoji: "🩸",
  },
  {
    slug: "one-piece-tcg",
    name: "One Piece TCG",
    shortName: "OP",
    description:
      "Crew builds, leader analysis, and meta breakdowns for the One Piece Card Game — set sail for victory.",
    color: "text-amber-700 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950",
    borderColor: "border-amber-200 dark:border-amber-800",
    badgeColor:
      "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    emoji: "🏴‍☠️",
  },
  {
    slug: "general",
    name: "General TCG",
    shortName: "TCG",
    description:
      "Cross-game theory, industry news, and discussions that span the entire trading card game universe.",
    color: "text-teal-700 dark:text-teal-400",
    bgColor: "bg-teal-50 dark:bg-teal-950",
    borderColor: "border-teal-200 dark:border-teal-800",
    badgeColor:
      "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
    emoji: "🃏",
  },
];

export function getCategoryBySlug(slug: string): GameCategory | undefined {
  return gameCategories.find((c) => c.slug === slug);
}
