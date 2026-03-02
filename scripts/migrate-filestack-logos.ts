/**
 * Migrate Filestack company logos to Linode Object Storage.
 *
 * Fetches all company.logo_url values starting with
 * "https://cdn.filestackcontent.com/RESIZE", downloads them with
 * resize=width:300, uploads to Linode Object Storage, and updates
 * the company.logo_url in the database.
 *
 * Usage: bun scripts/migrate-filestack-logos.ts [--dry-run]
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq, like } from 'drizzle-orm'
import * as schema from '../src/db/schema'

const dryRun = process.argv.includes('--dry-run')

const connectionString = process.env.DATABASE_URL!
if (!connectionString) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

const queryClient = postgres(connectionString, { prepare: false })
const db = drizzle(queryClient, { schema })

// S3 setup (same as src/services/s3.ts)
const regionEnv = process.env.LINODES3_REGION || 'us-southeast-1'
const region = regionEnv.replace('.linodeobjects.com', '')
const BUCKET = process.env.LINODES3_BUCKET || 'cdn.newsramp.app'
const CDN_BASE_URL = `https://${BUCKET}`

const s3Client = new S3Client({
  region,
  endpoint: process.env.LINODES3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.LINODES3_ACCESS_KEY!,
    secretAccessKey: process.env.LINODES3_SECRET!,
  },
  forcePathStyle: false,
})

async function main() {
  console.log(dryRun ? '=== DRY RUN ===' : '=== LIVE RUN ===')
  console.log()

  // Find all companies with Filestack RESIZE logos
  const companies = await db
    .select({
      id: schema.company.id,
      companyName: schema.company.companyName,
      logoUrl: schema.company.logoUrl,
    })
    .from(schema.company)
    .where(like(schema.company.logoUrl, 'https://cdn.filestackcontent.com/RESIZE%'))

  console.log(`Found ${companies.length} companies with Filestack RESIZE logos`)

  let migrated = 0
  let failed = 0

  for (const co of companies) {
    if (!co.logoUrl) continue

    // Build the resized Filestack URL
    const resizedUrl = co.logoUrl.replace('RESIZE', 'resize=width:300')

    console.log(`\n[${co.id}] ${co.companyName}`)
    console.log(`  From: ${co.logoUrl}`)
    console.log(`  Fetch: ${resizedUrl}`)

    if (dryRun) {
      migrated++
      continue
    }

    try {
      // Download the resized image from Filestack
      const res = await fetch(resizedUrl)
      if (!res.ok) {
        console.error(`  FAILED to fetch: ${res.status} ${res.statusText}`)
        failed++
        continue
      }

      const contentType = res.headers.get('content-type') || 'image/png'
      const buffer = Buffer.from(await res.arrayBuffer())

      if (buffer.length === 0) {
        console.error(`  FAILED: empty response`)
        failed++
        continue
      }

      // Determine extension from content type
      const ext = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : 'png'
      const key = `logos/${co.id}-${Date.now()}.${ext}`

      // Upload to Linode Object Storage
      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          ACL: 'public-read',
        })
      )

      const newUrl = `${CDN_BASE_URL}/${key}`

      // Update the company record
      await db.update(schema.company)
        .set({ logoUrl: newUrl })
        .where(eq(schema.company.id, co.id))

      console.log(`  Uploaded: ${newUrl} (${(buffer.length / 1024).toFixed(1)} KB)`)
      migrated++
    } catch (err) {
      console.error(`  ERROR:`, err)
      failed++
    }
  }

  console.log('\n=== Summary ===')
  console.log(`Migrated: ${migrated}`)
  console.log(`Failed: ${failed}`)
  if (dryRun) {
    console.log('\nNo changes written (dry run). Remove --dry-run to apply.')
  }

  await queryClient.end()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
