/**
 * Backfill script: Process all existing press releases to extract email addresses,
 * create release_emails records, and replace emails in release bodies with
 * newsworthy.email contact form links.
 *
 * Usage: bun scripts/backfill-release-emails.ts [--dry-run]
 *
 * --dry-run: Show what would be changed without writing to the database
 */

import { createHash } from 'crypto'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq, isNotNull, and } from 'drizzle-orm'
import * as schema from '../src/db/schema'

const dryRun = process.argv.includes('--dry-run')

const connectionString = process.env.DATABASE_URL!
if (!connectionString) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

const queryClient = postgres(connectionString, { prepare: false })
const db = drizzle(queryClient, { schema })

function md5(input: string): string {
  return createHash('md5').update(input.toLowerCase().trim()).digest('hex')
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractEmails(body: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
  const matches = body.match(emailRegex) || []
  const seen = new Set<string>()
  return matches.filter((email) => {
    const lower = email.toLowerCase()
    if (seen.has(lower)) return false
    seen.add(lower)
    return true
  })
}

async function main() {
  console.log(dryRun ? '=== DRY RUN ===' : '=== LIVE RUN ===')
  console.log()

  // Fetch all releases with a body
  const allReleases = await db
    .select({ id: schema.releases.id, body: schema.releases.body, title: schema.releases.title })
    .from(schema.releases)
    .where(isNotNull(schema.releases.body))

  console.log(`Found ${allReleases.length} releases with body text`)

  let totalEmails = 0
  let totalReleases = 0
  let totalNewRecords = 0

  for (const release of allReleases) {
    if (!release.body) continue

    // Skip releases already processed (body contains newsworthy.email links)
    if (release.body.includes('newsworthy.email/post/')) continue

    const emails = extractEmails(release.body)
    if (emails.length === 0) continue

    totalReleases++
    console.log(`\nRelease #${release.id}: "${release.title}" — ${emails.length} email(s) found`)

    let updatedBody = release.body

    for (const email of emails) {
      const hash = md5(email)
      totalEmails++

      console.log(`  ${email} → ${hash}-${release.id}`)

      // Insert hash record if not exists
      const existing = await db.query.releaseEmails.findFirst({
        where: eq(schema.releaseEmails.md5Hash, hash),
      })

      if (!existing) {
        totalNewRecords++
        if (!dryRun) {
          await db.insert(schema.releaseEmails).values({
            md5Hash: hash,
            email: email.toLowerCase().trim(),
          })
        }
        console.log(`  → Created release_emails record`)
      } else {
        console.log(`  → Hash already exists`)
      }

      const replacement = `<a href="https://newsworthy.email/post/${hash}-${release.id}">Email Contact</a>`

      // Replace mailto: hyperlinks
      const mailtoRegex = new RegExp(
        `<a\\s+[^>]*href\\s*=\\s*["']mailto:${escapeRegex(email)}["'][^>]*>.*?</a>`,
        'gi'
      )
      updatedBody = updatedBody.replace(mailtoRegex, replacement)

      // Replace bare email addresses
      const bareEmailRegex = new RegExp(escapeRegex(email), 'gi')
      updatedBody = updatedBody.replace(bareEmailRegex, replacement)
    }

    // Update the release body
    if (!dryRun) {
      await db.update(schema.releases)
        .set({ body: updatedBody })
        .where(eq(schema.releases.id, release.id))
    }
  }

  console.log('\n=== Summary ===')
  console.log(`Releases processed: ${totalReleases}`)
  console.log(`Emails found: ${totalEmails}`)
  console.log(`New release_emails records: ${totalNewRecords}`)
  if (dryRun) {
    console.log('\nNo changes written (dry run). Remove --dry-run to apply.')
  }

  await queryClient.end()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
