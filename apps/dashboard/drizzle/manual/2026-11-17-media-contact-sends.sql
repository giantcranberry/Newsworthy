-- Send log for the Newsworthy Curated 28-day rule.
--
-- Rule: a brand may email each journalist on its Newsworthy Curated list at
-- most once every 28 days. User-created media lists have no frequency limit.
-- The window is per brand: if two brands' curated lists share a journalist,
-- each brand has its own 28-day window for that journalist.
--
-- The sender skips any curated journalist with a row here for the same
-- company_id where sent_at > now() - interval '28 days', and inserts a row for
-- every curated email it actually sends.
--
-- pr_id is SET NULL on delete so deleting a release doesn't erase the history
-- and reopen the window early.
--
-- Additive only; nothing is dropped.
--
-- Run with:
--   psql "$DIRECT_DATABASE_URL" -f apps/dashboard/drizzle/manual/2026-11-17-media-contact-sends.sql

BEGIN;

CREATE TABLE IF NOT EXISTS curated_journalist_sends (
  id serial PRIMARY KEY,
  company_id integer NOT NULL REFERENCES company (id) ON DELETE CASCADE,
  curated_journalist_id integer NOT NULL REFERENCES curated_journalists (id) ON DELETE CASCADE,
  pr_id integer REFERENCES releases (id) ON DELETE SET NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT curated_journalist_sends_one_per_release UNIQUE (company_id, curated_journalist_id, pr_id)
);

CREATE INDEX IF NOT EXISTS curated_journalist_sends_window_idx
  ON curated_journalist_sends (company_id, curated_journalist_id, sent_at DESC);

COMMIT;
