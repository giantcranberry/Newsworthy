import {
  pgTable,
  serial,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  bigint,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import { company } from './company'
import { users } from './users'
import { releases } from './releases'

export const podcastFeeds = pgTable(
  'podcast_feeds',
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
    itunesCategory: varchar('itunes_category', { length: 128 }),
    lastFetchedAt: timestamp('last_fetched_at'),
    lastEpisodePublishedAt: timestamp('last_episode_published_at'),
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
    // Last time the cron sent a "podcast PR credits needed" warning to this
    // feed's owner. Used as a 24h cooldown so the user isn't spammed on every
    // tick when their effective balance is depleted. Cleared back to NULL as
    // soon as the effective balance recovers.
    fundingWarningSentAt: timestamp('funding_warning_sent_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('podcast_feeds_company_live_uidx')
      .on(table.companyId)
      .where(sql`${table.isDeleted} = false`),
    index('podcast_feeds_user_id_idx').on(table.userId),
  ],
)

export const podcastEpisodes = pgTable(
  'podcast_episodes',
  {
    id: serial('id').primaryKey(),
    uuid: varchar('uuid', { length: 36 }).unique().notNull(),
    feedId: integer('feed_id').notNull().references(() => podcastFeeds.id, { onDelete: 'cascade' }),
    guid: varchar('guid', { length: 512 }).notNull(),
    title: varchar('title', { length: 512 }),
    description: text('description'),
    audioUrl: text('audio_url'),
    audioType: varchar('audio_type', { length: 64 }),
    audioLengthBytes: bigint('audio_length_bytes', { mode: 'number' }),
    durationSeconds: integer('duration_seconds'),
    episodeNumber: integer('episode_number'),
    seasonNumber: integer('season_number'),
    episodeType: varchar('episode_type', { length: 16 }),
    imageUrl: text('image_url'),
    chaptersUrl: text('chapters_url'),
    link: text('link'),
    publishedAt: timestamp('published_at'),
    explicit: boolean('explicit').default(false).notNull(),
    skip: boolean('skip').default(false).notNull(),
    audioStorageUrl: text('audio_storage_url'),
    audioDownloadedAt: timestamp('audio_downloaded_at'),
    transcriptionStatus: varchar('transcription_status', { length: 20 }).default('pending').notNull(),
    transcriptionError: text('transcription_error'),
    transcribedAt: timestamp('transcribed_at'),
    releaseId: integer('release_id').references(() => releases.id),
    processedAt: timestamp('processed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('podcast_episodes_feed_guid_uidx').on(table.feedId, table.guid),
    index('podcast_episodes_feed_published_idx').on(table.feedId, table.publishedAt),
  ],
)

export const podcastEpisodeTranscripts = pgTable('podcast_episode_transcripts', {
  id: serial('id').primaryKey(),
  uuid: varchar('uuid', { length: 36 }).unique().notNull(),
  episodeId: integer('episode_id')
    .notNull()
    .unique()
    .references(() => podcastEpisodes.id, { onDelete: 'cascade' }),
  provider: varchar('provider', { length: 32 }).notNull(),
  model: varchar('model', { length: 64 }),
  language: varchar('language', { length: 16 }),
  text: text('text').notNull(),
  segments: jsonb('segments'),
  providerResponse: jsonb('provider_response'),
  durationSeconds: integer('duration_seconds'),
  costCents: integer('cost_cents'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const podcastFeedsRelations = relations(podcastFeeds, ({ one, many }) => ({
  company: one(company, {
    fields: [podcastFeeds.companyId],
    references: [company.id],
  }),
  user: one(users, {
    fields: [podcastFeeds.userId],
    references: [users.id],
  }),
  episodes: many(podcastEpisodes),
}))

export const podcastEpisodesRelations = relations(podcastEpisodes, ({ one }) => ({
  feed: one(podcastFeeds, {
    fields: [podcastEpisodes.feedId],
    references: [podcastFeeds.id],
  }),
  release: one(releases, {
    fields: [podcastEpisodes.releaseId],
    references: [releases.id],
  }),
  transcript: one(podcastEpisodeTranscripts, {
    fields: [podcastEpisodes.id],
    references: [podcastEpisodeTranscripts.episodeId],
  }),
}))

export const podcastEpisodeTranscriptsRelations = relations(podcastEpisodeTranscripts, ({ one }) => ({
  episode: one(podcastEpisodes, {
    fields: [podcastEpisodeTranscripts.episodeId],
    references: [podcastEpisodes.id],
  }),
}))
