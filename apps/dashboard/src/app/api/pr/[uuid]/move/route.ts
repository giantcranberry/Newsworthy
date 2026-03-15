import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import {
  releases,
  approvals,
  brandCredits,
  contentCalendar,
  tinyUrl,
  emailCampaigns,
  mpInvite,
  carts,
  company,
  contact,
} from '@/db/schema'
import { eq, and, or, isNull } from 'drizzle-orm'
import { getUserCompanyIds } from '@/lib/team-auth'
import { randomUUID } from 'crypto'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)
  const { uuid } = await params

  let body: { targetCompanyId: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { targetCompanyId } = body
  if (!targetCompanyId || typeof targetCompanyId !== 'number') {
    return NextResponse.json({ error: 'targetCompanyId is required' }, { status: 400 })
  }

  try {
    // Find the release
    const release = await db.query.releases.findFirst({
      where: eq(releases.uuid, uuid),
    })

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    if (release.companyId === targetCompanyId) {
      return NextResponse.json({ error: 'Release is already under this brand' }, { status: 400 })
    }

    // Check user has collaborator+ access to the source company
    const editableCompanyIds = await getUserCompanyIds(userId, 'collaborator')
    const canAccessSource = release.userId === userId || editableCompanyIds.includes(release.companyId)
    if (!canAccessSource) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Verify target company exists, is active, and user has collaborator+ access
    const targetCo = await db.query.company.findFirst({
      where: and(
        eq(company.id, targetCompanyId),
        eq(company.isDeleted, false),
        or(eq(company.isArchived, false), isNull(company.isArchived)),
      ),
    })

    if (!targetCo) {
      return NextResponse.json({ error: 'Target brand not found' }, { status: 404 })
    }

    const canAccessTarget = targetCo.userId === userId || editableCompanyIds.includes(targetCompanyId)
    if (!canAccessTarget) {
      return NextResponse.json({ error: 'No access to target brand' }, { status: 403 })
    }

    // Clone contact under the new brand if the release has one
    let newContactId: number | null = null
    if (release.primaryContactId) {
      const existingContact = await db.query.contact.findFirst({
        where: eq(contact.id, release.primaryContactId),
      })
      if (existingContact) {
        const [cloned] = await db.insert(contact).values({
          uuid: randomUUID(),
          userId,
          companyId: targetCompanyId,
          name: existingContact.name,
          title: existingContact.title,
          phone: existingContact.phone,
          email: existingContact.email,
          avatar: existingContact.avatar,
        }).returning({ id: contact.id })
        newContactId = cloned.id
      }
    }

    // Move everything in a transaction
    await db.transaction(async (tx) => {
      // Update the release itself
      await tx.update(releases)
        .set({
          companyId: targetCompanyId,
          primaryContactId: newContactId,
        })
        .where(eq(releases.id, release.id))

      // Update approvals
      await tx.update(approvals)
        .set({ companyId: targetCompanyId })
        .where(eq(approvals.releaseId, release.id))

      // Update brandCredits
      await tx.update(brandCredits)
        .set({ companyId: targetCompanyId })
        .where(eq(brandCredits.prId, release.id))

      // Update contentCalendar
      await tx.update(contentCalendar)
        .set({ companyId: targetCompanyId })
        .where(eq(contentCalendar.releaseId, release.id))

      // Update tinyUrl
      await tx.update(tinyUrl)
        .set({ coId: targetCompanyId })
        .where(eq(tinyUrl.prId, release.id))

      // Update emailCampaigns
      await tx.update(emailCampaigns)
        .set({ coId: targetCompanyId })
        .where(eq(emailCampaigns.prId, release.id))

      // Update mpInvite
      await tx.update(mpInvite)
        .set({ coId: targetCompanyId })
        .where(eq(mpInvite.prId, release.id))

      // Update carts
      await tx.update(carts)
        .set({ companyId: targetCompanyId })
        .where(eq(carts.prId, release.id))
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error moving release:', error)
    return NextResponse.json(
      { error: 'Failed to move release' },
      { status: 500 }
    )
  }
}
