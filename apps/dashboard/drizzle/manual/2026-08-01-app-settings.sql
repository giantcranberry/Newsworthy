-- Key/value store for admin-controlled application settings (feature
-- toggles, offers), edited at /admin/settings. First use: the
-- 'free_first_pr_enabled' toggle for the free-first-press-release offer
-- granted at registration. Absence of a row means the code default applies
-- (offer ON), so no seed row is required.
--
-- Run with: psql <fraction connection> -f apps/dashboard/drizzle/manual/2026-08-01-app-settings.sql

CREATE TABLE IF NOT EXISTS app_settings (
  id serial PRIMARY KEY,
  key varchar(64) NOT NULL UNIQUE,
  value varchar(255) NOT NULL,
  updated_by integer,
  updated_at timestamp NOT NULL DEFAULT now()
);
