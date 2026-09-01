import { auth } from '@/lib/auth'
import { db } from '@/db'
import { blocklistTerms } from '@/db/schema'
import { asc, eq, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!(session?.user as any)?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const terms = await db
    .select()
    .from(blocklistTerms)
    .orderBy(asc(blocklistTerms.term))

  return NextResponse.json(terms)
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    const isAdmin = (session?.user as any)?.isAdmin
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const term = typeof body.term === 'string' ? body.term.trim() : ''
    const note =
      typeof body.note === 'string' && body.note.trim()
        ? body.note.trim().slice(0, 256)
        : null

    if (!term) {
      return NextResponse.json(
        { error: 'Keyword or phrase is required' },
        { status: 400 },
      )
    }

    if (term.length > 500) {
      return NextResponse.json(
        { error: 'Term must be 500 characters or fewer' },
        { status: 400 },
      )
    }

    const [existing] = await db
      .select({ id: blocklistTerms.id })
      .from(blocklistTerms)
      .where(sql`lower(${blocklistTerms.term}) = lower(${term})`)
      .limit(1)

    if (existing) {
      return NextResponse.json(
        { error: 'That keyword or phrase is already on the list' },
        { status: 409 },
      )
    }

    const userId = Number((session?.user as any)?.id)
    const [created] = await db
      .insert(blocklistTerms)
      .values({
        term,
        note,
        createdBy: Number.isFinite(userId) ? userId : null,
      })
      .returning()

    return NextResponse.json(created)
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json(
        { error: 'That keyword or phrase is already on the list' },
        { status: 409 },
      )
    }
    console.error('Error creating blocklist term:', error)
    return NextResponse.json(
      { error: 'Failed to add term' },
      { status: 500 },
    )
  }
}
