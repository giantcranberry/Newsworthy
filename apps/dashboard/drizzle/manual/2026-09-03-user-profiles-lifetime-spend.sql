-- Lifetime spend on user_profiles (cents). Recalculated when admin loads a user's invoices.
--
-- Run with: psql "$DIRECT_DATABASE_URL" -f apps/dashboard/drizzle/manual/2026-09-03-user-profiles-lifetime-spend.sql

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS lifetime_spend integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_spend_updated_at timestamp;
