import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, clipReportRecipients } from '@/db/schema'
import { and, asc, eq, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getUserCompanyIds } from '@/lib/team-auth'

const MAX_RECIPIENTS = 6
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function getAuthorizedRelease(uuid: string, userId: number) {
  const release = await db.query.releases.findFirst({
    where: eq(releases.uuid, uuid),
    columns: { id: true, userId: true, companyId: true },
  })
  if (!release) return null
  if (release.userId !== userId) {
    const companyIds = await getUserCompanyIds(userId)
    if (!companyIds.includes(release.companyId)) return null
  }
  return release
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { uuid } = await params
  const release = await getAuthorizedRelease(uuid, userId)
  if (!release) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const recipients = await db
    .select()
    .from(clipReportRecipients)
    .where(eq(clipReportRecipients.releaseId, release.id))
    .orderBy(asc(clipReportRecipients.createdAt))

  return NextResponse.json({ recipients, max: MAX_RECIPIENTS })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ uuid: string }> },
) {
  try {
    const session = await getEffectiveSession()
    const userId = parseInt(session?.user?.id || '0')
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { uuid } = await params
    const release = await getAuthorizedRelease(uuid, userId)
    if (!release) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json()
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const name =
      typeof body.name === 'string' && body.name.trim()
        ? body.name.trim().slice(0, 128)
        : null

    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: 'A valid email address is required' },
        { status: 400 },
      )
    }

    const existing = await db
      .select({ id: clipReportRecipients.id })
      .from(clipReportRecipients)
      .where(eq(clipReportRecipients.releaseId, release.id))

    if (existing.length >= MAX_RECIPIENTS) {
      return NextResponse.json(
        { error: `You can add up to ${MAX_RECIPIENTS} recipients` },
        { status: 400 },
      )
    }

    const [dup] = await db
      .select({ id: clipReportRecipients.id })
      .from(clipReportRecipients)
      .where(
        and(
          eq(clipReportRecipients.releaseId, release.id),
          sql`lower(${clipReportRecipients.email}) = ${email}`,
        ),
      )
      .limit(1)

    if (dup) {
      return NextResponse.json(
        { error: 'That email is already on the list' },
        { status: 409 },
      )
    }

    const [created] = await db
      .insert(clipReportRecipients)
      .values({
        releaseId: release.id,
        email,
        name,
        isPrimaryContact: false,
      })
      .returning()

    return NextResponse.json(created)
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json(
        { error: 'That email is already on the list' },
        { status: 409 },
      )
    }
    console.error('Error adding clip report recipient:', error)
    return NextResponse.json(
      { error: 'Failed to add recipient' },
      { status: 500 },
    )
  }
}
