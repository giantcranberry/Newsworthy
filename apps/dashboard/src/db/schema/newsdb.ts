import { pgTable, serial, varchar, text, boolean, timestamp, integer, json } from 'drizzle-orm/pg-core'
import { users } from './users'

export const newsDbMaster = pgTable('news_db_master', {
  id: serial('id').primaryKey(),
  userId: integer('user_id'),
  md5: varchar('md5', { length: 32 }),
  tld: varchar('tld', { length: 64 }),
  firstName: varchar('first_name', { length: 36 }).notNull(),
  lastName: varchar('last_name', { length: 36 }).notNull(),
  middleName: varchar('middle_name', { length: 36 }),
  email: varchar('email', { length: 128 }),
  industry: varchar('industry', { length: 128 }),
  linkedin: varchar('linkedin', { length: 128 }),
  twitter: varchar('twitter', { length: 128 }),
  facebook: varchar('facebook', { length: 128 }),
  instagram: varchar('instagram', { length: 128 }),
  crunchbase: varchar('crunchbase', { length: 128 }),
  youtube: varchar('youtube', { length: 128 }),
  isValid: boolean('is_valid'),
  pdl: json('pdl'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const newsDbPatterns = pgTable('news_db_patterns', {
  id: serial('id').primaryKey(),
  tld: varchar('tld', { length: 128 }).notNull(),
  altDomain: varchar('alt_domain', { length: 128 }),
  pattern: varchar('pattern', { length: 128 }),
  general: varchar('general', { length: 128 }),
  createdBy: varchar('created_by', { length: 12 }),
})

export const newsDbNotfound = pgTable('news_db_notfound', {
  id: serial('id').primaryKey(),
  userId: integer('user_id'),
  tld: varchar('tld', { length: 64 }),
  md5: varchar('md5', { length: 32 }),
  firstName: varchar('first_name', { length: 36 }),
  lastName: varchar('last_name', { length: 36 }),
  email: varchar('email', { length: 128 }),
  linkedin: varchar('linkedin', { length: 128 }),
  twitter: varchar('twitter', { length: 128 }),
  facebook: varchar('facebook', { length: 128 }),
  instagram: varchar('instagram', { length: 128 }),
  crunchbase: varchar('crunchbase', { length: 128 }),
  youtube: varchar('youtube', { length: 128 }),
  searchTerm: varchar('search_term', { length: 256 }),
  qurl: text('qurl'),
  status: varchar('status', { length: 15 }),
  imported: timestamp('imported'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  notified: timestamp('notified'),
  general: boolean('general').default(false),
  createdBy: varchar('created_by', { length: 12 }),
})

export const newsDbQueries = pgTable('news_db_queries', {
  id: serial('id').primaryKey(),
  newsdbId: integer('newsdb_id'),
  userId: integer('user_id'),
  notfoundId: integer('notfound_id'),
  searchTerm: varchar('search_term', { length: 128 }),
  qurl: text('qurl'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const pitchList = pgTable('pitch_list', {
  id: serial('id').primaryKey(),
  groupId: integer('group_id'),
  newsdbId: integer('newsdb_id'),
  companyId: integer('company_id'),
  uuid: varchar('uuid', { length: 36 }).unique(),
  userId: integer('user_id'),
  md5: varchar('md5', { length: 32 }),
  tld: varchar('tld', { length: 64 }),
  firstName: varchar('first_name', { length: 36 }),
  lastName: varchar('last_name', { length: 36 }),
  notes: text('notes'),
  email: varchar('email', { length: 128 }),
  phone: varchar('phone', { length: 36 }),
  source: varchar('source', { length: 10 }),
  publication: varchar('publication', { length: 128 }),
  linkedin: varchar('linkedin', { length: 128 }),
  twitter: varchar('twitter', { length: 128 }),
  facebook: varchar('facebook', { length: 128 }),
  instagram: varchar('instagram', { length: 128 }),
  crunchbase: varchar('crunchbase', { length: 128 }),
  youtube: varchar('youtube', { length: 128 }),
  deliverable: boolean('deliverable'),
  qurl: text('qurl'),
  pdl: json('pdl'),
  isDeleted: boolean('is_deleted').default(false),
  emailCount: integer('email_count').default(0),
  unsubscribeAt: timestamp('unsubscribe_at'),
  lastOpenAt: timestamp('last_open_at'),
  bouncedAt: timestamp('bounced_at'),
  latest: timestamp('latest'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const pitchGroups = pgTable('pitch_groups', {
  id: serial('id').primaryKey(),
  userId: integer('user_id'),
  uuid: varchar('uuid', { length: 36 }).unique(),
  coId: integer('co_id'),
  groupName: varchar('group_name', { length: 48 }),
  isDeleted: boolean('is_deleted').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  latest: timestamp('latest'),
})

export const pitchCampaigns = pgTable('pitch_campaigns', {
  id: serial('id').primaryKey(),
  prId: integer('pr_id'),
  userId: integer('user_id'),
  groupId: integer('group_id'),
  uuid: varchar('uuid', { length: 36 }).unique(),
  name: varchar('name', { length: 228 }),
  subject: text('subject'),
  pitch: text('pitch'),
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
})

export const pitchListTags = pgTable('pitch_list_tags', {
  id: serial('id').primaryKey(),
  plid: integer('plid'),
  tag: varchar('tag', { length: 256 }),
  createdAt: timestamp('created_at').defaultNow(),
})

export const advocacyGroups = pgTable('advocacy_groups', {
  id: serial('id').primaryKey(),
  userId: integer('user_id'),
  uuid: varchar('uuid', { length: 36 }).unique(),
  coId: integer('co_id'),
  groupName: varchar('group_name', { length: 48 }),
  inviteMsg: text('invite_msg'),
  isDeleted: boolean('is_deleted').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  latest: timestamp('latest'),
})

export const advocates = pgTable('advocates', {
  id: serial('id').primaryKey(),
  groupId: integer('group_id'),
  userId: integer('user_id'),
  uuid: varchar('uuid', { length: 36 }).unique(),
  email: varchar('email', { length: 128 }),
  md5: varchar('md5', { length: 32 }),
  firstName: varchar('first_name', { length: 48 }),
  lastName: varchar('last_name', { length: 48 }),
  fullName: varchar('full_name', { length: 128 }),
  isDeleted: boolean('is_deleted').default(false),
  emailCount: integer('email_count').default(0),
  unsubscribeAt: timestamp('unsubscribe_at'),
  lastOpenAt: timestamp('last_open_at'),
  bouncedAt: timestamp('bounced_at'),
  latest: timestamp('latest'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const advocacyCampaigns = pgTable('advocacy_campaigns', {
  id: serial('id').primaryKey(),
  userId: integer('user_id'),
  groupId: integer('group_id'),
  uuid: varchar('uuid', { length: 36 }).unique(),
  name: varchar('name', { length: 228 }),
  prId: integer('pr_id'),
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
})
