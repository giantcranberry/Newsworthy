/**
 * Download all Filestack assets to disk and optionally delete from Filestack.
 *
 * Queries the database for all URLs containing cdn.filestackcontent.com,
 * downloads each file to ~/Dev/filestack/<table>/, then optionally deletes
 * them from Filestack via the REST API.
 *
 * Usage:
 *   bun scripts/download-filestack.ts              # download only
 *   bun scripts/download-filestack.ts --delete      # download + delete from Filestack
 *   bun scripts/download-filestack.ts --dry-run     # just list what would be downloaded
 */

import { createHmac } from 'crypto'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import postgres from 'postgres'

// ── Config ──────────────────────────────────────────────────────────────────

const DEST_DIR = join(process.env.HOME!, 'Dev', 'filestack')
const dryRun = process.argv.includes('--dry-run')
const shouldDelete = process.argv.includes('--delete')

const connectionString = process.env.DATABASE_URL!
if (!connectionString) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

const FILESTACK_KEY = process.env.FILESTACK_KEY!
const FILESTACK_SECRET = process.env.FILESTACK_SECRET!

if (shouldDelete && (!FILESTACK_KEY || !FILESTACK_SECRET)) {
  console.error('FILESTACK_KEY and FILESTACK_SECRET are required for --delete')
  process.exit(1)
}

const sql = postgres(connectionString, { prepare: false })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ── Tables to scan ──────────────────────────────────────────────────────────
// Each entry: [table, url_column, id_column, label_column?]

interface TableDef {
  table: string
  urlCol: string
  idCol: string
  labelCol?: string
}

const TABLES: TableDef[] = [
  { table: 'company', urlCol: 'logo_url', idCol: 'id', labelCol: 'company_name' },
  { table: 'contact', urlCol: 'avatar', idCol: 'id', labelCol: 'first_name' },
  { table: 'images', urlCol: 'url', idCol: 'id', labelCol: 'title' },
  { table: 'files', urlCol: 'url', idCol: 'id', labelCol: 'title' },
  { table: 'banners', urlCol: 'url', idCol: 'id', labelCol: 'title' },
  { table: 'banners', urlCol: 'cdn_url', idCol: 'id', labelCol: 'title' },
  { table: 'banners', urlCol: 'front_page_url', idCol: 'id', labelCol: 'title' },
  { table: 'user_profiles', urlCol: 'avatar', idCol: 'id' },
  { table: 'influencer', urlCol: 'avatar', idCol: 'id', labelCol: 'name' },
  { table: 'partners', urlCol: 'logo', idCol: 'id', labelCol: 'name' },
  { table: 'products', urlCol: 'logo_url', idCol: 'id', labelCol: 'name' },
  { table: 'clip_report', urlCol: 'logo', idCol: 'id' },
  { table: 'clip_report', urlCol: 'thumbnail', idCol: 'id' },
  { table: 'clip_image', urlCol: 'image_url', idCol: 'id' },
  { table: 'community_post_images', urlCol: 'url', idCol: 'id' },
  { table: 'kanban_task_files', urlCol: 'url', idCol: 'id' },
  { table: 'mp_messages', urlCol: 'file', idCol: 'id' },
  { table: 'newsramp', urlCol: 'image_url', idCol: 'id', labelCol: 'title' },
  { table: 'releases', urlCol: 'video_url', idCol: 'id', labelCol: 'headline' },
  // Backup tables from previous migrations (contain original Filestack URLs)
  { table: 'images_filestack_backup', urlCol: 'original_url', idCol: 'image_id' },
  { table: 'banners_filestack_backup', urlCol: 'original_url', idCol: 'banner_id' },
  { table: 'banners_filestack_backup', urlCol: 'original_front_page_url', idCol: 'banner_id' },
  { table: 'banners_filestack_backup', urlCol: 'original_cdn_url', idCol: 'banner_id' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract the Filestack handle from a CDN URL.
 * e.g. https://cdn.filestackcontent.com/resize=width:300/security=policy:...,signature:.../ABC123
 *      → ABC123
 */
function extractHandle(url: string): string | null {
  const match = url.match(/filestackcontent\.com\/(?:.*\/)?([A-Za-z0-9]{20,})$/)
  return match?.[1] ?? null
}

/**
 * Build a download URL from a Filestack CDN URL.
 * Strips transformations (RESIZE, resize=...) to get the original file.
 * Keeps security params if present.
 */
function toDownloadUrl(url: string): string {
  // Remove RESIZE or resize=... segments but keep security and handle
  return url
    .replace(/\/RESIZE\//, '/')
    .replace(/\/resize=[^/]+\//, '/')
}

/**
 * Guess a file extension from content-type header.
 */
function extFromContentType(ct: string): string {
  if (ct.includes('png')) return 'png'
  if (ct.includes('webp')) return 'webp'
  if (ct.includes('gif')) return 'gif'
  if (ct.includes('svg')) return 'svg'
  if (ct.includes('pdf')) return 'pdf'
  if (ct.includes('mp4')) return 'mp4'
  if (ct.includes('mp3') || ct.includes('mpeg')) return 'mp3'
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg'
  if (ct.includes('json')) return 'json'
  if (ct.includes('zip')) return 'zip'
  if (ct.includes('octet-stream')) return 'bin'
  return 'bin'
}

/**
 * Generate a Filestack security policy + signature for deletion.
 */
function makeDeletePolicy(handle: string): { policy: string; signature: string } {
  const policyObj = {
    call: ['remove'],
    handle,
    expiry: Math.floor(Date.now() / 1000) + 3600, // 1 hour
  }
  const policy = Buffer.from(JSON.stringify(policyObj)).toString('base64url')
  const signature = createHmac('sha256', FILESTACK_SECRET).update(policy).digest('hex')
  return { policy, signature }
}

/**
 * Delete a file from Filestack by handle.
 */
async function deleteFromFilestack(handle: string): Promise<boolean> {
  const { policy, signature } = makeDeletePolicy(handle)
  const url = `https://www.filestackapi.com/api/file/${handle}?key=${FILESTACK_KEY}&policy=${policy}&signature=${signature}`
  const res = await fetch(url, { method: 'DELETE' })
  return res.ok
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(dryRun ? '=== DRY RUN ===' : shouldDelete ? '=== DOWNLOAD + DELETE ===' : '=== DOWNLOAD ONLY ===')
  console.log(`Destination: ${DEST_DIR}`)
  console.log()

  // Track unique handles to avoid downloading the same file twice
  const seen = new Set<string>()
  let totalFound = 0
  let downloaded = 0
  let deleted = 0
  let failed = 0
  let skipped = 0

  for (const def of TABLES) {
    const { table, urlCol, idCol, labelCol } = def

    // Check if table exists first
    let rows: Record<string, any>[]
    try {
      const labelSelect = labelCol ? `, ${labelCol} AS label` : ''
      rows = await sql.unsafe(
        `SELECT ${idCol} AS id, ${urlCol} AS url${labelSelect}
         FROM ${table}
         WHERE ${urlCol} LIKE 'https://cdn.filestackcontent.com%'`
      )
    } catch (err: any) {
      // Table or column might not exist
      if (err.message?.includes('does not exist') || err.code === '42P01' || err.code === '42703') {
        continue
      }
      throw err
    }

    if (rows.length === 0) continue

    console.log(`\n── ${table}.${urlCol} (${rows.length} rows) ──`)
    totalFound += rows.length

    // Create output directory for this table
    const tableDir = join(DEST_DIR, `${table}_${urlCol}`)
    if (!dryRun) {
      await mkdir(tableDir, { recursive: true })
    }

    for (const row of rows) {
      const { id, url, label } = row
      if (!url) {
        skipped++
        continue
      }

      const handle = extractHandle(url)
      if (!handle) {
        console.log(`  [${id}] ${label || ''} — SKIP: no handle found in URL`)
        console.log(`    ${url}`)
        skipped++
        continue
      }

      // Skip if we already downloaded this handle
      if (seen.has(handle)) {
        console.log(`  [${id}] ${label || ''} — SKIP: already downloaded (${handle})`)
        skipped++
        continue
      }

      const downloadUrl = toDownloadUrl(url)
      console.log(`  [${id}] ${label || ''} — ${handle}`)

      if (dryRun) {
        console.log(`    Would download: ${downloadUrl}`)
        seen.add(handle)
        downloaded++
        continue
      }

      try {
        // Download
        const res = await fetch(downloadUrl)
        if (!res.ok) {
          console.error(`    FAILED to fetch: ${res.status} ${res.statusText}`)
          failed++
          continue
        }

        const contentType = res.headers.get('content-type') || 'application/octet-stream'
        const buffer = Buffer.from(await res.arrayBuffer())

        if (buffer.length === 0) {
          console.error(`    FAILED: empty response`)
          failed++
          continue
        }

        const ext = extFromContentType(contentType)
        const safeLabel = (label || '')
          .toString()
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .slice(0, 50)
        const filename = safeLabel
          ? `${id}_${safeLabel}_${handle}.${ext}`
          : `${id}_${handle}.${ext}`

        const filePath = join(tableDir, filename)
        await Bun.write(filePath, buffer)

        console.log(`    Saved: ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`)
        seen.add(handle)
        downloaded++

        // Delete from Filestack if requested
        if (shouldDelete) {
          const ok = await deleteFromFilestack(handle)
          if (ok) {
            console.log(`    Deleted from Filestack`)
            deleted++
          } else {
            console.error(`    FAILED to delete from Filestack`)
          }
        }

        // Rate limit
        await sleep(150)
      } catch (err) {
        console.error(`    ERROR:`, err)
        failed++
      }
    }
  }

  console.log('\n=== Summary ===')
  console.log(`Total found:  ${totalFound}`)
  console.log(`Downloaded:   ${downloaded}`)
  console.log(`Skipped:      ${skipped} (dupes or missing)`)
  console.log(`Failed:       ${failed}`)
  if (shouldDelete) {
    console.log(`Deleted:      ${deleted}`)
  }
  if (dryRun) {
    console.log('\nNo files written (dry run). Remove --dry-run to download.')
  }

  await sql.end()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
