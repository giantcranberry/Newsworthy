import { test, expect, mock, beforeEach, afterEach } from 'bun:test'
import { fetchChapterImages } from './chapters'

const ORIGINAL_FETCH = globalThis.fetch

function mockFetchOnce(response: Partial<Response> & { jsonBody?: unknown; textBody?: string }) {
  globalThis.fetch = mock(async () => {
    const ok = response.ok ?? true
    const status = response.status ?? (ok ? 200 : 500)
    const body =
      response.jsonBody !== undefined
        ? JSON.stringify(response.jsonBody)
        : (response.textBody ?? '')
    return new Response(body, { status }) as Response
  }) as unknown as typeof fetch
}

beforeEach(() => {
  globalThis.fetch = ORIGINAL_FETCH
})

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH
})

test('returns deduped images preserving first-occurrence order', async () => {
  mockFetchOnce({
    jsonBody: {
      version: '1.2.0',
      chapters: [
        { startTime: 0, title: 'Intro', img: 'https://cdn.example.com/a.jpg' },
        { startTime: 60, title: 'B', img: 'https://cdn.example.com/b.jpg' },
        { startTime: 120, title: 'A again', img: 'https://cdn.example.com/a.jpg' },
        { startTime: 180, title: 'C', img: 'https://cdn.example.com/c.jpg' },
      ],
    },
  })

  const result = await fetchChapterImages('https://example.com/c.json')
  expect(result.map((r) => r.url)).toEqual([
    'https://cdn.example.com/a.jpg',
    'https://cdn.example.com/b.jpg',
    'https://cdn.example.com/c.jpg',
  ])
  expect(result[0].title).toBe('Intro')
})

test('caps result at the provided limit', async () => {
  mockFetchOnce({
    jsonBody: {
      chapters: Array.from({ length: 25 }, (_, i) => ({
        startTime: i,
        img: `https://cdn.example.com/${i}.jpg`,
      })),
    },
  })

  const result = await fetchChapterImages('https://example.com/c.json', { limit: 5 })
  expect(result.length).toBe(5)
})

test('default limit is 10', async () => {
  mockFetchOnce({
    jsonBody: {
      chapters: Array.from({ length: 25 }, (_, i) => ({
        startTime: i,
        img: `https://cdn.example.com/${i}.jpg`,
      })),
    },
  })

  const result = await fetchChapterImages('https://example.com/c.json')
  expect(result.length).toBe(10)
})

test('filters out entries without img', async () => {
  mockFetchOnce({
    jsonBody: {
      chapters: [
        { startTime: 0, title: 'no img' },
        { startTime: 60, title: 'has img', img: 'https://cdn.example.com/x.jpg' },
        { startTime: 120, title: 'empty img', img: '' },
        { startTime: 180, title: 'non-http', img: 'data:image/png;base64,abc' },
      ],
    },
  })

  const result = await fetchChapterImages('https://example.com/c.json')
  expect(result.map((r) => r.url)).toEqual(['https://cdn.example.com/x.jpg'])
})

test('returns empty array when chapters array is missing', async () => {
  mockFetchOnce({ jsonBody: { version: '1.2.0' } })
  const result = await fetchChapterImages('https://example.com/c.json')
  expect(result).toEqual([])
})

test('returns empty array when chapters is empty', async () => {
  mockFetchOnce({ jsonBody: { chapters: [] } })
  const result = await fetchChapterImages('https://example.com/c.json')
  expect(result).toEqual([])
})

test('throws on HTTP error', async () => {
  mockFetchOnce({ ok: false, status: 404, textBody: 'not found' })
  await expect(fetchChapterImages('https://example.com/c.json')).rejects.toThrow(/404/)
})

test('throws on malformed JSON', async () => {
  mockFetchOnce({ textBody: 'not json' })
  await expect(fetchChapterImages('https://example.com/c.json')).rejects.toThrow()
})

test('passes startTime and title through to caller', async () => {
  mockFetchOnce({
    jsonBody: {
      chapters: [{ startTime: 42, title: 'Hello', img: 'https://cdn.example.com/h.jpg' }],
    },
  })
  const [first] = await fetchChapterImages('https://example.com/c.json')
  expect(first.title).toBe('Hello')
  expect(first.startTime).toBe(42)
})
