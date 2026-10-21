import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { crmContacts, releases, tinyUrl, tinyUrlClicks } from '@/db/schema'
import { eq, and, desc, sql, inArray } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getCompanyAccess } from '@/lib/team-auth'

function buildNewsUrl(release: { id: number; slug: string | null; releasedAt: Date | null }) {
  if (!release.releasedAt) return null
  const d = new Date(release.releasedAt)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `https://www.newsworthy.ai/news/${y}${m}${day}${release.id}/${release.slug}`
}

// GET: Share-link clicks for one advocate, grouped by release
export async function GET(
  request: Request,
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
  const contactId = parseInt(new URL(request.url).searchParams.get('contactId') || '0')

  const contact = await db.query.crmContacts.findFirst({
    where: and(
      eq(crmContacts.id, contactId),
      eq(crmContacts.companyId, co.id),
      inArray(crmContacts.contactType, ['advocate', 'both'])
    ),
  })

  if (!contact) {
    return NextResponse.json({ error: 'Subscriber not found' }, { status: 404 })
  }

  // advocat_id = crm_contacts.id; pre-migration links used the legacy advocates.id
  const advocatIds = [contact.id]
  if (contact.sourceTable === 'advocates' && contact.sourceId) advocatIds.push(contact.sourceId)

  const clicks = sql<number>`sum(${tinyUrl.hits})`.mapWith(Number)
  // Distinct visitors (IP + device) for this release's links, from the per-click log
  const uniqueVisitors = sql<number>`(
    SELECT count(DISTINCT c.visitor_hash) FROM ${tinyUrlClicks} c
    WHERE c.tiny_url_id = ANY(array_agg("tiny_url"."id"))
  )`.mapWith(Number)

  const rows = await db
    .select({
      id: releases.id,
      title: releases.title,
      slug: releases.slug,
      releasedAt: releases.releasedAt,
      clicks,
      uniqueVisitors,
    })
    .from(tinyUrl)
    .innerJoin(releases, eq(releases.id, tinyUrl.prId))
    .where(and(
      eq(tinyUrl.coId, co.id),
      inArray(tinyUrl.advocatId, advocatIds),
      sql`${tinyUrl.hits} > 0`
    ))
    .groupBy(releases.id, releases.title, releases.slug, releases.releasedAt)
    .orderBy(desc(clicks), desc(releases.releasedAt))

  return NextResponse.json({
    releases: rows.map((r) => ({
      id: r.id,
      title: r.title,
      url: buildNewsUrl(r),
      releasedAt: r.releasedAt,
      clicks: r.clicks,
      uniqueVisitors: r.uniqueVisitors,
    })),
  })
}
