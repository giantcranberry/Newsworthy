import { db } from '@/db'
import { company, releases } from '@/db/schema'
import { eq, and, ilike, or, sql, count } from 'drizzle-orm'
import type { Message, SkillResult, DataPart, TextPart } from '../types'

interface SearchParams {
  query?: string
  limit?: number
  offset?: number
}

function parseSearchInput(message: Message): SearchParams {
  for (const part of message.parts) {
    if (part.type === 'data' && part.mimeType === 'application/json') {
      return part.data as unknown as SearchParams
    }
  }

  for (const part of message.parts) {
    if (part.type === 'text') {
      try {
        return JSON.parse(part.text)
      } catch {
        // Strip command words and use remainder as query
        const cleaned = part.text.replace(/\b(search|find|list|browse|lookup|look up)\s+(brands?|companies|company|newsrooms?)\s*/i, '').trim()
        return { query: cleaned || undefined }
      }
    }
  }

  return {}
}

export async function searchBrands(message: Message): Promise<SkillResult> {
  const params = parseSearchInput(message)
  const limit = Math.min(params.limit || 20, 50)
  const offset = params.offset || 0

  const conditions = [
    eq(company.isDeleted, false),
    eq(company.isArchived, false),
  ]

  if (params.query) {
    const searchTerm = `%${params.query}%`
    conditions.push(
      or(
        ilike(company.companyName, searchTerm),
        ilike(company.nrDesc, searchTerm),
        ilike(company.city, searchTerm),
        ilike(company.state, searchTerm),
      )!
    )
  }

  // Only return brands that have at least one published release
  const brandsWithReleases = db
    .select({ companyId: releases.companyId })
    .from(releases)
    .where(and(eq(releases.status, 'sent'), eq(releases.isDeleted, false)))
    .groupBy(releases.companyId)
    .as('brands_with_releases')

  const results = await db
    .select({
      uuid: company.uuid,
      name: company.companyName,
      description: company.nrDesc,
      newsroomUri: company.nrUri,
      logoUrl: company.logoUrl,
      website: company.website,
      city: company.city,
      state: company.state,
      countryCode: company.countryCode,
    })
    .from(company)
    .innerJoin(brandsWithReleases, eq(company.id, brandsWithReleases.companyId))
    .where(and(...conditions))
    .orderBy(company.companyName)
    .limit(limit)
    .offset(offset)

  // Fetch published release count and latest releases for each brand
  const enriched = await Promise.all(
    results.map(async (brand) => {
      const [countResult] = await db
        .select({ total: count() })
        .from(releases)
        .innerJoin(company, eq(releases.companyId, company.id))
        .where(
          and(
            eq(company.uuid, brand.uuid),
            eq(releases.status, 'sent'),
            eq(releases.isDeleted, false),
          )
        )

      const recentReleases = await db
        .select({
          uuid: releases.uuid,
          title: releases.title,
          abstract: releases.abstract,
          releasedAt: releases.releasedAt,
          slug: releases.slug,
        })
        .from(releases)
        .innerJoin(company, eq(releases.companyId, company.id))
        .where(
          and(
            eq(company.uuid, brand.uuid),
            eq(releases.status, 'sent'),
            eq(releases.isDeleted, false),
          )
        )
        .orderBy(sql`${releases.releasedAt} DESC NULLS LAST`)
        .limit(5)

      return {
        uuid: brand.uuid,
        name: brand.name,
        description: brand.description,
        newsroomUri: brand.newsroomUri,
        logoUrl: brand.logoUrl,
        website: brand.website,
        location: [brand.city, brand.state, brand.countryCode].filter(Boolean).join(', ') || null,
        publishedReleaseCount: countResult.total,
        recentReleases,
      }
    })
  )

  const dataPart: DataPart = {
    type: 'data',
    mimeType: 'application/json',
    data: {
      results: enriched,
      total: enriched.length,
      limit,
      offset,
    },
  }

  const textPart: TextPart = {
    type: 'text',
    text: `Found ${enriched.length} brand${enriched.length !== 1 ? 's' : ''}${params.query ? ` matching "${params.query}"` : ''}.`,
  }

  return {
    artifacts: [
      {
        id: 'brand-results',
        name: 'Brand Search Results',
        parts: [textPart, dataPart],
      },
    ],
  }
}
