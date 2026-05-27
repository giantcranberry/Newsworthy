-- Enforce: a row inserted into brand_credits must NEVER take the (company_id,
-- product_type) aggregate balance below zero. Belt + suspenders behind the
-- application-level balance check, so a race or a missed check at any new
-- deduction site cannot create a negative balance.
--
-- Notes:
--   * Only deductions (NEW.credits < 0) are checked. Positive top-ups always
--     pass.
--   * Existing rows with negative aggregate balance (if any from prior bugs)
--     are NOT touched. We only block NEW inserts that would deepen the deficit
--     or push a positive balance below zero.
--   * Uses IS NOT DISTINCT FROM so NULL company_id / product_type are handled
--     by equality semantics rather than the SQL NULL trap.
--   * Expired credits are excluded from the running balance — matches the
--     application's getPodcastCreditsForCompany() filter.

CREATE OR REPLACE FUNCTION enforce_brand_credit_nonnegative()
RETURNS TRIGGER AS $$
DECLARE
  current_sum INTEGER;
BEGIN
  IF NEW.credits >= 0 THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(credits), 0)
    INTO current_sum
    FROM brand_credits
   WHERE company_id IS NOT DISTINCT FROM NEW.company_id
     AND product_type IS NOT DISTINCT FROM NEW.product_type
     AND (expires_at IS NULL OR expires_at > now());

  IF current_sum + NEW.credits < 0 THEN
    RAISE EXCEPTION
      'INSUFFICIENT_BRAND_CREDITS: company_id=% product_type=% balance=% requested=%',
      NEW.company_id, NEW.product_type, current_sum, NEW.credits
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS brand_credits_nonnegative_check ON brand_credits;

CREATE TRIGGER brand_credits_nonnegative_check
BEFORE INSERT ON brand_credits
FOR EACH ROW
EXECUTE FUNCTION enforce_brand_credit_nonnegative();
