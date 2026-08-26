-- Crawler / page hit traffic log (SEO + AI bots)
-- Modeled after verifiedschema pageHit; snake_case for fraction
-- Run with: psql "$DIRECT_DATABASE_URL" -f apps/dashboard/drizzle/manual/2026-08-26-page-hits.sql

CREATE TYPE crawler_visitor AS ENUM ('browser', 'seo', 'ai', 'other');

CREATE TABLE IF NOT EXISTS page_hits (
  id text PRIMARY KEY,
  page_url text NOT NULL,
  path text NOT NULL,
  visitor crawler_visitor NOT NULL,
  bot_name text,
  user_agent text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS page_hits_created_idx
  ON page_hits (created_at);

CREATE INDEX IF NOT EXISTS page_hits_visitor_created_idx
  ON page_hits (visitor, created_at);

CREATE INDEX IF NOT EXISTS page_hits_path_created_idx
  ON page_hits (path, created_at);
