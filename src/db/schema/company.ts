import { pgTable, serial, varchar, text, boolean, timestamp, integer, jsonb } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './users'

export const company = pgTable('company', {
  id: serial('id').primaryKey(),
  uuid: varchar('uuid', { length: 36 }).unique().notNull(),
  userId: integer('user_id').notNull().references(() => users.id),
  firstName: varchar('first_name', { length: 48 }),
  lastName: varchar('last_name', { length: 48 }),
  title: varchar('title', { length: 48 }),
  companyName: varchar('company_name', { length: 100 }).notNull(),
  nrUri: varchar('nr_uri', { length: 32 }),
  nrTitle: varchar('nr_title', { length: 128 }),
  nrDesc: text('nr_desc'),
  logoUrl: text('logo_url'),
  website: varchar('website', { length: 128 }),
  stripe: varchar('stripe', { length: 128 }),
  shopify: varchar('shopify', { length: 128 }),
  addr1: varchar('addr1', { length: 100 }),
  addr2: varchar('addr2', { length: 100 }),
  city: varchar('city', { length: 60 }),
  state: varchar('state', { length: 2 }),
  province: varchar('province', { length: 48 }),
  timezone: varchar('timezone', { length: 48 }),
  isArchived: boolean('is_archived').default(false),
  isDeleted: boolean('is_deleted').default(false),
  trustedRedirects: boolean('trusted_redirects').default(false),
  postalCode: varchar('postal_code', { length: 10 }),
  phone: varchar('phone', { length: 30 }),
  countryCode: varchar('country_code', { length: 5 }),
  email: varchar('email', { length: 128 }),
  gmb: text('gmb'),
  linkedinUrl: varchar('linkedin_url', { length: 255 }),
  xUrl: varchar('x_url', { length: 255 }),
  youtubeUrl: varchar('youtube_url', { length: 255 }),
  instagramUrl: varchar('instagram_url', { length: 255 }),
  blogUrl: varchar('blog_url', { length: 255 }),
  googleDriveUrl: varchar('google_drive_url', { length: 500 }),
  dropboxUrl: varchar('dropbox_url', { length: 500 }),
  boxUrl: varchar('box_url', { length: 500 }),
  agencyName: varchar('agency_name', { length: 128 }),
  agencyContactName: varchar('agency_contact_name', { length: 128 }),
  agencyContactPhone: varchar('agency_contact_phone', { length: 30 }),
  agencyContactEmail: varchar('agency_contact_email', { length: 128 }),
  agencyWebsite: varchar('agency_website', { length: 128 }),
  jsonLd: jsonb('json_ld'),
  seo: jsonb('seo'),
})

export const contact = pgTable('contact', {
  id: serial('id').primaryKey(),
  uuid: varchar('uuid', { length: 36 }),
  userId: integer('user_id').notNull().references(() => users.id),
  companyId: integer('company_id').notNull().references(() => company.id),
  name: varchar('name', { length: 64 }).notNull(),
  title: varchar('title', { length: 128 }),
  phone: varchar('phone', { length: 30 }),
  email: varchar('email', { length: 128 }),
  isArchived: boolean('is_archived').default(false),
  isDeleted: boolean('is_deleted').default(false),
})

export const images = pgTable('images', {
  id: serial('id').primaryKey(),
  uuid: varchar('uuid', { length: 36 }).unique().notNull(),
  userId: integer('user_id').notNull().references(() => users.id),
  companyId: integer('company_id').notNull().references(() => company.id),
  caption: text('caption'),
  title: varchar('title', { length: 255 }),
  source: varchar('source', { length: 32 }),
  sourceLink: varchar('source_link', { length: 128 }),
  url: text('url').notNull(),
  imgCredits: varchar('img_credits', { length: 128 }),
  width: integer('width'),
  height: integer('height'),
  ratio: integer('ratio').default(0),
  filesize: integer('filesize'),
  isArchived: boolean('is_archived').default(false),
  isDeleted: boolean('is_deleted').default(false),
})

export const files = pgTable('files', {
  id: serial('id').primaryKey(),
  uuid: varchar('uuid', { length: 36 }).unique().notNull(),
  userId: integer('user_id').notNull().references(() => users.id),
  companyId: integer('company_id').notNull().references(() => company.id),
  description: text('description'),
  title: varchar('title', { length: 64 }).notNull(),
  url: text('url').notNull(),
  isArchived: boolean('is_archived').default(false),
  isDeleted: boolean('is_deleted').default(false),
})

export const banners = pgTable('banners', {
  id: serial('id').primaryKey(),
  uuid: varchar('uuid', { length: 36 }).unique().notNull(),
  userId: integer('user_id').notNull().references(() => users.id),
  companyId: integer('company_id').notNull().references(() => company.id),
  caption: text('caption'),
  title: varchar('title', { length: 255 }),
  source: varchar('source', { length: 32 }),
  sourceLink: varchar('source_link', { length: 128 }),
  url: text('url').notNull(),
  cdnUrl: text('cdn_url'),
  frontPageUrl: text('front_page_url'),
  imgCredits: varchar('img_credits', { length: 128 }),
  width: integer('width'),
  height: integer('height'),
  ratio: integer('ratio').default(0),
  filesize: integer('filesize'),
  isArchived: boolean('is_archived').default(false),
  isDeleted: boolean('is_deleted').default(false),
})

export const socials = pgTable('socials', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 48 }),
  userId: integer('user_id').notNull().references(() => users.id),
  companyId: integer('company_id').references(() => company.id),
  journoId: integer('journo_id'),
  platform: varchar('platform', { length: 48 }),
  identity: varchar('identity', { length: 254 }),
  isArchived: boolean('is_archived').default(false),
  isDeleted: boolean('is_deleted').default(false),
})

export const newsroomRedirects = pgTable('newsroom_redirects', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').notNull().references(() => company.id, { onDelete: 'cascade' }),
  oldUri: varchar('old_uri', { length: 32 }).notNull(),
  newUri: varchar('new_uri', { length: 32 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

// Relations
export const companyRelations = relations(company, ({ one, many }) => ({
  owner: one(users, {
    fields: [company.userId],
    references: [users.id],
  }),
  contacts: many(contact),
  images: many(images),
  banners: many(banners),
  socials: many(socials),
}))

export const contactRelations = relations(contact, ({ one }) => ({
  company: one(company, {
    fields: [contact.companyId],
    references: [company.id],
  }),
}))

export const imagesRelations = relations(images, ({ one }) => ({
  company: one(company, {
    fields: [images.companyId],
    references: [company.id],
  }),
}))
