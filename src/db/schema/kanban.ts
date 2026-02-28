import { pgTable, serial, varchar, text, integer, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './users'

export const kanbanStages = pgTable('kanban_stages', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  color: varchar('color', { length: 7 }).notNull().default('#3b82f6'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const kanbanStagesRelations = relations(kanbanStages, ({ many }) => ({
  tasks: many(kanbanTasks),
}))

export const kanbanTasks = pgTable('kanban_tasks', {
  id: serial('id').primaryKey(),
  stageId: integer('stage_id').notNull().references(() => kanbanStages.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  priority: varchar('priority', { length: 10 }).notNull().default('medium'),
  assignedTo: integer('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  createdBy: integer('created_by').notNull().references(() => users.id),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const kanbanTasksRelations = relations(kanbanTasks, ({ one, many }) => ({
  stage: one(kanbanStages, {
    fields: [kanbanTasks.stageId],
    references: [kanbanStages.id],
  }),
  assignee: one(users, {
    fields: [kanbanTasks.assignedTo],
    references: [users.id],
    relationName: 'assignedTasks',
  }),
  creator: one(users, {
    fields: [kanbanTasks.createdBy],
    references: [users.id],
    relationName: 'createdTasks',
  }),
  files: many(kanbanTaskFiles),
  notes: many(kanbanTaskNotes),
}))

export const kanbanTaskFiles = pgTable('kanban_task_files', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').notNull().references(() => kanbanTasks.id, { onDelete: 'cascade' }),
  filename: varchar('filename', { length: 255 }).notNull(),
  url: text('url').notNull(),
  filesize: integer('filesize').notNull().default(0),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const kanbanTaskFilesRelations = relations(kanbanTaskFiles, ({ one }) => ({
  task: one(kanbanTasks, {
    fields: [kanbanTaskFiles.taskId],
    references: [kanbanTasks.id],
  }),
}))

export const kanbanTaskNotes = pgTable('kanban_task_notes', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').notNull().references(() => kanbanTasks.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const kanbanTaskNotesRelations = relations(kanbanTaskNotes, ({ one }) => ({
  task: one(kanbanTasks, {
    fields: [kanbanTaskNotes.taskId],
    references: [kanbanTasks.id],
  }),
  author: one(users, {
    fields: [kanbanTaskNotes.createdBy],
    references: [users.id],
    relationName: 'taskNotes',
  }),
}))
