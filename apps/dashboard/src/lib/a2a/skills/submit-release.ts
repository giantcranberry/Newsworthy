import { db } from '@/db'
import { releases, queue } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import type { Message, SkillResult, AuthContext } from '../types'
import { sendSmsNotification } from '@/lib/twilio'

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

export async function submitRelease(message: Message, auth: AuthContext): Promise<SkillResult> {
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

  const submittedStatuses = ['review', 'approved', 'published', 'sent']
  if (release.status && submittedStatuses.includes(release.status)) {
    throw new Error('Release has already been submitted')
  }

  // Update status to review
  await db.update(releases)
    .set({ status: 'review' })
    .where(eq(releases.id, release.id))

  // Create or update queue entry
  const existingQueue = await db.query.queue.findFirst({
    where: eq(queue.releaseId, release.id),
  })

  if (!existingQueue) {
    await db.insert(queue).values({
      uuid: uuidv4(),
      releaseId: release.id,
      submitted: new Date(),
    })
  } else {
    await db.update(queue)
      .set({ submitted: new Date(), approved: null, returned: null })
      .where(eq(queue.releaseId, release.id))
  }

  // SMS notification (non-blocking)
  sendSmsNotification(`PR submitted for review: "${release.title}"`)

  return {
    artifacts: [{
      id: 'submitted-release',
      name: `Submitted: ${release.title || release.uuid}`,
      parts: [
        { type: 'text', text: `Press release "${release.title}" has been submitted for editorial review.` },
        {
          type: 'data',
          mimeType: 'application/json',
          data: {
            uuid: release.uuid,
            status: 'review',
          },
        },
      ],
    }],
  }
}
