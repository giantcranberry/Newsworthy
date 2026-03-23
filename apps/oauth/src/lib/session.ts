import { cookies } from 'next/headers'
import { createHmac, randomBytes } from 'crypto'

const SESSION_COOKIE = 'nwai_oauth_session'
const SESSION_MAX_AGE = 30 * 24 * 3600 // 30 days in seconds

function getSessionSecret(): string {
  const secret = process.env.OAUTH_SESSION_SECRET
  if (!secret) throw new Error('OAUTH_SESSION_SECRET environment variable is required')
  return secret
}

/**
 * Sign a payload string with HMAC-SHA256.
 */
function sign(payload: string): string {
  const secret = getSessionSecret()
  const signature = createHmac('sha256', secret).update(payload).digest('hex')
  return `${payload}.${signature}`
}

/**
 * Verify and extract payload from a signed string.
 */
function verify(signedValue: string): string | null {
  const lastDot = signedValue.lastIndexOf('.')
  if (lastDot === -1) return null

  const payload = signedValue.substring(0, lastDot)
  const expected = sign(payload)

  // Constant-time comparison
  if (expected.length !== signedValue.length) return null
  let mismatch = 0
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signedValue.charCodeAt(i)
  }
  if (mismatch !== 0) return null

  return payload
}

export interface SessionData {
  userId: number
  email: string
  createdAt: number
}

/**
 * Get the current session from the signed cookie.
 */
export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies()
  const cookie = cookieStore.get(SESSION_COOKIE)
  if (!cookie) return null

  const payload = verify(cookie.value)
  if (!payload) return null

  try {
    const data = JSON.parse(payload) as SessionData

    // Check if session has expired
    const age = (Date.now() / 1000) - data.createdAt
    if (age > SESSION_MAX_AGE) return null

    return data
  } catch {
    return null
  }
}

/**
 * Create a new session for a user.
 */
export async function createSession(userId: number, email: string): Promise<void> {
  const cookieStore = await cookies()

  const data: SessionData = {
    userId,
    email,
    createdAt: Math.floor(Date.now() / 1000),
  }

  const signed = sign(JSON.stringify(data))

  cookieStore.set(SESSION_COOKIE, signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  })
}

/**
 * Destroy the current session.
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}
