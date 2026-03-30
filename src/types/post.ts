export type PostFrontmatter = {
  title: string;
  date: string;
  excerpt: string;
  author: string;
  /** Display name of the author (same as author, kept for clarity) */
  authorUsername?: string;
  /** DB user id of the author (set on community/professional posts) */
  authorId?: string;
  /**
   * Who wrote this article.
   *  professional — written by a user with role=professional
   *  community    — written by a user with role=community
   * Omit (or undefined) for legacy/editorial posts with no DB author.
   */
  articleType?: "professional" | "community";
  category: string;
  tags: string[];
  featured?: boolean;
  /** Pinned posts appear at the top of category and blog listing pages as "Start Here" articles */
  pinned?: boolean;
  paywalled?: boolean;
  coverImage?: string;
};

export type PostComment = {
  id: string;
  slug: string;
  authorId: string;
  authorUsername: string;
  authorAvatarUrl?: string;
  body: string;
  createdAt: string;
  /** True once visible to everyone */
  approved: boolean;
  /** ISO string when the comment was/will be approved */
  approvedAt?: string;
};

export type Post = PostFrontmatter & {
  slug: string;
  content: string;
  freeContent?: string;
  readingTime: string;
};

export type PostMeta = Omit<Post, "content" | "freeContent">;

// ---------------------------------------------------------------------------
// Marketplace
// ---------------------------------------------------------------------------

export type ListingCondition =
  | "Near Mint"
  | "Lightly Played"
  | "Moderately Played"
  | "Heavily Played"
  | "Damaged";

/**
 * Whether the listing is a single card or a sealed product
 * (booster box, booster pack, starter deck, etc.).
 * Defaults to "card" for all legacy listings.
 */
export type ListingType = "card" | "sealed";

/**
 * A single card listing on the marketplace.
 * marketplace is derived from the seller's role:
 *   role=store → "store"
 *   anything else → "community"
 */
export type Listing = {
  id: string;
  sellerId: string;
  sellerUsername: string;
  sellerAvatarUrl?: string;
  /** True if the seller has 10+ completed sales on TCG Times */
  sellerIsTrusted?: boolean;
  /** True if the seller has been manually verified by an admin */
  sellerIsVerified?: boolean;
  /** Total number of listings this seller has marked as sold */
  sellerTotalSales?: number;
  /** "store" if seller has role=store, otherwise "community" */
  marketplace: "store" | "community";
  /**
   * Whether this is a single card or a sealed product.
   * Defaults to "card" for legacy listings that predate this field.
   */
  listingType?: ListingType;
  cardName: string;
  setName: string;
  game: string;
  condition: ListingCondition;
  /** Optional freeform note about specific flaws (e.g. "minor edge wear top-right corner") */
  conditionNotes?: string;
  /** Price in USD cents (e.g. 499 = $4.99) */
  priceCents: number;
  quantity: number;
  imageUrl?: string;
  description?: string;
  createdAt: string;
  sold: boolean;
  /**
   * ISO 3166-1 alpha-2 country code of the seller's registered region.
   * e.g. "SG", "US", "JP", "AU". Populated from seller's profile at listing creation.
   * Used to surface cross-region market insights in the AI coach.
   */
  sellerRegion?: string;
};

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------

export type Message = {
  id: string;
  listingId: string;
  fromUserId: string;
  fromUsername: string;
  fromAvatarUrl?: string;
  toUserId: string;
  toUsername: string;
  body: string;
  createdAt: string;
  readAt?: string | null;
};

/** A message thread grouped by listing, returned for the inbox view */
export type MessageThread = {
  listingId: string;
  cardName: string;
  imageUrl?: string;
  otherUserId: string;
  otherUsername: string;
  otherAvatarUrl?: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
};

// ---------------------------------------------------------------------------
// Disputes
// ---------------------------------------------------------------------------

export type DisputeStatus = "open" | "under_review" | "resolved";

export type Dispute = {
  id: string;
  listingId: string;
  buyerId: string;
  buyerUsername: string;
  sellerId: string;
  sellerUsername: string;
  reason: string;
  status: DisputeStatus;
  resolution?: string | null;
  createdAt: string;
  updatedAt: string;
};

