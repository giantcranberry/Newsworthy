import { pgTable, serial, varchar, text, integer, timestamp } from 'drizzle-orm/pg-core'
import { users } from './users'

// Registry of admin-uploaded static assets stored in Linode Object Storage
// under the nwai-assets/ prefix. Managed at /admin/assets. Rows are
// hard-deleted when the asset is removed from storage.
export const nwaiAssets = pgTable('nwai_assets', {
  id: serial('id').primaryKey(),
  uuid: varchar('uuid', { length: 36 }).unique().notNull(),
  userId: integer('user_id').notNull().references(() => users.id),
  filename: varchar('filename', { length: 255 }).notNull(),
  url: text('url').notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  filesize: integer('filesize').notNull().default(0),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
