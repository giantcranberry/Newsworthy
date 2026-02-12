import { pgTable, serial, varchar, text, boolean, timestamp, integer, doublePrecision } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './users'
import { releases } from './releases'
import { activities } from './taxonomy'
import { partners } from './partners'

export const influencer = pgTable('influencer', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  uuid: varchar('uuid', { length: 36 }),
  avatar: text('avatar'),
  name: varchar('name', { length: 64 }),
  bio: text('bio'),
  completedJobs: integer('completed_jobs'),
  cell: varchar('cell', { length: 20 }),
  altemail: varchar('altemail', { length: 128 }),
})

export const influencerInventory = pgTable('influencer_inventory', {
  id: serial('id').primaryKey(),
  uuid: varchar('uuid', { length: 36 }),
  influencerId: integer('influencer_id').references(() => influencer.id),
  userId: integer('user_id').references(() => users.id),
  imPartnerId: integer('im_partner_id').references(() => partners.id),
  activityId: integer('activity_id').references(() => activities.id),
  elasticDoc: varchar('elastic_doc', { length: 32 }),
  threshold: integer('threshold').default(500).notNull(),
  score: doublePrecision('score').default(0).notNull(),
  status: varchar('status', { length: 12 }),
  url: varchar('url', { length: 128 }),
  reach: varchar('reach', { length: 128 }),
  nwStatement: varchar('nw_statement', { length: 128 }),
  handle: varchar('handle', { length: 128 }),
  bio: text('bio'),
  description: text('description'),
  audienceSize: integer('audience_size'),
  audienceType: varchar('audience_type', { length: 48 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  isActive: boolean('is_active').default(false),
  isArchived: boolean('is_archived').default(false),
  isDeleted: boolean('is_deleted').default(false),
})

export const queueMp = pgTable('queue_mp', {
  id: serial('id').primaryKey(),
  uuid: varchar('uuid', { length: 36 }).unique().notNull(),
  offerId: integer('offer_id').references(() => influencerInventory.id),
  editorId: integer('editor_id').references(() => users.id),
  influencerId: integer('influencer_id'),
  editorName: varchar('editor_name', { length: 32 }).default(''),
  submitted: timestamp('submitted'),
  checkedout: timestamp('checkedout', { withTimezone: true }),
  approved: timestamp('approved'),
  returned: timestamp('returned'),
})

export const mpRequests = pgTable('mp_requests', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  serviceId: integer('service_id').references(() => influencerInventory.id),
  influencerId: integer('influencer_id').references(() => influencer.id),
  prId: integer('pr_id').references(() => releases.id),
  uuid: varchar('uuid', { length: 36 }).unique(),
  offer: integer('offer'),
  internalNote: varchar('internal_note', { length: 255 }).default(''),
  msg: text('msg'),
  sellerMsg: text('seller_msg'),
  createdAt: timestamp('created_at').defaultNow(),
  sellerAccept: timestamp('seller_accept'),
  sellerDecline: timestamp('seller_decline'),
  buyerAccept: timestamp('buyer_accept'),
  buyerApproved: timestamp('buyer_approved'),
  buyerWithdrawn: timestamp('buyer_withdrawn'),
  delivered: timestamp('delivered'),
  delivery: timestamp('delivery'),
  deliveryUrl: text('delivery_url'),
  taskComplete: timestamp('task_complete'),
  offerExpired: timestamp('offer_expired'),
  shareUrl: varchar('share_url', { length: 64 }),
})

export const mpMessages = pgTable('mp_messages', {
  id: serial('id').primaryKey(),
  fromId: integer('from_id').notNull(),
  fromName: varchar('from_name', { length: 32 }).default(''),
  fromEmail: varchar('from_email', { length: 128 }).default(''),
  toId: integer('to_id').notNull(),
  toName: varchar('to_name', { length: 32 }).default(''),
  toEmail: varchar('to_email', { length: 128 }).default(''),
  projectId: integer('project_id').references(() => mpRequests.id),
  msgSubject: varchar('msg_subject', { length: 64 }).notNull(),
  smsMsg: text('sms_msg'),
  emailMsg: text('email_msg'),
  emailTemplate: varchar('email_template', { length: 64 }),
  file: text('file'),
  msgRead: timestamp('msg_read'),
  emailSent: timestamp('email_sent'),
  smsSent: timestamp('sms_sent'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const mpFunds = pgTable('mp_funds', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  prId: integer('pr_id').references(() => releases.id),
  influencerId: integer('influencer_id'),
  usedFor: integer('used_for'),
  requestId: integer('request_id'),
  amount: integer('amount').notNull(),
  cost: integer('cost'),
  internalNote: varchar('internal_note', { length: 255 }).default(''),
  paidVia: varchar('paid_via', { length: 32 }).default(''),
  nomen: varchar('nomen', { length: 32 }).default(''),
  createdAt: timestamp('created_at').defaultNow(),
  expireAt: timestamp('expire_at'),
  paid: timestamp('paid'),
})

export const mpRequestLog = pgTable('mp_request_log', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  requestId: integer('request_id').references(() => mpRequests.id),
  prId: integer('pr_id').references(() => releases.id),
  msg: text('msg'),
  actionTaken: varchar('action_taken', { length: 36 }),
  actionBy: varchar('action_by', { length: 10 }),
  actionUserid: integer('action_userid'),
  baccessUrl: varchar('baccess_url', { length: 40 }),
  saccessUrl: varchar('saccess_url', { length: 40 }),
  notifiedAt: timestamp('notified_at'),
  notifyStatus: varchar('notify_status', { length: 64 }),
  createdAt: timestamp('created_at').defaultNow(),
})

export const mpInvite = pgTable('mp_invite', {
  id: serial('id').primaryKey(),
  uuid: varchar('uuid', { length: 36 }).unique().notNull(),
  coId: integer('co_id'),
  partnerId: integer('partner_id'),
  prId: integer('pr_id'),
  userId: integer('user_id'),
  invitedUserId: integer('invited_user_id'),
  mpId: integer('mp_id'),
  influencerId: integer('influencer_id'),
  email: varchar('email', { length: 128 }),
  linkedin: text('linkedin'),
  name: varchar('name', { length: 64 }),
  msg: text('msg'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const mpPrefs = pgTable('mp_prefs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  influencerId: integer('influencer_id'),
  hidden: boolean('hidden').default(false),
  favorite: boolean('favorite').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at'),
})

// Junction tables
export const inventoryCategories = pgTable('inventory_categories', {
  inventoryId: integer('inventory_id').notNull().references(() => influencerInventory.id),
  categoryId: integer('category_id').notNull(),
})

export const inventoryRegions = pgTable('inventory_regions', {
  inventoryId: integer('inventory_id').notNull().references(() => influencerInventory.id),
  regionId: integer('region_id').notNull(),
})

// Relations
export const influencerRelations = relations(influencer, ({ one, many }) => ({
  user: one(users, {
    fields: [influencer.userId],
    references: [users.id],
  }),
  inventory: many(influencerInventory),
}))

export const influencerInventoryRelations = relations(influencerInventory, ({ one }) => ({
  influencer: one(influencer, {
    fields: [influencerInventory.influencerId],
    references: [influencer.id],
  }),
  activity: one(activities, {
    fields: [influencerInventory.activityId],
    references: [activities.id],
  }),
}))

export const mpRequestsRelations = relations(mpRequests, ({ one, many }) => ({
  user: one(users, {
    fields: [mpRequests.userId],
    references: [users.id],
  }),
  service: one(influencerInventory, {
    fields: [mpRequests.serviceId],
    references: [influencerInventory.id],
  }),
  influencer: one(influencer, {
    fields: [mpRequests.influencerId],
    references: [influencer.id],
  }),
  release: one(releases, {
    fields: [mpRequests.prId],
    references: [releases.id],
  }),
  messages: many(mpMessages),
  logs: many(mpRequestLog),
}))

export const mpMessagesRelations = relations(mpMessages, ({ one }) => ({
  project: one(mpRequests, {
    fields: [mpMessages.projectId],
    references: [mpRequests.id],
  }),
}))
