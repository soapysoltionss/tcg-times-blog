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
  data     JSONB NOT NULL
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
