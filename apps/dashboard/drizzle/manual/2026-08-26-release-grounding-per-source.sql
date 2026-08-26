-- Allow one successful row per provider for the same PR + query
-- (google_ai_overview, openai, and perplexity can all be stored)
--
-- Run with: psql "$DIRECT_DATABASE_URL" -f apps/dashboard/drizzle/manual/2026-08-26-release-grounding-per-source.sql

DROP INDEX IF EXISTS release_grounding_pr_query_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS release_grounding_pr_source_query_uidx
  ON release_grounding (pr_id, grounding_source, grounding_query);
