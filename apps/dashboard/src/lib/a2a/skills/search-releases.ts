import { db } from '@/db'
import { releases, releaseCategories, releaseRegions, company, category, region } from '@/db/schema'
import { eq, and, ilike, or, gte, lte, sql } from 'drizzle-orm'
import type { Message, SkillResult, DataPart, TextPart } from '../types'

interface SearchParams {
  query?: string
  categoryId?: number
  regionId?: number
  dateFrom?: string
  dateTo?: string
  limit?: number
  offset?: number
}

function parseSearchInput(message: Message): SearchParams {
  // Check for JSON data part first
  for (const part of message.parts) {
    if (part.type === 'data' && part.mimeType === 'application/json') {
      return part.data as unknown as SearchParams
    }
  }

  // Fall back to parsing text
  for (const part of message.parts) {
    if (part.type === 'text') {
      // Try parsing as JSON
      try {
        return JSON.parse(part.text)
      } catch {
        // Use text as a search query
        return { query: part.text }
      }
    }
  }

  return {}
}

export async function searchReleases(message: Message): Promise<SkillResult> {
  const params = parseSearchInput(message)
  const limit = Math.min(params.limit || 20, 50)
  const offset = params.offset || 0

  const conditions = [
    eq(releases.status, 'sent'),
    eq(releases.isDeleted, false),
  ]

  if (params.query) {
    const searchTerm = `%${params.query}%`
    conditions.push(
      or(
        ilike(releases.title, searchTerm),
        ilike(releases.abstract, searchTerm),
        ilike(releases.body, searchTerm),
      )!
    )
  }

  if (params.dateFrom) {
    conditions.push(gte(releases.releasedAt, new Date(params.dateFrom)))
  }
  if (params.dateTo) {
    conditions.push(lte(releases.releasedAt, new Date(params.dateTo)))
  }

  // Base query for releases
  let query = db
    .select({
      uuid: releases.uuid,
      title: releases.title,
      abstract: releases.abstract,
      location: releases.location,
      releasedAt: releases.releasedAt,
      slug: releases.slug,
      companyName: company.companyName,
    })
    .from(releases)
    .innerJoin(company, eq(releases.companyId, company.id))
    .where(and(...conditions))
    .orderBy(sql`${releases.releasedAt} DESC NULLS LAST`)
    .limit(limit)
    .offset(offset)

  // If filtering by category, add the join
  if (params.categoryId) {
    query = db
      .select({
        uuid: releases.uuid,
        title: releases.title,
        abstract: releases.abstract,
        location: releases.location,
        releasedAt: releases.releasedAt,
        slug: releases.slug,
        companyName: company.companyName,
      })
      .from(releases)
      .innerJoin(company, eq(releases.companyId, company.id))
      .innerJoin(releaseCategories, eq(releases.id, releaseCategories.releaseId))
      .where(and(...conditions, eq(releaseCategories.categoryId, params.categoryId)))
      .orderBy(sql`${releases.releasedAt} DESC NULLS LAST`)
      .limit(limit)
      .offset(offset)
  }

  // If filtering by region, add the join
  if (params.regionId) {
    query = db
      .select({
        uuid: releases.uuid,
        title: releases.title,
        abstract: releases.abstract,
        location: releases.location,
        releasedAt: releases.releasedAt,
        slug: releases.slug,
        companyName: company.companyName,
      })
      .from(releases)
      .innerJoin(company, eq(releases.companyId, company.id))
      .innerJoin(releaseRegions, eq(releases.id, releaseRegions.releaseId))
      .where(and(...conditions, eq(releaseRegions.regionId, params.regionId)))
      .orderBy(sql`${releases.releasedAt} DESC NULLS LAST`)
      .limit(limit)
      .offset(offset)
  }

  const results = await query

  // Fetch categories and regions for each release if we have results
  const enriched = await Promise.all(
    results.map(async (r) => {
      const [cats, regs] = await Promise.all([
        db
          .select({ name: category.name, slug: category.slug })
          .from(releaseCategories)
          .innerJoin(category, eq(releaseCategories.categoryId, category.id))
          .innerJoin(releases, eq(releaseCategories.releaseId, releases.id))
          .where(eq(releases.uuid, r.uuid)),
        db
          .select({ name: region.name, state: region.state })
          .from(releaseRegions)
          .innerJoin(region, eq(releaseRegions.regionId, region.id))
          .innerJoin(releases, eq(releaseRegions.releaseId, releases.id))
          .where(eq(releases.uuid, r.uuid)),
      ])

      return {
        ...r,
        categories: cats.map(c => c.name),
        regions: regs.map(rg => `${rg.name}, ${rg.state}`),
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
    text: `Found ${enriched.length} press release${enriched.length !== 1 ? 's' : ''}${params.query ? ` matching "${params.query}"` : ''}.`,
  }

  return {
    artifacts: [
      {
        id: 'search-results',
        name: 'Search Results',
        parts: [textPart, dataPart],
      },
    ],
  }
}
