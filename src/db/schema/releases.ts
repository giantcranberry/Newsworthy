import { pgTable, serial, varchar, text, boolean, timestamp, integer, doublePrecision, jsonb, unique } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './users'
import { company, contact, images, banners } from './company'

export const releases = pgTable('releases', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  companyId: integer('company_id').notNull().references(() => company.id),
  primaryContactId: integer('primary_contact_id').references(() => contact.id),
  primaryImageId: integer('primary_image_id').references(() => images.id),
  bannerId: integer('banner_id').references(() => banners.id),
  slug: varchar('slug', { length: 200 }),
  elasticDoc: varchar('elastic_doc', { length: 32 }),
  uuid: varchar('uuid', { length: 36 }).unique().notNull(),
  videoUrl: varchar('video_url', { length: 254 }),
  landingPage: text('landing_page'),
  title: varchar('title', { length: 180 }),
  publicDrive: text('public_drive'),
  clipped: boolean('clipped').default(false),
  esReindex: boolean('es_reindex').default(false),
  isFeatured: boolean('is_featured').default(false),
  isPinned: boolean('is_pinned').default(false),
  isArchived: boolean('is_archived').default(false),
  isDeleted: boolean('is_deleted').default(false),
  abstract: text('abstract'),
  selfHost: boolean('self_host').default(false),
  body: text('body'),
  pullquote: text('pullquote'),
  fir: boolean('fir').default(false),
  location: varchar('location', { length: 120 }),
  postalcode: varchar('postalcode', { length: 10 }),
  score: doublePrecision('score').default(0),
  editorialHold: boolean('editorial_hold').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  releaseAt: timestamp('release_at'),
  releasedAt: timestamp('released_at'),
  approvedAt: timestamp('approved_at'),
  timezone: varchar('timezone', { length: 32 }),
  fleschEase: doublePrecision('flesch_ease'),
  readTime: doublePrecision('read_time'),
  standardEase: doublePrecision('standard_ease'),
  status: varchar('status', { length: 10 }).default('start').notNull(),
  distribution: varchar('distribution', { length: 20 }),
  prhashId: varchar('prhash_id', { length: 42 }),
})

export const queue = pgTable('queue', {
  id: serial('id').primaryKey(),
  uuid: varchar('uuid', { length: 36 }).unique().notNull(),
  releaseId: integer('release_id').references(() => releases.id),
  editorId: integer('editor_id').references(() => users.id),
  editorName: varchar('editor_name', { length: 32 }).default(''),
  submitted: timestamp('submitted'),
  checkedout: timestamp('checkedout', { withTimezone: true }),
  approved: timestamp('approved'),
  returned: timestamp('returned'),
})

export const releaseEnhanced = pgTable('releases_enhanced', {
  id: serial('id').primaryKey(),
  prid: integer('prid').notNull().references(() => releases.id),
  createdAt: timestamp('created_at').defaultNow(),
  reportJson: jsonb('report_json'),
  reportUrl: varchar('report_url', { length: 255 }),
  ingestedAt: timestamp('ingested_at'),
})

export const releaseAnalysis = pgTable('release_analysis', {
  id: serial('id').primaryKey(),
  prId: integer('pr_id').notNull().references(() => releases.id, { onDelete: 'cascade' }).unique(),
  analysis: jsonb('analysis').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const releaseOptions = pgTable('release_options', {
  id: serial('id').primaryKey(),
  prId: integer('pr_id').notNull().unique(),
  userId: integer('user_id').notNull(),
  advocacy: boolean('advocacy').default(false),
  pitchlist: boolean('pitchlist').default(false),
  createdAt: timestamp('created_at').defaultNow(),
})

export const releaseNotes = pgTable('release_notes', {
  id: serial('id').primaryKey(),
  fromId: integer('from_id').notNull(),
  fromName: varchar('from_name', { length: 32 }).default(''),
  prId: integer('pr_id').notNull(),
  note: text('note'),
  isArchived: boolean('is_archived').default(false),
  createdAt: timestamp('created_at').defaultNow(),
})

export const approvals = pgTable('approvals', {
  id: serial('id').primaryKey(),
  uuid: varchar('uuid', { length: 36 }).unique().notNull(),
  releaseId: integer('release_id').notNull().references(() => releases.id),
  email: varchar('email', { length: 128 }),
  emailTo: varchar('email_to', { length: 64 }),
  signature: varchar('signature', { length: 64 }),
  requestedAt: timestamp('requested_at'),
  signedAt: timestamp('signed_at'),
  feedback: text('feedback'),
  approved: boolean('approved').default(false).notNull(),
  notes: text('notes'),
  companyId: integer('company_id').notNull().references(() => company.id).default(0),
  userId: integer('user_id').notNull().references(() => users.id),
})

export const translations = pgTable('translations', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  prId: integer('pr_id').notNull(),
  prUuid: varchar('pr_uuid', { length: 36 }).notNull(),
  elasticDoc: varchar('elastic_doc', { length: 32 }),
  uuid: varchar('uuid', { length: 36 }).unique().notNull(),
  slug: text('slug'),
  title: text('title'),
  abstract: text('abstract'),
  body: text('body'),
  links: text('links'),
  pullquote: text('pullquote'),
  dateline: text('dateline'),
  languageCode: varchar('language_code', { length: 6 }),
  createdAt: timestamp('created_at').defaultNow(),
  releaseAt: timestamp('release_at'),
  completionTokens: integer('completion_tokens'),
  promptTokens: integer('prompt_tokens'),
  totalTokens: integer('total_tokens'),
})

// Junction tables for many-to-many relationships
export const releaseFiles = pgTable('release_files', {
  releaseId: integer('release_id').notNull().references(() => releases.id),
  fileId: integer('file_id').notNull(),
})

export const releaseRegions = pgTable('release_regions', {
  releaseId: integer('release_id').notNull().references(() => releases.id),
  regionId: integer('region_id').notNull(),
})

export const releaseCategories = pgTable('release_categories', {
  releaseId: integer('release_id').notNull().references(() => releases.id),
  categoryId: integer('category_id').notNull(),
})

export const releaseCountries = pgTable('release_countries', {
  releaseId: integer('release_id').notNull().references(() => releases.id),
  countryId: integer('country_id').notNull(),
})

export const releasePayments = pgTable('release_payments', {
  releaseId: integer('release_id').notNull().references(() => releases.id),
  paymentId: integer('payment_id').notNull(),
})

export const releaseImages = pgTable('release_images', {
  id: serial('id').primaryKey(),
  releaseId: integer('release_id').notNull().references(() => releases.id, { onDelete: 'cascade' }),
  imageId: integer('image_id').notNull().references(() => images.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  unique().on(table.releaseId, table.imageId),
])

// Relations
export const releaseImagesRelations = relations(releaseImages, ({ one }) => ({
  release: one(releases, {
    fields: [releaseImages.releaseId],
    references: [releases.id],
  }),
  image: one(images, {
    fields: [releaseImages.imageId],
    references: [images.id],
  }),
}))

export const releasesRelations = relations(releases, ({ one, many }) => ({
  owner: one(users, {
    fields: [releases.userId],
    references: [users.id],
  }),
  company: one(company, {
    fields: [releases.companyId],
    references: [company.id],
  }),
  primaryContact: one(contact, {
    fields: [releases.primaryContactId],
    references: [contact.id],
  }),
  primaryImage: one(images, {
    fields: [releases.primaryImageId],
    references: [images.id],
  }),
  banner: one(banners, {
    fields: [releases.bannerId],
    references: [banners.id],
  }),
  queue: one(queue, {
    fields: [releases.id],
    references: [queue.releaseId],
  }),
  approvals: many(approvals),
  releaseNotes: many(releaseNotes),
  releaseImages: many(releaseImages),
}))

export const queueRelations = relations(queue, ({ one }) => ({
  release: one(releases, {
    fields: [queue.releaseId],
    references: [releases.id],
  }),
  editor: one(users, {
    fields: [queue.editorId],
    references: [users.id],
  }),
}))

export const approvalsRelations = relations(approvals, ({ one }) => ({
  release: one(releases, {
    fields: [approvals.releaseId],
    references: [releases.id],
  }),
  user: one(users, {
    fields: [approvals.userId],
    references: [users.id],
  }),
}))

export const releaseAnalysisRelations = relations(releaseAnalysis, ({ one }) => ({
  release: one(releases, {
    fields: [releaseAnalysis.prId],
    references: [releases.id],
  }),
}))
