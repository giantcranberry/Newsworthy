import { pgTable, serial, varchar, timestamp, integer, uniqueIndex } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './users'
import { company } from './company'

export const companyMembers = pgTable('company_members', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').notNull().references(() => company.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).notNull().default('collaborator'),
  invitedBy: integer('invited_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  uniqueIndex('idx_company_members_unique').on(table.companyId, table.userId),
])

export const companyInvites = pgTable('company_invites', {
  id: serial('id').primaryKey(),
  uuid: varchar('uuid', { length: 36 }).unique().notNull(),
  companyId: integer('company_id').notNull().references(() => company.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 254 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('collaborator'),
  invitedBy: integer('invited_by').notNull().references(() => users.id),
  token: varchar('token', { length: 64 }).unique().notNull(),
  acceptedAt: timestamp('accepted_at'),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  uniqueIndex('idx_company_invites_unique').on(table.companyId, table.email),
])

// Relations
export const companyMembersRelations = relations(companyMembers, ({ one }) => ({
  company: one(company, {
    fields: [companyMembers.companyId],
    references: [company.id],
  }),
  user: one(users, {
    fields: [companyMembers.userId],
    references: [users.id],
    relationName: 'memberUser',
  }),
  inviter: one(users, {
    fields: [companyMembers.invitedBy],
    references: [users.id],
    relationName: 'memberInviter',
  }),
}))

export const companyInvitesRelations = relations(companyInvites, ({ one }) => ({
  company: one(company, {
    fields: [companyInvites.companyId],
    references: [company.id],
  }),
  inviter: one(users, {
    fields: [companyInvites.invitedBy],
    references: [users.id],
  }),
}))
