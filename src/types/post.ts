export type PostFrontmatter = {
  title: string;
  date: string;
  excerpt: string;
  author: string;
  category: string;
  tags: string[];
  featured?: boolean;
  coverImage?: string;
};

export type Post = PostFrontmatter & {
  slug: string;
  content: string;
  readingTime: string;
};

export type PostMeta = Omit<Post, "content">;
