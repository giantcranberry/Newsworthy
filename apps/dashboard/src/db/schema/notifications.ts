import { pgTable, serial, varchar, text, boolean, timestamp, integer, uniqueIndex, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './users'
import { releases } from './releases'

export const globalMessages = pgTable('global_messages', {
  id: serial('id').primaryKey(),
  subject: varchar('subject', { length: 255 }).notNull(),
  body: text('body').notNull(),
  createdBy: integer('created_by').notNull().references(() => users.id),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'),
})

export const globalMessageReads = pgTable('global_message_reads', {
  id: serial('id').primaryKey(),
  globalMessageId: integer('global_message_id').notNull().references(() => globalMessages.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  isArchived: boolean('is_archived').default(false).notNull(),
  isDeleted: boolean('is_deleted').default(false).notNull(),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_global_message_reads_unique').on(table.globalMessageId, table.userId),
  index('idx_global_message_reads_user_id').on(table.userId),
])

export const userMessages = pgTable('user_messages', {
  id: serial('id').primaryKey(),
  fromId: integer('from_id').references(() => users.id),
  toId: integer('to_id').notNull().references(() => users.id),
  releaseId: integer('release_id').references(() => releases.id),
  subject: varchar('subject', { length: 255 }).notNull(),
  body: text('body').notNull(),
  isRead: boolean('is_read').default(false).notNull(),
  readAt: timestamp('read_at'),
  isArchived: boolean('is_archived').default(false).notNull(),
  isDeleted: boolean('is_deleted').default(false).notNull(),
  emailSent: boolean('email_sent').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_user_messages_to_id').on(table.toId),
  index('idx_user_messages_release_id').on(table.releaseId),
])

// Relations
export const globalMessagesRelations = relations(globalMessages, ({ one, many }) => ({
  creator: one(users, {
    fields: [globalMessages.createdBy],
    references: [users.id],
  }),
  reads: many(globalMessageReads),
}))

export const globalMessageReadsRelations = relations(globalMessageReads, ({ one }) => ({
  globalMessage: one(globalMessages, {
    fields: [globalMessageReads.globalMessageId],
    references: [globalMessages.id],
  }),
  user: one(users, {
    fields: [globalMessageReads.userId],
    references: [users.id],
  }),
}))

export const userMessagesRelations = relations(userMessages, ({ one }) => ({
  sender: one(users, {
    fields: [userMessages.fromId],
    references: [users.id],
    relationName: 'sentMessages',
  }),
  recipient: one(users, {
    fields: [userMessages.toId],
    references: [users.id],
    relationName: 'receivedMessages',
  }),
}))
