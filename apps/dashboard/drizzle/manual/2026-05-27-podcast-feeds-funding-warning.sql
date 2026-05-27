-- Tracks when the cron last sent a "podcast PR credits needed" notification
-- to this feed's owner. The refresh-podcast-feeds cron uses this to enforce
-- a 24-hour cooldown on funding warnings so users aren't spammed every tick
-- when their effective balance is depleted. The cron sets it to now() when
-- a warning fires and clears it back to NULL when the brand's effective
-- balance recovers (credits > pending podcast drafts).

ALTER TABLE podcast_feeds
  ADD COLUMN IF NOT EXISTS funding_warning_sent_at TIMESTAMP;
