import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// In dev, prefer DIRECT_DATABASE_URL (no PgBouncer) to avoid connection limit bottleneck
const connectionString = (process.env.NODE_ENV !== 'production' && process.env.DIRECT_DATABASE_URL) || process.env.DATABASE_URL!

// Use global singleton to prevent HMR from creating multiple connections
const globalForDb = globalThis as unknown as {
  queryClient: ReturnType<typeof postgres> | undefined
}

const queryClient = globalForDb.queryClient ?? postgres(connectionString, { prepare: false, max: 3 })

if (process.env.NODE_ENV !== 'production') {
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
