export type PostFrontmatter = {
  title: string;
  date: string;
  excerpt: string;
  author: string;
  category: string;
  tags: string[];
  featured?: boolean;
  paywalled?: boolean;
  coverImage?: string;
};

export type Post = PostFrontmatter & {
  slug: string;
  content: string;
  freeContent?: string;
  readingTime: string;
};

export type PostMeta = Omit<Post, "content" | "freeContent">;
