-- Stakeholder "Approve with Changes" response.
-- The row is still approved = true (it does not block submission); with_changes
-- marks that the requested changes are in feedback.

ALTER TABLE approvals ADD COLUMN IF NOT EXISTS with_changes boolean NOT NULL DEFAULT false;
