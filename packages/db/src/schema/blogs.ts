import {
  pgTable,
  serial,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import { company } from './company'
import { users } from './users'
import { releases } from './releases'

export const blogFeeds = pgTable(
  'blog_feeds',
  {
    id: serial('id').primaryKey(),
    uuid: varchar('uuid', { length: 36 }).unique().notNull(),
    companyId: integer('company_id').notNull().references(() => company.id),
    userId: integer('user_id').notNull().references(() => users.id),
    feedUrl: text('feed_url').notNull(),
    title: varchar('title', { length: 255 }),
    description: text('description'),
    imageUrl: text('image_url'),
    author: varchar('author', { length: 255 }),
    language: varchar('language', { length: 16 }),
    link: text('link'),
    category: varchar('category', { length: 128 }),
    lastFetchedAt: timestamp('last_fetched_at'),
    lastPostPublishedAt: timestamp('last_post_published_at'),
    fetchError: text('fetch_error'),
    isActive: boolean('is_active').default(true).notNull(),
    isArchived: boolean('is_archived').default(false).notNull(),
    isDeleted: boolean('is_deleted').default(false).notNull(),
    notifyEmail: boolean('notify_email').default(true).notNull(),
    notifyEmailTo: text('notify_email_to'),
    notifySms: boolean('notify_sms').default(false).notNull(),
    notifySmsPhone: varchar('notify_sms_phone', { length: 30 }),
    notifyInApp: boolean('notify_in_app').default(true).notNull(),
    notifySlack: boolean('notify_slack').default(false).notNull(),
    notifySlackWebhookUrl: text('notify_slack_webhook_url'),
    notificationsSavedAt: timestamp('notifications_saved_at'),
    // Last time the cron sent a "blog PR credits needed" warning to this
    // feed's owner. 24h cooldown. Cleared when the effective balance recovers.
    fundingWarningSentAt: timestamp('funding_warning_sent_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('blog_feeds_company_live_uidx')
      .on(table.companyId)
      .where(sql`${table.isDeleted} = false`),
    index('blog_feeds_user_id_idx').on(table.userId),
  ],
)

export const blogPosts = pgTable(
  'blog_posts',
  {
    id: serial('id').primaryKey(),
    uuid: varchar('uuid', { length: 36 }).unique().notNull(),
    feedId: integer('feed_id').notNull().references(() => blogFeeds.id, { onDelete: 'cascade' }),
    guid: varchar('guid', { length: 512 }).notNull(),
    title: varchar('title', { length: 512 }),
    summary: text('summary'),
    content: text('content'),
    link: text('link'),
    imageUrl: text('image_url'),
    author: varchar('author', { length: 255 }),
    publishedAt: timestamp('published_at'),
    skip: boolean('skip').default(false).notNull(),
    releaseId: integer('release_id').references(() => releases.id),
    processedAt: timestamp('processed_at'),
    generationStatus: varchar('generation_status', { length: 20 }).default('pending').notNull(),
    generationError: text('generation_error'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('blog_posts_feed_guid_uidx').on(table.feedId, table.guid),
    index('blog_posts_feed_published_idx').on(table.feedId, table.publishedAt),
  ],
)

export const blogFeedsRelations = relations(blogFeeds, ({ one, many }) => ({
  company: one(company, {
    fields: [blogFeeds.companyId],
    references: [company.id],
  }),
  user: one(users, {
    fields: [blogFeeds.userId],
    references: [users.id],
  }),
  posts: many(blogPosts),
}))

export const blogPostsRelations = relations(blogPosts, ({ one }) => ({
  feed: one(blogFeeds, {
    fields: [blogPosts.feedId],
    references: [blogFeeds.id],
  }),
  release: one(releases, {
    fields: [blogPosts.releaseId],
    references: [releases.id],
  }),
}))
