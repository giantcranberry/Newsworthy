import { createHash } from 'crypto'
import { db } from '@/db'
import { releaseEmails, releases } from '@/db/schema'
import { eq } from 'drizzle-orm'

function md5(input: string): string {
  return createHash('md5').update(input.toLowerCase().trim()).digest('hex')
}

/**
 * Extract all email addresses from HTML body text.
 * Handles both plain text emails and mailto: hyperlinks.
 */
function extractEmails(body: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
  const matches = body.match(emailRegex) || []
  // Deduplicate (case-insensitive)
  const seen = new Set<string>()
  return matches.filter((email) => {
    const lower = email.toLowerCase()
    if (seen.has(lower)) return false
    seen.add(lower)
    return true
  })
}

/**
 * Process a release body: extract emails, store hashes in release_emails table,
 * and replace email addresses/mailto links with newsworthy.email links.
 */
export async function processReleaseEmails(releaseId: number, body: string): Promise<string> {
  const emails = extractEmails(body)
  if (emails.length === 0) return body

  let updatedBody = body

  for (const email of emails) {
    const hash = md5(email)

    // Insert if not exists
    const existing = await db.query.releaseEmails.findFirst({
      where: eq(releaseEmails.md5Hash, hash),
    })

    if (!existing) {
      await db.insert(releaseEmails).values({
        md5Hash: hash,
        email: email.toLowerCase().trim(),
      })
    }

    const replacement = `<a href="https://newsworthy.email/post/${hash}-${releaseId}">Email Contact</a>`

    // Replace mailto: hyperlinks containing this email
    // Matches <a href="mailto:email@example.com" ...>any text</a>
    const mailtoRegex = new RegExp(
      `<a\\s+[^>]*href\\s*=\\s*["']mailto:${escapeRegex(email)}["'][^>]*>.*?</a>`,
      'gi'
    )
    updatedBody = updatedBody.replace(mailtoRegex, replacement)

    // Replace any remaining bare email addresses (not already replaced)
    const bareEmailRegex = new RegExp(escapeRegex(email), 'gi')
    updatedBody = updatedBody.replace(bareEmailRegex, replacement)
  }

  // Save updated body back to the release
  await db.update(releases)
    .set({ body: updatedBody })
    .where(eq(releases.id, releaseId))

  return updatedBody
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
