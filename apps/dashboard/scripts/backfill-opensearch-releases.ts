/**
 * Backfill script: Index releases into OpenSearch nw_releases index.
 *
 * Finds all sent/approved releases that have no elastic_doc ID and indexes them.
 *
 * Usage:
 *   bun apps/dashboard/scripts/backfill-opensearch-releases.ts
 *   bun apps/dashboard/scripts/backfill-opensearch-releases.ts --dry-run
 */
import { db } from '../src/db'
import { releases, releaseCategories, releaseRegions, company, images, banners, users, partners } from '../src/db/schema'
import { eq, and, isNull, inArray, or } from 'drizzle-orm'
import { indexDocument } from '../src/lib/opensearch'

const CIRCUITS: Record<string, number[]> = {
  hr: [29, 34, 216, 217, 218, 219, 221, 254, 260],
  cannadellic: [125, 237, 236],
  cannabis: [125, 237],
  psychedelics: [236],
}

const dryRun = process.argv.includes('--dry-run')

async function main() {
  console.log(`Backfill OpenSearch nw_releases index${dryRun ? ' (DRY RUN)' : ''}`)
  console.log('---')

  // Find releases that are sent or approved but have no elastic_doc
  const missing = await db
    .select({
      id: releases.id,
      uuid: releases.uuid,
      title: releases.title,
      abstract: releases.abstract,
      body: releases.body,
      location: releases.location,
      releaseAt: releases.releaseAt,
      slug: releases.slug,
      userId: releases.userId,
      companyId: releases.companyId,
      score: releases.score,
      status: releases.status,
      primaryImageId: releases.primaryImageId,
      bannerId: releases.bannerId,
    })
    .from(releases)
    .where(
      and(
        isNull(releases.elasticDoc),
        inArray(releases.status, ['sent', 'approved']),
        or(eq(releases.isDeleted, false), isNull(releases.isDeleted)),
      )
    )

  console.log(`Found ${missing.length} releases without elastic_doc`)

  let indexed = 0
  let errors = 0

  for (const rel of missing) {
    try {
      // Get company UUID
      const [comp] = await db
        .select({ uuid: company.uuid })
        .from(company)
        .where(eq(company.id, rel.companyId))

      // Get partner handle
      const [usr] = await db
        .select({ partnerId: users.partnerId })
        .from(users)
        .where(eq(users.id, rel.userId))

      let partnerHandle = 'newsworthy'
      if (usr?.partnerId) {
        const [p] = await db
          .select({ handle: partners.handle })
          .from(partners)
          .where(eq(partners.id, usr.partnerId))
        if (p?.handle) partnerHandle = p.handle
      }

      // Get primary image
      let newsImage: string | null = null
      if (rel.primaryImageId) {
        const [img] = await db
          .select({ url: images.url })
          .from(images)
          .where(eq(images.id, rel.primaryImageId))
        if (img?.url) newsImage = img.url.replace('/RESIZE/', '/resize=w:500/')
      }

      // Get banner
      let ogImage: string | null = null
      if (rel.bannerId) {
        const [ban] = await db
          .select({ url: banners.url })
          .from(banners)
          .where(eq(banners.id, rel.bannerId))
        if (ban?.url) ogImage = ban.url.replace('/RESIZE/', '/resize=w:1200/')
      }

      // Get categories and regions
      const cats = await db
        .select({ categoryId: releaseCategories.categoryId })
        .from(releaseCategories)
        .where(eq(releaseCategories.releaseId, rel.id))

      const regs = await db
        .select({ regionId: releaseRegions.regionId })
        .from(releaseRegions)
        .where(eq(releaseRegions.releaseId, rel.id))

      const categoryIds = cats.map(c => c.categoryId)
      const regionIds = regs.map(r => r.regionId)

      // Compute circuits
      const circuitNames: string[] = []
      for (const [name, catIds] of Object.entries(CIRCUITS)) {
        if (categoryIds.some(id => catIds.includes(id))) {
          circuitNames.push(name)
        }
      }

      // Build dateline
      let dateline = ''
      if (rel.releaseAt) {
        const d = new Date(rel.releaseAt)
        dateline = `${rel.location || ''} - ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
      }

      // Build news URL
      let newsUrlStr = ''
      if (rel.releaseAt && rel.slug) {
        const d = new Date(rel.releaseAt)
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        newsUrlStr = `https://newsworthy.ai/news/${y}${m}${day}${rel.id}/${rel.slug}`
      }

      const content: Record<string, unknown> = {
        pr_id: rel.id,
        created_at: new Date().toISOString(),
        release_at: rel.releaseAt ? new Date(rel.releaseAt).toISOString() : null,
        headline: rel.title,
        abstract: rel.abstract,
        location: rel.location,
        partner: partnerHandle,
        body: rel.body,
        pr_uuid: rel.uuid,
        dateline,
        edscore: rel.score ?? 4,
        user_id: rel.userId,
        company_id: rel.companyId,
        company_uuid: comp?.uuid || null,
        url: newsUrlStr,
        regions: regionIds,
        categories: categoryIds,
        circuits: circuitNames,
        placements: [partnerHandle],
      }

      if (newsImage) content.news_image = newsImage
      if (ogImage) content.og_image = ogImage

      if (dryRun) {
        console.log(`[DRY RUN] Would index release #${rel.id}: ${rel.title}`)
      } else {
        const res = await indexDocument('nw_releases', content)
        if (res?._id) {
          await db.update(releases)
            .set({ elasticDoc: res._id })
            .where(eq(releases.id, rel.id))
          console.log(`Indexed release #${rel.id}: ${rel.title} -> ${res._id}`)
        }
      }
      indexed++
    } catch (err) {
      console.error(`Error indexing release #${rel.id}:`, err)
      errors++
    }
  }

  console.log('---')
  console.log(`Done. ${indexed} indexed, ${errors} errors.`)
  process.exit(0)
}

main()
