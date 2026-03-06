import { auth } from '@/lib/auth'
import { db } from '@/db'
import { releases, users, company } from '@/db/schema'
import { desc, eq, gte } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

const VALID_STATUSES = ['start', 'draft', 'draftnxt', 'review', 'approved', 'sent']

export async function GET(request: NextRequest) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  const isStaff = (session?.user as any)?.isStaff

  if (!isAdmin && !isStaff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const status = request.nextUrl.searchParams.get('status')

  if (status && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const baseQuery = db
    .select({
      release: {
        id: releases.id,
        uuid: releases.uuid,
        title: releases.title,
        status: releases.status,
        createdAt: releases.createdAt,
        releaseAt: releases.releaseAt,
      },
      user: {
        email: users.email,
      },
      company: {
        companyName: company.companyName,
      },
    })
    .from(releases)
    .leftJoin(users, eq(releases.userId, users.id))
    .leftJoin(company, eq(releases.companyId, company.id))

  let result
  if (status) {
    result = await baseQuery
      .where(eq(releases.status, status))
      .orderBy(desc(releases.createdAt))
  } else {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    result = await baseQuery
      .where(gte(releases.createdAt, thirtyDaysAgo))
      .orderBy(desc(releases.createdAt))
  }

  return NextResponse.json(result)
}
