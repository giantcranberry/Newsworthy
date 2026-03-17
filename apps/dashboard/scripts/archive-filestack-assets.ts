/**
 * Archive Filestack assets locally and delete from Filestack.
 *
 * Queries all three backup tables (logos, banners, avatars, images),
 * downloads each original Filestack asset, saves to ~/Dev/filestack/
 * with a navigable directory structure, then deletes from Filestack.
 *
 * Directory structure:
 *   ~/Dev/filestack/
 *     logos/
 *       company-{id}/
 *         {handle}.{ext}
 *     banners/
 *       banner-{id}/
 *         {handle}.{ext}
 *         {handle}-front.{ext}     (front_page_url if different)
 *     avatars/
 *       user-{id}/
 *         {handle}.{ext}
 *     images/
 *       image-{id}/
 *         {handle}.{ext}
 *
 * Usage: bun scripts/archive-filestack-assets.ts [--dry-run] [--skip-delete]
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { sql } from 'drizzle-orm'
import { mkdir, writeFile } from 'node:fs/promises'
import { createHmac } from 'node:crypto'
import path from 'node:path'

const dryRun = process.argv.includes('--dry-run')
const skipDelete = process.argv.includes('--skip-delete')

const connectionString = process.env.DATABASE_URL!
if (!connectionString) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

const FILESTACK_KEY = process.env.FILESTACK_KEY!
const FILESTACK_SECRET = process.env.FILESTACK_SECRET!

// Read-only policy (for downloads)
const FILESTACK_RO_POLICY = process.env.FILESTACK_RO_POLICY!
const FILESTACK_RO_SIGNATURE = process.env.FILESTACK_RO_SIGNATURE!

if (!FILESTACK_KEY || !FILESTACK_SECRET) {
  console.error('FILESTACK_KEY and FILESTACK_SECRET are required.')
  process.exit(1)
}

// Generate a delete policy+signature at runtime (RO policy only has read+convert)
function generateDeletePolicy(): { policy: string; signature: string } {
  const policyObj = {
    call: ['remove'],
    expiry: Math.floor(Date.now() / 1000) + 3600, // 1 hour
  }
  const policy = Buffer.from(JSON.stringify(policyObj)).toString('base64')
  const signature = createHmac('sha256', FILESTACK_SECRET).update(policy).digest('hex')
  return { policy, signature }
}

const deleteAuth = generateDeletePolicy()

const queryClient = postgres(connectionString, { prepare: false })
const db = drizzle(queryClient)

const BASE_DIR = path.join(process.env.HOME!, 'Dev', 'filestack')

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Detect extension from content-type header */
function extFromContentType(ct: string): string {
  if (ct.includes('png')) return 'png'
  if (ct.includes('webp')) return 'webp'
  if (ct.includes('gif')) return 'gif'
  if (ct.includes('svg')) return 'svg'
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg'
  if (ct.includes('bmp')) return 'bmp'
  if (ct.includes('tiff')) return 'tiff'
  return 'bin'
}

/**
 * Extract the Filestack handle from a URL.
 * Examples:
 *   .../RESIZE/security=policy:...,signature:.../HANDLE  →  HANDLE
 *   .../security=policy:...,signature:.../HANDLE         →  HANDLE
 *   .../resize=width:328/HANDLE                          →  HANDLE
 *   .../HANDLE                                           →  HANDLE
 */
function extractHandle(url: string): string {
  const parts = url.replace('https://cdn.filestackcontent.com/', '').split('/')
  return parts[parts.length - 1]
}

/**
 * Build a raw download URL — fetch the original file with no transforms.
 * Uses the security policy to authenticate but no resize/convert operations.
 *
 *   .../RESIZE/security=policy:...,signature:.../HANDLE
 *   .../resize=width:328/HANDLE
 *   .../security=policy:...,signature:.../HANDLE
 *
 * All become: https://cdn.filestackcontent.com/security=policy:...,signature:.../HANDLE
 */
function toRawDownloadUrl(filestackUrl: string): string {
  const handle = extractHandle(filestackUrl)
  return `https://cdn.filestackcontent.com/security=policy:${FILESTACK_RO_POLICY},signature:${FILESTACK_RO_SIGNATURE}/${handle}`
}

/**
 * Delete a file from Filestack using the REST API.
 * DELETE https://www.filestackapi.com/api/file/{handle}?key={apikey}&policy={policy}&signature={signature}
 */
async function deleteFromFilestack(handle: string): Promise<boolean> {
  const url = `https://www.filestackapi.com/api/file/${handle}?key=${FILESTACK_KEY}&policy=${deleteAuth.policy}&signature=${deleteAuth.signature}`
  try {
    const res = await fetch(url, { method: 'DELETE' })
    if (res.ok) return true
    const body = await res.text()
    console.error(`    Delete failed (${res.status}): ${body}`)
    return false
  } catch (err) {
    console.error(`    Delete error:`, err)
    return false
  }
}

interface BackupRow {
  type: 'logo' | 'banner' | 'avatar' | 'image'
  id: number
  entityId: number
  urls: string[]
  labels: string[]
}

async function fetchBackupRows(): Promise<BackupRow[]> {
  const rows: BackupRow[] = []

  // Logos
  const logos = await db.execute<{ id: number; company_id: number; original_logo_url: string }>(
    sql`SELECT id, company_id, original_logo_url FROM logos_filestack_backup`
  )
  for (const r of logos) {
    if (r.original_logo_url) {
      rows.push({ type: 'logo', id: r.id, entityId: r.company_id, urls: [r.original_logo_url], labels: ['logo'] })
    }
  }

  // Banners
  const banners = await db.execute<{ id: number; banner_id: number; original_url: string; original_front_page_url: string; original_cdn_url: string }>(
    sql`SELECT id, banner_id, original_url, original_front_page_url, original_cdn_url FROM banners_filestack_backup`
  )
  for (const r of banners) {
    // Only archive the full-size original — front_page_url/cdn_url are
    // Filestack-generated resized copies, not unique assets
    if (r.original_url) {
      rows.push({ type: 'banner', id: r.id, entityId: r.banner_id, urls: [r.original_url], labels: ['full'] })
    }
  }

  // Avatars
  const avatars = await db.execute<{ id: number; user_id: number; original_avatar: string }>(
    sql`SELECT id, user_id, original_avatar FROM avatars_filestack_backup`
  )
  for (const r of avatars) {
    if (r.original_avatar) {
      rows.push({ type: 'avatar', id: r.id, entityId: r.user_id, urls: [r.original_avatar], labels: ['avatar'] })
    }
  }

  // Images
  const images = await db.execute<{ id: number; image_id: number; original_url: string }>(
    sql`SELECT id, image_id, original_url FROM images_filestack_backup`
  )
  for (const r of images) {
    if (r.original_url) {
      rows.push({ type: 'image', id: r.id, entityId: r.image_id, urls: [r.original_url], labels: ['image'] })
    }
  }

  return rows
}

function getDir(row: BackupRow): string {
  switch (row.type) {
    case 'logo': return path.join(BASE_DIR, 'logos', `company-${row.entityId}`)
    case 'banner': return path.join(BASE_DIR, 'banners', `banner-${row.entityId}`)
    case 'avatar': return path.join(BASE_DIR, 'avatars', `user-${row.entityId}`)
    case 'image': return path.join(BASE_DIR, 'images', `image-${row.entityId}`)
  }
}

async function main() {
  console.log(dryRun ? '=== DRY RUN ===' : '=== LIVE RUN ===')
  if (skipDelete) console.log('(skipping Filestack deletion)')
  console.log(`Archive directory: ${BASE_DIR}`)
  console.log()

  const rows = await fetchBackupRows()
  console.log(`Found ${rows.length} backup records:`)
  console.log(`  Logos:   ${rows.filter(r => r.type === 'logo').length}`)
  console.log(`  Banners: ${rows.filter(r => r.type === 'banner').length}`)
  console.log(`  Avatars: ${rows.filter(r => r.type === 'avatar').length}`)
  console.log(`  Images:  ${rows.filter(r => r.type === 'image').length}`)

  let downloaded = 0
  let deleted = 0
  let failed = 0

  for (const row of rows) {
    const dir = getDir(row)

    console.log(`\n[${row.type}:${row.entityId}]`)

    for (let i = 0; i < row.urls.length; i++) {
      const url = row.urls[i]
      const label = row.labels[i]
      const handle = extractHandle(url)
      const downloadUrl = toRawDownloadUrl(url)

      console.log(`  ${label}: ${handle}`)
      console.log(`    Fetch: ${downloadUrl}`)

      if (dryRun) {
        console.log(`    Would save to: ${dir}/${handle}.*`)
        downloaded++
        continue
      }

      try {
        // Download raw original — no transforms
        const res = await fetch(downloadUrl)
        if (!res.ok) {
          console.error(`    FAILED to fetch: ${res.status} ${res.statusText}`)
          failed++
          continue
        }

        const buffer = Buffer.from(await res.arrayBuffer())
        if (buffer.length === 0) {
          console.error(`    FAILED: empty response`)
          failed++
          continue
        }

        // Use content-type from Filestack to determine extension
        const contentType = res.headers.get('content-type') || 'application/octet-stream'
        const ext = extFromContentType(contentType)
        const filename = label !== 'full' && label !== 'logo' && label !== 'avatar' && label !== 'image'
          ? `${handle}-${label}.${ext}`
          : `${handle}.${ext}`
        const filePath = path.join(dir, filename)

        await mkdir(dir, { recursive: true })
        await writeFile(filePath, buffer)

        console.log(`    Saved: ${filePath} (${(buffer.length / 1024).toFixed(1)} KB, ${contentType})`)
        downloaded++

        // Delete from Filestack
        if (!skipDelete) {
          const ok = await deleteFromFilestack(handle)
          if (ok) {
            console.log(`    Deleted from Filestack: ${handle}`)
            deleted++
          }
        }

        await sleep(200)
      } catch (err) {
        console.error(`    ERROR:`, err)
        failed++
      }
    }
  }

  console.log('\n=== Summary ===')
  console.log(`Downloaded: ${downloaded}`)
  if (!skipDelete) console.log(`Deleted:    ${deleted}`)
  console.log(`Failed:     ${failed}`)
  if (dryRun) {
    console.log('\nNo changes written (dry run).')
  }

  await queryClient.end()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
