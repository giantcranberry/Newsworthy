import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { communityGuidelines } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [guidelines] = await db.select().from(communityGuidelines).limit(1)
  return NextResponse.json(guidelines || { body: '' })
}

export async function PUT(request: NextRequest) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  const userId = (session?.user as any)?.id
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { body } = await request.json()

  const [existing] = await db.select().from(communityGuidelines).limit(1)

  if (existing) {
    const [updated] = await db
      .update(communityGuidelines)
      .set({ body, updatedBy: userId, updatedAt: new Date() })
      .where(eq(communityGuidelines.id, existing.id))
      .returning()
    return NextResponse.json(updated)
  } else {
    const [created] = await db
      .insert(communityGuidelines)
      .values({ body, updatedBy: userId })
      .returning()
    return NextResponse.json(created)
  }
}
