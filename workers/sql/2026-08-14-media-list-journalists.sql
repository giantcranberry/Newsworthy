-- Media-list journalist lookup cache (fraction DB).
-- One row per journalist (unique on normalized name_key).
-- Used by workers/media_list_agent to avoid repeat Firecrawl/Hunter calls
-- when the same person is identified while building a brand list.
--
-- Freshness: the agent treats a row as fresh when updated_at is < 60 days old.
-- (Use updated_at, not created_at — otherwise a refreshed row would still look stale.)
--
-- Run with:
--   psql "$DIRECT_DATABASE_URL" -f workers/sql/2026-08-14-media-list-journalists.sql

CREATE TABLE IF NOT EXISTS media_list_journalists (
  id serial PRIMARY KEY,

  -- Display name as last seen; uniqueness is on name_key
  name text NOT NULL,
  name_key varchar(255) NOT NULL,

  -- Crawled / published contact (never guessed)
  email text,
  email_type text,

  publication text,
  outlet_type text,
  role text,
  theme_fit text,
  example_coverage_url text,
  notes text,

  -- Hunter.io enrichment (separate from crawled email)
  hunter_email text,
  hunter_score text,
  hunter_verification text,
  hunter_domain text,
  hunter_company text,
  hunter_status text,
  hunter_source_url text,

  -- Which list slugs contributed to this row (e.g. green-choice-proteins)
  source_lists text[] NOT NULL DEFAULT '{}',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT media_list_journalists_name_key_unique UNIQUE (name_key)
);

CREATE INDEX IF NOT EXISTS media_list_journalists_email_idx
  ON media_list_journalists (lower(email))
  WHERE email IS NOT NULL AND email <> '';

CREATE INDEX IF NOT EXISTS media_list_journalists_hunter_email_idx
  ON media_list_journalists (lower(hunter_email))
  WHERE hunter_email IS NOT NULL AND hunter_email <> '';

CREATE INDEX IF NOT EXISTS media_list_journalists_updated_at_idx
  ON media_list_journalists (updated_at);
