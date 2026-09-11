/**
 * ANSI rendering primitives. Every helper takes and returns plain strings;
 * width-aware helpers ignore escape sequences so colored text still lines up.
 */

const ANSI_PATTERN = /\x1B\[[0-9;]*m/g
/** OSC 8 hyperlinks, terminated by either BEL or ST. */
const OSC_PATTERN = /\x1B\]8;[^\x1B\x07]*(?:\x07|\x1B\\)/g
/** Either escape, anchored, for the width-aware walkers below. */
const ESCAPE_AT = /^(?:\x1B\[[0-9;]*m|\x1B\]8;[^\x1B\x07]*(?:\x07|\x1B\\))/

export const colorEnabled =
  !process.env.NO_COLOR && process.env.TERM !== 'dumb'

export const stripAnsi = (text: string): string =>
  text.replace(OSC_PATTERN, '').replace(ANSI_PATTERN, '')
export const visibleWidth = (text: string): number => stripAnsi(text).length

const style =
  (open: string, close: string) =>
  (text: string): string =>
    colorEnabled ? `\x1B[${open}m${text}\x1B[${close}m` : text

export const bold = style('1', '22')
export const dim = style('2', '22')
export const italic = style('3', '23')
export const inverse = style('7', '27')

const rgb = (r: number, g: number, b: number) => style(`38;2;${r};${g};${b}`, '39')
const bgRgb = (r: number, g: number, b: number) => style(`48;2;${r};${g};${b}`, '49')

/** Palette lifted from the admin dashboard's Tailwind classes. */
export const color = {
  blue: rgb(59, 130, 246),
  green: rgb(34, 197, 94),
  purple: rgb(168, 85, 247),
  amber: rgb(245, 158, 11),
  red: rgb(248, 113, 113),
  violet: rgb(139, 92, 246),
  cyan: rgb(34, 211, 238),
  yellow: rgb(250, 204, 21),
  text: rgb(226, 232, 240),
  muted: rgb(148, 163, 184),
  faint: rgb(100, 116, 139),
}

/**
 * Row backgrounds. These sit behind text that is already coloured, which works
 * because every foreground helper closes with 39 rather than a full reset.
 */
export const background = {
  bar: bgRgb(30, 45, 70),
  barAlt: bgRgb(24, 36, 56),
  stripe: bgRgb(23, 28, 38),
}

export type Paint = (text: string) => string

/** Truncate plain text with an ellipsis. Call this before applying color. */
export function truncate(text: string, max: number): string {
  if (max <= 0) return ''
  if (text.length <= max) return text
  if (max === 1) return '…'
  return `${text.slice(0, max - 1)}…`
}

export function padEnd(text: string, size: number): string {
  const gap = size - visibleWidth(text)
  return gap > 0 ? text + ' '.repeat(gap) : text
}

export function padStart(text: string, size: number): string {
  const gap = size - visibleWidth(text)
  return gap > 0 ? ' '.repeat(gap) + text : text
}

export function center(text: string, size: number): string {
  const gap = size - visibleWidth(text)
  if (gap <= 0) return text
  const left = Math.floor(gap / 2)
  return ' '.repeat(left) + text + ' '.repeat(gap - left)
}

/** Fixed-width cell. Truncates plain text, then paints, then pads. */
export function cell(
  text: string,
  size: number,
  options: { align?: 'left' | 'right'; paint?: Paint } = {},
): string {
  const { align = 'left', paint } = options
  const clipped = truncate(text, size)
  const painted = paint ? paint(clipped) : clipped
  return align === 'right' ? padStart(painted, size) : padEnd(painted, size)
}

export interface PanelOptions {
  title: string
  width: number
  body: string[]
  /** Right-aligned note in the top border, e.g. "updated 12s ago". */
  note?: string
  accent?: Paint
}

/** A rounded box with a titled top border. Body lines may contain color. */
export function panel({ title, width, body, note, accent = color.muted }: PanelOptions): string[] {
  const inner = Math.max(4, width - 2)
  const border = color.faint
  const head = ` ${title} `
  const tail = note ? ` ${note} ` : ''
  const fillWidth = Math.max(0, inner - head.length - tail.length)

  const top =
    border('╭') +
    accent(bold(head)) +
    border('─'.repeat(fillWidth)) +
    (tail ? dim(border(tail)) : '') +
    border('╮')

  const lines = body.map(
    (line) => border('│') + padEnd(truncateAnsiSafe(line, inner), inner) + border('│'),
  )

  return [top, ...lines, border('╰' + '─'.repeat(inner) + '╯')]
}

/**
 * Clip a possibly-colored line to a visible width. Escape sequences are kept
 * so colors never leak past the clip point.
 */
export function truncateAnsiSafe(line: string, max: number): string {
  if (visibleWidth(line) <= max) return line
  let visible = 0
  let out = ''
  let index = 0
  while (index < line.length && visible < max - 1) {
    if (line[index] === '\x1B') {
      const match = ESCAPE_AT.exec(line.slice(index))
      if (match) {
        out += match[0]
        index += match[0].length
        continue
      }
    }
    out += line[index]
    index += 1
    visible += 1
  }
  return `${out}…\x1B[0m`
}

/**
 * An OSC 8 hyperlink. Terminals that understand it make `text` clickable and
 * every other terminal just prints `text`, so it costs nothing to emit.
 */
export function link(text: string, url: string): string {
  if (!colorEnabled) return text
  return `\x1B]8;;${url}\x1B\\${text}\x1B]8;;\x1B\\`
}

/** Split a coloured line at a visible column without cutting an escape in half. */
export function splitAtVisible(line: string, at: number): [string, string] {
  let visible = 0
  let index = 0
  while (index < line.length && visible < at) {
    if (line[index] === '\x1B') {
      const match = ESCAPE_AT.exec(line.slice(index))
      if (match) {
        index += match[0].length
        continue
      }
    }
    index += 1
    visible += 1
  }
  return [line.slice(0, index), line.slice(index)]
}

/**
 * Lay a background bar behind a row of text: `cells` columns get `barPaint`
 * and the rest of the row gets `restPaint`, so the eye can follow a value
 * across the columns that describe it. The row is padded to `width` first so
 * the background reaches the panel border.
 */
export function backgroundBar(
  line: string,
  width: number,
  cells: number,
  barPaint: Paint,
  restPaint: Paint = (text) => text,
): string {
  const padded = padEnd(line, width)
  const clamped = Math.max(0, Math.min(width, cells))
  if (clamped === 0) return restPaint(padded)
  if (clamped >= width) return barPaint(padded)
  const [bar, rest] = splitAtVisible(padded, clamped)
  return barPaint(bar) + restPaint(rest)
}

/** Lay blocks of lines out side by side, padding short blocks with blanks. */
export function columns(blocks: string[][], widths: number[], gap = 1): string[] {
  const height = Math.max(0, ...blocks.map((block) => block.length))
  const spacer = ' '.repeat(gap)
  const rows: string[] = []
  for (let row = 0; row < height; row++) {
    rows.push(
      blocks
        .map((block, index) => padEnd(block[row] ?? '', widths[index] ?? 0))
        .join(spacer),
    )
  }
  return rows
}

/** Split a width into `count` roughly equal columns, accounting for gaps. */
export function splitWidth(total: number, count: number, gap = 1): number[] {
  const usable = total - gap * (count - 1)
  const base = Math.floor(usable / count)
  const extra = usable - base * count
  return Array.from({ length: count }, (_, index) => base + (index < extra ? 1 : 0))
}

const BLOCKS = [' ', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']

/**
 * Split `span` columns across `count` bars, spreading the remainder evenly so
 * a short series still fills a wide panel without a ragged right edge.
 */
export function distributeWidths(span: number, count: number): number[] {
  if (count <= 0) return []
  const base = Math.floor(span / count)
  const extra = span - base * count
  return Array.from(
    { length: count },
    (_, index) =>
      base +
      (Math.floor((index * extra) / count) !== Math.floor(((index + 1) * extra) / count)
        ? 1
        : 0),
  )
}

/**
 * Multi-row vertical bar chart. Returns `height` lines, top row first.
 * `widths` gives each bar its column count.
 */
export function barChart(
  values: number[],
  height: number,
  paint: Paint,
  widths: number[],
): string[] {
  const span = widths.reduce((total, size) => total + size, 0)
  const max = Math.max(...values, 0)
  if (max <= 0) return Array.from({ length: height }, () => ' '.repeat(span))

  const eighths = values.map((value) =>
    Math.round((Math.max(0, value) / max) * height * 8),
  )

  const rows: string[] = []
  for (let row = 0; row < height; row++) {
    const floor = (height - 1 - row) * 8
    const chars = eighths.map((total) => {
      const remainder = total - floor
      if (remainder >= 8) return '█'
      if (remainder <= 0) return ' '
      return BLOCKS[remainder]
    })
    rows.push(paint(chars.map((char, index) => char.repeat(widths[index] ?? 1)).join('')))
  }
  return rows
}

/**
 * Two-tone bars: `base` values fill from the axis up, `top` values stack on
 * the shoulder of each one. A cell takes the colour of whichever segment
 * covers most of it, so the boundary lands on a character edge rather than
 * splitting one.
 */
export function stackedBarChart(
  base: number[],
  top: number[],
  height: number,
  basePaint: Paint,
  topPaint: Paint,
  widths: number[],
): string[] {
  const span = widths.reduce((total, size) => total + size, 0)
  const totals = base.map((value, index) => Math.max(0, value) + Math.max(0, top[index] ?? 0))
  const max = Math.max(...totals, 0)
  if (max <= 0) return Array.from({ length: height }, () => ' '.repeat(span))

  const scale = (value: number) => Math.round((Math.max(0, value) / max) * height * 8)
  const totalEighths = totals.map(scale)
  const baseEighths = base.map((value, index) => Math.min(scale(value), totalEighths[index]))

  const rows: string[] = []
  for (let row = 0; row < height; row++) {
    const floor = (height - 1 - row) * 8
    const cells = totalEighths.map((total, index) => {
      const remainder = total - floor
      if (remainder <= 0) return { char: ' ', paint: basePaint }
      const char = remainder >= 8 ? '█' : BLOCKS[remainder]
      // Midpoint of the part of this cell that is actually drawn.
      const middle = floor + Math.min(remainder, 8) / 2
      return { char, paint: middle >= baseEighths[index] ? topPaint : basePaint }
    })

    // Collapse neighbouring cells of the same colour into one escape sequence.
    let line = ''
    let run = ''
    let runPaint: Paint | null = null
    for (const [index, cell] of cells.entries()) {
      const piece = cell.char.repeat(widths[index] ?? 1)
      if (runPaint && cell.paint !== runPaint) {
        line += runPaint(run)
        run = ''
      }
      runPaint = cell.paint
      run += piece
    }
    if (runPaint) line += runPaint(run)
    rows.push(line)
  }

  return rows
}

/** Single-row sparkline, sharing bar widths with the chart above it. */
export function sparkline(values: number[], paint: Paint, widths: number[]): string {
  const span = widths.reduce((total, size) => total + size, 0)
  const max = Math.max(...values, 0)
  if (max <= 0) return ' '.repeat(span)
  return paint(
    values
      .map((value, index) =>
        BLOCKS[Math.max(1, Math.round((Math.max(0, value) / max) * 8))].repeat(
          widths[index] ?? 1,
        ),
      )
      .join(''),
  )
}

/** Place `first`, `middle` and `last` across a `span`-wide axis label row. */
export function axisLabels(
  first: string,
  middle: string,
  last: string,
  span: number,
): string {
  const slots = new Array(Math.max(0, span)).fill(' ')
  const place = (text: string, start: number) => {
    const offset = Math.max(0, Math.min(start, slots.length - text.length))
    for (let index = 0; index < text.length; index++) {
      if (offset + index < slots.length) slots[offset + index] = text[index]
    }
  }
  place(first, 0)
  if (span > first.length + middle.length + last.length + 4) {
    place(middle, Math.floor(span / 2 - middle.length / 2))
  }
  place(last, span - last.length)
  return slots.join('')
}

/** Horizontal proportion bar, e.g. ████████░░░░ */
export function hbar(value: number, max: number, size: number, paint: Paint): string {
  if (size <= 0) return ''
  const filled = max > 0 ? Math.round((Math.max(0, value) / max) * size) : 0
  const clamped = Math.min(size, Math.max(value > 0 ? 1 : 0, filled))
  return paint('█'.repeat(clamped)) + dim(color.faint('░'.repeat(size - clamped)))
}

const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export function spinner(tick: number): string {
  return SPINNER[tick % SPINNER.length]
}

/** Terminal control sequences. */
export const term = {
  enterAlt: '\x1B[?1049h',
  leaveAlt: '\x1B[?1049l',
  hideCursor: '\x1B[?25l',
  showCursor: '\x1B[?25h',
  home: '\x1B[H',
  clear: '\x1B[2J',
  clearBelow: '\x1B[J',
  clearLine: '\x1B[K',
  reset: '\x1B[0m',
}
