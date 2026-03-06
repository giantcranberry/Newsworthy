import { pgTable, serial, varchar, text, boolean, integer, timestamp } from 'drizzle-orm/pg-core'

export const category = pgTable('category', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 64 }).unique().notNull(),
  circuit: varchar('circuit', { length: 128 }),
  parentSlug: varchar('parent_slug', { length: 128 }),
  parentCategory: varchar('parent_category', { length: 128 }),
  name: varchar('name', { length: 128 }).notNull(),
  description: varchar('description', { length: 256 }),
})

export const circuits = pgTable('circuits', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 128 }).unique().notNull(),
  description: varchar('description', { length: 256 }),
  createdAt: timestamp('created_at').defaultNow(),
})

export const circuitCategories = pgTable('circuit_categories', {
  id: serial('id').primaryKey(),
  circuitId: integer('circuit_id').notNull().references(() => circuits.id, { onDelete: 'cascade' }),
  categoryId: integer('category_id').notNull().references(() => category.id, { onDelete: 'cascade' }),
})

export const region = pgTable('region', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 64 }).unique().notNull(),
  state: varchar('state', { length: 8 }).notNull(),
  name: varchar('name', { length: 64 }).notNull(),
  description: varchar('description', { length: 196 }),
  scroll: boolean('scroll').default(false),
  fPosition: integer('f_position'),
})

export const country = pgTable('country', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 5 }).unique().notNull(),
  name: varchar('name', { length: 32 }).notNull(),
  description: varchar('description', { length: 128 }),
  fPosition: integer('f_position'),
})

export const activities = pgTable('activities', {
  id: serial('id').primaryKey(),
  uuid: varchar('uuid', { length: 36 }).unique(),
  name: varchar('name', { length: 30 }).notNull(),
  icon: varchar('icon', { length: 30 }),
  network: varchar('network', { length: 30 }),
  isDeleted: boolean('is_deleted').default(false),
  isActive: boolean('is_active').default(false),
  sortOrder: integer('sort_order'),
})
