import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { company, crmContacts } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createHash } from 'crypto'
import { getCompanyAccess, hasMinRole } from '@/lib/team-auth'

function getMd5(email: string) {
  return createHash('md5').update(email.toLowerCase()).digest('hex')
}

// POST: Import pre-parsed rows from client (CSV/XLS)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params
  const session = await getEffectiveSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)
  const isAdmin = !!(session?.user as any)?.isAdmin || !!(session?.user as any)?.isStaff
  const access = await getCompanyAccess(uuid, userId, isAdmin)

  if (!access) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  const co = access.company

  const { rows, contactType } = await request.json()
  const type = contactType || 'media'

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
  }

  if (rows.length > 5000) {
    return NextResponse.json({
      error: `Please limit to 5,000 contacts per import. You submitted ${rows.length}.`,
    }, { status: 400 })
  }

  let added = 0
  let skipped = 0
  const errors: string[] = []
  const seenInBatch = new Set<string>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const email = row.email?.trim()?.toLowerCase()

    if (!email || !email.includes('@')) {
      skipped++
      continue
    }

    const emailMd5 = getMd5(email)

    // Within-batch dedup
    if (seenInBatch.has(emailMd5)) {
      skipped++
      continue
    }
    seenInBatch.add(emailMd5)

    // Check for duplicate within this company
    const existing = await db.query.crmContacts.findFirst({
      where: and(
        eq(crmContacts.md5, emailMd5),
        eq(crmContacts.companyId, co.id),
        sql`${crmContacts.isDeleted} IS NOT TRUE`
      ),
    })

    if (existing) {
      skipped++
      continue
    }

    const firstName = row.firstName?.trim() || null
    const lastName = row.lastName?.trim() || null

    try {
      await db.insert(crmContacts).values({
        uuid: randomUUID().replace(/-/g, ''),
        userId,
        companyId: co.id,
        contactType: type,
        firstName,
        lastName,
        fullName: [firstName, lastName].filter(Boolean).join(' ') || null,
        email,
        md5: emailMd5,
        phone: row.phone?.trim() || null,
        publication: row.publication?.trim() || null,
        tld: row.tld?.trim()?.toLowerCase() || null,
        notes: row.notes?.trim() || null,
        source: 'import',
      })
      added++
    } catch {
      errors.push(`Row ${i + 1}: Failed to import ${email}`)
    }
  }

  return NextResponse.json({
    success: true,
    added,
    skipped,
    errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
  })
}
