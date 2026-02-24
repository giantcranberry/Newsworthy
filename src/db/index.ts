import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL!

// Use global singleton to prevent HMR from creating multiple connections
const globalForDb = globalThis as unknown as {
  queryClient: ReturnType<typeof postgres> | undefined
}

const queryClient = globalForDb.queryClient ?? postgres(connectionString, { prepare: false })

if (process.env.NODE_ENV !== 'production') {
  globalForDb.queryClient = queryClient
}

export const db = drizzle(queryClient, { schema })

// For direct queries when needed
export { queryClient }

// Re-export schema
export * from './schema'
