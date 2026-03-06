import { pgTable, serial, varchar, text, boolean, timestamp, integer, uniqueIndex, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './users'
import { company } from './company'

// ─── Community Boards ────────────────────────────────────────────────
export const communityBoards = pgTable('community_boards', {
  id: serial('id').primaryKey(),
  uuid: varchar('uuid', { length: 36 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  description: text('description'),
  iconClass: varchar('icon_class', { length: 64 }),
  color: varchar('color', { length: 7 }).notNull().default('#3b82f6'),
  rules: text('rules'),
  sortOrder: integer('sort_order').notNull().default(0),
  staffOnly: boolean('staff_only').notNull().default(false),
  isArchived: boolean('is_archived').notNull().default(false),
  isDeleted: boolean('is_deleted').notNull().default(false),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const communityBoardsRelations = relations(communityBoards, ({ one, many }) => ({
  creator: one(users, {
    fields: [communityBoards.createdBy],
    references: [users.id],
    relationName: 'createdBoards',
  }),
  posts: many(communityPosts),
}))

// ─── Community Guidelines ────────────────────────────────────────────
export const communityGuidelines = pgTable('community_guidelines', {
  id: serial('id').primaryKey(),
  body: text('body'),
  updatedBy: integer('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const communityGuidelinesRelations = relations(communityGuidelines, ({ one }) => ({
  editor: one(users, {
    fields: [communityGuidelines.updatedBy],
    references: [users.id],
    relationName: 'guidelinesEditor',
  }),
}))

// ─── Community Guideline Acceptances ─────────────────────────────────
export const communityGuidelineAcceptances = pgTable('community_guideline_acceptances', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  acceptedAt: timestamp('accepted_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_community_guideline_acceptances_user').on(table.userId),
])

export const communityGuidelineAcceptancesRelations = relations(communityGuidelineAcceptances, ({ one }) => ({
  user: one(users, {
    fields: [communityGuidelineAcceptances.userId],
    references: [users.id],
    relationName: 'guidelineAcceptance',
  }),
}))

// ─── Community Posts ─────────────────────────────────────────────────
export const communityPosts = pgTable('community_posts', {
  id: serial('id').primaryKey(),
  uuid: varchar('uuid', { length: 36 }).notNull().unique(),
  boardId: integer('board_id').notNull().references(() => communityBoards.id),
  userId: integer('user_id').notNull().references(() => users.id),
  companyId: integer('company_id').references(() => company.id, { onDelete: 'set null' }),
  body: text('body').notNull(),
  visibility: varchar('visibility', { length: 16 }).notNull().default('public'),
  visibilityCompanyId: integer('visibility_company_id').references(() => company.id, { onDelete: 'set null' }),
  isPinned: boolean('is_pinned').notNull().default(false),
  isDeleted: boolean('is_deleted').notNull().default(false),
  commentCount: integer('comment_count').notNull().default(0),
  reactionCount: integer('reaction_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_community_posts_board_id').on(table.boardId),
  index('idx_community_posts_user_id').on(table.userId),
  index('idx_community_posts_created_at').on(table.createdAt),
])

export const communityPostsRelations = relations(communityPosts, ({ one, many }) => ({
  board: one(communityBoards, {
    fields: [communityPosts.boardId],
    references: [communityBoards.id],
  }),
  author: one(users, {
    fields: [communityPosts.userId],
    references: [users.id],
    relationName: 'communityPosts',
  }),
  company: one(company, {
    fields: [communityPosts.companyId],
    references: [company.id],
    relationName: 'communityPostCompany',
  }),
  visibilityCompany: one(company, {
    fields: [communityPosts.visibilityCompanyId],
    references: [company.id],
    relationName: 'communityPostVisibilityCompany',
  }),
  images: many(communityPostImages),
  comments: many(communityComments),
}))

// ─── Community Post Images ───────────────────────────────────────────
export const communityPostImages = pgTable('community_post_images', {
  id: serial('id').primaryKey(),
  postId: integer('post_id').notNull().references(() => communityPosts.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  caption: varchar('caption', { length: 255 }),
  width: integer('width'),
  height: integer('height'),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const communityPostImagesRelations = relations(communityPostImages, ({ one }) => ({
  post: one(communityPosts, {
    fields: [communityPostImages.postId],
    references: [communityPosts.id],
  }),
}))

// ─── Community Comments ──────────────────────────────────────────────
export const communityComments = pgTable('community_comments', {
  id: serial('id').primaryKey(),
  uuid: varchar('uuid', { length: 36 }).notNull().unique(),
  postId: integer('post_id').notNull().references(() => communityPosts.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id),
  parentId: integer('parent_id'),
  depth: integer('depth').notNull().default(0),
  body: text('body').notNull(),
  isDeleted: boolean('is_deleted').notNull().default(false),
  reactionCount: integer('reaction_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_community_comments_post_id').on(table.postId),
  index('idx_community_comments_parent_id').on(table.parentId),
  index('idx_community_comments_user_id').on(table.userId),
])

export const communityCommentsRelations = relations(communityComments, ({ one, many }) => ({
  post: one(communityPosts, {
    fields: [communityComments.postId],
    references: [communityPosts.id],
  }),
  author: one(users, {
    fields: [communityComments.userId],
    references: [users.id],
    relationName: 'communityComments',
  }),
  parent: one(communityComments, {
    fields: [communityComments.parentId],
    references: [communityComments.id],
    relationName: 'commentReplies',
  }),
  replies: many(communityComments, { relationName: 'commentReplies' }),
}))

// ─── Community Reactions ─────────────────────────────────────────────
export const communityReactions = pgTable('community_reactions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  targetType: varchar('target_type', { length: 10 }).notNull(),
  targetId: integer('target_id').notNull(),
  emoji: varchar('emoji', { length: 16 }).notNull().default('like'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_community_reactions_unique').on(table.userId, table.targetType, table.targetId, table.emoji),
])

export const communityReactionsRelations = relations(communityReactions, ({ one }) => ({
  user: one(users, {
    fields: [communityReactions.userId],
    references: [users.id],
    relationName: 'communityReactions',
  }),
}))

// ─── User Follows ────────────────────────────────────────────────────
export const userFollows = pgTable('user_follows', {
  id: serial('id').primaryKey(),
  followerId: integer('follower_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  followingId: integer('following_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_user_follows_unique').on(table.followerId, table.followingId),
])

export const userFollowsRelations = relations(userFollows, ({ one }) => ({
  follower: one(users, {
    fields: [userFollows.followerId],
    references: [users.id],
    relationName: 'following',
  }),
  following: one(users, {
    fields: [userFollows.followingId],
    references: [users.id],
    relationName: 'followers',
  }),
}))

// ─── Chat Conversations ─────────────────────────────────────────────
export const chatConversations = pgTable('chat_conversations', {
  id: serial('id').primaryKey(),
  uuid: varchar('uuid', { length: 36 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const chatConversationsRelations = relations(chatConversations, ({ many }) => ({
  participants: many(chatParticipants),
  messages: many(chatMessages),
}))

// ─── Chat Participants ──────────────────────────────────────────────
export const chatParticipants = pgTable('chat_participants', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').notNull().references(() => chatConversations.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  lastReadAt: timestamp('last_read_at'),
  isMuted: boolean('is_muted').notNull().default(false),
}, (table) => [
  uniqueIndex('idx_chat_participants_unique').on(table.conversationId, table.userId),
])

export const chatParticipantsRelations = relations(chatParticipants, ({ one }) => ({
  conversation: one(chatConversations, {
    fields: [chatParticipants.conversationId],
    references: [chatConversations.id],
  }),
  user: one(users, {
    fields: [chatParticipants.userId],
    references: [users.id],
    relationName: 'chatParticipants',
  }),
}))

// ─── Chat Messages ──────────────────────────────────────────────────
export const chatMessages = pgTable('chat_messages', {
  id: serial('id').primaryKey(),
  uuid: varchar('uuid', { length: 36 }).notNull().unique(),
  conversationId: integer('conversation_id').notNull().references(() => chatConversations.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id),
  body: text('body').notNull(),
  isDeleted: boolean('is_deleted').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_chat_messages_conversation_id').on(table.conversationId),
  index('idx_chat_messages_created_at').on(table.createdAt),
])

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  conversation: one(chatConversations, {
    fields: [chatMessages.conversationId],
    references: [chatConversations.id],
  }),
  sender: one(users, {
    fields: [chatMessages.userId],
    references: [users.id],
    relationName: 'chatMessages',
  }),
}))
