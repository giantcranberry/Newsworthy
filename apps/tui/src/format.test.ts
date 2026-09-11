import { test, expect } from 'bun:test'
import { delta, formatCents, formatCompactCents, plural } from './format.ts'
import { localDayKey, startOfDay, startOfWeek, startOfYear, toEpoch } from './periods.ts'

test('formatCents matches the dashboard formatting', () => {
  expect(formatCents(0)).toBe('$0.00')
  expect(formatCents(149900)).toBe('$1,499.00')
  expect(formatCents(-500)).toBe('-$5.00')
})

test('formatCompactCents shortens large amounts', () => {
  expect(formatCompactCents(0)).toBe('$0')
  expect(formatCompactCents(94000)).toBe('$940')
  expect(formatCompactCents(123400)).toBe('$1.23k')
  expect(formatCompactCents(1240000)).toBe('$12.4k')
  expect(formatCompactCents(131000000)).toBe('$1.31M')
})

test('delta reports direction against the previous period', () => {
  expect(delta(150, 100)).toEqual({ text: '+50.0%', direction: 'up' })
  expect(delta(50, 100)).toEqual({ text: '-50.0%', direction: 'down' })
  expect(delta(100, 100).direction).toBe('flat')
  expect(delta(0, 0)).toEqual({ text: '—', direction: 'flat' })
  expect(delta(100, 0)).toEqual({ text: 'new', direction: 'up' })
})

test('plural only adds the suffix when it should', () => {
  expect(plural(1, 'transaction')).toBe('1 transaction')
  expect(plural(0, 'transaction')).toBe('0 transactions')
  expect(plural(2, 'transaction')).toBe('2 transactions')
})

test('period boundaries are ordered and land on local midnight', () => {
  const now = toEpoch(new Date())
  expect(startOfYear()).toBeLessThanOrEqual(startOfWeek())
  expect(startOfWeek()).toBeLessThanOrEqual(startOfDay())
  expect(startOfDay()).toBeLessThanOrEqual(now)

  const midnight = new Date(startOfDay() * 1000)
  expect(midnight.getHours()).toBe(0)
  expect(midnight.getMinutes()).toBe(0)
})

test('localDayKey buckets by local calendar day', () => {
  const noon = new Date()
  noon.setHours(12, 0, 0, 0)
  expect(localDayKey(toEpoch(noon))).toBe(localDayKey(startOfDay()))
  expect(localDayKey(toEpoch(noon))).toMatch(/^\d{4}-\d{2}-\d{2}$/)
})
