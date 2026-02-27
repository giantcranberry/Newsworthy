import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { releases, releaseCategories, releaseRegions } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function PUT(request: NextRequest) {
  const session = await auth()

  const isEditor = (session?.user as any)?.isEditor
  const isAdmin = (session?.user as any)?.isAdmin

  if (!isEditor && !isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      releaseId,
      title,
      abstract,
      body: releaseBody,
      pullquote,
      location,
      videoUrl,
      landingPage,
      publicDrive,
      fir,
      primaryContactId,
      releaseDate,
      releaseTime,
      timezone,
      categoryIds,
      regionIds,
    } = body

    if (!releaseId) {
      return NextResponse.json({ error: 'Release ID required' }, { status: 400 })
    }

    // Validate
    if (!title || title.length < 30 || title.length > 180) {
      return NextResponse.json({ error: 'Headline must be between 30 and 180 characters' }, { status: 400 })
    }
    if (!abstract || abstract.length < 30 || abstract.length > 350) {
      return NextResponse.json({ error: 'Abstract must be between 30 and 350 characters' }, { status: 400 })
    }

    // Build release_at from date + time + timezone
    let releaseAt: Date | null = null
    if (releaseDate && releaseTime) {
      // Combine date and time, store as UTC
      // The client sends date as YYYY-MM-DD and time as HH:MM
      releaseAt = new Date(`${releaseDate}T${releaseTime}:00`)
    }

    // Update release fields
    await db.update(releases)
      .set({
        title,
        abstract,
        body: releaseBody,
        pullquote: pullquote || null,
        location: location || null,
        videoUrl: videoUrl || null,
        landingPage: landingPage || null,
        publicDrive: publicDrive || null,
        fir: fir || false,
        primaryContactId: primaryContactId || null,
        releaseAt,
        timezone: timezone || null,
      })
      .where(eq(releases.id, releaseId))

    // Update categories: delete existing, insert new
    if (categoryIds && Array.isArray(categoryIds)) {
      await db.delete(releaseCategories)
        .where(eq(releaseCategories.releaseId, releaseId))

      if (categoryIds.length > 0) {
        await db.insert(releaseCategories).values(
          categoryIds.map((catId: number) => ({
            releaseId,
            categoryId: catId,
          }))
        )
      }
    }

    // Update regions: delete existing, insert new
    if (regionIds && Array.isArray(regionIds)) {
      await db.delete(releaseRegions)
        .where(eq(releaseRegions.releaseId, releaseId))

      if (regionIds.length > 0) {
        await db.insert(releaseRegions).values(
          regionIds.map((regId: number) => ({
            releaseId,
            regionId: regId,
          }))
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating release:', error)
    return NextResponse.json({ error: 'Failed to update release' }, { status: 500 })
  }
}
