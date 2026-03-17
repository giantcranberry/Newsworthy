/**
 * Migrate Filestack images to Linode Object Storage.
 *
 * For each image with a Filestack URL:
 * 1. Backs up original URL to images_filestack_backup
 * 2. Downloads the original image at full resolution
 * 3. Uploads to Linode Object Storage
 * 4. Updates url in the images table
 *
 * Usage: bun scripts/migrate-filestack-images.ts [--dry-run]
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq, like, sql } from 'drizzle-orm'
import sharp from 'sharp'
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Detect format from image bytes */
async function detectFormat(buffer: Buffer): Promise<{ ext: string; mime: string }> {
  const metadata = await sharp(buffer).metadata()
  const format = metadata.format
  if (format === 'png') return { ext: 'png', mime: 'image/png' }
  if (format === 'webp') return { ext: 'webp', mime: 'image/webp' }
  if (format === 'gif') return { ext: 'gif', mime: 'image/gif' }
  return { ext: 'jpg', mime: 'image/jpeg' }
}

/**
 * Strip the RESIZE transform to download the original full-resolution image.
 *
 * Input:  https://cdn.filestackcontent.com/RESIZE/security=policy:...,signature:.../HANDLE
 * Output: https://cdn.filestackcontent.com/security=policy:...,signature:.../HANDLE
 */
function toDownloadUrl(filestackUrl: string): string {
  return filestackUrl.replace('/RESIZE/', '/')
}

async function main() {
  console.log(dryRun ? '=== DRY RUN ===' : '=== LIVE RUN ===')
  console.log()

  // Find all images with Filestack URLs
  const rows = await db
    .select({
      id: schema.images.id,
      title: schema.images.title,
      url: schema.images.url,
      companyId: schema.images.companyId,
    })
    .from(schema.images)
    .where(like(schema.images.url, 'https://cdn.filestackcontent.com%'))

  console.log(`Found ${rows.length} images with Filestack URLs`)

  let migrated = 0
  let failed = 0
  let skipped = 0

  for (const image of rows) {
    const { id, title, url, companyId } = image

    console.log(`\n[${id}] ${title || '(no title)'}`)
    console.log(`  url: ${url}`)

    if (!url) {
      console.log('  SKIP: no url')
      skipped++
      continue
    }

    const downloadUrl = toDownloadUrl(url)
    console.log(`  Fetch: ${downloadUrl}`)

    if (dryRun) {
      migrated++
      continue
    }

    try {
      // 1. Backup original URL
      await db.execute(sql`
        INSERT INTO images_filestack_backup (image_id, original_url)
        VALUES (${id}, ${url})
      `)

      // 2. Download the image
      const res = await fetch(downloadUrl)
      if (!res.ok) {
        console.error(`  FAILED to fetch: ${res.status} ${res.statusText}`)
        failed++
        continue
      }

      const contentType = res.headers.get('content-type') || 'image/jpeg'
      const buffer = Buffer.from(await res.arrayBuffer())

      if (buffer.length === 0) {
        console.error(`  FAILED: empty response`)
        failed++
        continue
      }

      console.log(`  Downloaded: ${(buffer.length / 1024).toFixed(1)} KB`)

      // 3. Detect format from the actual image bytes
      const { ext, mime } = await detectFormat(buffer)

      const timestamp = Date.now()
      const key = `images/co-${companyId}-${id}-${timestamp}.${ext}`

      // 4. Upload original bytes to Linode (no resize/recompression)
      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: buffer,
          ContentType: mime,
          ACL: 'public-read',
        })
      )

      const newUrl = `${CDN_BASE_URL}/${key}`

      // 5. Update the image record
      await db
        .update(schema.images)
        .set({ url: newUrl })
        .where(eq(schema.images.id, id))

      console.log(`  Uploaded: ${newUrl} (${(buffer.length / 1024).toFixed(1)} KB, ${ext})`)
      migrated++

      // Rate limit
      await sleep(200)
    } catch (err) {
      console.error(`  ERROR:`, err)
      failed++
    }
  }

  console.log('\n=== Summary ===')
  console.log(`Total:    ${rows.length}`)
  console.log(`Migrated: ${migrated}`)
  console.log(`Failed:   ${failed}`)
  console.log(`Skipped:  ${skipped}`)
  if (dryRun) {
    console.log('\nNo changes written (dry run). Remove --dry-run to apply.')
  }

  await queryClient.end()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
