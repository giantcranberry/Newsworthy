# Advocacy Migration: advocates table -> crm_contacts

## Problem

The Next.js dashboard manages advocacy contacts in the `crm_contacts` table (`contact_type = 'advocate'`), but Flask's `xrunmail` reads exclusively from the `advocates` table for email sending, invite flows, and event tracking. New advocates added via the dashboard never receive advocacy emails.

## Decision

Migrate Flask's advocacy functionality to read/write `crm_contacts` instead of `advocates`. Flask continues to handle all email sending via `xrunmail` CLI commands. The Next.js dashboard remains the sole UI for managing advocates.

## Design

### Phase 1: Data Migration

**One-time script** to copy existing `advocates` rows into `crm_contacts`.

- For each advocate in `advocates` (where `is_deleted = false`):
  - Look up `advocacy_groups.co_id` via `advocates.group_id` to get the `company_id`
  - Look up `advocacy_groups.user_id` to get the `user_id`
  - Check if a `crm_contacts` row already exists with matching `email` + `company_id`
  - If exists and `contact_type = 'media'`, upgrade to `'both'`
  - If not exists, insert into `crm_contacts` with `contact_type = 'advocate'`
  - Copy fields: `email`, `md5`, `first_name`, `last_name`, `full_name`, `email_count`, `unsubscribe_at`, `last_open_at`, `bounced_at`, `latest`, `created_at`
  - Store a mapping of `advocates.id -> crm_contacts.id` in a temporary `advocate_id_map` table for tag migration
- Script should be idempotent (safe to run multiple times)
- Run against production DB with a dry-run flag first

### Phase 2: Flask xrunmail Changes

Modify five functions in `xrunmail/routes.py`:

#### 2a. `advocacy_invite()` (line ~601)

Current: Queries `Advocates.query.filter_by(latest=None)`

Change to:
```python
CrmContacts.query.filter(
    CrmContacts.contact_type.in_(['advocate', 'both']),
    CrmContacts.latest == None,
    CrmContacts.is_deleted == False,
    CrmContacts.unsubscribe_at == None,
    CrmContacts.bounced_at == None,
)
```
- Look up company via `CrmContacts.company_id` directly (no group_id indirection)
- Tag format: `advocacy_{company_id}-c{crm_contact_id}` (prefix `c` distinguishes from old format)

#### 2b. `advocacy_send()` (line ~635)

Current: Queries `Advocates` by `group_id`, creates `TinyUrl` with `advocat_id`

Change to:
```python
CrmContacts.query.filter(
    CrmContacts.company_id == release.company_id,
    CrmContacts.contact_type.in_(['advocate', 'both']),
    CrmContacts.unsubscribe_at == None,
    CrmContacts.bounced_at == None,
    CrmContacts.is_deleted == False,
)
```
- `TinyUrl.advocat_id` now stores `crm_contacts.id` (field name stays the same to avoid schema change)
- Tag format: `advocacy_{company_id}-c{crm_contact_id}`
- Update `crm_contacts.latest` and `crm_contacts.email_count` after send
- `AdvocacyCampaigns` record still created (uses `group_id` from `advocacy_groups` looked up by company_id)

#### 2c. `get_unsub_events()` (line ~178)

Current: Parses tag `advocacy_{co}-{advocate_id}`, looks up `Advocates`

Change to:
- Parse tag: if ID portion starts with `c`, strip prefix and look up `CrmContacts.query.get(id)`
- If no `c` prefix (old format), look up `Advocates.query.get(id)` (legacy support for 90 days)
- Set `unsubscribe_at` on whichever record is found

#### 2d. `get_open_events()` (line ~300)

Same dual-lookup pattern as 2c. Update `last_open_at`.

#### 2e. `get_bounce_events()` (line ~352)

Same dual-lookup pattern as 2c. Update `bounced_at`.

### Phase 3: Flask Model Addition

Add a `CrmContacts` SQLAlchemy model in Flask's `models.py` that maps to the existing `crm_contacts` table. Only needs the columns Flask uses:

```python
class CrmContacts(db.Model):
    __tablename__ = 'crm_contacts'
    id = db.Column(db.Integer, primary_key=True)
    uuid = db.Column(db.String(36))
    user_id = db.Column(db.Integer)
    company_id = db.Column(db.Integer)
    contact_type = db.Column(db.String(12))
    email = db.Column(db.String(128))
    md5 = db.Column(db.String(32))
    first_name = db.Column(db.String(48))
    last_name = db.Column(db.String(48))
    full_name = db.Column(db.String(128))
    is_deleted = db.Column(db.Boolean, default=False)
    email_count = db.Column(db.Integer, default=0)
    unsubscribe_at = db.Column(db.DateTime)
    last_open_at = db.Column(db.DateTime)
    bounced_at = db.Column(db.DateTime)
    latest = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime)
    updated_at = db.Column(db.DateTime)
```

No DB migration needed -- the table already exists.

### Phase 4: Legacy Tag Cutoff (90 days post-deploy)

After 90 days:
- Remove old-format tag parsing from event handlers (drop `Advocates.query.get()` fallback)
- The `advocates` table becomes read-only archive
- Optionally drop the `advocate_id_map` temporary table

## What Does NOT Change

- **PostQueue** mechanism -- Flask still picks up `target='advocacy'` jobs
- **TinyUrl table schema** -- `advocat_id` column reused for `crm_contacts.id`
- **AdvocacyCampaigns** -- still created as a send log
- **AdvocacyGroups** -- still used for `invite_msg` and as a logical grouping
- **Mailgun sending** -- same templates, same `Messenger` class
- **Elasticsearch tracking** -- `advocat_id` in ShareStat now references crm_contacts.id
- **Next.js dashboard** -- no changes needed; it already writes to crm_contacts

## Tag Format Reference

| Period | Format | ID source |
|--------|--------|-----------|
| Pre-migration | `advocacy_{co_id}-{advocate_id}` | advocates.id |
| Post-migration | `advocacy_{co_id}-c{crm_contact_id}` | crm_contacts.id |

## Risks

- **Duplicate sends during transition**: If the migration script runs but Flask hasn't been updated yet, the old code still sends to advocates table contacts. Mitigation: deploy Flask changes immediately after running the migration script.
- **Missing advocates**: If an advocate exists only in `advocates` and the migration script fails for that row, they won't receive emails. Mitigation: dry-run first, validate counts match.
- **TinyUrl.advocat_id ambiguity**: Old rows reference advocates.id, new rows reference crm_contacts.id. This is acceptable since the field is only used for attribution and the IDs won't collide in practice (different auto-increment sequences). If collisions are a concern, add a `advocat_source` column (`'legacy'` or `'crm'`).

## Execution Order

1. Add `CrmContacts` model to Flask (Phase 3 -- safe, no behavioral change)
2. Run data migration script with dry-run (Phase 1)
3. Run data migration script for real (Phase 1)
4. Validate: count crm_contacts advocates == count advocates (active)
5. Deploy Flask xrunmail changes (Phase 2)
6. Monitor for 1 week: check invite sends, advocacy sends, event processing
7. After 90 days: remove legacy tag support (Phase 4)
