import { pgTable, serial, varchar, text, boolean, timestamp, integer, numeric, jsonb, date } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './users'
import { company } from './company'
import { releases } from './releases'

export const adCampaigns = pgTable('ad_campaigns', {
  id: serial('id').primaryKey(),
  uuid: varchar('uuid', { length: 36 }).unique().notNull(),
  releaseId: integer('release_id').notNull().references(() => releases.id),
  companyId: integer('company_id').notNull().references(() => company.id),
  userId: integer('user_id').notNull().references(() => users.id),

  // Budget
  budgetAmount: integer('budget_amount').notNull().default(10),
  amountSpent: numeric('amount_spent', { precision: 10, scale: 2 }).default('0'),

  // Google Ads resource IDs
  googleCampaignId: varchar('google_campaign_id', { length: 64 }),
  googleAdGroupId: varchar('google_ad_group_id', { length: 64 }),
  googleBudgetId: varchar('google_budget_id', { length: 64 }),

  // Ad content (AI-generated)
  headlines: jsonb('headlines'),
  descriptions: jsonb('descriptions'),
  keywords: jsonb('keywords'),
  finalUrl: varchar('final_url', { length: 512 }),

  // Status tracking
  status: varchar('status', { length: 32 }).notNull().default('pending'),

  // Google review
  policyStatus: varchar('policy_status', { length: 32 }),
  policyTopics: jsonb('policy_topics'),

  // Metrics
  impressions: integer('impressions').default(0),
  clicks: integer('clicks').default(0),

  // Payment
  paymentIntentId: varchar('payment_intent_id', { length: 128 }),
  paidAt: timestamp('paid_at'),

  // Dates
  campaignStartDate: date('campaign_start_date'),
  campaignEndDate: date('campaign_end_date'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const adCampaignsRelations = relations(adCampaigns, ({ one }) => ({
  release: one(releases, {
    fields: [adCampaigns.releaseId],
    references: [releases.id],
  }),
  company: one(company, {
    fields: [adCampaigns.companyId],
    references: [company.id],
  }),
  user: one(users, {
    fields: [adCampaigns.userId],
    references: [users.id],
  }),
}))
