-- Full-text search index for website search over releases (fraction DB).
--
-- The website's /api/search now runs Postgres FTS instead of OpenSearch. The
-- search works without this index (seq scan over ~2.3k rows), but this makes
-- it index-backed. The expression MUST stay textually identical to the one in
-- apps/website/lib/search.ts (searchReleases) or the planner won't use it.
--
-- CONCURRENTLY avoids locking writes; run outside a transaction (plain psql,
-- not wrapped in BEGIN/COMMIT).

CREATE INDEX CONCURRENTLY IF NOT EXISTS releases_fts_idx
  ON releases
  USING GIN (
    to_tsvector(
      'english',
      coalesce(title, '') || ' ' || coalesce(abstract, '') || ' ' || coalesce(body, '')
    )
  );

-- Supporting index for the common "latest public releases" ordering
CREATE INDEX CONCURRENTLY IF NOT EXISTS releases_release_at_idx
  ON releases (release_at DESC)
  WHERE status = 'sent';
