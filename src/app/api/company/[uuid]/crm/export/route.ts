import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { company, crmContacts } from '@/db/schema'
import { eq, and, desc, sql, isNotNull, isNull, inArray, ilike, or } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

async function getCompanyForUser(uuid: string, userId: number, isAdmin = false) {
  return db.query.company.findFirst({
    where: isAdmin
      ? eq(company.uuid, uuid)
      : and(
          eq(company.uuid, uuid),
          eq(company.userId, userId)
        ),
  })
}

function escapeCsvField(value: string | null | undefined): string {
  if (!value) return ''
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

// GET: Export all contacts matching current filters as CSV
export async function GET(
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
  const co = await getCompanyForUser(uuid, userId, isAdmin)

  if (!co) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.trim() || ''
  const contactType = searchParams.get('type') || ''
  const statusFilter = searchParams.get('status') || ''

  let combinedFilter = and(
    eq(crmContacts.companyId, co.id),
    sql`${crmContacts.isDeleted} IS NOT TRUE`
  )

  // Contact type filter
  if (contactType === 'media') {
    combinedFilter = and(combinedFilter, inArray(crmContacts.contactType, ['media', 'both']))
  } else if (contactType === 'advocate') {
    combinedFilter = and(combinedFilter, inArray(crmContacts.contactType, ['advocate', 'both']))
  }

  // Search filter
  if (query) {
    combinedFilter = and(combinedFilter, or(
      ilike(crmContacts.email, `%${query}%`),
      ilike(crmContacts.firstName, `%${query}%`),
      ilike(crmContacts.lastName, `%${query}%`),
      ilike(crmContacts.publication, `%${query}%`)
    ))
  }

  // Status filter
  if (statusFilter === 'active') {
    combinedFilter = and(combinedFilter, isNull(crmContacts.bouncedAt), isNull(crmContacts.unsubscribeAt))
  } else if (statusFilter === 'bounced') {
    combinedFilter = and(combinedFilter, isNotNull(crmContacts.bouncedAt))
  } else if (statusFilter === 'unsubscribed') {
    combinedFilter = and(combinedFilter, isNotNull(crmContacts.unsubscribeAt))
  }

  const contacts = await db
    .select()
    .from(crmContacts)
    .where(combinedFilter)
    .orderBy(desc(crmContacts.createdAt))
    .limit(50000)

  const headers = [
    'Email', 'First Name', 'Last Name', 'Type', 'Phone',
    'Publication', 'Domain', 'Notes', 'Source', 'Status',
    'Added', 'Last Open', 'Bounced', 'Unsubscribed',
    'LinkedIn', 'Twitter',
  ]

  const rows = contacts.map((c) => {
    let status = 'Active'
    if (c.bouncedAt) status = 'Bounced'
    else if (c.unsubscribeAt) status = 'Unsubscribed'

    return [
      escapeCsvField(c.email),
      escapeCsvField(c.firstName),
      escapeCsvField(c.lastName),
      escapeCsvField(c.contactType),
      escapeCsvField(c.phone),
      escapeCsvField(c.publication),
      escapeCsvField(c.tld),
      escapeCsvField(c.notes),
      escapeCsvField(c.source),
      status,
      c.createdAt ? new Date(c.createdAt).toISOString().split('T')[0] : '',
      c.lastOpenAt ? new Date(c.lastOpenAt).toISOString().split('T')[0] : '',
      c.bouncedAt ? new Date(c.bouncedAt).toISOString().split('T')[0] : '',
      c.unsubscribeAt ? new Date(c.unsubscribeAt).toISOString().split('T')[0] : '',
      escapeCsvField(c.linkedin),
      escapeCsvField(c.twitter),
    ].join(',')
  })

  const csv = [headers.join(','), ...rows].join('\n')

  const companyName = co.companyName?.replace(/[^a-zA-Z0-9]/g, '-') || 'contacts'
  const date = new Date().toISOString().split('T')[0]
  const filename = `${companyName}-crm-export-${date}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
