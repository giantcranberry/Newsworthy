/**
 * Seed script: insert the three Podcast PR product rows.
 *
 * Usage:
 *   doppler run -- bun scripts/seed-podcast-pr-products.ts
 *
 * Idempotent — skips any rows already present (matched by short_name +
 * product_type='podcast_pr').
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { and, eq } from 'drizzle-orm'
import * as schema from '../src/db/schema'

const DATABASE_URL = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DIRECT_DATABASE_URL or DATABASE_URL is required')
  process.exit(1)
}

const usesPgBouncer = DATABASE_URL.includes('pgbouncer=true')
const client = postgres(DATABASE_URL, {
  prepare: usesPgBouncer ? false : undefined,
  max: 1,
})
const db = drizzle(client, { schema })

const PRODUCT_TYPE = 'podcast_pr'

interface PodcastPackage {
  shortName: string
  displayName: string
  description: string
  label: string
  priceCents: number
  productCredits: number
  sortOrder: number
}

const PACKAGES: PodcastPackage[] = [
  {
    shortName: 'Podcast 1',
    displayName: 'Podcast PR — Pay as you go',
    description:
      '1 podcast press release credit. Generate and distribute one PR from a podcast episode. Credits valid for 2 years. Brand/Podcast specific. Credits must be used for this podcast. Credits cannot be used for non-podcast press releases.',
    label: 'Single',
    priceCents: 12900,
    productCredits: 1,
    sortOrder: 10,
  },
  {
    shortName: 'Podcast 5',
    displayName: 'Podcast PR — 5 Pack',
    description:
      '5 podcast press release credits at $105 each. Credits valid for 2 years. Brand/Podcast specific. Credits must be used for this podcast. Credits cannot be used for non-podcast press releases.',
    label: 'Starter',
    priceCents: 52500,
    productCredits: 5,
    sortOrder: 15,
  },
  {
    shortName: 'Podcast 12',
    displayName: 'Podcast PR — 12 Pack',
    description:
      '12 podcast press release credits at $79 each. Credits valid for 2 years. Brand/Podcast specific. Credits must be used for this podcast. Credits cannot be used for non-podcast press releases.',
    label: 'Popular',
    priceCents: 94800,
    productCredits: 12,
    sortOrder: 20,
  },
  {
    shortName: 'Podcast 20',
    displayName: 'Podcast PR — 20 Pack',
    description:
      '20 podcast press release credits at $65 each. Credits valid for 2 years. Brand/Podcast specific. Credits must be used for this podcast. Credits cannot be used for non-podcast press releases.',
    label: 'Best Value',
    priceCents: 130000,
    productCredits: 20,
    sortOrder: 30,
  },
]

async function main() {
  let created = 0
  let skipped = 0

  for (const pkg of PACKAGES) {
    const existing = await db.query.products.findFirst({
      where: and(
        eq(schema.products.shortName, pkg.shortName),
        eq(schema.products.productType, PRODUCT_TYPE),
      ),
      columns: { id: true, displayName: true },
    })

    if (existing) {
      await db
        .update(schema.products)
        .set({
          displayName: pkg.displayName,
          description: pkg.description,
          label: pkg.label,
        })
        .where(eq(schema.products.id, existing.id))
      console.log(`  update id=${existing.id}  "${pkg.shortName}" (copy refreshed)`)
      skipped++
      continue
    }

    const [inserted] = await db
      .insert(schema.products)
      .values({
        shortName: pkg.shortName,
        displayName: pkg.displayName,
        description: pkg.description,
        label: pkg.label,
        icon: 'Podcast',
        price: pkg.priceCents,
        partnerShare: 0,
        productType: PRODUCT_TYPE,
        productCredits: pkg.productCredits,
        isActive: true,
        isUpgrade: false,
        isSoloUpgrade: false,
        sortOrder: pkg.sortOrder,
      })
      .returning({ id: schema.products.id })

    console.log(`  add   id=${inserted.id}  "${pkg.shortName}" (${pkg.productCredits} credits, $${pkg.priceCents / 100})`)
    created++
  }

  console.log(`\nDone. ${created} created, ${skipped} skipped.`)
  await client.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
