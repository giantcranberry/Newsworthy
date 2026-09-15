import { test, expect } from 'bun:test'
import {
  backspaceAt,
  findRiskyCommands,
  formatSqlValue,
  insertAt,
  interpretSqlKey,
  isNumericColumn,
  moveVertical,
  parseDatabaseTarget,
  pushHistory,
} from './sql.ts'
import {
  columnWidths,
  confirmBody,
  connectionBody,
  layoutEditor,
  renderResultGrid,
  sqlSummaryLine,
} from './sql-panels.ts'
import { stripAnsi, visibleWidth } from './ui.ts'

const SECRET_URL =
  'postgresql://postgres:s3cret-pass@aws-0-us-east-1.pooler.supabase.com:5432/fraction?sslmode=require'

test('parseDatabaseTarget reads name, host and user and drops the password', () => {
  const target = parseDatabaseTarget(SECRET_URL, { DIRECT_DATABASE_URL: SECRET_URL })
  expect(target.database).toBe('fraction')
  expect(target.host).toBe('aws-0-us-east-1.pooler.supabase.com')
  expect(target.port).toBe('5432')
  expect(target.user).toBe('postgres')
  expect(target.envVar).toBe('DIRECT_DATABASE_URL')
  expect(JSON.stringify(target)).not.toContain('s3cret-pass')
})

test('parseDatabaseTarget prefers DIRECT_DATABASE_URL as the source label', () => {
  const target = parseDatabaseTarget(SECRET_URL, {
    DIRECT_DATABASE_URL: SECRET_URL,
    DATABASE_URL: 'postgresql://other:pw@127.0.0.1:5432/other',
  })
  expect(target.envVar).toBe('DIRECT_DATABASE_URL')
  expect(target.database).toBe('fraction')
})

test('parseDatabaseTarget falls back when the URL is empty', () => {
  const target = parseDatabaseTarget('', {})
  expect(target.database).toBe('unknown')
  expect(target.envVar).toBeNull()
})

test('formatSqlValue renders nulls, dates, arrays and json', () => {
  expect(formatSqlValue(null)).toBe('NULL')
  expect(formatSqlValue(true)).toBe('true')
  expect(formatSqlValue(12.5)).toBe('12.5')
  expect(formatSqlValue(new Date('2026-09-14T15:04:05.000Z'))).toContain('2026-09-14 15:04:05')
  expect(formatSqlValue([1, null, 'a'])).toBe('{1,NULL,a}')
  expect(formatSqlValue({ id: 1 })).toBe('{"id":1}')
})

test('isNumericColumn ignores nulls and rejects mixed types', () => {
  expect(isNumericColumn([1, null, 3n])).toBe(true)
  expect(isNumericColumn([1, 'x'])).toBe(false)
})

test('editor insert, backspace and vertical movement keep the cursor on the column', () => {
  const typed = insertAt('', 0, 'ab\ncd')
  expect(typed).toEqual({ text: 'ab\ncd', cursor: 5 })
  expect(backspaceAt(typed.text, typed.cursor)).toEqual({ text: 'ab\nc', cursor: 4 })
  expect(moveVertical('ab\ncd', 1, 1)).toBe(4)
  expect(moveVertical('ab\ncd', 4, -1)).toBe(1)
})

test('Ctrl-J and F5 execute, Enter inserts a newline, letters type', () => {
  const editor = { text: 'select 1', cursor: 8 }
  expect(interpretSqlKey('\n', editor).type).toBe('execute')
  expect(interpretSqlKey('\x1b[15~', editor).type).toBe('execute')
  expect(interpretSqlKey('\r', editor)).toEqual({
    type: 'edit',
    editor: { text: 'select 1\n', cursor: 9 },
  })
  expect(interpretSqlKey(';', editor)).toEqual({
    type: 'edit',
    editor: { text: 'select 1;', cursor: 9 },
  })
})

test('a paste of several characters is inserted as one edit', () => {
  const effect = interpretSqlKey('select *\r\nfrom users;', { text: '', cursor: 0 })
  expect(effect).toEqual({
    type: 'edit',
    editor: { text: 'select *\nfrom users;', cursor: 20 },
  })
})

test('layoutEditor puts the cursor on a trailing newline row', () => {
  const view = layoutEditor('ab\n', 3, 40)
  expect(view.lines).toEqual(['ab', ''])
  expect(view.cursorRow).toBe(1)
  expect(view.cursorCol).toBe(0)
})

test('layoutEditor wraps long lines and keeps the cursor on the wrapped row', () => {
  const view = layoutEditor('abcdefghij', 6, 4)
  expect(view.lines).toEqual(['abcd', 'efgh', 'ij'])
  expect(view.cursorRow).toBe(1)
  expect(view.cursorCol).toBe(2)
})

test('connection copy shows the database name and never the password', () => {
  const target = parseDatabaseTarget(SECRET_URL, { DIRECT_DATABASE_URL: SECRET_URL })
  const session = {
    database: 'fraction',
    user: 'postgres',
    schema: 'public',
    address: '10.0.0.1',
    port: 5432,
    version: 'PostgreSQL 15.8 on aarch64',
  }
  const summary = stripAnsi(sqlSummaryLine(session, target))
  expect(summary).toContain('fraction')
  expect(summary).toContain('aws-0-us-east-1.pooler.supabase.com:5432')
  expect(summary).toContain('DIRECT_DATABASE_URL')
  expect(summary).not.toContain('s3cret-pass')
  expect(summary).not.toContain('10.0.0.1')

  const body = connectionBody(session, target, null, 80).map(stripAnsi).join('\n')
  expect(body).toContain('fraction')
  expect(body).toContain('postgres@aws-0-us-east-1.pooler.supabase.com:5432')
  expect(body).not.toContain('s3cret-pass')
  expect(body).not.toContain('10.0.0.1')
})

test('result grid lines fill the inner width and cap oversized columns', () => {
  const grid = renderResultGrid(
    {
      command: 'SELECT',
      rowCount: 2,
      columns: ['id', 'email'],
      rows: [
        [1, 'ada@example.com'],
        [2, 'al@example.com'],
      ],
      truncated: false,
      elapsedMs: 12,
    },
    60,
  )
  for (const line of grid) {
    if (line.length === 0) continue
    expect(visibleWidth(line)).toBeLessThanOrEqual(60)
  }
  expect(stripAnsi(grid.join('\n'))).toContain('ada@example.com')
})

test('columnWidths spend leftover space and never exceed the inner width', () => {
  const widths = columnWidths(['a', 'b'], [['1', '2']], 40)
  expect(widths.reduce((sum, size) => sum + size, 0) + 1).toBe(40)
  const tight = columnWidths(['name'], [['x'.repeat(80)]], 20)
  expect(tight[0]).toBe(20)
})

test('pushHistory skips blanks and consecutive duplicates', () => {
  expect(pushHistory([], '')).toEqual([])
  expect(pushHistory(['select 1'], 'select 1')).toEqual(['select 1'])
  expect(pushHistory(['select 1'], 'select 2')).toEqual(['select 1', 'select 2'])
})

test('findRiskyCommands flags UPDATE DELETE TRUNCATE DROP and ignores lookalikes', () => {
  expect(findRiskyCommands('SELECT * FROM updates')).toEqual([])
  expect(findRiskyCommands("SELECT 'drop table users'")).toEqual([])
  expect(findRiskyCommands('-- delete from users\nSELECT 1')).toEqual([])
  expect(findRiskyCommands('/* UPDATE users SET x = 1 */ SELECT 1')).toEqual([])
  expect(findRiskyCommands('UPDATE users SET admin = true')).toEqual(['UPDATE'])
  expect(findRiskyCommands('delete from users where id = 1')).toEqual(['DELETE'])
  expect(findRiskyCommands('TRUNCATE TABLE users')).toEqual(['TRUNCATE'])
  expect(findRiskyCommands('DROP TABLE users')).toEqual(['DROP'])
  expect(findRiskyCommands('WITH x AS (SELECT 1) DELETE FROM users')).toEqual(['DELETE'])
  expect(findRiskyCommands('SELECT 1; UPDATE users SET x = 1; DROP INDEX foo')).toEqual([
    'UPDATE',
    'DROP',
  ])
  expect(findRiskyCommands('EXPLAIN DELETE FROM users')).toEqual([])
  expect(findRiskyCommands('EXPLAIN ANALYZE DELETE FROM users')).toEqual(['DELETE'])
  expect(findRiskyCommands('EXPLAIN (ANALYZE, BUFFERS) UPDATE users SET x = 1')).toEqual(['UPDATE'])
})

test('confirm copy asks Risky, Continue? and names the commands', () => {
  const body = confirmBody(['DELETE', 'DROP'], 80).map(stripAnsi).join('\n')
  expect(body).toContain('Risky, Continue?')
  expect(body).toContain('This will run DELETE, DROP.')
  expect(body).toContain('y')
  expect(body).toContain('n')
})
