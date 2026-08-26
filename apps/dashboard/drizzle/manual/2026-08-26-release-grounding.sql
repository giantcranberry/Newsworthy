-- Successful AI search grounding hits for released PRs
-- Unique on (pr_id, grounding_query): do not re-log / recheck the same query after a hit
-- Only successful groundings are inserted by workers/grounding_check/run_batch.ts
--
-- Run with: psql "$DIRECT_DATABASE_URL" -f apps/dashboard/drizzle/manual/2026-08-26-release-grounding.sql

CREATE TABLE IF NOT EXISTS release_grounding (
  id serial PRIMARY KEY,
  pr_id integer NOT NULL REFERENCES releases(id),
  grounding_source varchar(32) NOT NULL,
  grounding_query text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS release_grounding_pr_source_query_uidx
  ON release_grounding (pr_id, grounding_source, grounding_query);

CREATE INDEX IF NOT EXISTS release_grounding_pr_id_idx
  ON release_grounding (pr_id);

CREATE INDEX IF NOT EXISTS release_grounding_created_idx
  ON release_grounding (created_at);
