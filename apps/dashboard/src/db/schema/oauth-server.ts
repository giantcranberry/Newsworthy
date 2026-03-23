import { pgTable, serial, varchar, text, boolean, timestamp, integer, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './users'

export const oauthClients = pgTable('nwai_oauth_clients', {
  id: serial('id').primaryKey(),
  clientId: varchar('client_id', { length: 64 }).unique().notNull(),
  clientSecretHash: varchar('client_secret_hash', { length: 128 }),
  name: varchar('name', { length: 128 }).notNull(),
  redirectUris: text('redirect_uris').array().notNull(),
  allowedScopes: text('allowed_scopes').array().notNull(),
  isConfidential: boolean('is_confidential').default(true).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  skipConsent: boolean('skip_consent').default(true).notNull(),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const oauthAuthorizationCodes = pgTable('nwai_oauth_authorization_codes', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 128 }).unique().notNull(),
  clientId: varchar('client_id', { length: 64 }).notNull(),
  userId: integer('user_id').notNull().references(() => users.id),
  redirectUri: text('redirect_uri').notNull(),
  scope: text('scope').notNull(),
  codeChallenge: varchar('code_challenge', { length: 128 }).notNull(),
  codeChallengeMethod: varchar('code_challenge_method', { length: 10 }).notNull().default('S256'),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_nwai_oauth_codes_client_id').on(table.clientId),
  index('idx_nwai_oauth_codes_user_id').on(table.userId),
])

export const oauthAccessTokens = pgTable('nwai_oauth_access_tokens', {
  id: serial('id').primaryKey(),
  token: varchar('token', { length: 128 }).unique().notNull(),
  clientId: varchar('client_id', { length: 64 }).notNull(),
  userId: integer('user_id').notNull().references(() => users.id),
  scope: text('scope').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_nwai_oauth_access_tokens_client_id').on(table.clientId),
  index('idx_nwai_oauth_access_tokens_user_id').on(table.userId),
])

export const oauthRefreshTokens = pgTable('nwai_oauth_refresh_tokens', {
  id: serial('id').primaryKey(),
  token: varchar('token', { length: 128 }).unique().notNull(),
  accessTokenId: integer('access_token_id').notNull().references(() => oauthAccessTokens.id),
  clientId: varchar('client_id', { length: 64 }).notNull(),
  userId: integer('user_id').notNull().references(() => users.id),
  expiresAt: timestamp('expires_at').notNull(),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_nwai_oauth_refresh_tokens_client_id').on(table.clientId),
  index('idx_nwai_oauth_refresh_tokens_user_id').on(table.userId),
  index('idx_nwai_oauth_refresh_tokens_access_token_id').on(table.accessTokenId),
])

// Relations
export const oauthClientsRelations = relations(oauthClients, ({ one }) => ({
  creator: one(users, {
    fields: [oauthClients.createdBy],
    references: [users.id],
  }),
}))

export const oauthAuthorizationCodesRelations = relations(oauthAuthorizationCodes, ({ one }) => ({
  user: one(users, {
    fields: [oauthAuthorizationCodes.userId],
    references: [users.id],
  }),
}))

export const oauthAccessTokensRelations = relations(oauthAccessTokens, ({ one }) => ({
  user: one(users, {
    fields: [oauthAccessTokens.userId],
    references: [users.id],
  }),
}))

export const oauthRefreshTokensRelations = relations(oauthRefreshTokens, ({ one }) => ({
  accessToken: one(oauthAccessTokens, {
    fields: [oauthRefreshTokens.accessTokenId],
    references: [oauthAccessTokens.id],
  }),
  user: one(users, {
    fields: [oauthRefreshTokens.userId],
    references: [users.id],
  }),
}))
