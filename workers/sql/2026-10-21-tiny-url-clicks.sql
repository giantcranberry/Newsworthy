-- Per-click log for tiny_url share links (fraction DB).
-- tiny_url.hits is only a running counter; this records each click so the
-- advocacy Manage Subscribers page can show distinct visitors (IP + device)
-- per advocate and per release.
--
-- Written by the short-link redirect (Flask) on every hit, alongside the
-- existing tiny_url.hits increment. Rows are removed with their tiny_url row.
--
-- Run with:
--   psql "$DIRECT_DATABASE_URL" -f workers/sql/2026-10-21-tiny-url-clicks.sql
-- (CREATE INDEX CONCURRENTLY cannot run inside a transaction; psql -f is fine.)

CREATE TABLE IF NOT EXISTS tiny_url_clicks (
  id bigserial PRIMARY KEY,
  tiny_url_id integer NOT NULL REFERENCES tiny_url(id) ON DELETE CASCADE,

  -- Raw request data, same shapes as page_hits / nw_shares
  request_ip varchar(64),
  user_agent text,
  referrer text,

  -- sha256(request_ip || '|' || user_agent), computed by the writer;
  -- distinct visitors = count(DISTINCT visitor_hash)
  visitor_hash char(64),

  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tiny_url_clicks_tiny_url_id_idx
  ON tiny_url_clicks (tiny_url_id, visitor_hash);

-- Supports the Clicks column / sort on the Manage Subscribers page
-- (sum of tiny_url.hits per company + advocate).
CREATE INDEX CONCURRENTLY IF NOT EXISTS tiny_url_co_advocat_idx
  ON tiny_url (co_id, advocat_id);
