/**
 * Migrate Filestack banner images to Linode Object Storage.
 *
 * For each banner with a Filestack URL:
 * 1. Backs up original URLs to banners_filestack_backup
 * 2. Downloads the full-size image (resize=width:1200)
 * 3. Generates a 328px thumbnail with sharp
 * 4. Uploads both to Linode Object Storage
 * 5. Updates url, front_page_url, and cdn_url in the banners table
 *
 * Usage: bun scripts/migrate-filestack-banners.ts [--dry-run]
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

/** Small delay between downloads to avoid hammering Filestack */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Detect format from content-type and return sharp output config */
function getFormat(contentType: string): { ext: string; mime: string; isPng: boolean } {
  if (contentType.includes('png')) return { ext: 'png', mime: 'image/png', isPng: true }
  if (contentType.includes('webp')) return { ext: 'webp', mime: 'image/webp', isPng: false }
  if (contentType.includes('gif')) return { ext: 'gif', mime: 'image/gif', isPng: false }
  return { ext: 'jpg', mime: 'image/jpeg', isPng: false }
}

/** Resize buffer preserving original format (PNG stays PNG, JPEG stays JPEG) */
async function resizeImage(buffer: Buffer, maxWidth: number, quality: number): Promise<{ data: Buffer; ext: string; mime: string }> {
  const metadata = await sharp(buffer).metadata()
  const format = metadata.format // 'jpeg', 'png', 'webp', 'gif', etc.

  let pipeline = sharp(buffer)
    .rotate()
    .resize(maxWidth, undefined, { fit: 'inside', withoutEnlargement: true })

  let ext: string
  let mime: string

  if (format === 'png') {
    pipeline = pipeline.png({ quality })
    ext = 'png'
    mime = 'image/png'
  } else if (format === 'webp') {
    pipeline = pipeline.webp({ quality })
    ext = 'webp'
    mime = 'image/webp'
  } else {
    pipeline = pipeline.jpeg({ quality })
    ext = 'jpg'
    mime = 'image/jpeg'
  }

  const data = await pipeline.toBuffer()
  return { data, ext, mime }
}

/**
 * Convert a Filestack RESIZE URL to a fetchable download URL.
 *
 * Input:  https://cdn.filestackcontent.com/RESIZE/security=policy:...,signature:.../HANDLE
 * Output: https://cdn.filestackcontent.com/resize=width:1200/security=policy:...,signature:.../HANDLE
 */
function toDownloadUrl(filestackUrl: string): string {
  return filestackUrl.replace('/RESIZE/', '/resize=width:1200/')
}

async function main() {
  console.log(dryRun ? '=== DRY RUN ===' : '=== LIVE RUN ===')
  console.log()

  // Find all banners with Filestack URLs
  const banners = await db
    .select({
      id: schema.banners.id,
      title: schema.banners.title,
      url: schema.banners.url,
      frontPageUrl: schema.banners.frontPageUrl,
      cdnUrl: schema.banners.cdnUrl,
    })
    .from(schema.banners)
    .where(like(schema.banners.url, 'https://cdn.filestackcontent.com%'))

  console.log(`Found ${banners.length} banners with Filestack URLs`)

  let migrated = 0
  let failed = 0
  let skipped = 0

  for (const banner of banners) {
    const { id, title, url, frontPageUrl, cdnUrl } = banner

    console.log(`\n[${id}] ${title || '(no title)'}`)
    console.log(`  url:            ${url}`)
    console.log(`  front_page_url: ${frontPageUrl}`)

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
      // 1. Backup original URLs
      await db.execute(sql`
        INSERT INTO banners_filestack_backup (banner_id, original_url, original_front_page_url, original_cdn_url)
        VALUES (${id}, ${url}, ${frontPageUrl}, ${cdnUrl})
      `)

      // 2. Download the full-size image
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

      // 3. Process full-size (cap at 1200px wide, preserve format)
      const full = await resizeImage(buffer, 1200, 85)

      // 4. Generate 328px thumbnail (same format)
      const thumb = await resizeImage(buffer, 328, 80)

      const timestamp = Date.now()
      const fullKey = `banners/${id}-${timestamp}.${full.ext}`
      const thumbKey = `banners/${id}-${timestamp}-thumb.${thumb.ext}`

      // 5. Upload full-size to Linode
      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: fullKey,
          Body: full.data,
          ContentType: full.mime,
          ACL: 'public-read',
        })
      )

      // 6. Upload thumbnail to Linode
      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: thumbKey,
          Body: thumb.data,
          ContentType: thumb.mime,
          ACL: 'public-read',
        })
      )

      const newUrl = `${CDN_BASE_URL}/${fullKey}`
      const newThumbUrl = `${CDN_BASE_URL}/${thumbKey}`

      // 7. Update the banner record
      await db
        .update(schema.banners)
        .set({
          url: newUrl,
          frontPageUrl: newThumbUrl,
          cdnUrl: newThumbUrl,
        })
        .where(eq(schema.banners.id, id))

      console.log(`  Full:  ${newUrl} (${(full.data.length / 1024).toFixed(1)} KB, ${full.ext})`)
      console.log(`  Thumb: ${newThumbUrl} (${(thumb.data.length / 1024).toFixed(1)} KB, ${thumb.ext})`)
      migrated++

      // Rate limit
      await sleep(200)
    } catch (err) {
      console.error(`  ERROR:`, err)
      failed++
    }
  }

  console.log('\n=== Summary ===')
  console.log(`Total:    ${banners.length}`)
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
