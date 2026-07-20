import { db } from '@/db'
import { releases, releaseCategories, releaseRegions, brandCredits } from '@/db/schema'
import { v4 as uuidv4 } from 'uuid'
import slugify from 'slugify'
import { creditBalance } from '@/lib/brand-credits'
import type { Message, SkillResult, AuthContext } from '../types'

function createSlug(title: string): string {
  return slugify(title, { lower: true, strict: true, trim: true }).slice(0, 200)
}

async function hasCredits(userId: number, companyId: number): Promise<boolean> {
  if ((await creditBalance(userId, companyId, 'pr')) > 0) return true
  return (await creditBalance(userId, null, 'pr')) > 0
}

interface CreateReleaseInput {
  title?: string
  abstract?: string
  body?: string
  pullquote?: string
  location?: string
  categoryIds?: number[]
  regionIds?: number[]
}

function parseInput(message: Message): CreateReleaseInput {
  for (const part of message.parts) {
    if (part.type === 'data' && part.mimeType === 'application/json') {
      return part.data as unknown as CreateReleaseInput
    }
  }
  for (const part of message.parts) {
    if (part.type === 'text') {
      try {
        return JSON.parse(part.text)
      } catch {
        // Try to extract title from text
        const text = part.text.replace(/^(create|add|new)\s+(release|pr|press\s*release)\s*/i, '').trim()
        const titleMatch = text.match(/(?:titled?|called?|named?)\s+["']?(.+?)["']?\s*$/i)
        if (titleMatch) return { title: titleMatch[1] }
        if (text) return { title: text }
      }
    }
  }
  return {}
}

export async function createRelease(message: Message, auth: AuthContext): Promise<SkillResult> {
  const input = parseInput(message)

  // Check credits
  const userHasCredits = await hasCredits(auth.userId, auth.companyId)
  if (!userHasCredits) {
    throw new Error('No press release credits available. Please purchase credits to create a release.')
  }

  const uuid = uuidv4().replace(/-/g, '')
  const slug = input.title ? createSlug(input.title) : null
  const status = 'draftnxt'

  // Create the release and deduct the credit atomically, so a rejected
  // deduction (nonnegative-balance trigger firing in a race) rolls the
  // release back instead of leaving an uncharged draft.
  const newRelease = await db.transaction(async (tx) => {
    const [created] = await tx.insert(releases).values({
      uuid,
      userId: auth.userId,
      companyId: auth.companyId,
      title: input.title,
      abstract: input.abstract,
      body: input.body,
      pullquote: input.pullquote || null,
      slug,
      location: input.location,
      status,
      createdAt: new Date(),
      editorialHold: false,
    }).returning()

    // Deduct brand-level 'pr' credit if available, else fall back to user-level
    const brandBalance = await creditBalance(auth.userId, auth.companyId, 'pr')

    await tx.insert(brandCredits).values({
      userId: auth.userId,
      companyId: brandBalance > 0 ? auth.companyId : null,
      prId: created.id,
      credits: -1,
      productType: 'pr',
      notes: `PR: ${input.title?.substring(0, 40) || created.uuid}`,
    })

    return created
  })

  // Save categories
  if (input.categoryIds && input.categoryIds.length > 0) {
    await db.insert(releaseCategories).values(
      input.categoryIds.map(categoryId => ({
        releaseId: newRelease.id,
        categoryId,
      }))
    )
  }

  // Save regions
  if (input.regionIds && input.regionIds.length > 0) {
    await db.insert(releaseRegions).values(
      input.regionIds.map(regionId => ({
        releaseId: newRelease.id,
        regionId,
      }))
    )
  }

  return {
    artifacts: [{
      id: 'created-release',
      name: `Release: ${newRelease.title || newRelease.uuid}`,
      parts: [
        { type: 'text', text: `Press release created successfully with status "${status}".` },
        {
          type: 'data',
          mimeType: 'application/json',
          data: {
            uuid: newRelease.uuid,
            title: newRelease.title,
            status: newRelease.status,
          },
        },
      ],
    }],
  }
}
