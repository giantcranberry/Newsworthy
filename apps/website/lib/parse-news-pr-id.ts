/**
 * Parse releases.id from a public /news article path.
 * /news/{YYYYMMDD}{prId}/{slug} and /news/{lang}/{YYYYMMDD}{prId}/{slug}
 * Curated, beat, agency, and listing routes return null.
 */
export function parsePrIdFromNewsPath(path: string): number | null {
  const match = path.match(/^\/news\/(?:[a-z]{2}\/)?(\d{8}\d+)(?:\/|$)/i)
  if (!match?.[1]) return null

  const prId = Number.parseInt(match[1].slice(8), 10)
  if (!Number.isFinite(prId) || prId < 1) return null
  return prId
}
