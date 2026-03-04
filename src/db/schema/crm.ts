import { pgTable, serial, varchar, text, boolean, timestamp, integer, json } from 'drizzle-orm/pg-core'

export const crmContacts = pgTable('crm_contacts', {
  id: serial('id').primaryKey(),
  uuid: varchar('uuid', { length: 36 }).unique(),
  userId: integer('user_id').notNull(),
  companyId: integer('company_id').notNull(),
  groupId: integer('group_id'),
  contactType: varchar('contact_type', { length: 12 }).notNull(), // 'media', 'advocate', 'both'
  md5: varchar('md5', { length: 32 }),
  firstName: varchar('first_name', { length: 48 }),
  lastName: varchar('last_name', { length: 48 }),
  fullName: varchar('full_name', { length: 128 }),
  email: varchar('email', { length: 128 }),
  phone: varchar('phone', { length: 36 }),
  notes: text('notes'),
  // Media-specific fields
  newsdbId: integer('newsdb_id'),
  tld: varchar('tld', { length: 64 }),
  source: varchar('source', { length: 10 }),
  publication: varchar('publication', { length: 128 }),
  deliverable: boolean('deliverable'),
  qurl: text('qurl'),
  pdl: json('pdl'),
  // Social links
  linkedin: varchar('linkedin', { length: 128 }),
  twitter: varchar('twitter', { length: 128 }),
  facebook: varchar('facebook', { length: 128 }),
  instagram: varchar('instagram', { length: 128 }),
  crunchbase: varchar('crunchbase', { length: 128 }),
  youtube: varchar('youtube', { length: 128 }),
  // Engagement tracking
  isDeleted: boolean('is_deleted').default(false),
  emailCount: integer('email_count').default(0),
  unsubscribeAt: timestamp('unsubscribe_at'),
  lastOpenAt: timestamp('last_open_at'),
  bouncedAt: timestamp('bounced_at'),
  latest: timestamp('latest'),
  // Migration traceability
  sourceTable: varchar('source_table', { length: 20 }),
  sourceId: integer('source_id'),
  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})
