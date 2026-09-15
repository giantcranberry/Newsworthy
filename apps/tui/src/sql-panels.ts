/** Renderers for the SQL tab: connection, editor and result grid. */

import {
  background,
  bold,
  cell,
  color,
  dim,
  inverse,
  padEnd,
  panel,
  truncate,
  type Paint,
} from './ui.ts'
import {
  formatSqlValue,
  isNumericColumn,
  type DatabaseTarget,
  type RiskyCommand,
  type SqlEditor,
  type SqlResult,
  type SqlSession,
} from './sql.ts'

const BLANK = ''

export function sqlSummaryLine(session: SqlSession | null, target: DatabaseTarget): string {
  const database = session?.database || target.database
  const user = session?.user || target.user
  const schema = session?.schema
  const hostLabel = target.port ? `${target.host}:${target.port}` : target.host

  const parts = [
    `${color.green('db')} ${bold(color.text(database || '—'))}`,
    `${color.blue('host')} ${bold(hostLabel || '—')}`,
    `${color.muted('user')} ${bold(user || '—')}`,
  ]
  if (schema) parts.push(`${color.muted('schema')} ${bold(schema)}`)
  if (target.envVar) parts.push(dim(color.faint(target.envVar)))
  return ' ' + parts.join(dim(color.faint('  │  ')))
}

export function connectionBody(
  session: SqlSession | null,
  target: DatabaseTarget,
  error: string | null,
  width: number,
): string[] {
  const inner = width - 2
  const database = session?.database || target.database
  const user = session?.user || target.user
  const host = target.host
  const port = target.port
  const schema = session?.schema
  const version = session?.version
    ? session.version.replace(/^PostgreSQL\s+/i, 'Postgres ')
    : null

  const endpoint = [user, user ? '@' : '', host, port ? `:${port}` : ''].join('')
  const extras = [
    schema ? `schema ${schema}` : '',
    target.envVar ?? '',
  ].filter(Boolean)

  return [
    BLANK,
    ` ${bold(color.green(truncate(database || 'unknown', inner - 1)))}`,
    ` ${color.muted(truncate(endpoint || 'not connected', inner - 1))}`,
    ...(extras.length > 0
      ? [` ${dim(color.faint(truncate(extras.join('  ·  '), inner - 1)))}`]
      : []),
    ...(version ? [` ${dim(color.faint(truncate(version, inner - 1)))}`] : []),
    ...(error ? [` ${color.red(truncate(error, inner - 1))}`] : []),
    BLANK,
  ]
}

export interface EditorView {
  lines: string[]
  cursorRow: number
  cursorCol: number
}

/** Wrap the editor on `width` columns and locate the cursor in that grid. */
export function layoutEditor(text: string, cursor: number, width: number): EditorView {
  const at = Math.max(0, Math.min(cursor, text.length))
  const logical = text.split('\n')
  const lines: string[] = []
  let cursorRow = 0
  let cursorCol = 0
  let offset = 0

  for (let index = 0; index < logical.length; index++) {
    const line = logical[index]!
    const lineStart = offset
    if (line.length === 0) {
      if (at === lineStart) {
        cursorRow = lines.length
        cursorCol = 0
      }
      lines.push('')
    } else {
      for (let column = 0; column < line.length; column += width) {
        const slice = line.slice(column, column + width)
        const start = lineStart + column
        const end = start + slice.length
        if (at >= start && at < end) {
          cursorRow = lines.length
          cursorCol = at - start
        } else if (at === end && column + width >= line.length) {
          cursorRow = lines.length
          cursorCol = slice.length
        }
        lines.push(slice)
      }
    }
    offset += line.length
    if (index < logical.length - 1) offset += 1
  }

  return { lines: lines.length > 0 ? lines : [''], cursorRow, cursorCol }
}

export function editorBody(
  editor: SqlEditor,
  width: number,
  height: number,
): string[] {
  const inner = Math.max(8, width - 3)
  const view = layoutEditor(editor.text, editor.cursor, inner)
  const maxStart = Math.max(0, view.lines.length - height)
  const start = Math.min(maxStart, Math.max(0, view.cursorRow - height + 1))
  const end = start + height

  const rows: string[] = []
  for (let row = start; row < end; row++) {
    const line = view.lines[row] ?? ''
    if (row === view.cursorRow) {
      const col = Math.min(view.cursorCol, line.length)
      const ch = line[col] ?? ' '
      const painted =
        ' ' +
        line.slice(0, col) +
        inverse(ch) +
        line.slice(col + (line[col] ? 1 : 0))
      rows.push(
        editor.text.length === 0
          ? painted + dim(color.faint(' Type SQL, then Ctrl-J or F5 to run'))
          : painted,
      )
    } else {
      rows.push(' ' + line)
    }
  }

  while (rows.length < height) rows.push(BLANK)
  return rows
}

export function confirmBody(commands: RiskyCommand[], width: number): string[] {
  const inner = width - 2
  const list = commands.join(', ')
  return [
    BLANK,
    ` ${bold(color.amber(truncate('Risky, Continue?', inner - 1)))}`,
    ` ${color.muted(truncate(`This will run ${list}.`, inner - 1))}`,
    BLANK,
    ` ${bold(color.green('y'))} ${color.muted('run')}   ${bold(color.red('n'))} ${color.muted('cancel')}`,
    BLANK,
  ]
}

export function resultNote(result: SqlResult | null, loading: boolean, error: string | null): string {
  if (loading) return 'running'
  if (error) return 'error'
  if (!result) return 'Ctrl-J or F5 to run'
  const elapsed = result.elapsedMs < 1000 ? `${result.elapsedMs}ms` : `${(result.elapsedMs / 1000).toFixed(1)}s`
  if (result.columns.length === 0) return `${result.command} ${result.rowCount} · ${elapsed}`
  const shown = result.rows.length
  const total = result.truncated ? `${shown}+` : String(result.rowCount)
  return `${result.command} ${total} · ${elapsed}`
}

export function resultsBody(
  result: SqlResult | null,
  error: string | null,
  width: number,
  height: number,
  scroll: number,
): string[] {
  const inner = width - 2
  if (error) {
    return padBody([BLANK, ` ${color.red(truncate(error, inner - 1))}`, BLANK], height)
  }
  if (!result) {
    return padBody(
      [BLANK, ` ${dim(color.faint('Run a query to see rows here.'))}`, BLANK],
      height,
    )
  }
  if (result.columns.length === 0) {
    const verb = result.command || 'OK'
    return padBody(
      [
        BLANK,
        ` ${bold(color.green(verb))} ${color.muted(String(result.rowCount))}`,
        ` ${dim(color.faint(`${result.elapsedMs}ms`))}`,
        BLANK,
      ],
      height,
    )
  }

  const grid = renderResultGrid(result, inner)
  const window = grid.slice(scroll, scroll + height)
  return padBody(window.length > 0 ? window : [BLANK], height)
}

export function renderResultGrid(result: SqlResult, inner: number): string[] {
  const names = result.columns
  const formatted = result.rows.map((row) => row.map(formatSqlValue))
  const numeric = names.map((_, index) => isNumericColumn(result.rows.map((row) => row[index])))
  const widths = columnWidths(names, formatted, inner - 1)

  const header =
    ' ' +
    names
      .map((name, index) =>
        cell(name, widths[index]!, {
          align: numeric[index] ? 'right' : 'left',
          paint: dim,
        }),
      )
      .join(' ')

  const rows = formatted.map((row, rowIndex) => {
    const line =
      ' ' +
      row
        .map((value, index) => {
          const paint: Paint =
            value === 'NULL' ? color.faint : numeric[index] ? color.text : color.muted
          return cell(value, widths[index]!, {
            align: numeric[index] ? 'right' : 'left',
            paint,
          })
        })
        .join(' ')
    return rowIndex % 2 === 1 ? background.stripe(padEnd(line, inner)) : line
  })

  const footerBits = [`${result.rowCount} ${result.rowCount === 1 ? 'row' : 'rows'}`]
  if (result.truncated) footerBits.push(`showing first ${result.rows.length}`)
  footerBits.push(`${result.elapsedMs}ms`)
  const footer = ` ${dim(color.faint(footerBits.join(' · ')))}`

  return [BLANK, header, ...rows, BLANK, footer, BLANK]
}

export function columnWidths(names: string[], rows: string[][], inner: number): number[] {
  const count = names.length
  if (count === 0) return []
  const gaps = count - 1
  const minCol = 4
  const maxCol = Math.max(12, Math.floor((inner - gaps) / Math.min(count, 4)))

  const widths = names.map((name, index) => {
    let size = Math.min(maxCol, Math.max(minCol, name.length))
    for (const row of rows) {
      const value = row[index] ?? ''
      size = Math.max(size, Math.min(maxCol, value.length))
    }
    return size
  })

  const fit = (sizes: number[]) => sizes.reduce((sum, size) => sum + size, 0) + gaps

  let total = fit(widths)
  while (total > inner && widths.some((size) => size > minCol)) {
    let widest = 0
    for (let index = 1; index < widths.length; index++) {
      if (widths[index]! > widths[widest]!) widest = index
    }
    if (widths[widest]! <= minCol) break
    widths[widest]! -= 1
    total -= 1
  }

  if (total < inner && widths.length > 0) {
    widths[widths.length - 1]! += inner - total
  }

  return widths
}

export function buildSqlBody(options: {
  width: number
  height: number
  editor: SqlEditor
  result: SqlResult | null
  resultScroll: number
  session: SqlSession | null
  target: DatabaseTarget
  sessionError: string | null
  resultError: string | null
  loading: boolean
  confirm: RiskyCommand[] | null
}): string[] {
  const {
    width,
    height,
    editor,
    result,
    resultScroll,
    session,
    target,
    sessionError,
    resultError,
    loading,
    confirm,
  } = options

  const connection = panel({
    title: 'Database',
    width,
    accent: color.green,
    note: target.envVar ?? '',
    body: connectionBody(session, target, sessionError, width),
  })

  const editorHeight = Math.min(10, Math.max(5, Math.floor(height / 4)))
  const query = panel({
    title: 'Query',
    width,
    accent: color.cyan,
    note: 'Ctrl-J / F5 run · Ctrl-L clear',
    body: editorBody(editor, width, editorHeight),
  })

  const used = connection.length + query.length + 2
  const resultsHeight = Math.max(6, height - used - 2)
  const results = confirm
    ? panel({
        title: 'Confirm',
        width,
        accent: color.amber,
        note: 'y run · n cancel',
        body: confirmBody(confirm, width),
      })
    : panel({
        title: result ? `Results (${result.rowCount})` : 'Results',
        width,
        accent: resultError ? color.red : color.blue,
        note: resultNote(result, loading, resultError),
        body: resultsBody(result, resultError, width, resultsHeight, resultScroll),
      })

  return [...connection, BLANK, ...query, BLANK, ...results]
}

function padBody(lines: string[], height: number): string[] {
  const next = lines.slice()
  while (next.length < height) next.push(BLANK)
  return next.slice(0, height)
}

export function resultGridLength(result: SqlResult | null, error: string | null, width: number): number {
  if (error || !result) return 3
  if (result.columns.length === 0) return 4
  return renderResultGrid(result, width - 2).length
}
