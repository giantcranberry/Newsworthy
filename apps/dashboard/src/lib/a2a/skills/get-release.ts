import { db } from '@/db'
import {
  releases, company, images, releaseFaqs,
  releaseCategories, releaseRegions, releaseImages,
  category, region,
} from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import type { Message, SkillResult, DataPart, TextPart } from '../types'

function parseIdentifier(message: Message): string {
  for (const part of message.parts) {
    if (part.type === 'text') {
      // Try to extract a UUID pattern
      const uuidMatch = part.text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
      if (uuidMatch) return uuidMatch[0]

      // Try to extract after "get release" or similar commands
      const cmdMatch = part.text.match(/(?:get|read|fetch|show)\s+(?:release\s+)?(.+)/i)
      if (cmdMatch) return cmdMatch[1].trim()

      return part.text.trim()
    }
    if (part.type === 'data' && part.data.uuid) {
      return part.data.uuid as string
    }
    if (part.type === 'data' && part.data.slug) {
      return part.data.slug as string
    }
  }
  return ''
}

export async function getRelease(message: Message): Promise<SkillResult> {
  const identifier = parseIdentifier(message)

  if (!identifier) {
    return {
      artifacts: [{
        id: 'error',
        name: 'Error',
        parts: [{ type: 'text', text: 'Please provide a release UUID or slug.' }],
      }],
    }
  }

  // Try UUID first, then slug
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier)

  const [release] = await db
    .select({
      id: releases.id,
      uuid: releases.uuid,
      slug: releases.slug,
      title: releases.title,
      abstract: releases.abstract,
      body: releases.body,
      pullquote: releases.pullquote,
      location: releases.location,
      releasedAt: releases.releasedAt,
      fleschEase: releases.fleschEase,
      readTime: releases.readTime,
      score: releases.score,
      videoUrl: releases.videoUrl,
      landingPage: releases.landingPage,
      companyName: company.companyName,
      companyWebsite: company.website,
      companyLogoUrl: company.logoUrl,
      companyNewsroomUri: company.nrUri,
    })
    .from(releases)
    .innerJoin(company, eq(releases.companyId, company.id))
    .where(
      and(
        isUuid ? eq(releases.uuid, identifier) : eq(releases.slug, identifier),
        eq(releases.status, 'sent'),
        eq(releases.isDeleted, false),
      )
    )
    .limit(1)

  if (!release) {
    return {
      artifacts: [{
        id: 'error',
        name: 'Error',
        parts: [{ type: 'text', text: `No published release found for "${identifier}".` }],
      }],
    }
  }

  // Fetch related data in parallel
  const [cats, regs, faqs, imgs] = await Promise.all([
    db
      .select({ name: category.name, slug: category.slug })
      .from(releaseCategories)
      .innerJoin(category, eq(releaseCategories.categoryId, category.id))
      .where(eq(releaseCategories.releaseId, release.id)),
    db
      .select({ name: region.name, state: region.state })
      .from(releaseRegions)
      .innerJoin(region, eq(releaseRegions.regionId, region.id))
      .where(eq(releaseRegions.releaseId, release.id)),
    db
      .select({ question: releaseFaqs.question, answer: releaseFaqs.answer })
      .from(releaseFaqs)
      .where(eq(releaseFaqs.prId, release.id))
      .orderBy(releaseFaqs.sortOrder),
    db
      .select({
        url: images.url,
        caption: images.caption,
        title: images.title,
      })
      .from(releaseImages)
      .innerJoin(images, eq(releaseImages.imageId, images.id))
      .where(eq(releaseImages.releaseId, release.id))
      .orderBy(releaseImages.sortOrder),
  ])

  const data = {
    uuid: release.uuid,
    slug: release.slug,
    title: release.title,
    abstract: release.abstract,
    body: release.body,
    pullquote: release.pullquote,
    location: release.location,
    releasedAt: release.releasedAt,
    readabilityScores: {
      fleschEase: release.fleschEase,
      readTime: release.readTime,
      score: release.score,
    },
    videoUrl: release.videoUrl,
    landingPage: release.landingPage,
    company: {
      name: release.companyName,
      website: release.companyWebsite,
      logoUrl: release.companyLogoUrl,
      newsroomUri: release.companyNewsroomUri,
    },
    categories: cats.map(c => ({ name: c.name, slug: c.slug })),
    regions: regs.map(r => ({ name: r.name, state: r.state })),
    faqs,
    images: imgs,
  }

  const textPart: TextPart = {
    type: 'text',
    text: `Press release: "${release.title}" by ${release.companyName}`,
  }

  const dataPart: DataPart = {
    type: 'data',
    mimeType: 'application/json',
    data: data as unknown as Record<string, unknown>,
  }

  return {
    artifacts: [
      {
        id: 'release',
        name: release.title || 'Press Release',
        parts: [textPart, dataPart],
      },
    ],
  }
}
