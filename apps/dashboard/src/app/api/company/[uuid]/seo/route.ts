import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { company } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
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

export async function PUT(
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

  const body = await request.json()
  const { jsonLd, seo } = body

  const updateData: Record<string, unknown> = {}

  // Handle JSON-LD
  if (jsonLd === null) {
    updateData.jsonLd = null
  } else if (jsonLd !== undefined) {
    let parsed: unknown
    if (typeof jsonLd === 'string') {
      try {
        parsed = JSON.parse(jsonLd)
      } catch {
        return NextResponse.json({ error: 'Invalid JSON syntax' }, { status: 400 })
      }
    } else {
      parsed = jsonLd
    }
    updateData.jsonLd = parsed
  }

  // Handle SEO config
  if (seo !== undefined) {
    updateData.seo = seo
  }

  if (Object.keys(updateData).length > 0) {
    await db.update(company)
      .set(updateData)
      .where(eq(company.id, co.id))
  }

  return NextResponse.json({ success: true })
}
