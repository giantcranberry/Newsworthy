import { db } from '@/db'
import { releases, releaseCategories, releaseRegions } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import slugify from 'slugify'
import type { Message, SkillResult, AuthContext } from '../types'

function createSlug(title: string): string {
  return slugify(title, { lower: true, strict: true, trim: true }).slice(0, 200)
}

interface UpdateReleaseInput {
  uuid: string
  title?: string
  abstract?: string
  body?: string
  pullquote?: string
  location?: string
  categoryIds?: number[]
  regionIds?: number[]
}

function parseInput(message: Message): UpdateReleaseInput | null {
  for (const part of message.parts) {
    if (part.type === 'data' && part.mimeType === 'application/json') {
      return part.data as unknown as UpdateReleaseInput
    }
  }
  for (const part of message.parts) {
    if (part.type === 'text') {
      try {
        return JSON.parse(part.text)
      } catch {
        // Try to extract UUID from text
        const uuidMatch = part.text.match(/[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}|[0-9a-f]{32}/i)
        if (uuidMatch) return { uuid: uuidMatch[0] }
      }
    }
  }
  return null
}

export async function updateRelease(message: Message, auth: AuthContext): Promise<SkillResult> {
  const input = parseInput(message)
  if (!input?.uuid) {
    throw new Error('Release UUID is required')
  }

  const existingRelease = await db.query.releases.findFirst({
    where: eq(releases.uuid, input.uuid),
  })

  if (!existingRelease) {
    throw new Error('Release not found')
  }

  if (existingRelease.userId !== auth.userId || existingRelease.companyId !== auth.companyId) {
    throw new Error('Unauthorized: release does not belong to this API key')
  }

  const lockedStatuses = ['review', 'approved', 'published']
  if (existingRelease.status && lockedStatuses.includes(existingRelease.status)) {
    throw new Error(`Cannot edit release with status "${existingRelease.status}"`)
  }

  // Build update fields
  const updates: Record<string, unknown> = {}
  if (input.title !== undefined) {
    updates.title = input.title
    updates.slug = createSlug(input.title)
  }
  if (input.abstract !== undefined) updates.abstract = input.abstract
  if (input.body !== undefined) updates.body = input.body
  if (input.pullquote !== undefined) updates.pullquote = input.pullquote || null
  if (input.location !== undefined) updates.location = input.location

  if (Object.keys(updates).length > 0) {
    await db.update(releases)
      .set(updates)
      .where(eq(releases.id, existingRelease.id))
  }

  // Update categories if provided
  if (input.categoryIds !== undefined) {
    await db.delete(releaseCategories)
      .where(eq(releaseCategories.releaseId, existingRelease.id))
    if (input.categoryIds.length > 0) {
      await db.insert(releaseCategories).values(
        input.categoryIds.map(categoryId => ({
          releaseId: existingRelease.id,
          categoryId,
        }))
      )
    }
  }

  // Update regions if provided
  if (input.regionIds !== undefined) {
    await db.delete(releaseRegions)
      .where(eq(releaseRegions.releaseId, existingRelease.id))
    if (input.regionIds.length > 0) {
      await db.insert(releaseRegions).values(
        input.regionIds.map(regionId => ({
          releaseId: existingRelease.id,
          regionId,
        }))
      )
    }
  }

  return {
    artifacts: [{
      id: 'updated-release',
      name: `Release: ${input.title || existingRelease.title || existingRelease.uuid}`,
      parts: [
        { type: 'text', text: `Press release "${input.title || existingRelease.title}" updated successfully.` },
        {
          type: 'data',
          mimeType: 'application/json',
          data: {
            uuid: existingRelease.uuid,
            title: input.title || existingRelease.title,
            status: existingRelease.status,
          },
        },
      ],
    }],
  }
}
