import { pgTable, serial, varchar, text, boolean, timestamp, integer } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './users'

export const partners = pgTable('partners', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  parent: integer('parent'),
  handle: varchar('handle', { length: 25 }),
  company: varchar('company', { length: 64 }),
  contactName: varchar('contact_name', { length: 64 }),
  addr1: varchar('addr1', { length: 64 }),
  addr2: varchar('addr2', { length: 64 }),
  csz: varchar('csz', { length: 128 }),
  phone: varchar('phone', { length: 25 }),
  contactEmail: varchar('contact_email', { length: 128 }),
  email: varchar('email', { length: 128 }),
  ein: varchar('ein', { length: 9 }),
  logo: varchar('logo', { length: 256 }),
  brandName: varchar('brand_name', { length: 64 }),
  backfill: varchar('backfill', { length: 20 }),
  feedLength: integer('feed_length'),
  basePrice: integer('base_price'),
  includeNewsdb: boolean('include_newsdb').default(true),
  partnerType: varchar('partner_type', { length: 15 }),
  offerCopy: text('offer_copy'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  publisherUrl: varchar('publisher_url', { length: 128 }),
  isDeleted: boolean('is_deleted').default(false),
  isActive: boolean('is_active').default(false),
  referredBy: varchar('referred_by', { length: 36 }),
  appkey: varchar('appkey', { length: 128 }),
  appsecret: varchar('appsecret', { length: 128 }),
  apptoken: varchar('apptoken', { length: 128 }),
  freePrs: integer('free_prs').default(0),
})

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  partnerId: integer('partner_id'),
  userId: integer('user_id').references(() => users.id),
  shortName: varchar('short_name', { length: 22 }),
  displayName: varchar('display_name', { length: 36 }),
  description: text('description'),
  label: varchar('label', { length: 20 }),
  icon: varchar('icon', { length: 32 }),
  stripeTest: varchar('stripe_test', { length: 64 }),
  stripeLive: varchar('stripe_live', { length: 64 }),
  stripeTestPrice: varchar('stripe_test_price', { length: 64 }),
  stripeLivePrice: varchar('stripe_live_price', { length: 64 }),
  price: integer('price').notNull(),
  partnerShare: integer('partner_share').notNull(),
  productType: varchar('product_type', { length: 12 }),
  productCredits: integer('product_credits'),
  isDeleted: boolean('is_deleted').default(false),
  isActive: boolean('is_active').default(false),
  isPrimary: boolean('is_primary').default(false),
  isUpgrade: boolean('is_upgrade').default(false),
  isSoloUpgrade: boolean('is_solo_upgrade').default(false),
  serviceRoute: varchar('service_route', { length: 48 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const subscriptionPlans = pgTable('subscription_plans', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 48 }),
  includedPr: integer('included_pr').default(0),
  includedCo: integer('included_co').default(0),
  hasImSpend: boolean('has_im_spend').default(true),
  creditsPerPr: integer('credits_per_pr').default(0),
  dfyCost: integer('dfy_cost').default(0),
  creditCost: integer('credit_cost').default(115),
  pressLists: integer('press_lists').default(0),
  newsdb: boolean('newsdb').default(false),
  isActive: boolean('is_active').default(true),
  isPublic: boolean('is_public').default(true),
  prCost: integer('pr_cost').default(0),
  planCost: integer('plan_cost').default(0),
  commission: integer('commission').default(0),
  monthly: integer('monthly').default(0),
})

export const coupons = pgTable('coupons', {
  id: serial('id').primaryKey(),
  createdBy: integer('created_by'),
  partnerId: integer('partner_id'),
  redeemed: integer('redeemed').default(0),
  couponCode: varchar('coupon_code', { length: 32 }),
  campaign: varchar('campaign', { length: 64 }),
  prCount: integer('pr_count').default(1).notNull(),
  isDeleted: boolean('is_deleted').default(false),
  singleUse: boolean('single_use').default(false),
  isUsed: boolean('is_used').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at'),
  email: varchar('email', { length: 128 }),
})

export const couponLog = pgTable('coupon_log', {
  id: serial('id').primaryKey(),
  userId: integer('user_id'),
  couponCode: varchar('coupon_code', { length: 32 }),
  createdAt: timestamp('created_at').defaultNow(),
})

// Relations
export const partnersRelations = relations(partners, ({ many }) => ({
  products: many(products),
}))

export const productsRelations = relations(products, ({ one }) => ({
  partner: one(partners, {
    fields: [products.partnerId],
    references: [partners.id],
  }),
}))
