import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { influencer } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)

  try {
    // Check if user already has an influencer profile
    const existing = await db.query.influencer.findFirst({
      where: eq(influencer.userId, userId),
    })

    if (existing) {
      return NextResponse.json(
        { error: 'You already have an influencer profile' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { name, bio, cell, altemail } = body

    // Create new influencer profile
    const uuid = uuidv4()
    const [newInfluencer] = await db.insert(influencer).values({
      userId,
      uuid,
      name: name || session.user.name || session.user.email,
      bio,
      cell,
      altemail,
      completedJobs: 0,
    }).returning()

    return NextResponse.json({ success: true, uuid: newInfluencer.uuid })
  } catch (error) {
    console.error('Error creating influencer profile:', error)
    return NextResponse.json(
      { error: 'Failed to create influencer profile' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)

  try {
    const body = await request.json()
    const { name, bio, cell, altemail, avatar } = body

    // Update influencer profile
    await db.update(influencer)
      .set({
        name,
        bio,
        cell,
        altemail,
        avatar,
      })
      .where(eq(influencer.userId, userId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating influencer profile:', error)
    return NextResponse.json(
      { error: 'Failed to update influencer profile' },
      { status: 500 }
    )
  }
}
