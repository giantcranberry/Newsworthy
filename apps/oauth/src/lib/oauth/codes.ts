import { randomBytes } from 'crypto'
import { db } from '@/db'
import { oauthAuthorizationCodes } from '@nwai/db/src/schema'
import { eq, and, isNull } from 'drizzle-orm'

const CODE_EXPIRY_SECONDS = 60

interface GenerateCodeParams {
  clientId: string
  userId: number
  redirectUri: string
  scope: string
  codeChallenge: string
  codeChallengeMethod: string
}

/**
 * Generate a new authorization code and store it in the database.
 */
export async function generateAuthorizationCode(params: GenerateCodeParams): Promise<string> {
  const code = randomBytes(64).toString('hex') // 128 hex chars

  const expiresAt = new Date(Date.now() + CODE_EXPIRY_SECONDS * 1000)

  await db.insert(oauthAuthorizationCodes).values({
    code,
    clientId: params.clientId,
    userId: params.userId,
    redirectUri: params.redirectUri,
    scope: params.scope,
    codeChallenge: params.codeChallenge,
    codeChallengeMethod: params.codeChallengeMethod,
    expiresAt,
  })

  return code
}

interface ValidatedCode {
  id: number
  code: string
  clientId: string
  userId: number
  redirectUri: string
  scope: string
  codeChallenge: string
  codeChallengeMethod: string
}

/**
 * Validate and consume an authorization code.
 * Returns the code details if valid, null otherwise.
 * Marks the code as used to prevent replay attacks.
 */
export async function consumeAuthorizationCode(
  code: string,
  clientId: string
): Promise<ValidatedCode | null> {
  const record = await db.query.oauthAuthorizationCodes.findFirst({
    where: and(
      eq(oauthAuthorizationCodes.code, code),
      eq(oauthAuthorizationCodes.clientId, clientId),
      isNull(oauthAuthorizationCodes.usedAt),
    ),
  })

  if (!record) return null

  // Check expiry
  if (new Date() > record.expiresAt) return null

  // Mark as used
  await db
    .update(oauthAuthorizationCodes)
    .set({ usedAt: new Date() })
    .where(eq(oauthAuthorizationCodes.id, record.id))

  return {
    id: record.id,
    code: record.code,
    clientId: record.clientId,
    userId: record.userId,
    redirectUri: record.redirectUri,
    scope: record.scope,
    codeChallenge: record.codeChallenge,
    codeChallengeMethod: record.codeChallengeMethod,
  }
}
