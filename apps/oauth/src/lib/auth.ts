import { compare } from 'bcryptjs'
import { pbkdf2Sync } from 'crypto'
import { db } from '@/db'
import { users } from '@nwai/db/src/schema'
import { eq } from 'drizzle-orm'

/**
 * Verify Werkzeug-style password hashes (pbkdf2:sha256:...)
 */
function verifyWerkzeugPassword(password: string, hash: string): boolean {
  try {
    if (hash.startsWith('pbkdf2:')) {
      const parts = hash.split('$')
      if (parts.length !== 3) return false

      const methodPart = parts[0]
      const salt = parts[1]
      const storedHash = parts[2]

      const methodParts = methodPart.split(':')
      const hashMethod = methodParts[1] || 'sha256'
      const iterations = parseInt(methodParts[2] || '260000', 10)

      const derivedKey = pbkdf2Sync(password, salt, iterations, 32, hashMethod)
      return derivedKey.toString('hex') === storedHash
    }
    return false
  } catch {
    return false
  }
}

/**
 * Verify a user's password (supports both Werkzeug PBKDF2 and bcrypt).
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (hash.startsWith('pbkdf2:')) {
    return verifyWerkzeugPassword(password, hash)
  }
  return compare(password, hash)
}

/**
 * Authenticate a user by email and password.
 * Returns the user ID and email if successful, null otherwise.
 */
export async function authenticateUser(
  email: string,
  password: string
): Promise<{ userId: number; email: string } | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  })

  if (!user || !user.passwordHash) return null

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) return null

  return { userId: user.id, email: user.email }
}
