import { db } from '@/db'
import { partners } from '@/db/schema'
import { inArray } from 'drizzle-orm'

export async function getManagedPartners(ids: number[]) {
  if (ids.length === 0) return []
  return db.query.partners.findMany({
    where: inArray(partners.id, ids),
  })
}

export function resolvePartnerId(managedIds: number[], partnerParam?: string): number | null {
  if (managedIds.length === 0) return null

  if (partnerParam) {
    const parsed = parseInt(partnerParam)
    if (!isNaN(parsed) && managedIds.includes(parsed)) {
      return parsed
    }
  }

  return managedIds[0]
}
