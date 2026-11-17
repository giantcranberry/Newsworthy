// Multiple media lists per brand + Newsworthy Curated list.
// Migrations: apps/dashboard/drizzle/manual/2026-11-17-multi-media-lists.sql
//             apps/dashboard/drizzle/manual/2026-11-17-media-contact-sends.sql
// Lists themselves are rows in pitch_groups (see newsdb.ts: isCurated).

import { pgTable, serial, varchar, text, timestamp, integer, unique } from 'drizzle-orm/pg-core'

/** User-created list membership: a brand's media contact (crm_contacts) on one of its lists. */
export const mediaListMembers = pgTable('media_list_members', {
  id: serial('id').primaryKey(),
  pitchGroupId: integer('pitch_group_id').notNull(),
  crmContactId: integer('crm_contact_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique('media_list_members_unique').on(t.pitchGroupId, t.crmContactId)])

/**
 * Newsworthy-owned journalists found by the hunter. Never stored in crm_contacts.
 * The email must never be returned to dashboard users — only name + publication.
 */
export const curatedJournalists = pgTable('curated_journalists', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: varchar('email', { length: 128 }).notNull(),
  emailMd5: varchar('email_md5', { length: 32 }).notNull().unique('curated_journalists_email_md5_unique'),
  emailSource: varchar('email_source', { length: 16 }).notNull(), // 'published' | 'hunter'
  hunterScore: integer('hunter_score'),
  hunterVerification: varchar('hunter_verification', { length: 32 }),
  publication: text('publication'),
  outletDomain: varchar('outlet_domain', { length: 128 }),
  outletType: varchar('outlet_type', { length: 64 }),
  role: text('role'),
  exampleCoverageUrl: text('example_coverage_url'),
  notes: text('notes'),
  unsubscribeAt: timestamp('unsubscribe_at', { withTimezone: true }),
  bouncedAt: timestamp('bounced_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Curated journalists on a brand's Newsworthy Curated list (pitch_groups.is_curated). */
export const curatedListMembers = pgTable('curated_list_members', {
  id: serial('id').primaryKey(),
  pitchGroupId: integer('pitch_group_id').notNull(),
  curatedJournalistId: integer('curated_journalist_id').notNull(),
  themeFit: text('theme_fit'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique('curated_list_members_unique').on(t.pitchGroupId, t.curatedJournalistId)])

/** Media lists selected for a release. sent_at = list processed by the sender. */
export const releaseMediaLists = pgTable('release_media_lists', {
  id: serial('id').primaryKey(),
  prId: integer('pr_id').notNull(),
  pitchGroupId: integer('pitch_group_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
}, (t) => [unique('release_media_lists_unique').on(t.prId, t.pitchGroupId)])

/**
 * Curated 28-day rule log: a brand may email each curated journalist at most
 * once every 28 days. Per brand — other brands have independent windows.
 */
export const curatedJournalistSends = pgTable('curated_journalist_sends', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').notNull(),
  curatedJournalistId: integer('curated_journalist_id').notNull(),
  prId: integer('pr_id'),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique('curated_journalist_sends_one_per_release').on(t.companyId, t.curatedJournalistId, t.prId)])

export const CURATED_LIST_NAME = 'Newsworthy Curated'
export const CURATED_SEND_WINDOW_DAYS = 28
