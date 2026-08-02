-- Adds releases.pending_upgrades: comma-separated upgrade product types the
-- user selected at the wizard Upgrades step but has not paid for yet. These
-- are settled in the combined checkout on the finalize page (1 PR credit +
-- selected upgrades in a single payment) and the column is cleared once paid.
--
-- Run with: psql <fraction connection> -f drizzle/manual/2026-08-01-releases-pending-upgrades.sql

ALTER TABLE releases
  ADD COLUMN IF NOT EXISTS pending_upgrades varchar(120);

-- Widen distribution: it stores a comma-joined list of upgrade product types
-- (e.g. 'premium,enhanced,concierge'), which can exceed the original 20-char
-- limit once upgrades from credit redemptions and the finalize checkout are
-- appended together. Widening is metadata-only in Postgres (no table rewrite).
ALTER TABLE releases
  ALTER COLUMN distribution TYPE varchar(120);
