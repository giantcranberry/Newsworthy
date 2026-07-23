import { auth } from '@/lib/auth'
import { db } from '@/db'
import {
  company,
  contact,
  images,
  files,
  banners,
  socials,
  releases,
  brandCredits,
  podcastFeeds,
  approvals,
  adCampaigns,
  contentCalendar,
  consolidatedReports,
  a2aApiKeys,
  companyMembers,
  users,
} from '@/db/schema'
import { eq, and, ne } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

// POST: Transfer a brand and everything tied to it (assets, press releases,
// credits, podcast feeds) to another user account. Admin only — staff and
// editors cannot move brands between accounts.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const session = await auth()
  if (!(session?.user as any)?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { uuid } = await params

  let body: { newOwnerId?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const newOwnerId = body.newOwnerId
  if (!newOwnerId || !Number.isInteger(newOwnerId) || newOwnerId <= 0) {
    return NextResponse.json({ error: 'newOwnerId is required' }, { status: 400 })
  }

  const brand = await db.query.company.findFirst({
    where: eq(company.uuid, uuid),
  })
  if (!brand) {
    return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
  }

  if (brand.userId === newOwnerId) {
    return NextResponse.json({ error: 'User already owns this brand' }, { status: 400 })
  }

  const newOwner = await db.query.users.findFirst({
    where: eq(users.id, newOwnerId),
  })
  if (!newOwner || newOwner.isDeleted) {
    return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
  }

  const previousOwnerId = brand.userId

  try {
    const counts = await db.transaction(async (tx) => {
      await tx.update(company).set({ userId: newOwnerId }).where(eq(company.id, brand.id))

      const movedContacts = await tx.update(contact).set({ userId: newOwnerId })
        .where(eq(contact.companyId, brand.id)).returning({ id: contact.id })
      const movedImages = await tx.update(images).set({ userId: newOwnerId })
        .where(eq(images.companyId, brand.id)).returning({ id: images.id })
      const movedFiles = await tx.update(files).set({ userId: newOwnerId })
        .where(eq(files.companyId, brand.id)).returning({ id: files.id })
      const movedBanners = await tx.update(banners).set({ userId: newOwnerId })
        .where(eq(banners.companyId, brand.id)).returning({ id: banners.id })
      const movedSocials = await tx.update(socials).set({ userId: newOwnerId })
        .where(eq(socials.companyId, brand.id)).returning({ id: socials.id })
      const movedReleases = await tx.update(releases).set({ userId: newOwnerId })
        .where(eq(releases.companyId, brand.id)).returning({ id: releases.id })
      const movedCredits = await tx.update(brandCredits).set({ userId: newOwnerId })
        .where(eq(brandCredits.companyId, brand.id)).returning({ id: brandCredits.id })
      const movedPodcastFeeds = await tx.update(podcastFeeds).set({ userId: newOwnerId })
        .where(eq(podcastFeeds.companyId, brand.id)).returning({ id: podcastFeeds.id })
      const movedApprovals = await tx.update(approvals).set({ userId: newOwnerId })
        .where(eq(approvals.companyId, brand.id)).returning({ id: approvals.id })
      const movedAdCampaigns = await tx.update(adCampaigns).set({ userId: newOwnerId })
        .where(eq(adCampaigns.companyId, brand.id)).returning({ id: adCampaigns.id })
      const movedCalendar = await tx.update(contentCalendar).set({ userId: newOwnerId })
        .where(eq(contentCalendar.companyId, brand.id)).returning({ id: contentCalendar.id })
      const movedReports = await tx.update(consolidatedReports).set({ userId: newOwnerId })
        .where(eq(consolidatedReports.companyId, brand.id)).returning({ id: consolidatedReports.id })

      // The new owner may have been a team member — owners aren't members.
      await tx
        .delete(companyMembers)
        .where(and(eq(companyMembers.companyId, brand.id), eq(companyMembers.userId, newOwnerId)))

      // Kill API keys for this brand that belong to anyone but the new owner:
      // the previous owner should not retain programmatic access after handoff.
      const revokedKeys = await tx
        .update(a2aApiKeys)
        .set({ isActive: false })
        .where(and(eq(a2aApiKeys.companyId, brand.id), ne(a2aApiKeys.userId, newOwnerId)))
        .returning({ id: a2aApiKeys.id })

      return {
        contacts: movedContacts.length,
        images: movedImages.length,
        files: movedFiles.length,
        banners: movedBanners.length,
        socials: movedSocials.length,
        releases: movedReleases.length,
        creditEntries: movedCredits.length,
        podcastFeeds: movedPodcastFeeds.length,
        approvals: movedApprovals.length,
        adCampaigns: movedAdCampaigns.length,
        calendarEvents: movedCalendar.length,
        consolidatedReports: movedReports.length,
        revokedApiKeys: revokedKeys.length,
      }
    })

    console.log(
      `Admin ${(session?.user as any)?.id} transferred brand ${brand.id} (${brand.companyName}) ` +
        `from user ${previousOwnerId} to user ${newOwnerId}:`,
      counts
    )

    return NextResponse.json({
      success: true,
      brand: { id: brand.id, uuid: brand.uuid, companyName: brand.companyName },
      previousOwnerId,
      newOwnerId,
      counts,
    })
  } catch (error) {
    console.error('Error transferring brand:', error)
    return NextResponse.json({ error: 'Failed to transfer brand' }, { status: 500 })
  }
}
