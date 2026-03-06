import { db } from '@/db'
import { releases, releaseCategories, releaseRegions, brandCredits } from '@/db/schema'
import { eq, and, isNull, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import slugify from 'slugify'
import type { Message, SkillResult, AuthContext } from '../types'

function createSlug(title: string): string {
  return slugify(title, { lower: true, strict: true, trim: true }).slice(0, 200)
}

async function hasCredits(userId: number, companyId: number): Promise<boolean> {
  const brandCreditResult = await db
    .select({
      balance: sql<number>`COALESCE(SUM(${brandCredits.credits}), 0)`.as('balance'),
    })
    .from(brandCredits)
    .where(and(eq(brandCredits.companyId, companyId), eq(brandCredits.userId, userId)))

  if (Number(brandCreditResult[0]?.balance || 0) > 0) return true

  const userCreditResult = await db
    .select({
      balance: sql<number>`COALESCE(SUM(${brandCredits.credits}), 0)`.as('balance'),
    })
    .from(brandCredits)
    .where(and(eq(brandCredits.userId, userId), isNull(brandCredits.companyId)))

  return Number(userCreditResult[0]?.balance || 0) > 0
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

  const [newRelease] = await db.insert(releases).values({
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

  // Deduct credit
  const brandBalance = await db
    .select({
      balance: sql<number>`COALESCE(SUM(${brandCredits.credits}), 0)`.as('balance'),
    })
    .from(brandCredits)
    .where(and(eq(brandCredits.companyId, auth.companyId), eq(brandCredits.userId, auth.userId)))

  if (Number(brandBalance[0]?.balance || 0) > 0) {
    await db.insert(brandCredits).values({
      userId: auth.userId,
      companyId: auth.companyId,
      prId: newRelease.id,
      credits: -1,
      productType: 'pr',
      notes: `PR: ${input.title?.substring(0, 40) || newRelease.uuid}`,
    })
  } else {
    await db.insert(brandCredits).values({
      userId: auth.userId,
      companyId: null,
      prId: newRelease.id,
      credits: -1,
      productType: 'pr',
      notes: `PR: ${input.title?.substring(0, 40) || newRelease.uuid}`,
    })
  }

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
