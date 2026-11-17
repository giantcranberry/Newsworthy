-- Multiple media lists per brand + "Newsworthy Curated" list.
--
-- Scope: media lists (pitch_groups) ONLY. The Share list (advocacy_groups and
-- advocate rows in crm_contacts) is not touched by this migration.
--
-- Nothing is dropped. All changes are additive; the backfill only inserts.
--
-- Run with:
--   psql "$DIRECT_DATABASE_URL" -f apps/dashboard/drizzle/manual/2026-11-17-multi-media-lists.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. pitch_groups become "media lists". A brand may have many user lists and
--    at most one curated list (written only by the Newsworthy hunter process).
-- ---------------------------------------------------------------------------
ALTER TABLE pitch_groups ADD COLUMN IF NOT EXISTS is_curated boolean NOT NULL DEFAULT false;
ALTER TABLE pitch_groups ADD COLUMN IF NOT EXISTS description text;

CREATE INDEX IF NOT EXISTS pitch_groups_co_id_idx ON pitch_groups (co_id);

CREATE UNIQUE INDEX IF NOT EXISTS pitch_groups_one_curated_per_company
  ON pitch_groups (co_id)
  WHERE is_curated AND is_deleted IS NOT TRUE;

-- ---------------------------------------------------------------------------
-- 2. Membership for user-created lists. A brand's media contact (crm_contacts,
--    contact_type 'media' or 'both') can be on several of its lists.
--    Contacts without an email are not allowed on a list (enforced in the API;
--    crm_contacts.email is nullable so it can't be a constraint here).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media_list_members (
  id serial PRIMARY KEY,
  pitch_group_id integer NOT NULL REFERENCES pitch_groups (id) ON DELETE CASCADE,
  crm_contact_id integer NOT NULL REFERENCES crm_contacts (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT media_list_members_unique UNIQUE (pitch_group_id, crm_contact_id)
);

CREATE INDEX IF NOT EXISTS media_list_members_contact_idx ON media_list_members (crm_contact_id);

-- ---------------------------------------------------------------------------
-- 3. Curated journalists. Owned by Newsworthy, shared across brands, and never
--    stored in crm_contacts, so existing CRM pages/export/enrich can't expose
--    the email. Users only ever see name + publication.
--    Email is required: a journalist without one is not stored.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS curated_journalists (
  id serial PRIMARY KEY,
  name text NOT NULL,
  email varchar(128) NOT NULL CHECK (email <> ''),
  email_md5 varchar(32) NOT NULL,
  email_source varchar(16) NOT NULL,          -- 'published' (crawled) | 'hunter'
  hunter_score integer,
  hunter_verification varchar(32),
  publication text,
  outlet_domain varchar(128),
  outlet_type varchar(64),                    -- Trade, Podcast, Blog, Newsletter, ...
  role text,
  example_coverage_url text,
  notes text,
  unsubscribe_at timestamptz,
  bounced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT curated_journalists_email_md5_unique UNIQUE (email_md5)
);

CREATE TABLE IF NOT EXISTS curated_list_members (
  id serial PRIMARY KEY,
  pitch_group_id integer NOT NULL REFERENCES pitch_groups (id) ON DELETE CASCADE,
  curated_journalist_id integer NOT NULL REFERENCES curated_journalists (id) ON DELETE CASCADE,
  theme_fit text,                             -- why this journalist fits this brand
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT curated_list_members_unique UNIQUE (pitch_group_id, curated_journalist_id)
);

CREATE INDEX IF NOT EXISTS curated_list_members_journalist_idx ON curated_list_members (curated_journalist_id);

-- ---------------------------------------------------------------------------
-- 4. Which lists a release goes to, and the send log for the 28-day rule.
--    The user picks one or more lists per release (curated included).
--    sent_at is set by the sender when the list is actually emailed; a list
--    is unavailable if max(sent_at) for it is within the last 28 days.
--    release_options.pitchlist stays as the "send to media lists" on/off flag.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS release_media_lists (
  id serial PRIMARY KEY,
  pr_id integer NOT NULL REFERENCES releases (id) ON DELETE CASCADE,
  pitch_group_id integer NOT NULL REFERENCES pitch_groups (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  CONSTRAINT release_media_lists_unique UNIQUE (pr_id, pitch_group_id)
);

CREATE INDEX IF NOT EXISTS release_media_lists_group_sent_idx
  ON release_media_lists (pitch_group_id, sent_at DESC)
  WHERE sent_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. Backfill: every brand's existing media contacts go into its existing
--    (lowest-id) pitch_groups row, which becomes the default user list.
-- ---------------------------------------------------------------------------

-- 5a. Brands that have media contacts but no pitch group yet get one.
INSERT INTO pitch_groups (uuid, user_id, co_id, group_name, created_at, updated_at)
SELECT replace(gen_random_uuid()::text, '-', ''), co.user_id, co.id, left(co.company_name, 48), now(), now()
FROM company co
WHERE EXISTS (
        SELECT 1 FROM crm_contacts c
        WHERE c.company_id = co.id
          AND c.contact_type IN ('media', 'both')
          AND c.is_deleted IS NOT TRUE
      )
  AND NOT EXISTS (
        SELECT 1 FROM pitch_groups g
        WHERE g.co_id = co.id AND g.is_deleted IS NOT TRUE
      );

-- 5b. Link existing media contacts (with an email) to that default list.
INSERT INTO media_list_members (pitch_group_id, crm_contact_id)
SELECT g.id, c.id
FROM crm_contacts c
JOIN LATERAL (
  SELECT id FROM pitch_groups
  WHERE co_id = c.company_id
    AND is_deleted IS NOT TRUE
    AND is_curated = false
  ORDER BY id
  LIMIT 1
) g ON true
WHERE c.contact_type IN ('media', 'both')
  AND c.is_deleted IS NOT TRUE
  AND c.email IS NOT NULL
  AND c.email <> ''
ON CONFLICT (pitch_group_id, crm_contact_id) DO NOTHING;

COMMIT;
