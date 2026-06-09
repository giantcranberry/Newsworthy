import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, consolidatedReports, company } from '@/db/schema'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { getUserCompanyIds } from '@/lib/team-auth'

const MAX_RELEASES = 12

// GET — list the current user's saved consolidated shares
export async function GET() {
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db.query.consolidatedReports.findMany({
    where: and(eq(consolidatedReports.userId, userId), eq(consolidatedReports.isDeleted, false)),
    orderBy: desc(consolidatedReports.createdAt),
  })

  return NextResponse.json(
    rows.map((r) => ({
      uuid: r.uuid,
      title: r.title,
      count: Array.isArray(r.releaseUuids) ? (r.releaseUuids as string[]).length : 0,
      createdAt: r.createdAt,
    })),
  )
}

// POST — create a shareable consolidated report from a set of release uuids
export async function POST(request: NextRequest) {
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { ids?: unknown; title?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const ids = Array.isArray(body.ids)
    ? Array.from(new Set(body.ids.filter((v): v is string => typeof v === 'string' && v.length > 0)))
    : []
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 200) : null

  if (ids.length < 2) {
    return NextResponse.json({ error: 'Select at least two releases' }, { status: 400 })
  }
  if (ids.length > MAX_RELEASES) {
    return NextResponse.json({ error: `Select at most ${MAX_RELEASES} releases` }, { status: 400 })
  }

  // Verify the user can access every selected release (owner, company, or admin).
  const found = await db.query.releases.findMany({
    where: inArray(releases.uuid, ids),
    columns: { uuid: true, userId: true, companyId: true, status: true },
  })

  if (found.length !== ids.length) {
    return NextResponse.json({ error: 'One or more releases not found' }, { status: 404 })
  }

  const isAdminOrImpersonating =
    (session?.user as any)?.isAdmin || (session?.user as any)?.isImpersonating
  if (!isAdminOrImpersonating) {
    const companyIds = await getUserCompanyIds(userId)
    const companyIdSet = new Set(companyIds)
    const allowed = found.every((r) => r.userId === userId || companyIdSet.has(r.companyId))
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Pick a company for branding: the first selected release's company the user owns.
  const companyId = found[0]?.companyId ?? null
  let brandCompanyId: number | null = null
  if (companyId) {
    const co = await db.query.company.findFirst({
      where: and(eq(company.id, companyId), eq(company.isDeleted, false)),
      columns: { id: true },
    })
    brandCompanyId = co?.id ?? null
  }

  const uuid = randomUUID()
  // Preserve the caller's order rather than the DB return order.
  await db.insert(consolidatedReports).values({
    uuid,
    userId,
    companyId: brandCompanyId,
    title,
    releaseUuids: ids,
  })

  return NextResponse.json({ uuid })
}
