import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { releases } from '@/db/schema'
import { eq } from 'drizzle-orm'

// GET - Lookup a released PR by ID
export async function GET(request: NextRequest) {
  const session = await auth()

  const isEditor = (session?.user as any)?.isEditor
  const isAdmin = (session?.user as any)?.isAdmin

  if (!isEditor && !isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const prId = searchParams.get('prId')

  if (!prId) {
    return NextResponse.json({ error: 'PR ID is required' }, { status: 400 })
  }

  const id = parseInt(prId)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid PR ID' }, { status: 400 })
  }

  const result = await db
    .select({
      id: releases.id,
      status: releases.status,
      title: releases.title,
    })
    .from(releases)
    .where(eq(releases.id, id))
    .limit(1)

  if (result.length === 0) {
    return NextResponse.json({ error: `Press release with ID ${prId} not found.` }, { status: 404 })
  }

  return NextResponse.json({ release: result[0] })
}

// PUT - Update a released PR
export async function PUT(request: NextRequest) {
  const session = await auth()

  const isEditor = (session?.user as any)?.isEditor
  const isAdmin = (session?.user as any)?.isAdmin

  if (!isEditor && !isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { releaseId, title, abstract, body: releaseBody, pullquote } = body

    if (!releaseId) {
      return NextResponse.json({ error: 'Release ID is required' }, { status: 400 })
    }

    // Verify the release exists and is in 'sent' status
    const existing = await db
      .select()
      .from(releases)
      .where(eq(releases.id, releaseId))
      .limit(1)

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    if (existing[0].status !== 'sent') {
      return NextResponse.json({ error: 'Can only edit releases in sent/released status' }, { status: 400 })
    }

    // Validate fields
    if (!title || title.length < 30 || title.length > 180) {
      return NextResponse.json({ error: 'Headline must be between 30 and 180 characters' }, { status: 400 })
    }
    if (!abstract || abstract.length < 30 || abstract.length > 350) {
      return NextResponse.json({ error: 'Abstract must be between 30 and 350 characters' }, { status: 400 })
    }
    if (!releaseBody) {
      return NextResponse.json({ error: 'Body content is required' }, { status: 400 })
    }

    // Update only the four allowed fields
    await db.update(releases)
      .set({
        title,
        abstract,
        body: releaseBody,
        pullquote: pullquote || null,
      })
      .where(eq(releases.id, releaseId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating released PR:', error)
    return NextResponse.json({ error: 'Failed to update release' }, { status: 500 })
  }
}
