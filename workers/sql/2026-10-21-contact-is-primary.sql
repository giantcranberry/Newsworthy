-- Default (primary) PR contact per brand.
-- At most one non-deleted contact per company has is_primary = true; the
-- dashboard clears the flag on the brand's other contacts in the same
-- transaction before setting it.

ALTER TABLE contact ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS contact_one_primary_per_company_idx
  ON contact (company_id)
  WHERE is_primary AND is_deleted IS NOT TRUE;

-- Backfill: a brand's only live contact becomes its default.
UPDATE contact c SET is_primary = true
WHERE c.is_deleted IS NOT TRUE
  AND c.is_primary = false
  AND (
    SELECT count(*) FROM contact o
    WHERE o.company_id = c.company_id AND o.is_deleted IS NOT TRUE
  ) = 1;
