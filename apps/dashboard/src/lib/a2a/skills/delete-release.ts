import { db } from '@/db'
import { releases, brandCredits } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import type { Message, SkillResult, AuthContext } from '../types'

function parseUuid(message: Message): string | null {
  for (const part of message.parts) {
    if (part.type === 'data' && part.mimeType === 'application/json') {
      return (part.data as any).uuid || null
    }
  }
  for (const part of message.parts) {
    if (part.type === 'text') {
      try {
        const parsed = JSON.parse(part.text)
        return parsed.uuid || null
      } catch {
        const match = part.text.match(/[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}|[0-9a-f]{32}/i)
        return match ? match[0] : null
      }
    }
  }
  return null
}

export async function deleteRelease(message: Message, auth: AuthContext): Promise<SkillResult> {
  const uuid = parseUuid(message)
  if (!uuid) {
    throw new Error('Release UUID is required')
  }

  const release = await db.query.releases.findFirst({
    where: eq(releases.uuid, uuid),
  })

  if (!release) {
    throw new Error('Release not found')
  }

  if (release.userId !== auth.userId || release.companyId !== auth.companyId) {
    throw new Error('Unauthorized: release does not belong to this API key')
  }

  const protectedStatuses = ['approved', 'sent', 'review']
  if (release.status && protectedStatuses.includes(release.status)) {
    throw new Error(`Cannot delete release with status "${release.status}"`)
  }

  // Reallocate credits
  await db.delete(brandCredits).where(
    and(
      eq(brandCredits.prId, release.id),
      eq(brandCredits.userId, auth.userId)
    )
  )

  // Soft-delete
  await db.update(releases)
    .set({ isDeleted: true })
    .where(eq(releases.id, release.id))

  return {
    artifacts: [{
      id: 'deleted-release',
      name: 'Release Deleted',
      parts: [
        { type: 'text', text: `Press release "${release.title || release.uuid}" has been deleted. Credits have been reallocated.` },
        { type: 'data', mimeType: 'application/json', data: { success: true } },
      ],
    }],
  }
}
