import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

// Import schema directly from the shared package's schema directory
// to avoid triggering the eager DB connection in @nwai/db's index.ts
import * as schema from '@nwai/db/src/schema'

// Lazy DB initialization to avoid build-time errors when DATABASE_URL is not set
const globalForDb = globalThis as unknown as {
  queryClient: ReturnType<typeof postgres> | undefined
}

function getQueryClient() {
  if (globalForDb.queryClient) return globalForDb.queryClient

  const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL!
  const usesPgBouncer = connectionString?.includes('pgbouncer=true')
  const isDev = process.env.NODE_ENV !== 'production'

  const client = postgres(connectionString, {
    prepare: usesPgBouncer ? false : undefined,
    max: usesPgBouncer ? 1 : isDev ? 10 : 5,
    idle_timeout: 20,
    connect_timeout: 10,
  })

  if (isDev) {
    globalForDb.queryClient = client
  }

  return client
}

let _db: ReturnType<typeof drizzle<typeof schema>> | undefined

export function getDb() {
  if (!_db) {
    _db = drizzle(getQueryClient(), { schema })
  }
  return _db
}

// Proxy that lazily initializes db on first access
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    return (getDb() as any)[prop]
  },
})
