import { pgTable, serial, varchar, text, integer, timestamp, date, time, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './users'
import { company } from './company'
import { releases } from './releases'

export const contentCalendar = pgTable('content_calendar', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  companyId: integer('company_id').references(() => company.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  eventType: varchar('event_type', { length: 50 }).notNull().default('press_release'),
  eventDate: date('event_date').notNull(),
  eventTime: time('event_time'),
  status: varchar('status', { length: 20 }).notNull().default('planned'),
  color: varchar('color', { length: 7 }).notNull().default('#3b82f6'),
  releaseId: integer('release_id').references(() => releases.id, { onDelete: 'set null' }),
  googleEventId: varchar('google_event_id', { length: 1024 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_content_calendar_user_date').on(table.userId, table.eventDate),
  index('idx_content_calendar_company').on(table.companyId),
])

export const contentCalendarRelations = relations(contentCalendar, ({ one }) => ({
  user: one(users, {
    fields: [contentCalendar.userId],
    references: [users.id],
  }),
  company: one(company, {
    fields: [contentCalendar.companyId],
    references: [company.id],
  }),
  release: one(releases, {
    fields: [contentCalendar.releaseId],
    references: [releases.id],
  }),
}))
