/** SQL editor, connection-string parsing and result formatting. */

export const SQL_ROW_LIMIT = 200
export const SQL_TIMEOUT_MS = 15_000
export const SQL_HISTORY_LIMIT = 50

export interface DatabaseTarget {
  database: string
  host: string
  port: string
  user: string
  envVar: 'DIRECT_DATABASE_URL' | 'DATABASE_URL' | null
}

export interface SqlSession {
  database: string
  user: string
  schema: string
  address: string | null
  port: number | null
  version: string
}

export interface SqlResult {
  command: string
  rowCount: number
  columns: string[]
  rows: unknown[][]
  truncated: boolean
  elapsedMs: number
}

export interface SqlEditor {
  text: string
  cursor: number
}

export type SqlKeyEffect =
  | { type: 'edit'; editor: SqlEditor }
  | { type: 'execute' }
  | { type: 'history'; direction: 1 | -1 }
  | { type: 'scroll-results'; pages: number }
  | { type: 'ignore' }

export function connectionStringFromEnv(
  env: Record<string, string | undefined> = process.env,
): string {
  return env.DIRECT_DATABASE_URL || env.DATABASE_URL || ''
}

export function envVarFromEnv(
  env: Record<string, string | undefined> = process.env,
): DatabaseTarget['envVar'] {
  if (env.DIRECT_DATABASE_URL) return 'DIRECT_DATABASE_URL'
  if (env.DATABASE_URL) return 'DATABASE_URL'
  return null
}

/**
 * Host, user and database name from a Postgres URL. The password is parsed
 * so it can be dropped — it never appears on the returned object.
 */
export function parseDatabaseTarget(
  connectionString: string,
  env: Record<string, string | undefined> = process.env,
): DatabaseTarget {
  const envVar = envVarFromEnv(env)
  const fallback: DatabaseTarget = {
    database: 'unknown',
    host: 'unknown',
    port: '',
    user: '',
    envVar,
  }
  if (!connectionString) return fallback

  try {
    const url = new URL(connectionString.replace(/^postgres(ql)?:/i, 'https:'))
    const database = decodeURIComponent(url.pathname.replace(/^\//, '').split('/')[0] || '')
    return {
      database: database || 'postgres',
      host: url.hostname || '127.0.0.1',
      port: url.port || '5432',
      user: decodeURIComponent(url.username || ''),
      envVar,
    }
  } catch {
    return fallback
  }
}

export function formatSqlValue(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : String(value)
  if (value instanceof Date) {
    return value.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC')
  }
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    const hex = value.toString('hex')
    return hex.length > 64 ? `\\x${hex.slice(0, 64)}…` : `\\x${hex}`
  }
  if (Array.isArray(value)) return `{${value.map(formatSqlValue).join(',')}}`
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

export function isNumericColumn(values: unknown[]): boolean {
  return values.every(
    (value) =>
      value === null ||
      value === undefined ||
      typeof value === 'number' ||
      typeof value === 'bigint',
  )
}

export const RISKY_COMMANDS = ['UPDATE', 'DELETE', 'TRUNCATE', 'DROP'] as const
export type RiskyCommand = (typeof RISKY_COMMANDS)[number]

const RISKY_SET = new Set<string>(RISKY_COMMANDS)

type SqlToken = { kind: 'word'; value: string } | { kind: 'punct'; value: string }

/**
 * Leading UPDATE / DELETE / TRUNCATE / DROP in any statement. Comments and
 * string literals are ignored, so `SELECT 'drop table'` is not flagged.
 */
export function findRiskyCommands(sql: string): RiskyCommand[] {
  const found: RiskyCommand[] = []
  const seen = new Set<string>()
  for (const statement of splitStatements(tokenizeSql(sql))) {
    const command = leadingCommand(statement)
    if (command && RISKY_SET.has(command) && !seen.has(command)) {
      seen.add(command)
      found.push(command as RiskyCommand)
    }
  }
  return found
}

function tokenizeSql(sql: string): SqlToken[] {
  const tokens: SqlToken[] = []
  const length = sql.length
  let index = 0

  while (index < length) {
    const char = sql[index]!

    if (char === ' ' || char === '\t' || char === '\n' || char === '\r' || char === '\f') {
      index += 1
      continue
    }

    if (char === '-' && sql[index + 1] === '-') {
      index += 2
      while (index < length && sql[index] !== '\n') index += 1
      continue
    }

    if (char === '/' && sql[index + 1] === '*') {
      index += 2
      let depth = 1
      while (index < length && depth > 0) {
        if (sql[index] === '/' && sql[index + 1] === '*') {
          depth += 1
          index += 2
          continue
        }
        if (sql[index] === '*' && sql[index + 1] === '/') {
          depth -= 1
          index += 2
          continue
        }
        index += 1
      }
      continue
    }

    const tag = dollarTag(sql, index)
    if (tag) {
      index += tag.length
      const close = sql.indexOf(tag, index)
      index = close === -1 ? length : close + tag.length
      continue
    }

    if ((char === 'e' || char === 'E') && sql[index + 1] === "'") {
      index = skipQuoted(sql, index + 2, true)
      continue
    }
    if ((char === 'u' || char === 'U') && sql[index + 1] === '&' && sql[index + 2] === "'") {
      index = skipQuoted(sql, index + 3, false)
      continue
    }
    if (char === "'") {
      index = skipQuoted(sql, index + 1, false)
      continue
    }

    if (char === '"') {
      index += 1
      while (index < length) {
        if (sql[index] === '"' && sql[index + 1] === '"') {
          index += 2
          continue
        }
        if (sql[index] === '"') {
          index += 1
          break
        }
        index += 1
      }
      tokens.push({ kind: 'word', value: '' })
      continue
    }

    if (/[A-Za-z_]/.test(char)) {
      let end = index + 1
      while (end < length && /[A-Za-z0-9_]/.test(sql[end]!)) end += 1
      tokens.push({ kind: 'word', value: sql.slice(index, end).toUpperCase() })
      index = end
      continue
    }

    tokens.push({ kind: 'punct', value: char })
    index += 1
  }

  return tokens
}

function dollarTag(sql: string, index: number): string | null {
  if (sql[index] !== '$') return null
  if (sql[index + 1] === '$') return '$$'
  if (!/[A-Za-z_]/.test(sql[index + 1] ?? '')) return null
  let end = index + 2
  while (end < sql.length && /[A-Za-z0-9_]/.test(sql[end]!)) end += 1
  if (sql[end] === '$') return sql.slice(index, end + 1)
  return null
}

function skipQuoted(sql: string, index: number, escaped: boolean): number {
  while (index < sql.length) {
    if (escaped && sql[index] === '\\') {
      index += 2
      continue
    }
    if (sql[index] === "'" && sql[index + 1] === "'") {
      index += 2
      continue
    }
    if (sql[index] === "'") return index + 1
    index += 1
  }
  return sql.length
}

function splitStatements(tokens: SqlToken[]): SqlToken[][] {
  const statements: SqlToken[][] = []
  let current: SqlToken[] = []
  for (const token of tokens) {
    if (token.kind === 'punct' && token.value === ';') {
      if (current.length > 0) statements.push(current)
      current = []
      continue
    }
    current.push(token)
  }
  if (current.length > 0) statements.push(current)
  return statements
}

function wordAt(tokens: SqlToken[], index: number): string | null {
  const token = tokens[index]
  return token?.kind === 'word' && token.value ? token.value : null
}

function punctAt(tokens: SqlToken[], index: number): string | null {
  const token = tokens[index]
  return token?.kind === 'punct' ? token.value : null
}

function skipParens(tokens: SqlToken[], index: number): number {
  if (punctAt(tokens, index) !== '(') return index
  let depth = 0
  for (let cursor = index; cursor < tokens.length; cursor++) {
    if (punctAt(tokens, cursor) === '(') depth += 1
    else if (punctAt(tokens, cursor) === ')') {
      depth -= 1
      if (depth === 0) return cursor + 1
    }
  }
  return tokens.length
}

function skipCte(tokens: SqlToken[], index: number): number {
  let cursor = index + 1
  if (wordAt(tokens, cursor) === 'RECURSIVE') cursor += 1
  while (cursor < tokens.length) {
    if (tokens[cursor]?.kind !== 'word') break
    cursor += 1
    if (punctAt(tokens, cursor) === '(') cursor = skipParens(tokens, cursor)
    if (wordAt(tokens, cursor) !== 'AS') break
    cursor += 1
    if (wordAt(tokens, cursor) === 'NOT') cursor += 1
    if (wordAt(tokens, cursor) === 'MATERIALIZED') cursor += 1
    if (punctAt(tokens, cursor) === '(') cursor = skipParens(tokens, cursor)
    if (punctAt(tokens, cursor) === ',') {
      cursor += 1
      continue
    }
    break
  }
  return cursor
}

const EXPLAIN_FLAGS = new Set([
  'ANALYZE',
  'VERBOSE',
  'COSTS',
  'SETTINGS',
  'GENERIC_PLAN',
  'BUFFERS',
  'WAL',
  'TIMING',
  'SUMMARY',
])

function skipExplain(tokens: SqlToken[], index: number): { next: number; analyze: boolean } {
  let cursor = index + 1
  let analyze = false
  if (punctAt(tokens, cursor) === '(') {
    const end = skipParens(tokens, cursor)
    for (let at = cursor; at < end; at++) {
      if (wordAt(tokens, at) === 'ANALYZE') analyze = true
    }
    return { next: end, analyze }
  }
  while (wordAt(tokens, cursor) && EXPLAIN_FLAGS.has(wordAt(tokens, cursor)!)) {
    if (wordAt(tokens, cursor) === 'ANALYZE') analyze = true
    cursor += 1
  }
  if (wordAt(tokens, cursor) === 'FORMAT') cursor += 2
  return { next: cursor, analyze }
}

function leadingCommand(tokens: SqlToken[]): string | null {
  let index = 0
  while (index < tokens.length) {
    const word = wordAt(tokens, index)
    if (!word) {
      index += 1
      continue
    }
    if (word === 'WITH') {
      index = skipCte(tokens, index)
      continue
    }
    if (word === 'EXPLAIN') {
      const skipped = skipExplain(tokens, index)
      if (!skipped.analyze) return null
      index = skipped.next
      continue
    }
    return word
  }
  return null
}

export function isExecuteKey(key: string): boolean {
  return EXECUTE_KEYS.has(key)
}

export function pushHistory(history: string[], query: string): string[] {
  const trimmed = query.trim()
  if (!trimmed) return history
  if (history[history.length - 1] === trimmed) return history
  const next = [...history, trimmed]
  return next.length > SQL_HISTORY_LIMIT ? next.slice(-SQL_HISTORY_LIMIT) : next
}

export function insertAt(text: string, cursor: number, chunk: string): SqlEditor {
  const at = clamp(cursor, 0, text.length)
  return { text: text.slice(0, at) + chunk + text.slice(at), cursor: at + chunk.length }
}

export function backspaceAt(text: string, cursor: number): SqlEditor {
  if (cursor <= 0) return { text, cursor }
  return { text: text.slice(0, cursor - 1) + text.slice(cursor), cursor: cursor - 1 }
}

export function deleteAt(text: string, cursor: number): SqlEditor {
  if (cursor >= text.length) return { text, cursor }
  return { text: text.slice(0, cursor) + text.slice(cursor + 1), cursor }
}

export function lineBounds(text: string, cursor: number): { start: number; end: number } {
  const start = text.lastIndexOf('\n', Math.max(0, cursor) - 1) + 1
  const newline = text.indexOf('\n', cursor)
  return { start, end: newline === -1 ? text.length : newline }
}

export function moveHorizontal(text: string, cursor: number, delta: number): number {
  return clamp(cursor + delta, 0, text.length)
}

export function moveVertical(text: string, cursor: number, direction: -1 | 1): number {
  const { start, end } = lineBounds(text, cursor)
  const column = cursor - start
  if (direction === -1) {
    if (start === 0) return cursor
    const prevEnd = start - 1
    const prevStart = text.lastIndexOf('\n', prevEnd - 1) + 1
    return prevStart + Math.min(column, prevEnd - prevStart)
  }
  if (end === text.length) return cursor
  const nextStart = end + 1
  const nextNewline = text.indexOf('\n', nextStart)
  const nextEnd = nextNewline === -1 ? text.length : nextNewline
  return nextStart + Math.min(column, nextEnd - nextStart)
}

export function deleteWordBefore(text: string, cursor: number): SqlEditor {
  if (cursor <= 0) return { text, cursor }
  let index = cursor
  while (index > 0 && /\s/.test(text[index - 1]!)) index -= 1
  while (index > 0 && !/\s/.test(text[index - 1]!)) index -= 1
  return { text: text.slice(0, index) + text.slice(cursor), cursor: index }
}

export function deleteToLineStart(text: string, cursor: number): SqlEditor {
  const { start } = lineBounds(text, cursor)
  if (cursor === start) return backspaceAt(text, cursor)
  return { text: text.slice(0, start) + text.slice(cursor), cursor: start }
}

export function deleteToLineEnd(text: string, cursor: number): SqlEditor {
  const { end } = lineBounds(text, cursor)
  if (cursor === end) return deleteAt(text, cursor)
  return { text: text.slice(0, cursor) + text.slice(end), cursor }
}

const CTRL_A = '\x01'
const CTRL_E = '\x05'
const CTRL_K = '\x0b'
const CTRL_L = '\x0c'
const CTRL_N = '\x0e'
const CTRL_P = '\x10'
const CTRL_U = '\x15'
const CTRL_W = '\x17'
const BACKSPACE = '\x7f'
const ALT_BACKSPACE = '\x08'

const EXECUTE_KEYS = new Set([
  '\n',
  '\x1b[15~',
  '\x1b[13;5u',
  '\x1b[27;5;13~',
])

const PRINTABLE_CONTROLS = new Set(['\r', '\n'])

export function interpretSqlKey(key: string, editor: SqlEditor): SqlKeyEffect {
  if (EXECUTE_KEYS.has(key)) return { type: 'execute' }
  if (key === '\x1b[5~') return { type: 'scroll-results', pages: -1 }
  if (key === '\x1b[6~') return { type: 'scroll-results', pages: 1 }
  if (key === CTRL_P) return { type: 'history', direction: -1 }
  if (key === CTRL_N) return { type: 'history', direction: 1 }

  if (key === CTRL_L) return { type: 'edit', editor: { text: '', cursor: 0 } }
  if (key === BACKSPACE || key === ALT_BACKSPACE) {
    return { type: 'edit', editor: backspaceAt(editor.text, editor.cursor) }
  }
  if (key === '\x1b[3~') return { type: 'edit', editor: deleteAt(editor.text, editor.cursor) }
  if (key === CTRL_W) return { type: 'edit', editor: deleteWordBefore(editor.text, editor.cursor) }
  if (key === CTRL_U) return { type: 'edit', editor: deleteToLineStart(editor.text, editor.cursor) }
  if (key === CTRL_K) return { type: 'edit', editor: deleteToLineEnd(editor.text, editor.cursor) }

  if (key === CTRL_A || key === '\x1b[H' || key === '\x1b[1~') {
    const { start } = lineBounds(editor.text, editor.cursor)
    return { type: 'edit', editor: { text: editor.text, cursor: start } }
  }
  if (key === CTRL_E || key === '\x1b[F' || key === '\x1b[4~') {
    const { end } = lineBounds(editor.text, editor.cursor)
    return { type: 'edit', editor: { text: editor.text, cursor: end } }
  }
  if (key === '\x1b[D') {
    return {
      type: 'edit',
      editor: { text: editor.text, cursor: moveHorizontal(editor.text, editor.cursor, -1) },
    }
  }
  if (key === '\x1b[C') {
    return {
      type: 'edit',
      editor: { text: editor.text, cursor: moveHorizontal(editor.text, editor.cursor, 1) },
    }
  }
  if (key === '\x1b[A') {
    return {
      type: 'edit',
      editor: { text: editor.text, cursor: moveVertical(editor.text, editor.cursor, -1) },
    }
  }
  if (key === '\x1b[B') {
    return {
      type: 'edit',
      editor: { text: editor.text, cursor: moveVertical(editor.text, editor.cursor, 1) },
    }
  }

  if (key === '\r') return { type: 'edit', editor: insertAt(editor.text, editor.cursor, '\n') }

  // A paste arrives as one chunk of printable text, including newlines.
  if (key.length > 1 && !key.startsWith('\x1b')) {
    const chunk = key
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\t/g, '  ')
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    if (chunk.length > 0) {
      return { type: 'edit', editor: insertAt(editor.text, editor.cursor, chunk) }
    }
  }

  if (key.length === 1 && !isControlChar(key)) {
    return { type: 'edit', editor: insertAt(editor.text, editor.cursor, key) }
  }

  if (PRINTABLE_CONTROLS.has(key)) {
    return { type: 'edit', editor: insertAt(editor.text, editor.cursor, '\n') }
  }

  return { type: 'ignore' }
}

function isControlChar(char: string): boolean {
  if (char.length !== 1) return false
  const code = char.charCodeAt(0)
  return code < 32 || code === 127
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
