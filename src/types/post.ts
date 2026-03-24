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
