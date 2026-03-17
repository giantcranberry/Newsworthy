/**
 * Migrate Filestack user avatars to Linode Object Storage.
 *
 * For each user_profile with a Filestack avatar URL:
 * 1. Backs up original URL to avatars_filestack_backup
 * 2. Downloads the original image (no resize — preserves transparency)
 * 3. Uploads to Linode Object Storage in original format
 * 4. Updates user_profiles.avatar in the database
 *
 * Usage: bun scripts/migrate-filestack-avatars.ts [--dry-run]
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
  if (format === 'svg') return { ext: 'svg', mime: 'image/svg+xml' }
  return { ext: 'jpg', mime: 'image/jpeg' }
}

/**
 * Strip the RESIZE transform to download the original image.
 * Handles both patterns:
 *   .../RESIZE/security=.../HANDLE  →  .../security=.../HANDLE
 *   .../security=.../HANDLE         →  unchanged
 */
function toDownloadUrl(filestackUrl: string): string {
  return filestackUrl.replace('/RESIZE/', '/')
}

async function main() {
  console.log(dryRun ? '=== DRY RUN ===' : '=== LIVE RUN ===')
  console.log()

  // Find all user profiles with any Filestack avatar URL
  const profiles = await db
    .select({
      id: schema.userProfiles.id,
      userId: schema.userProfiles.userId,
      firstName: schema.userProfiles.firstName,
      lastName: schema.userProfiles.lastName,
      avatar: schema.userProfiles.avatar,
    })
    .from(schema.userProfiles)
    .where(like(schema.userProfiles.avatar, 'https://cdn.filestackcontent.com%'))

  console.log(`Found ${profiles.length} user profiles with Filestack avatars`)

  let migrated = 0
  let failed = 0
  let skipped = 0

  for (const profile of profiles) {
    const { id, userId, firstName, lastName, avatar } = profile

    if (!avatar) {
      skipped++
      continue
    }

    const downloadUrl = toDownloadUrl(avatar)

    console.log(`\n[profile:${id} user:${userId}] ${firstName || ''} ${lastName || ''}`)
    console.log(`  From: ${avatar}`)
    console.log(`  Fetch: ${downloadUrl}`)

    if (dryRun) {
      migrated++
      continue
    }

    try {
      // 1. Backup original URL
      await db.execute(sql`
        INSERT INTO avatars_filestack_backup (user_profile_id, user_id, original_avatar)
        VALUES (${id}, ${userId}, ${avatar})
      `)

      // 2. Download the original image
      const res = await fetch(downloadUrl)
      if (!res.ok) {
        console.error(`  FAILED to fetch: ${res.status} ${res.statusText}`)
        failed++
        continue
      }

      const buffer = Buffer.from(await res.arrayBuffer())

      if (buffer.length === 0) {
        console.error(`  FAILED: empty response`)
        failed++
        continue
      }

      console.log(`  Downloaded: ${(buffer.length / 1024).toFixed(1)} KB`)

      // 3. Detect actual format from image bytes
      const { ext, mime } = await detectFormat(buffer)
      const key = `avatars/user-${userId}-${Date.now()}.${ext}`

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

      // 5. Update the user profile record
      await db
        .update(schema.userProfiles)
        .set({ avatar: newUrl })
        .where(eq(schema.userProfiles.id, id))

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
  console.log(`Total:    ${profiles.length}`)
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
