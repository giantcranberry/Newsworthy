import { db } from '@/db'
import { releases } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import type { Message, SkillResult, AuthContext } from '../types'

interface ListReleasesInput {
  status?: string
  limit?: number
  offset?: number
}

function parseInput(message: Message): ListReleasesInput {
  for (const part of message.parts) {
    if (part.type === 'data' && part.mimeType === 'application/json') {
      return part.data as unknown as ListReleasesInput
    }
  }
  for (const part of message.parts) {
    if (part.type === 'text') {
      try {
        return JSON.parse(part.text)
      } catch {
        // Check for status keywords in text
        const text = part.text.toLowerCase()
        if (text.includes('draft')) return { status: 'draftnxt' }
        if (text.includes('review')) return { status: 'review' }
        if (text.includes('approved')) return { status: 'approved' }
        if (text.includes('sent') || text.includes('published')) return { status: 'sent' }
      }
    }
  }
  return {}
}

export async function listReleases(message: Message, auth: AuthContext): Promise<SkillResult> {
  const input = parseInput(message)
  const limit = Math.min(input.limit || 20, 50)
  const offset = input.offset || 0

  const conditions = [
    eq(releases.userId, auth.userId),
    eq(releases.companyId, auth.companyId),
    eq(releases.isDeleted, false),
  ]

  if (input.status) {
    conditions.push(eq(releases.status, input.status))
  }

  const results = await db
    .select({
      uuid: releases.uuid,
      title: releases.title,
      status: releases.status,
      createdAt: releases.createdAt,
      releasedAt: releases.releasedAt,
    })
    .from(releases)
    .where(and(...conditions))
    .orderBy(sql`${releases.createdAt} DESC NULLS LAST`)
    .limit(limit)
    .offset(offset)

  const statusLabel = input.status ? ` with status "${input.status}"` : ''

  return {
    artifacts: [{
      id: 'release-list',
      name: 'My Releases',
      parts: [
        { type: 'text', text: `Found ${results.length} release${results.length !== 1 ? 's' : ''}${statusLabel}.` },
        {
          type: 'data',
          mimeType: 'application/json',
          data: { results, total: results.length, limit, offset },
        },
      ],
    }],
  }
}
