/** Postgres-backed SQL execution. Kept off the pure editor module so tests
 *  do not open a connection pool. */

import { queryClient } from '@nwai/db'
import {
  connectionStringFromEnv,
  parseDatabaseTarget,
  SQL_ROW_LIMIT,
  SQL_TIMEOUT_MS,
  type DatabaseTarget,
  type SqlResult,
  type SqlSession,
} from './sql.ts'

/** Prefer the live client's parsed options, then the connection string. */
export function targetFromClient(
  env: Record<string, string | undefined> = process.env,
): DatabaseTarget {
  const parsed = parseDatabaseTarget(connectionStringFromEnv(env), env)
  try {
    const options = queryClient.options
    const host = Array.isArray(options.host) ? options.host[0] : options.host
    const port = Array.isArray(options.port) ? options.port[0] : options.port
    return {
      database: options.database || parsed.database,
      host: host || parsed.host,
      port: port != null ? String(port) : parsed.port,
      user: options.user || parsed.user,
      envVar: parsed.envVar,
    }
  } catch {
    return parsed
  }
}

export async function fetchSqlSession(): Promise<SqlSession> {
  const rows = await queryClient.unsafe(
    `
      SELECT
        current_database() AS database,
        current_user AS "user",
        current_schema() AS schema,
        inet_server_addr()::text AS address,
        inet_server_port() AS port,
        version() AS version
    `,
    [],
    { prepare: false },
  )
  const row = rows[0] ?? {}
  return {
    database: String(row.database ?? ''),
    user: String(row.user ?? ''),
    schema: String(row.schema ?? ''),
    address: row.address == null ? null : String(row.address),
    port: row.port == null ? null : Number(row.port),
    version: String(row.version ?? ''),
  }
}

export async function runSql(query: string): Promise<SqlResult> {
  const trimmed = query.trim()
  if (!trimmed) throw new Error('The editor is empty.')

  const started = Date.now()
  const pending = queryClient.unsafe(trimmed, [], { prepare: false })
  const timer = setTimeout(() => pending.cancel(), SQL_TIMEOUT_MS)
  try {
    const result = await pending
    const columns = (result.columns ?? []).map((column) => column.name)
    const truncated = result.length > SQL_ROW_LIMIT
    const rows = result.slice(0, SQL_ROW_LIMIT).map((row) => columns.map((name) => row[name]))
    return {
      command: result.command || 'SELECT',
      rowCount: result.count ?? result.length,
      columns,
      rows,
      truncated,
      elapsedMs: Date.now() - started,
    }
  } catch (error) {
    if (error instanceof Error && /cancel/i.test(error.message)) {
      throw new Error(`Query timed out after ${Math.round(SQL_TIMEOUT_MS / 1000)}s.`)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}
