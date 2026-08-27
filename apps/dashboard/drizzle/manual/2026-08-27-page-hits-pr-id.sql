-- Add page_hits.pr_id (releases.id) for /news article crawler hits.
-- Run with: psql "$DIRECT_DATABASE_URL" -f apps/dashboard/drizzle/manual/2026-08-27-page-hits-pr-id.sql
-- Do not drop tables. Review before running.

ALTER TABLE page_hits
  ADD COLUMN IF NOT EXISTS pr_id integer;

ALTER TABLE page_hits
  DROP CONSTRAINT IF EXISTS page_hits_pr_id_releases_fk;

ALTER TABLE page_hits
  ADD CONSTRAINT page_hits_pr_id_releases_fk
  FOREIGN KEY (pr_id) REFERENCES releases (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS page_hits_pr_id_created_idx
  ON page_hits (pr_id, created_at)
  WHERE pr_id IS NOT NULL;

-- Optional backfill: parse /news/{YYYYMMDD}{prId}/... (and /news/{lang}/...)
-- Only sets pr_id when that release still exists.
UPDATE page_hits ph
SET pr_id = parsed.pr_id
FROM (
  SELECT
    ph2.id,
    (regexp_match(ph2.path, '^/news/(?:[a-z]{2}/)?\d{8}(\d+)(?:/|$)'))[1]::integer AS pr_id
  FROM page_hits ph2
  WHERE ph2.pr_id IS NULL
    AND ph2.path ~ '^/news/(?:[a-z]{2}/)?\d{8}\d+(?:/|$)'
) parsed
WHERE ph.id = parsed.id
  AND EXISTS (SELECT 1 FROM releases r WHERE r.id = parsed.pr_id);
