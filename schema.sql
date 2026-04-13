-- TCG Times — Neon Postgres schema
-- Run this once in your Neon project's SQL editor.
--
-- Table design: the full User object is stored as JSONB in the `data` column.
-- The three indexed columns (id, email, username) are extracted for fast
-- lookups. Everything else lives in JSONB so the schema never needs
-- migrations when new User fields are added.

CREATE TABLE IF NOT EXISTS users (
  id       TEXT PRIMARY KEY,
  email    TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  data     JSONB NOT NULL,
  -- ISO 3166-1 alpha-2 primary region, e.g. "SG", "US", "JP"
  -- Extracted from JSONB for fast region-filtered queries.
  -- Stores supports a comma-separated list for multi-region, e.g. "SG,MY"
  region   TEXT
);

-- Speed up lookups that search inside the JSONB oauthAccounts array
-- (used by getUserByProvider)
CREATE INDEX IF NOT EXISTS idx_users_oauth
  ON users USING gin ((data->'oauthAccounts'));

-- ---------------------------------------------------------------------------
-- Launch interest list
-- Stores emails from visitors who want to be notified when the site launches.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS interest (
  email      TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified   BOOLEAN     NOT NULL DEFAULT false
);

-- ---------------------------------------------------------------------------
-- Article comments
-- approved=false means "pending moderation" (professional article comments
-- wait 2 hours before becoming visible). Community article comments are
-- inserted with approved=true immediately.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS comments (
  id           TEXT        PRIMARY KEY,
  slug         TEXT        NOT NULL,
  author_id    TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body         TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved     BOOLEAN     NOT NULL DEFAULT false,
  approved_at  TIMESTAMPTZ,
  article_type TEXT        NOT NULL DEFAULT 'community' -- 'community' | 'professional'
);

CREATE INDEX IF NOT EXISTS idx_comments_slug        ON comments (slug);
CREATE INDEX IF NOT EXISTS idx_comments_pending     ON comments (approved, created_at)
  WHERE approved = false;

-- ---------------------------------------------------------------------------
-- Marketplace listings
-- marketplace column is derived from seller role at insert time:
--   store account → 'store'
--   any other role → 'community'
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS listings (
  id              TEXT        PRIMARY KEY,
  seller_id       TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  marketplace     TEXT        NOT NULL DEFAULT 'community', -- 'store' | 'community'
  listing_type    TEXT        NOT NULL DEFAULT 'card',      -- 'card' | 'sealed'
  card_name       TEXT        NOT NULL,
  set_name        TEXT        NOT NULL,
  game            TEXT        NOT NULL,
  condition       TEXT        NOT NULL,
  condition_notes TEXT,
  price_cents     INTEGER     NOT NULL,
  quantity        INTEGER     NOT NULL DEFAULT 1,
  image_url       TEXT,
  description     TEXT,
  -- ISO 3166-1 alpha-2 region of the seller at time of listing, e.g. "SG"
  -- Populated from seller profile. Used for cross-region AI insights.
  seller_region   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  sold            BOOLEAN     NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_listings_marketplace ON listings (marketplace);
CREATE INDEX IF NOT EXISTS idx_listings_game        ON listings (game);
CREATE INDEX IF NOT EXISTS idx_listings_card        ON listings (lower(card_name));
CREATE INDEX IF NOT EXISTS idx_listings_seller      ON listings (seller_id);

-- Migration: add listing_type column to existing tables (run once on live DB)
-- ALTER TABLE listings ADD COLUMN IF NOT EXISTS listing_type TEXT NOT NULL DEFAULT 'card';

-- ---------------------------------------------------------------------------
-- Blog posts
-- All posts are stored here. Content is raw MDX/Markdown (string).
-- Frontmatter fields are also stored as JSONB for fast filtered queries
-- (category, featured, paywalled, etc.) without parsing the content.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS posts (
  slug        TEXT        PRIMARY KEY,
  frontmatter JSONB       NOT NULL,
  content     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast category / featured / date queries
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts ((frontmatter->>'category'));
CREATE INDEX IF NOT EXISTS idx_posts_date     ON posts ((frontmatter->>'date') DESC);
CREATE INDEX IF NOT EXISTS idx_posts_featured ON posts ((frontmatter->>'featured'))
  WHERE frontmatter->>'featured' = 'true';

-- ---------------------------------------------------------------------------
-- In-site messaging
-- Messages are grouped into threads by listing_id. Either party in the
-- listing (buyer or seller) can send a message. No email addresses exposed.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS messages (
  id           TEXT        PRIMARY KEY,
  listing_id   TEXT        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  from_user_id TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id   TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body         TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_listing    ON messages (listing_id);
CREATE INDEX IF NOT EXISTS idx_messages_to_user    ON messages (to_user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_messages_from_user  ON messages (from_user_id);

-- ---------------------------------------------------------------------------
-- Disputes
-- Buyers can open a dispute on a sold listing within 7 days.
-- Status machine: open → under_review → resolved
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS disputes (
  id           TEXT        PRIMARY KEY,
  listing_id   TEXT        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id     TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id    TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason       TEXT        NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'open', -- 'open' | 'under_review' | 'resolved'
  resolution   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disputes_listing ON disputes (listing_id);
CREATE INDEX IF NOT EXISTS idx_disputes_buyer   ON disputes (buyer_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status  ON disputes (status) WHERE status <> 'resolved';

-- ---------------------------------------------------------------------------
-- TCGPlayer price snapshots
-- One row per (game, card_name, recorded_date). Populated by the card-search
-- routes on first call each day via tcgcsv.com (daily TCGPlayer mirror).
-- Enables % price change by comparing today vs yesterday.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS price_snapshots (
  id            SERIAL      PRIMARY KEY,
  game          TEXT        NOT NULL,
  card_name     TEXT        NOT NULL,
  tcgplayer_id  INTEGER,
  price_cents   INTEGER     NOT NULL,
  recorded_date DATE        NOT NULL DEFAULT CURRENT_DATE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_price_snapshots_unique
  ON price_snapshots (lower(game), lower(card_name), recorded_date);

CREATE INDEX IF NOT EXISTS idx_price_snapshots_lookup
  ON price_snapshots (lower(game), lower(card_name), recorded_date DESC);

-- ---------------------------------------------------------------------------
-- FAI Coach rate limits
-- Tracks per-IP daily message counts for the free tier of the AI coach tool.
-- Rows are keyed by (ip, date) and auto-expire after 2 days via a pg_cron job
-- or simply by ignoring rows older than today in queries.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS fai_coach_rate_limits (
  ip         TEXT        NOT NULL,
  date       DATE        NOT NULL DEFAULT CURRENT_DATE,
  count      INTEGER     NOT NULL DEFAULT 0,
  PRIMARY KEY (ip, date)
);

-- ---------------------------------------------------------------------------
-- Migration helpers (run once if upgrading an existing database)
-- ---------------------------------------------------------------------------

-- Add region column to users if it doesn't exist yet
ALTER TABLE users ADD COLUMN IF NOT EXISTS region TEXT;

-- Add seller_region column to listings if it doesn't exist yet
ALTER TABLE listings ADD COLUMN IF NOT EXISTS seller_region TEXT;

-- Index for region-filtered user queries (e.g. find all SG-based stores)
CREATE INDEX IF NOT EXISTS idx_users_region   ON users (region) WHERE region IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_listings_region ON listings (seller_region) WHERE seller_region IS NOT NULL;

-- Problem 7: local P2P selling — city on users, seller_city + local_pickup on listings
ALTER TABLE users    ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS seller_city  TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS local_pickup BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_listings_local ON listings (local_pickup) WHERE local_pickup = true;

-- ---------------------------------------------------------------------------
-- Problem 1b: Post-sale seller feedback
-- Buyers can leave positive / neutral / negative feedback after a sale.
-- One feedback per (buyer, listing) pair.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS seller_feedback (
  id          TEXT        PRIMARY KEY,
  listing_id  TEXT        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id    TEXT        NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  seller_id   TEXT        NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  rating      TEXT        NOT NULL, -- 'positive' | 'neutral' | 'negative'
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (buyer_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_seller  ON seller_feedback (seller_id);
CREATE INDEX IF NOT EXISTS idx_feedback_listing ON seller_feedback (listing_id);

-- ---------------------------------------------------------------------------
-- Problem 10a: Aggregated news items from Reddit and other sources
-- Populated by the /api/news-scraper cron job (daily).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS news_items (
  id           TEXT        PRIMARY KEY,
  game         TEXT        NOT NULL, -- 'fab' | 'grand-archive' | 'one-piece' | 'pokemon' | 'general'
  source       TEXT        NOT NULL, -- 'reddit' | 'official' | 'fractalofin' | 'discord'
  subreddit    TEXT,                 -- e.g. 'FleshandBlood' (Reddit posts only)
  title        TEXT        NOT NULL,
  url          TEXT        NOT NULL,
  summary      TEXT,
  published_at TIMESTAMPTZ NOT NULL,
  tags         TEXT[]      NOT NULL DEFAULT '{}', -- ['ban','rotation','tournament','new-set']
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (url)
);

CREATE INDEX IF NOT EXISTS idx_news_game       ON news_items (game, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_tags       ON news_items USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_news_published  ON news_items (published_at DESC);

-- Migration helpers for existing databases
ALTER TABLE seller_feedback ADD COLUMN IF NOT EXISTS rating TEXT;
ALTER TABLE seller_feedback ADD COLUMN IF NOT EXISTS note   TEXT;

-- ---------------------------------------------------------------------------
-- Problem 8a: Completed sale transactions
-- Written when a listing is marked as sold. Powers price discovery widgets,
-- market dashboards, and eventually the bid/ask order book.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS transactions (
  id            TEXT        PRIMARY KEY,
  listing_id    TEXT        REFERENCES listings(id) ON DELETE SET NULL,
  card_name     TEXT        NOT NULL,
  set_name      TEXT        NOT NULL DEFAULT '',
  game          TEXT        NOT NULL,
  condition     TEXT        NOT NULL DEFAULT 'NM',
  price_cents   INTEGER     NOT NULL,
  quantity      INTEGER     NOT NULL DEFAULT 1,
  buyer_id      TEXT        REFERENCES users(id) ON DELETE SET NULL,
  seller_id     TEXT        REFERENCES users(id) ON DELETE SET NULL,
  seller_region TEXT,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_card     ON transactions (lower(game), lower(card_name), completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_game     ON transactions (game, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_seller   ON transactions (seller_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_recent   ON transactions (completed_at DESC);

-- ---------------------------------------------------------------------------
-- Problem 8b: Bid / Ask order book
-- Users place bids (want to buy at $X) or asks (want to sell at $Y).
-- When a bid price >= an open ask for the same card, both fill automatically.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS orders (
  id            TEXT        PRIMARY KEY,
  user_id       TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_name     TEXT        NOT NULL,
  set_name      TEXT        NOT NULL DEFAULT '',
  game          TEXT        NOT NULL,
  condition     TEXT        NOT NULL DEFAULT 'Near Mint',
  type          TEXT        NOT NULL CHECK (type IN ('bid','ask')),
  price_cents   INTEGER     NOT NULL CHECK (price_cents > 0),
  quantity      INTEGER     NOT NULL DEFAULT 1 CHECK (quantity > 0),
  quantity_filled INTEGER   NOT NULL DEFAULT 0,
  status        TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open','filled','cancelled','expired')),
  note          TEXT,
  region        TEXT,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_card      ON orders (lower(game), lower(card_name), status, type, price_cents);
CREATE INDEX IF NOT EXISTS idx_orders_user      ON orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_open_bid  ON orders (lower(game), lower(card_name), price_cents DESC) WHERE status = 'open' AND type = 'bid';
CREATE INDEX IF NOT EXISTS idx_orders_open_ask  ON orders (lower(game), lower(card_name), price_cents ASC)  WHERE status = 'open' AND type = 'ask';
CREATE INDEX IF NOT EXISTS idx_orders_status    ON orders (status, expires_at) WHERE status = 'open';

-- ---------------------------------------------------------------------------
-- Problem 8d: Circulating supply estimates (for market cap calculation)
-- Populated manually or by admin script. One row per card+game combo.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS supply_estimates (
  id            SERIAL      PRIMARY KEY,
  card_name     TEXT        NOT NULL,
  game          TEXT        NOT NULL,
  set_name      TEXT        NOT NULL DEFAULT '',
  rarity        TEXT,
  -- estimated number of copies in active circulation globally
  supply_global INTEGER,
  -- estimated copies in SEA/SG region specifically
  supply_region INTEGER,
  notes         TEXT,
  source        TEXT,                      -- e.g. "print_run_data", "manual", "tcgcsv"
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lower(card_name), lower(game))
);

CREATE INDEX IF NOT EXISTS idx_supply_card ON supply_estimates (lower(game), lower(card_name));
