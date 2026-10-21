import { db } from '@/db'
import { contact } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'

/** Name of the brand's primary PR contact, or null when none is set. */
export async function getPrimaryContactName(companyId: number): Promise<string | null> {
  const row = await db.query.contact.findFirst({
    columns: { name: true },
    where: and(
      eq(contact.companyId, companyId),
      eq(contact.isPrimary, true),
      sql`${contact.isDeleted} IS NOT TRUE`
    ),
  })
  return row?.name?.trim() || null
}
