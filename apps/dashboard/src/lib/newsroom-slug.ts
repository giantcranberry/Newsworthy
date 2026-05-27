import { db } from '@/db'
import { company } from '@/db/schema'
import { eq } from 'drizzle-orm'
import slugify from 'slugify'

const MAX_LEN = 32

export function buildNrUriBase(name: string): string {
  return slugify(name, { lower: true, strict: true, trim: true }).slice(0, MAX_LEN)
}

export async function generateUniqueNrUri(name: string): Promise<string> {
  const base = buildNrUriBase(name)
  if (!base) {
    throw new Error('Cannot generate newsroom address from company name')
  }

  let candidate = base
  let n = 2
  // Linear probe; brand names rarely collide more than a handful of times.
  while (true) {
    const existing = await db.query.company.findFirst({
      where: eq(company.nrUri, candidate),
      columns: { id: true },
    })
    if (!existing) return candidate
    const suffix = `-${n++}`
    const trimmed = base.length + suffix.length > MAX_LEN
      ? base.slice(0, MAX_LEN - suffix.length)
      : base
    candidate = `${trimmed}${suffix}`
  }
}
