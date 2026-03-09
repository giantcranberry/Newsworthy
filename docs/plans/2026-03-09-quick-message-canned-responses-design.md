# Quick Message & Canned Responses — Design

## Context

Editors/admins reviewing press releases on `/admin/releases` need a fast way to message the account holder (user) directly from the expanded release row. Messages should be sendable from canned (saved) templates or written custom. Canned messages are shared across all users/roles.

## UI Design

### Inline Quick Message Section (in expanded release row)

A new card section placed after Brand Info and before Change Distribution. Teal/cyan color scheme.

Contents:
- **Canned message dropdown** — lists all saved canned messages (shared, not per-user). Selecting one fills the subject field and shows a body preview.
- **Subject field** — pre-filled with `Regarding your press release: "{title}"`, editable. Replaced when a canned message is selected.
- **Send button** — sends the canned message immediately using the filled subject + body.
- **"Custom message" button** — opens a dialog for writing a free-form message.

### Custom Message Dialog

Opened from the inline section's "Custom message" button:
- **Subject field** — pre-filled with auto-generated default, editable
- **Body textarea** — plain text, auto-resizing
- **"Save as canned message" checkbox** — when checked, reveals a "Label" text input for naming the template
- **Send button** — sends the message and optionally saves as canned

### Canned Message Management Dialog

Accessed via a "Manage" link next to the canned dropdown:
- Simple list of all saved canned messages
- Each row: label, subject preview, delete (trash) button
- No edit — just delete. To update a message, delete and re-save.

## Data Model

### Migration: Add `subject` column to `canned_msgs`

```sql
ALTER TABLE canned_msgs ADD COLUMN subject varchar(255);
```

### Table usage

| Column | Usage |
|--------|-------|
| `route` | `'quick-message'` (category identifier) |
| `handle` | Display label (e.g., "Missing contact info") |
| `subject` | Email subject line template |
| `msg` | Email body text |
| `created_by` | User ID who created it |

Canned messages are shared — all users see all messages regardless of who created them.

## API Routes

| Route | Method | Purpose | Access |
|-------|--------|---------|--------|
| `GET /api/admin/canned-messages` | GET | List all canned messages (route='quick-message') | admin, editor, staff |
| `POST /api/admin/canned-messages` | POST | Create new canned message | admin, editor, staff |
| `DELETE /api/admin/canned-messages/[id]` | DELETE | Delete a canned message | admin, editor, staff |

Message sending reuses existing `POST /api/admin/messages/send`.

## Access Control

- Admin, Editor, and Staff can all send quick messages and manage canned messages
- Messages are sent via the existing `userMessages` system with email notification

## Technical Details

- Plain textarea (no TinyMCE) for the custom message dialog
- Canned messages are static text (no placeholder variables)
- Subject is editable with a sensible default
- Saving as canned stores both subject and body
- Fire-and-forget email notification via existing Resend integration
