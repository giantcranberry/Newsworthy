const WINDOW_MS = 60_000 // 60 seconds
const MAX_REQUESTS_DEFAULT = 60 // 60 requests per window (unauthenticated)
const MAX_REQUESTS_AUTHENTICATED = 120 // 120 requests per window (API key)

interface RateLimitEntry {
  count: number
  windowStart: number
}

const store = new Map<string, RateLimitEntry>()

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now - entry.windowStart > WINDOW_MS * 2) {
      store.delete(key)
    }
  }
}, 300_000)

export function checkRateLimit(
  identifier: string,
  limit?: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const maxRequests = limit ?? MAX_REQUESTS_DEFAULT
  const now = Date.now()
  const entry = store.get(identifier)

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    store.set(identifier, { count: 1, windowStart: now })
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + WINDOW_MS }
  }

  entry.count++

  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.windowStart + WINDOW_MS }
  }

  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.windowStart + WINDOW_MS }
}

export { MAX_REQUESTS_DEFAULT, MAX_REQUESTS_AUTHENTICATED }
