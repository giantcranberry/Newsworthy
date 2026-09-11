import { test, expect } from 'bun:test'
import {
  axisLabels,
  backgroundBar,
  barChart,
  link,
  padEnd,
  stripAnsi,
  stackedBarChart,
  color,
  distributeWidths,
  panel,
  sparkline,
  splitWidth,
  truncate,
  truncateAnsiSafe,
  visibleWidth,
} from './ui.ts'

test('distributeWidths fills the span exactly', () => {
  for (const span of [10, 47, 106, 200]) {
    for (const count of [1, 7, 30, 90]) {
      const widths = distributeWidths(span, count)
      expect(widths.length).toBe(count)
      if (span >= count) {
        expect(widths.reduce((total, size) => total + size, 0)).toBe(span)
      }
    }
  }
})

test('splitWidth accounts for the gaps between columns', () => {
  const widths = splitWidth(100, 4, 2)
  expect(widths.length).toBe(4)
  expect(widths.reduce((total, size) => total + size, 0) + 2 * 3).toBe(100)
})

test('panel lines are all the declared width', () => {
  const lines = panel({
    title: 'Sales',
    width: 80,
    note: 'updated 12s ago',
    body: ['', ` ${color.green('$1,234.00')}`, ' short', ' x'.repeat(200)],
  })
  for (const line of lines) {
    expect(visibleWidth(line)).toBe(80)
  }
})

test('truncateAnsiSafe clips colored text without leaking escapes', () => {
  const line = color.green('abcdefghij') + color.amber('klmnopqrst')
  const clipped = truncateAnsiSafe(line, 8)
  expect(visibleWidth(clipped)).toBeLessThanOrEqual(8)
  expect(clipped.endsWith('\x1B[0m')).toBe(true)
})

test('truncate adds an ellipsis only when it has to', () => {
  expect(truncate('hello', 10)).toBe('hello')
  expect(truncate('hello', 5)).toBe('hello')
  expect(truncate('hello', 4)).toBe('hel…')
  expect(truncate('hello', 0)).toBe('')
})

test('barChart returns the requested height at the requested span', () => {
  const values = [0, 5, 10, 3]
  const widths = distributeWidths(20, values.length)
  const rows = barChart(values, 6, (text) => text, widths)
  expect(rows.length).toBe(6)
  for (const row of rows) expect(visibleWidth(row)).toBe(20)
  // The tallest bar reaches the top row.
  expect(rows[0]).toContain('█')
})

test('barChart and sparkline stay sized when every value is zero', () => {
  const widths = distributeWidths(12, 4)
  const rows = barChart([0, 0, 0, 0], 3, (text) => text, widths)
  expect(rows.every((row) => visibleWidth(row) === 12)).toBe(true)
  expect(visibleWidth(sparkline([0, 0, 0, 0], (text) => text, widths))).toBe(12)
})

test('axisLabels pins the first and last label to the ends', () => {
  const labels = axisLabels('Aug 12', 'Aug 27', 'Sep 10', 60)
  expect(labels.length).toBe(60)
  expect(labels.startsWith('Aug 12')).toBe(true)
  expect(labels.endsWith('Sep 10')).toBe(true)
  expect(labels).toContain('Aug 27')
})

test('axisLabels drops the middle label when there is no room', () => {
  const labels = axisLabels('Aug 12', 'Aug 27', 'Sep 10', 14)
  expect(labels.length).toBe(14)
  expect(labels).not.toContain('Aug 27')
})

test('stackedBarChart puts the top segment above the base segment', () => {
  const widths = distributeWidths(3, 3)
  const rows = stackedBarChart(
    [8, 0, 4],
    [0, 8, 4],
    4,
    (text) => `B${text}B`,
    (text) => `G${text}G`,
    widths,
  )

  expect(rows).toHaveLength(4)
  // A column of only base revenue never picks up the top colour, and one of
  // only out-of-band revenue is entirely the top colour.
  const plain = rows.map((row) => row.replace(/[BG]/g, ''))
  expect(plain.every((row) => row.length === 3)).toBe(true)

  // Column three is half and half, so its lower two rows are base and its
  // upper two are the top segment.
  const columnColour = (row: string, index: number): string => {
    let column = -1
    let paint = ''
    for (let at = 0; at < row.length; at++) {
      const char = row[at]
      if (char === 'B' || char === 'G') {
        paint = char
        continue
      }
      column += 1
      if (column === index) return char === ' ' ? ' ' : paint
    }
    return ' '
  }

  expect(columnColour(rows[3], 2)).toBe('B')
  expect(columnColour(rows[2], 2)).toBe('B')
  expect(columnColour(rows[1], 2)).toBe('G')
  expect(columnColour(rows[0], 2)).toBe('G')
  expect(columnColour(rows[3], 0)).toBe('B')
  expect(columnColour(rows[0], 0)).toBe('B')
  expect(columnColour(rows[3], 1)).toBe('G')
  expect(columnColour(rows[0], 1)).toBe('G')
})

test('stackedBarChart keeps its size when every value is zero', () => {
  const widths = distributeWidths(12, 4)
  const rows = stackedBarChart(
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    3,
    (text) => text,
    (text) => text,
    widths,
  )
  expect(rows).toHaveLength(3)
  expect(rows.every((row) => row.length === 12)).toBe(true)
})

test('hyperlinks take no visible width and survive padding', () => {
  const linked = link('Wellness Eternal', 'https://dashboard.stripe.com/invoices/in_1')
  expect(visibleWidth(linked)).toBe('Wellness Eternal'.length)
  expect(stripAnsi(linked)).toBe('Wellness Eternal')
  expect(visibleWidth(padEnd(linked, 30))).toBe(30)
  // Clipping a linked cell keeps the escape that closes the link.
  expect(stripAnsi(truncateAnsiSafe(linked, 8))).toBe('Wellnes…')
})

test('backgroundBar shades the requested columns and leaves the width alone', () => {
  const row = `${'a'.repeat(4)}${'b'.repeat(4)}`
  const shaded = backgroundBar(row, 10, 4, (text) => `[${text}]`, (text) => `<${text}>`)
  expect(shaded).toBe('[aaaa]<bbbb  >')
  expect(backgroundBar(row, 10, 0, (text) => `[${text}]`)).toBe('aaaabbbb  ')
})
