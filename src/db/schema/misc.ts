import { pgTable, serial, varchar, text, boolean, timestamp, integer, bigint, json } from 'drizzle-orm/pg-core'
import { users } from './users'
import { company } from './company'
import { releases } from './releases'

// Reader engagement
export const followedCompanies = pgTable('followed_companies', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  userId: integer('user_id').references(() => users.id),
  coId: integer('co_id').references(() => company.id),
})

export const newsLike = pgTable('news_like', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  userId: integer('user_id').references(() => users.id),
  prId: integer('pr_id').references(() => releases.id),
})

export const newsBookmark = pgTable('news_bookmark', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  userId: integer('user_id').references(() => users.id),
  prId: integer('pr_id').references(() => releases.id),
})

// Subscriptions
export const listSubscriptions = pgTable('list_subscriptions', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').notNull().references(() => company.id),
  userId: integer('user_id'),
  email: varchar('email', { length: 256 }).notNull(),
  listName: varchar('list_name', { length: 64 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const smsSubscriptions = pgTable('sms_subscriptions', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').notNull().references(() => company.id),
  userId: integer('user_id'),
  cell: varchar('cell', { length: 15 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

// URL shortener
export const tinyUrl = pgTable('tiny_url', {
  id: serial('id').primaryKey(),
  coId: integer('co_id'),
  prId: integer('pr_id'),
  userId: integer('user_id'),
  ormId: integer('orm_id'),
  advocatId: integer('advocat_id'),
  influencerId: integer('influencer_id'),
  emailListId: integer('email_list_id'),
  mpId: integer('mp_id'),
  hits: integer('hits').default(0),
  url: text('url').notNull(),
  cohort: varchar('cohort', { length: 12 }),
  handle: varchar('handle', { length: 20 }),
  campaign: varchar('campaign', { length: 20 }),
  campaignId: integer('campaign_id'),
  utm: varchar('utm', { length: 32 }),
  target: varchar('target', { length: 128 }),
  createdAt: timestamp('created_at').defaultNow(),
})

// Messages and notes
export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  fromId: integer('from_id').notNull(),
  fromName: varchar('from_name', { length: 32 }).default(''),
  toId: integer('to_id').notNull(),
  prId: integer('pr_id'),
  offerId: integer('offer_id'),
  subject: text('subject'),
  body: text('body'),
  isArchived: boolean('is_archived').default(false),
  createdAt: timestamp('created_at').defaultNow(),
})

export const staffNotes = pgTable('staff_notes', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  staffName: varchar('staff_name', { length: 32 }).default(''),
  prId: integer('pr_id'),
  offerId: integer('offer_id'),
  body: text('body'),
  isArchived: boolean('is_archived').default(false),
  createdAt: timestamp('created_at').defaultNow(),
})

export const cannedMsgs = pgTable('canned_msgs', {
  id: serial('id').primaryKey(),
  route: varchar('route', { length: 32 }).notNull(),
  handle: varchar('handle', { length: 64 }).notNull(),
  msg: text('msg').notNull(),
  createdBy: integer('created_by').notNull(),
})

// Help content
export const helpMsgs = pgTable('help_msgs', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 12 }),
  module: varchar('module', { length: 15 }),
  title: varchar('title', { length: 128 }),
  msg: text('msg'),
})

// Analytics and reporting
export const clipReport = pgTable('clip_report', {
  id: serial('id').primaryKey(),
  releaseId: integer('release_id').references(() => releases.id),
  md5FqDomain: varchar('md5_fq_domain', { length: 32 }),
  name: varchar('name', { length: 64 }),
  network: varchar('network', { length: 16 }),
  city: varchar('city', { length: 48 }),
  state: varchar('state'),
  worker: varchar('worker', { length: 36 }),
  logo: text('logo'),
  link: text('link'),
  thumbnail: text('thumbnail'),
  thumbStatus: integer('thumb_status'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const clipImage = pgTable('clip_image', {
  id: serial('id').primaryKey(),
  fqDomain: varchar('fq_domain', { length: 64 }),
  md5FqDomain: varchar('md5_fq_domain', { length: 32 }),
  imageUrl: text('image_url'),
  status: integer('status'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const trending = pgTable('trending', {
  id: serial('id').primaryKey(),
  prId: integer('pr_id').references(() => releases.id),
  current: integer('current'),
  previous: integer('previous'),
  movement: integer('movement'),
  releasedAt: timestamp('released_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const elasticdocs = pgTable('elasticdocs', {
  id: serial('id').primaryKey(),
  releaseId: integer('release_id').notNull(),
  docId: varchar('doc_id', { length: 24 }).notNull(),
  indexName: varchar('index_name', { length: 32 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

// Misc
export const returnRoutes = pgTable('return_routes', {
  id: serial('id').primaryKey(),
  userId: integer('user_id'),
  url: varchar('url', { length: 200 }),
})

export const postQueue = pgTable('post_queue', {
  id: serial('id').primaryKey(),
  prid: integer('prid').notNull(),
  target: varchar('target', { length: 32 }).notNull(),
  subTarget: varchar('sub_target', { length: 32 }),
  msg: text('msg'),
  releaseAt: timestamp('release_at'),
  completedAt: timestamp('completed_at'),
})

export const postTargets = pgTable('post_targets', {
  id: serial('id').primaryKey(),
  target: varchar('target', { length: 32 }).notNull(),
  subTarget: varchar('sub_target', { length: 32 }),
  description: varchar('description', { length: 64 }),
})

export const distNetworks = pgTable('dist_networks', {
  id: serial('id').primaryKey(),
  network: varchar('network', { length: 32 }).notNull(),
  subNetwork: varchar('sub_network', { length: 32 }),
  apiUrl: text('api_url'),
  resultType: varchar('result_type', { length: 8 }).default('json'),
  createdAt: timestamp('created_at').defaultNow(),
  isActive: boolean('is_active').default(false),
})

export const newsramp = pgTable('newsramp', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  uuid: varchar('uuid', { length: 36 }).unique().notNull(),
  headline: text('headline'),
  content: text('content'),
  imageUrl: varchar('image_url', { length: 254 }),
  sourceUrl: text('source_url'),
  createdAt: timestamp('created_at'),
  md5Permalink: varchar('md5_permalink', { length: 40 }),
})

export const blockchain = pgTable('blockchain', {
  id: serial('id').primaryKey(),
  prid: integer('prid').notNull(),
  pruuid: varchar('pruuid', { length: 36 }).notNull(),
  userId: integer('user_id').notNull(),
  chain: varchar('chain', { length: 32 }).notNull(),
  contract: varchar('contract', { length: 128 }).notNull(),
  txid: varchar('txid', { length: 128 }).notNull(),
  redirectUrl: text('redirect_url'),
  selfHostDomain: varchar('self_host_domain', { length: 120 }),
  account: varchar('account', { length: 128 }).notNull(),
  fingerprint: varchar('fingerprint', { length: 64 }).notNull(),
  gasUsed: integer('gas_used'),
  qrcode: varchar('qrcode', { length: 255 }),
  mp3: varchar('mp3', { length: 255 }),
  stripped: text('stripped'),
  incoming: text('incoming'),
  hitcount: integer('hitcount').default(0),
  createdAt: timestamp('created_at').defaultNow(),
})

export const crawlerFilters = pgTable('crawler_filters', {
  id: serial('id').primaryKey(),
  filterType: varchar('filter_type', { length: 60 }),
  filterString: varchar('filter_string', { length: 60 }),
})

export const processControl = pgTable('process_control', {
  id: serial('id').primaryKey(),
  cohort: varchar('cohort', { length: 12 }),
  handle: varchar('handle', { length: 36 }).unique(),
  latest: timestamp('latest'),
  settings: json('settings'),
})

// Email and outreach
export const emailLists = pgTable('email_lists', {
  id: serial('id').primaryKey(),
  uuid: varchar('uuid', { length: 36 }).unique(),
  originatorId: integer('originator_id'),
  listName: varchar('list_name', { length: 48 }),
  isDeleted: boolean('is_deleted').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  description: text('description'),
  source: varchar('source', { length: 64 }),
  latest: timestamp('latest'),
})

export const emailData = pgTable('email_data', {
  id: serial('id').primaryKey(),
  listId: integer('list_id'),
  email: varchar('email', { length: 128 }),
  emailsSent: integer('emails_sent').default(0),
  emailMd5: varchar('email_md5', { length: 32 }),
  uuid: varchar('uuid', { length: 40 }),
  firstName: varchar('first_name', { length: 48 }),
  lastName: varchar('last_name', { length: 48 }),
  isDeleted: boolean('is_deleted').default(false),
  company: varchar('company', { length: 128 }),
  title: varchar('title', { length: 256 }),
  titleLevel: varchar('title_level', { length: 128 }),
  job: varchar('job', { length: 128 }),
  cell: varchar('cell', { length: 20 }),
  source: varchar('source', { length: 64 }),
  sourceId: varchar('source_id', { length: 64 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  unsubscribeAt: timestamp('unsubscribe_at'),
  lastOpenAt: timestamp('last_open_at'),
  bouncedAt: timestamp('bounced_at'),
  latest: timestamp('latest'),
})

export const emailCampaigns = pgTable('email_campaigns', {
  id: serial('id').primaryKey(),
  userId: integer('user_id'),
  listId: integer('list_id'),
  coId: integer('co_id'),
  prId: integer('pr_id'),
  otag: varchar('otag', { length: 36 }),
  uuid: varchar('uuid', { length: 36 }).unique(),
  name: varchar('name', { length: 228 }),
  limit: integer('limit'),
  content: text('content').notNull(),
  subject: varchar('subject', { length: 128 }).notNull(),
  template: varchar('template', { length: 64 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
})

export const outreachGroups = pgTable('outreach_groups', {
  id: serial('id').primaryKey(),
  uuid: varchar('uuid', { length: 36 }).unique(),
  groupName: varchar('group_name', { length: 48 }),
  inviteMsg: text('invite_msg'),
  isDeleted: boolean('is_deleted').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  latest: timestamp('latest'),
})

export const outreachMembers = pgTable('outreach_members', {
  id: serial('id').primaryKey(),
  groupId: integer('group_id'),
  uuid: varchar('uuid', { length: 36 }).unique(),
  email: varchar('email', { length: 128 }),
  md5: varchar('md5', { length: 32 }),
  firstName: varchar('first_name', { length: 48 }),
  lastName: varchar('last_name', { length: 48 }),
  fullName: varchar('full_name', { length: 128 }),
  description: varchar('description', { length: 128 }),
  isDeleted: boolean('is_deleted').default(false),
  emailCount: integer('email_count').default(0),
  unsubscribeAt: timestamp('unsubscribe_at'),
  lastOpenAt: timestamp('last_open_at'),
  bouncedAt: timestamp('bounced_at'),
  latest: timestamp('latest'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const outreachCampaigns = pgTable('outreach_campaigns', {
  id: serial('id').primaryKey(),
  userId: integer('user_id'),
  groupId: integer('group_id'),
  uuid: varchar('uuid', { length: 36 }).unique(),
  name: varchar('name', { length: 228 }),
  prId: integer('pr_id'),
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
})

// Profile regions/categories junction tables
export const profileRegions = pgTable('profile_regions', {
  userId: integer('user_id').notNull().references(() => users.id),
  regionId: integer('region_id').notNull(),
})

export const profileCategories = pgTable('profile_categories', {
  userId: integer('user_id').notNull().references(() => users.id),
  categoryId: integer('category_id').notNull(),
})

export const brandCredits = pgTable('brand_credits', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  companyId: integer('company_id').references(() => company.id),
  prId: integer('pr_id').references(() => releases.id),
  credits: integer('credits').notNull().default(0),
  productType: varchar('product_type', { length: 36 }),
  notes: varchar('notes', { length: 48 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
