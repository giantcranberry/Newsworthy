-- Registry of admin-uploaded static assets stored in Linode Object Storage
-- under the nwai-assets/ prefix. Managed at /admin/assets (upload, copy URL,
-- delete). Rows are hard-deleted when the asset is removed from storage, so
-- no soft-delete flag.
--
-- Run with: psql <fraction connection> -f apps/dashboard/drizzle/manual/2026-08-04-nwai-assets.sql

CREATE TABLE IF NOT EXISTS nwai_assets (
  id serial PRIMARY KEY,
  uuid varchar(36) NOT NULL UNIQUE,
  user_id integer NOT NULL REFERENCES users(id),
  filename varchar(255) NOT NULL,
  url text NOT NULL,
  mime_type varchar(100) NOT NULL,
  filesize integer NOT NULL DEFAULT 0,
  description text,
  created_at timestamp NOT NULL DEFAULT now()
);
