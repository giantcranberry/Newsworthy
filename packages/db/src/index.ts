import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Prefer DIRECT_DATABASE_URL (Supabase session pooler, port 5432) which supports
// concurrent queries and prepared statements. Fall back to DATABASE_URL (transaction
// pooler, port 6543) which requires prepare:false and max:1.
const isDev = process.env.NODE_ENV !== 'production'
const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL!
const usesPgBouncer = connectionString.includes('pgbouncer=true')

// Use global singleton to prevent HMR from creating multiple connections
const globalForDb = globalThis as unknown as {
  queryClient: ReturnType<typeof postgres> | undefined
}

const queryClient = globalForDb.queryClient ?? postgres(connectionString, {
  prepare: usesPgBouncer ? false : undefined,
  max: usesPgBouncer ? 1 : isDev ? 10 : 5,
  idle_timeout: 20,
  connect_timeout: 10,
})

if (isDev) {
  globalForDb.queryClient = queryClient
}

export const db = drizzle(queryClient, { schema })

// For direct queries when needed
export { queryClient }

// Re-export schema
export * from './schema'

// Re-export commonly used drizzle-orm utilities
export { sql, eq, ne, gt, gte, lt, lte, and, or, not, inArray, notInArray, isNull, isNotNull, desc, asc, like, ilike, between, exists, notExists, count, sum, avg, min, max } from 'drizzle-orm'
export type { InferSelectModel, InferInsertModel } from 'drizzle-orm'
