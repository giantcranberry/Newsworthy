-- !! TARGET: the NEON database (curated corpus: articles/feeditem/tldr), !!
-- !! NOT the main Supabase/fraction DB.                                  !!
--
-- Full-text search index for website curated search (apps/website/lib/search.ts,
-- searchCurated). Without this index the curated search does a seq scan with
-- per-row to_tsvector over ~35k articles (slow, likely seconds) — run this
-- before or soon after deploying the Postgres-backed search. The expression
-- MUST stay textually identical to the one in searchCurated or the planner
-- won't use it.
--
-- CONCURRENTLY avoids locking writes; run outside a transaction.

CREATE INDEX CONCURRENTLY IF NOT EXISTS articles_fts_idx
  ON articles
  USING GIN (
    to_tsvector(
      'english',
      coalesce(article_json->>'headline', '') || ' ' || coalesce(article_json->>'content', '')
    )
  );
