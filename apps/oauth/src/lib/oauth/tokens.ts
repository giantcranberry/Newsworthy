import { randomBytes } from 'crypto'
import { db } from '@/db'
import { oauthAccessTokens, oauthRefreshTokens } from '@nwai/db/src/schema'
import { eq, and, isNull } from 'drizzle-orm'

const ACCESS_TOKEN_EXPIRY_SECONDS = 3600 // 1 hour
const REFRESH_TOKEN_EXPIRY_SECONDS = 30 * 24 * 3600 // 30 days

interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number
  scope: string
}

interface IssueTokenParams {
  clientId: string
  userId: number
  scope: string
}

/**
 * Issue a new access token + refresh token pair.
 */
export async function issueTokenPair(params: IssueTokenParams): Promise<TokenPair> {
  const accessTokenValue = randomBytes(64).toString('hex')
  const refreshTokenValue = randomBytes(64).toString('hex')

  const accessExpiresAt = new Date(Date.now() + ACCESS_TOKEN_EXPIRY_SECONDS * 1000)
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_SECONDS * 1000)

  const [accessToken] = await db
    .insert(oauthAccessTokens)
    .values({
      token: accessTokenValue,
      clientId: params.clientId,
      userId: params.userId,
      scope: params.scope,
      expiresAt: accessExpiresAt,
    })
    .returning()

  await db.insert(oauthRefreshTokens).values({
    token: refreshTokenValue,
    accessTokenId: accessToken.id,
    clientId: params.clientId,
    userId: params.userId,
    expiresAt: refreshExpiresAt,
  })

  return {
    accessToken: accessTokenValue,
    refreshToken: refreshTokenValue,
    expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
    scope: params.scope,
  }
}

interface ValidatedAccessToken {
  id: number
  clientId: string
  userId: number
  scope: string
}

/**
 * Validate a Bearer access token.
 * Returns token details if valid, null if expired/revoked/not found.
 */
export async function validateAccessToken(token: string): Promise<ValidatedAccessToken | null> {
  const record = await db.query.oauthAccessTokens.findFirst({
    where: and(
      eq(oauthAccessTokens.token, token),
      isNull(oauthAccessTokens.revokedAt),
    ),
  })

  if (!record) return null
  if (new Date() > record.expiresAt) return null

  return {
    id: record.id,
    clientId: record.clientId,
    userId: record.userId,
    scope: record.scope,
  }
}

/**
 * Rotate a refresh token: revoke the old pair, issue a new pair.
 * If a revoked refresh token is presented, revoke the entire family (theft detection).
 */
export async function rotateRefreshToken(
  refreshToken: string,
  clientId: string
): Promise<TokenPair | null> {
  // First check if this refresh token has already been revoked (theft detection)
  const revokedToken = await db.query.oauthRefreshTokens.findFirst({
    where: and(
      eq(oauthRefreshTokens.token, refreshToken),
      eq(oauthRefreshTokens.clientId, clientId),
    ),
  })

  if (revokedToken && revokedToken.revokedAt) {
    // Theft detected — revoke all tokens for this user+client
    await revokeAllTokensForUserClient(revokedToken.userId, clientId)
    return null
  }

  // Look up the valid refresh token
  const record = await db.query.oauthRefreshTokens.findFirst({
    where: and(
      eq(oauthRefreshTokens.token, refreshToken),
      eq(oauthRefreshTokens.clientId, clientId),
      isNull(oauthRefreshTokens.revokedAt),
    ),
  })

  if (!record) return null
  if (new Date() > record.expiresAt) return null

  // Get the associated access token's scope
  const accessToken = await db.query.oauthAccessTokens.findFirst({
    where: eq(oauthAccessTokens.id, record.accessTokenId),
  })
  if (!accessToken) return null

  // Revoke old pair
  const now = new Date()
  await db.update(oauthRefreshTokens).set({ revokedAt: now }).where(eq(oauthRefreshTokens.id, record.id))
  await db.update(oauthAccessTokens).set({ revokedAt: now }).where(eq(oauthAccessTokens.id, record.accessTokenId))

  // Issue new pair
  return issueTokenPair({
    clientId: record.clientId,
    userId: record.userId,
    scope: accessToken.scope,
  })
}

/**
 * Revoke a specific token (access or refresh) and its paired token.
 */
export async function revokeToken(token: string): Promise<void> {
  const now = new Date()

  // Try as access token first
  const accessToken = await db.query.oauthAccessTokens.findFirst({
    where: eq(oauthAccessTokens.token, token),
  })

  if (accessToken) {
    await db.update(oauthAccessTokens).set({ revokedAt: now }).where(eq(oauthAccessTokens.id, accessToken.id))
    // Also revoke the associated refresh token
    await db
      .update(oauthRefreshTokens)
      .set({ revokedAt: now })
      .where(eq(oauthRefreshTokens.accessTokenId, accessToken.id))
    return
  }

  // Try as refresh token
  const refreshTokenRecord = await db.query.oauthRefreshTokens.findFirst({
    where: eq(oauthRefreshTokens.token, token),
  })

  if (refreshTokenRecord) {
    await db.update(oauthRefreshTokens).set({ revokedAt: now }).where(eq(oauthRefreshTokens.id, refreshTokenRecord.id))
    // Also revoke the associated access token
    await db
      .update(oauthAccessTokens)
      .set({ revokedAt: now })
      .where(eq(oauthAccessTokens.id, refreshTokenRecord.accessTokenId))
  }
}

/**
 * Revoke all tokens for a user+client combination (theft detection).
 */
async function revokeAllTokensForUserClient(userId: number, clientId: string): Promise<void> {
  const now = new Date()

  await db
    .update(oauthAccessTokens)
    .set({ revokedAt: now })
    .where(
      and(
        eq(oauthAccessTokens.userId, userId),
        eq(oauthAccessTokens.clientId, clientId),
        isNull(oauthAccessTokens.revokedAt),
      )
    )

  await db
    .update(oauthRefreshTokens)
    .set({ revokedAt: now })
    .where(
      and(
        eq(oauthRefreshTokens.userId, userId),
        eq(oauthRefreshTokens.clientId, clientId),
        isNull(oauthRefreshTokens.revokedAt),
      )
    )
}
