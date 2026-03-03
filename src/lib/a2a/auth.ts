import { db } from '@/db'
import { a2aApiKeys } from '@/db/schema'
import { eq, and, isNull, or, gt } from 'drizzle-orm'
import { compare } from 'bcryptjs'
import type { AuthContext } from './types'

const KEY_PREFIX = 'nw_a2a_'

/**
 * Extract API key from Authorization header.
 * Expects: Authorization: Bearer nw_a2a_...
 */
export function extractApiKey(request: Request): string | null {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null

  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null

  const key = parts[1]
  if (!key.startsWith(KEY_PREFIX)) return null

  return key
}

/**
 * Validate an API key by prefix lookup + bcrypt comparison.
 * Updates last_used_at on success.
 */
export async function validateApiKey(key: string): Promise<AuthContext | null> {
  // Extract the prefix for lookup (first 12 chars: "nw_a2a_" + first 5 hex chars)
  const prefix = key.substring(0, 12)

  // Find candidate keys by prefix
  const candidates = await db
    .select()
    .from(a2aApiKeys)
    .where(
      and(
        eq(a2aApiKeys.keyPrefix, prefix),
        eq(a2aApiKeys.isActive, true),
        or(
          isNull(a2aApiKeys.expiresAt),
          gt(a2aApiKeys.expiresAt, new Date())
        )
      )
    )

  for (const candidate of candidates) {
    const matches = await compare(key, candidate.keyHash)
    if (matches) {
      // Update last_used_at (fire-and-forget)
      db.update(a2aApiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(a2aApiKeys.id, candidate.id))
        .then(() => {})
        .catch(() => {})

      return {
        userId: candidate.userId,
        companyId: candidate.companyId,
        keyId: candidate.id,
      }
    }
  }

  return null
}

/**
 * Full authentication flow: extract key from request, validate it.
 */
export async function authenticateA2A(request: Request): Promise<AuthContext | null> {
  const key = extractApiKey(request)
  if (!key) return null
  return validateApiKey(key)
}
