/**
 * migrate-posts-to-db.mjs
 *
 * Reads every MDX/MD file from content/posts/ and upserts it into the
 * Neon Postgres `posts` table.
 *
 * Usage:
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/migrate-posts-to-db.mjs
 *
 * Requires DATABASE_URL in the environment (or a .env.local file).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// Load .env.local manually (no dotenv dep needed in Node 20+)
// ---------------------------------------------------------------------------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const envPath = path.join(repoRoot, ".env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌  DATABASE_URL is not set. Add it to .env.local or export it.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Dynamic imports (ESM-only packages)
// ---------------------------------------------------------------------------
const { neon } = await import("@neondatabase/serverless");
const { default: matter } = await import("gray-matter");

const sql = neon(DATABASE_URL);

// ---------------------------------------------------------------------------
// Ensure the posts table exists
// ---------------------------------------------------------------------------
await sql`
  CREATE TABLE IF NOT EXISTS posts (
    slug        TEXT        PRIMARY KEY,
    frontmatter JSONB       NOT NULL,
    content     TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS idx_posts_category ON posts ((frontmatter->>'category'))`;
await sql`CREATE INDEX IF NOT EXISTS idx_posts_date     ON posts ((frontmatter->>'date') DESC)`;
await sql`
  CREATE INDEX IF NOT EXISTS idx_posts_featured ON posts ((frontmatter->>'featured'))
  WHERE frontmatter->>'featured' = 'true'
`;

// ---------------------------------------------------------------------------
// Read and upsert all posts
// ---------------------------------------------------------------------------
const postsDir = path.join(repoRoot, "content", "posts");
if (!fs.existsSync(postsDir)) {
  console.error(`❌  content/posts/ directory not found at ${postsDir}`);
  process.exit(1);
}

const files = fs.readdirSync(postsDir).filter((f) => f.endsWith(".mdx") || f.endsWith(".md"));

if (files.length === 0) {
  console.log("⚠️  No MDX/MD files found in content/posts/. Nothing to migrate.");
  process.exit(0);
}

let succeeded = 0;
let failed = 0;

for (const file of files) {
  const slug = file.replace(/\.mdx?$/, "");
  const fullPath = path.join(postsDir, file);

  try {
    const raw = fs.readFileSync(fullPath, "utf-8");
    const { data: frontmatter, content } = matter(raw);

    // Ensure required fields have sensible defaults
    if (!frontmatter.title)    frontmatter.title    = slug;
    if (!frontmatter.date)     frontmatter.date     = new Date().toISOString().slice(0, 10);
    if (!frontmatter.excerpt)  frontmatter.excerpt  = "";
    if (!frontmatter.author)   frontmatter.author   = "staff";
    if (!frontmatter.category) frontmatter.category = "general";
    if (!frontmatter.tags)     frontmatter.tags     = [];

    const fm = JSON.stringify(frontmatter);

    await sql`
      INSERT INTO posts (slug, frontmatter, content, updated_at)
      VALUES (${slug}, ${fm}::jsonb, ${content}, now())
      ON CONFLICT (slug) DO UPDATE
        SET frontmatter = EXCLUDED.frontmatter,
            content     = EXCLUDED.content,
            updated_at  = now()
    `;

    console.log(`  ✅  ${slug}`);
    succeeded++;
  } catch (err) {
    console.error(`  ❌  ${slug}: ${err.message}`);
    failed++;
  }
}

console.log(`\nMigration complete: ${succeeded} succeeded, ${failed} failed.`);
if (failed > 0) process.exit(1);
