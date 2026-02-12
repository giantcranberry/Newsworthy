import { pgTable, serial, varchar, text, boolean, timestamp, integer } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  partnerId: integer('partner_id').default(1),
  imPartnerId: integer('im_partner_id').default(1),
  managerFor: integer('manager_for'),
  email: varchar('email', { length: 254 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 128 }),
  referredBy: varchar('referred_by', { length: 128 }),
  token: varchar('token', { length: 32 }).unique(),
  registeredAs: varchar('registered_as', { length: 2 }),
  tokenExpiration: timestamp('token_expiration'),
  emailVerified: boolean('email_verified').default(false),
  isAdmin: boolean('is_admin').default(false).notNull(),
  isDeleted: boolean('is_deleted').default(false).notNull(),
  isSuper: boolean('is_super').default(false).notNull(),
  isEditor: boolean('is_editor').default(false).notNull(),
  isStaff: boolean('is_staff').default(false).notNull(),
  isAccounting: boolean('is_accounting').default(false).notNull(),
  isManager: boolean('is_manager').default(false).notNull(),
  isCircle: boolean('is_circle').default(false),
  scroll: boolean('scroll').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  lastSeen: timestamp('last_seen'),
  loginCount: integer('login_count'),
  extUserId: varchar('ext_user_id', { length: 48 }),
  timezone: varchar('timezone', { length: 48 }),
  regMethod: varchar('reg_method', { length: 10 }).default('email'),
  flashMsg: boolean('flash_msg').default(false),
})

export const userProfiles = pgTable('user_profiles', {
  id: serial('id').primaryKey(),
  acctName: varchar('acct_name', { length: 100 }),
  acctHandle: varchar('acct_handle', { length: 100 }),
  acctPromo: text('acct_promo'),
  addr1: varchar('addr1', { length: 100 }),
  addr2: varchar('addr2', { length: 100 }),
  avatar: text('avatar'),
  bio: text('bio'),
  city: varchar('city', { length: 60 }),
  company: varchar('company', { length: 128 }),
  countryCode: varchar('country_code', { length: 5 }),
  defaultdash: varchar('defaultdash', { length: 12 }).default(''),
  plan: integer('plan').default(0),
  sender: boolean('sender').default(true),
  reader: boolean('reader').default(false),
  journo: boolean('journo').default(false),
  traffic: boolean('traffic').default(false),
  newsdb: boolean('newsdb').default(false),
  influencer: boolean('influencer').default(false),
  stripe: varchar('stripe', { length: 128 }),
  firstName: varchar('first_name', { length: 48 }),
  lastName: varchar('last_name', { length: 48 }),
  state: varchar('state', { length: 2 }),
  province: varchar('province', { length: 48 }),
  postalCode: varchar('postal_code', { length: 10 }),
  locale: varchar('locale', { length: 6 }),
  phone: varchar('phone', { length: 20 }),
  mobile: varchar('mobile', { length: 20 }),
  twitter: varchar('twitter', { length: 64 }),
  linkedinUrl: varchar('linkedin_url', { length: 256 }),
  userId: integer('user_id').notNull().references(() => users.id),
  nrdirect: boolean('nrdirect').default(false),
  newsrampApi: varchar('newsramp_api', { length: 64 }),
})

export const userSubscription = pgTable('user_subscription', {
  id: serial('id').primaryKey(),
  planId: integer('plan_id').default(0),
  userId: integer('user_id').notNull().references(() => users.id),
  name: varchar('name', { length: 48 }),
  includedPr: integer('included_pr').default(0),
  remainingPr: integer('remaining_pr').default(0),
  remainingPluspr: integer('remaining_pluspr').default(0),
  includedCo: integer('included_co').default(0),
  newsdbCredits: integer('newsdb_credits').default(10),
  hasImSpend: boolean('has_im_spend').default(true),
  creditsPerPr: integer('credits_per_pr').default(0),
  dfyCost: integer('dfy_cost').default(0),
  creditCost: integer('credit_cost').default(115),
  pressLists: integer('press_lists').default(0),
  newsdb: boolean('newsdb').default(false),
  planCost: integer('plan_cost').default(0),
  prCost: integer('pr_cost').default(0),
  commission: integer('commission').default(0),
  monthly: integer('monthly').default(0),
  startAt: timestamp('start_at').defaultNow().notNull(),
})

export const verify = pgTable('verify', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  uuid: varchar('uuid', { length: 32 }).notNull(),
  verified: boolean('verified').default(false),
  smsVerifyCode: varchar('sms_verify_code', { length: 6 }),
  smsConsent: boolean('sms_consent').default(false),
  smsCell: varchar('sms_cell', { length: 20 }),
  verifiedBy: varchar('verified_by', { length: 5 }),
  createdAt: timestamp('created_at').defaultNow(),
})

export const journalists = pgTable('journalists', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  title: varchar('title', { length: 48 }),
})

export const oauth = pgTable('oauth', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  provider: varchar('provider', { length: 50 }),
  providerUserId: varchar('provider_user_id', { length: 256 }),
  vanity: varchar('vanity', { length: 128 }),
  headline: varchar('headline', { length: 128 }),
  bio: text('bio'),
  token: text('token'),
  tokenSecret: text('token_secret'),
  createdAt: timestamp('created_at').defaultNow(),
})

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(userProfiles, {
    fields: [users.id],
    references: [userProfiles.userId],
  }),
  subscription: one(userSubscription, {
    fields: [users.id],
    references: [userSubscription.userId],
  }),
  journalist: one(journalists, {
    fields: [users.id],
    references: [journalists.userId],
  }),
}))
