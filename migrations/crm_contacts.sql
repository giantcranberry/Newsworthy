-- CRM Contacts table: unified contact system merging pitch_list + advocates
-- Run manually after review

CREATE TABLE IF NOT EXISTS crm_contacts (
  id SERIAL PRIMARY KEY,
  uuid VARCHAR(36) UNIQUE,
  user_id INTEGER NOT NULL,
  company_id INTEGER NOT NULL,
  group_id INTEGER,
  contact_type VARCHAR(12) NOT NULL, -- 'media', 'advocate', 'both'
  md5 VARCHAR(32),
  first_name VARCHAR(48),
  last_name VARCHAR(48),
  full_name VARCHAR(128),
  email VARCHAR(128),
  phone VARCHAR(36),
  notes TEXT,
  -- Media-specific
  newsdb_id INTEGER,
  tld VARCHAR(64),
  source VARCHAR(10),
  publication VARCHAR(128),
  deliverable BOOLEAN,
  qurl TEXT,
  pdl JSON,
  -- Social links
  linkedin VARCHAR(128),
  twitter VARCHAR(128),
  facebook VARCHAR(128),
  instagram VARCHAR(128),
  crunchbase VARCHAR(128),
  youtube VARCHAR(128),
  -- Engagement tracking
  is_deleted BOOLEAN DEFAULT FALSE,
  email_count INTEGER DEFAULT 0,
  unsubscribe_at TIMESTAMP,
  last_open_at TIMESTAMP,
  bounced_at TIMESTAMP,
  latest TIMESTAMP,
  -- Migration traceability
  source_table VARCHAR(20),
  source_id INTEGER,
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crm_contacts_company_id ON crm_contacts (company_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_email ON crm_contacts (email);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_contact_type ON crm_contacts (contact_type);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_company_type ON crm_contacts (company_id, contact_type);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_user_id ON crm_contacts (user_id);

-- Migrate pitch_list → crm_contacts (contact_type = 'media')
INSERT INTO crm_contacts (
  uuid, user_id, company_id, group_id, contact_type,
  md5, first_name, last_name, full_name, email, phone, notes,
  newsdb_id, tld, source, publication, deliverable, qurl, pdl,
  linkedin, twitter, facebook, instagram, crunchbase, youtube,
  is_deleted, email_count, unsubscribe_at, last_open_at, bounced_at, latest,
  source_table, source_id,
  created_at, updated_at
)
SELECT
  pl.uuid, pl.user_id,
  COALESCE(pl.company_id, pg.co_id),
  pl.group_id, 'media',
  pl.md5, pl.first_name, pl.last_name,
  CONCAT_WS(' ', NULLIF(pl.first_name, ''), NULLIF(pl.last_name, '')),
  pl.email, pl.phone, pl.notes,
  pl.newsdb_id, pl.tld, pl.source, pl.publication, pl.deliverable, pl.qurl, pl.pdl,
  pl.linkedin, pl.twitter, pl.facebook, pl.instagram, pl.crunchbase, pl.youtube,
  pl.is_deleted, pl.email_count, pl.unsubscribe_at, pl.last_open_at, pl.bounced_at, pl.latest,
  'pitch_list', pl.id,
  pl.created_at, pl.updated_at
FROM pitch_list pl
LEFT JOIN pitch_groups pg ON pg.id = pl.group_id
WHERE COALESCE(pl.company_id, pg.co_id) IS NOT NULL;

-- Migrate advocates → crm_contacts (contact_type = 'advocate')
INSERT INTO crm_contacts (
  uuid, user_id, company_id, group_id, contact_type,
  md5, first_name, last_name, full_name, email,
  is_deleted, email_count, unsubscribe_at, last_open_at, bounced_at, latest,
  source_table, source_id,
  created_at, updated_at
)
SELECT
  a.uuid, a.user_id,
  ag.co_id,
  a.group_id, 'advocate',
  a.md5, a.first_name, a.last_name, a.full_name, a.email,
  a.is_deleted, a.email_count, a.unsubscribe_at, a.last_open_at, a.bounced_at, a.latest,
  'advocates', a.id,
  a.created_at, a.updated_at
FROM advocates a
JOIN advocacy_groups ag ON ag.id = a.group_id;

-- Deduplicate: where same email + same company exists as both media and advocate,
-- mark the media record as 'both' and soft-delete the advocate duplicate
WITH dupes AS (
  SELECT
    m.id AS media_id,
    a.id AS advocate_id
  FROM crm_contacts m
  JOIN crm_contacts a ON LOWER(m.email) = LOWER(a.email) AND m.company_id = a.company_id
  WHERE m.contact_type = 'media'
    AND a.contact_type = 'advocate'
    AND m.is_deleted IS NOT TRUE
    AND a.is_deleted IS NOT TRUE
)
UPDATE crm_contacts SET contact_type = 'both'
WHERE id IN (SELECT media_id FROM dupes);

WITH dupes AS (
  SELECT
    m.id AS media_id,
    a.id AS advocate_id
  FROM crm_contacts m
  JOIN crm_contacts a ON LOWER(m.email) = LOWER(a.email) AND m.company_id = a.company_id
  WHERE m.contact_type = 'both'
    AND a.contact_type = 'advocate'
    AND m.is_deleted IS NOT TRUE
    AND a.is_deleted IS NOT TRUE
)
UPDATE crm_contacts SET is_deleted = TRUE
WHERE id IN (SELECT advocate_id FROM dupes);
