import { pgTable, serial, varchar, text, boolean, timestamp, integer, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './users'
import { company } from './company'

export const a2aApiKeys = pgTable('a2a_api_keys', {
  id: serial('id').primaryKey(),
  uuid: varchar('uuid', { length: 36 }).unique().notNull(),
  userId: integer('user_id').notNull().references(() => users.id),
  companyId: integer('company_id').notNull().references(() => company.id),
  name: varchar('name', { length: 100 }).notNull(),
  keyHash: varchar('key_hash', { length: 128 }).notNull(),
  keyPrefix: varchar('key_prefix', { length: 12 }).notNull(),
  scopes: text('scopes').array().default([]),
  isActive: boolean('is_active').default(true),
  lastUsedAt: timestamp('last_used_at'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_a2a_api_keys_prefix').on(table.keyPrefix),
])

export const a2aApiKeysRelations = relations(a2aApiKeys, ({ one }) => ({
  user: one(users, {
    fields: [a2aApiKeys.userId],
    references: [users.id],
  }),
  company: one(company, {
    fields: [a2aApiKeys.companyId],
    references: [company.id],
  }),
}))
