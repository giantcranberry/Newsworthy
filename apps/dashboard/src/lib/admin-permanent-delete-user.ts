import { db } from '@/db'
import {
  users,
  company,
  contact,
  images,
  files,
  banners,
  socials,
  newsroomRedirects,
  releases,
  consolidatedReports,
  queue,
  releaseEnhanced,
  releasePlacements,
  releaseAnalysis,
  releaseOptions,
  releaseNotes,
  approvals,
  translations,
  releaseFiles,
  releaseRegions,
  releaseCategories,
  releaseCountries,
  releasePayments,
  releaseImages,
  releaseFaqs,
  contactFormLogs,
  releaseEvents,
  companyMembers,
  companyInvites,
  brandCredits,
  profileRegions,
  profileCategories,
  staffNotes,
  messages,
  followedCompanies,
  newsLike,
  newsBookmark,
  listSubscriptions,
  smsSubscriptions,
  tinyUrl,
  clipReport,
  trending,
  elasticdocs,
  returnRoutes,
  postQueue,
  newsramp,
  blockchain,
  emailCampaigns,
  aiJobs,
  aiVideos,
  pdfDownloads,
  journalists,
  oauth,
  carts,
  cartSessions,
  cartItems,
  cartTransactions,
  cartAbandonedReminders,
  payment,
  payfile,
  paymentLinks,
  crmContacts,
  a2aApiKeys,
  podcastFeeds,
  podcastEpisodes,
  adCampaigns,
  communityPosts,
  communityPostImages,
  communityComments,
  communityReactions,
  chatMessages,
  chatParticipants,
  userMessages,
  userProfiles,
  userSubscription,
  verify,
  slackConnections,
  googleChatConnections,
  adminUserFavorites,
  partnerManagers,
  contentCalendar,
  kanbanStages,
  kanbanTasks,
  kanbanTaskFiles,
  kanbanTaskNotes,
  nwaiAssets,
  oauthAuthorizationCodes,
  oauthAccessTokens,
  oauthRefreshTokens,
  influencer,
  influencerInventory,
  inventoryCategories,
  inventoryRegions,
  queueMp,
  mpRequests,
  mpFunds,
  mpRequestLog,
  mpPrefs,
  mpInvite,
  mpMessages,
  partners,
  pitchList,
  pitchGroups,
  pitchCampaigns,
  advocacyGroups,
  advocates,
  advocacyCampaigns,
  newsDbQueries,
  newsDbNotfound,
} from '@/db/schema'
import { and, eq, inArray, or } from 'drizzle-orm'

async function deleteByIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deleter: (ids: number[]) => Promise<any>,
  ids: number[],
) {
  if (ids.length === 0) return
  // Chunk to keep IN lists reasonable
  for (let i = 0; i < ids.length; i += 500) {
    await deleter(ids.slice(i, i + 500))
  }
}

/**
 * Permanently hard-delete a user and owned brand/PR data.
 * Does NOT soft-delete — rows are removed. Not everything cascades in the
 * schema, so this walks dependent tables in FK-safe order inside a transaction.
 */
export async function permanentlyDeleteUser(userId: number): Promise<{
  companiesDeleted: number
  releasesDeleted: number
}> {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .select({
        id: users.id,
        isAdmin: users.isAdmin,
        isSuper: users.isSuper,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!user) {
      throw new Error('USER_NOT_FOUND')
    }
    if (user.isAdmin || user.isSuper) {
      throw new Error('CANNOT_DELETE_ADMIN')
    }

    // Brands owned by this user (full wipe). Memberships on others are removed later.
    const ownedCompanies = await tx
      .select({ id: company.id })
      .from(company)
      .where(eq(company.userId, userId))
    const companyIds = ownedCompanies.map((c) => c.id)

    // Releases authored by the user OR attached to brands they own
    const releaseRows =
      companyIds.length > 0
        ? await tx
            .select({ id: releases.id })
            .from(releases)
            .where(or(eq(releases.userId, userId), inArray(releases.companyId, companyIds)))
        : await tx
            .select({ id: releases.id })
            .from(releases)
            .where(eq(releases.userId, userId))
    const releaseIds = [...new Set(releaseRows.map((r) => r.id))]

    // ── Release dependents ────────────────────────────────────────────
    if (releaseIds.length > 0) {
      // Clear FKs that point at releases but shouldn't block deletion
      await tx
        .update(podcastEpisodes)
        .set({ releaseId: null })
        .where(inArray(podcastEpisodes.releaseId, releaseIds))

      const enhanced = await tx
        .select({ id: releaseEnhanced.id })
        .from(releaseEnhanced)
        .where(inArray(releaseEnhanced.prid, releaseIds))
      const enhancedIds = enhanced.map((e) => e.id)
      if (enhancedIds.length > 0) {
        await tx
          .delete(releasePlacements)
          .where(inArray(releasePlacements.enhancedId, enhancedIds))
      }
      await deleteByIds(
        (ids) => tx.delete(releasePlacements).where(inArray(releasePlacements.prid, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(releaseEnhanced).where(inArray(releaseEnhanced.prid, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(releaseAnalysis).where(inArray(releaseAnalysis.prId, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(releaseFaqs).where(inArray(releaseFaqs.prId, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(releaseEvents).where(inArray(releaseEvents.prId, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(releaseImages).where(inArray(releaseImages.releaseId, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(releaseFiles).where(inArray(releaseFiles.releaseId, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(releaseRegions).where(inArray(releaseRegions.releaseId, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(releaseCategories).where(inArray(releaseCategories.releaseId, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(releaseCountries).where(inArray(releaseCountries.releaseId, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(releasePayments).where(inArray(releasePayments.releaseId, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(releaseOptions).where(inArray(releaseOptions.prId, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(releaseNotes).where(inArray(releaseNotes.prId, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(queue).where(inArray(queue.releaseId, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(approvals).where(inArray(approvals.releaseId, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(translations).where(inArray(translations.prId, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(contactFormLogs).where(inArray(contactFormLogs.releaseId, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(clipReport).where(inArray(clipReport.releaseId, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(trending).where(inArray(trending.prId, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(elasticdocs).where(inArray(elasticdocs.releaseId, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(postQueue).where(inArray(postQueue.prid, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(blockchain).where(inArray(blockchain.prid, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(newsLike).where(inArray(newsLike.prId, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(newsBookmark).where(inArray(newsBookmark.prId, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(pdfDownloads).where(inArray(pdfDownloads.releaseId, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(adCampaigns).where(inArray(adCampaigns.releaseId, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(brandCredits).where(inArray(brandCredits.prId, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(aiJobs).where(inArray(aiJobs.prId, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(aiVideos).where(inArray(aiVideos.prId, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(emailCampaigns).where(inArray(emailCampaigns.prId, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(tinyUrl).where(inArray(tinyUrl.prId, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(staffNotes).where(inArray(staffNotes.prId, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(messages).where(inArray(messages.prId, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(userMessages).where(inArray(userMessages.releaseId, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(mpRequests).where(inArray(mpRequests.prId, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(mpFunds).where(inArray(mpFunds.prId, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(mpRequestLog).where(inArray(mpRequestLog.prId, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(pitchCampaigns).where(inArray(pitchCampaigns.prId, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(advocacyCampaigns).where(inArray(advocacyCampaigns.prId, ids)),
        releaseIds,
      )
      await deleteByIds(
        (ids) => tx.delete(carts).where(inArray(carts.prId, ids)),
        releaseIds,
      )

      // Detach calendar events from releases (calendar rows cascade with user)
      await tx
        .update(contentCalendar)
        .set({ releaseId: null })
        .where(inArray(contentCalendar.releaseId, releaseIds))

      // Clear release asset FKs so company images/contacts/banners can go next
      await tx
        .update(releases)
        .set({ primaryContactId: null, primaryImageId: null, bannerId: null })
        .where(inArray(releases.id, releaseIds))

      await deleteByIds(
        (ids) => tx.delete(releases).where(inArray(releases.id, ids)),
        releaseIds,
      )
    }

    // ── Owned brand dependents ────────────────────────────────────────
    if (companyIds.length > 0) {
      // Podcast feeds → episodes/transcripts cascade from feed
      await deleteByIds(
        (ids) => tx.delete(podcastFeeds).where(inArray(podcastFeeds.companyId, ids)),
        companyIds,
      )

      await deleteByIds(
        (ids) => tx.delete(consolidatedReports).where(inArray(consolidatedReports.companyId, ids)),
        companyIds,
      )
      await deleteByIds(
        (ids) => tx.delete(a2aApiKeys).where(inArray(a2aApiKeys.companyId, ids)),
        companyIds,
      )
      await deleteByIds(
        (ids) => tx.delete(paymentLinks).where(inArray(paymentLinks.companyId, ids)),
        companyIds,
      )
      await deleteByIds(
        (ids) => tx.delete(crmContacts).where(inArray(crmContacts.companyId, ids)),
        companyIds,
      )
      await deleteByIds(
        (ids) => tx.delete(pitchList).where(inArray(pitchList.companyId, ids)),
        companyIds,
      )
      const pitchGroupRows = await tx
        .select({ id: pitchGroups.id })
        .from(pitchGroups)
        .where(inArray(pitchGroups.coId, companyIds))
      const pitchGroupIds = pitchGroupRows.map((g) => g.id)
      if (pitchGroupIds.length > 0) {
        await tx.delete(pitchCampaigns).where(inArray(pitchCampaigns.groupId, pitchGroupIds))
        await tx.delete(pitchList).where(inArray(pitchList.groupId, pitchGroupIds))
        await tx.delete(pitchGroups).where(inArray(pitchGroups.id, pitchGroupIds))
      }
      const advocacyGroupRows = await tx
        .select({ id: advocacyGroups.id })
        .from(advocacyGroups)
        .where(inArray(advocacyGroups.coId, companyIds))
      const advocacyGroupIds = advocacyGroupRows.map((g) => g.id)
      if (advocacyGroupIds.length > 0) {
        await tx.delete(advocacyCampaigns).where(inArray(advocacyCampaigns.groupId, advocacyGroupIds))
        await tx.delete(advocates).where(inArray(advocates.groupId, advocacyGroupIds))
        await tx.delete(advocacyGroups).where(inArray(advocacyGroups.id, advocacyGroupIds))
      } else {
        await deleteByIds(
          (ids) => tx.delete(advocacyGroups).where(inArray(advocacyGroups.coId, ids)),
          companyIds,
        )
      }
      await deleteByIds(
        (ids) => tx.delete(listSubscriptions).where(inArray(listSubscriptions.companyId, ids)),
        companyIds,
      )
      await deleteByIds(
        (ids) => tx.delete(smsSubscriptions).where(inArray(smsSubscriptions.companyId, ids)),
        companyIds,
      )
      await deleteByIds(
        (ids) => tx.delete(followedCompanies).where(inArray(followedCompanies.coId, ids)),
        companyIds,
      )
      await deleteByIds(
        (ids) => tx.delete(newsroomRedirects).where(inArray(newsroomRedirects.companyId, ids)),
        companyIds,
      )
      await deleteByIds(
        (ids) => tx.delete(companyMembers).where(inArray(companyMembers.companyId, ids)),
        companyIds,
      )
      await deleteByIds(
        (ids) => tx.delete(companyInvites).where(inArray(companyInvites.companyId, ids)),
        companyIds,
      )
      await deleteByIds(
        (ids) => tx.delete(brandCredits).where(inArray(brandCredits.companyId, ids)),
        companyIds,
      )
      await deleteByIds(
        (ids) => tx.delete(contact).where(inArray(contact.companyId, ids)),
        companyIds,
      )
      await deleteByIds(
        (ids) => tx.delete(images).where(inArray(images.companyId, ids)),
        companyIds,
      )
      await deleteByIds(
        (ids) => tx.delete(files).where(inArray(files.companyId, ids)),
        companyIds,
      )
      await deleteByIds(
        (ids) => tx.delete(banners).where(inArray(banners.companyId, ids)),
        companyIds,
      )
      await deleteByIds(
        (ids) => tx.delete(socials).where(inArray(socials.companyId, ids)),
        companyIds,
      )
      await deleteByIds(
        (ids) => tx.delete(carts).where(inArray(carts.companyId, ids)),
        companyIds,
      )
      await deleteByIds(
        (ids) => tx.delete(adCampaigns).where(inArray(adCampaigns.companyId, ids)),
        companyIds,
      )
      await deleteByIds(
        (ids) => tx.delete(tinyUrl).where(inArray(tinyUrl.coId, ids)),
        companyIds,
      )
      await deleteByIds(
        (ids) => tx.delete(emailCampaigns).where(inArray(emailCampaigns.coId, ids)),
        companyIds,
      )

      // Detach kanban / community / calendar company refs
      await tx
        .update(kanbanTasks)
        .set({ companyId: null })
        .where(inArray(kanbanTasks.companyId, companyIds))
      await tx
        .update(communityPosts)
        .set({ companyId: null, visibilityCompanyId: null })
        .where(
          or(
            inArray(communityPosts.companyId, companyIds),
            inArray(communityPosts.visibilityCompanyId, companyIds),
          ),
        )
      await tx
        .update(contentCalendar)
        .set({ companyId: null })
        .where(inArray(contentCalendar.companyId, companyIds))

      await deleteByIds(
        (ids) => tx.delete(company).where(inArray(company.id, ids)),
        companyIds,
      )
    }

    // ── Community content authored by this user ───────────────────────
    const posts = await tx
      .select({ id: communityPosts.id })
      .from(communityPosts)
      .where(eq(communityPosts.userId, userId))
    const postIds = posts.map((p) => p.id)
    if (postIds.length > 0) {
      const comments = await tx
        .select({ id: communityComments.id })
        .from(communityComments)
        .where(inArray(communityComments.postId, postIds))
      const commentIds = comments.map((c) => c.id)
      if (commentIds.length > 0) {
        await tx
          .delete(communityReactions)
          .where(
            and(
              eq(communityReactions.targetType, 'comment'),
              inArray(communityReactions.targetId, commentIds),
            ),
          )
      }
      await tx
        .delete(communityReactions)
        .where(
          and(
            eq(communityReactions.targetType, 'post'),
            inArray(communityReactions.targetId, postIds),
          ),
        )
      await tx.delete(communityComments).where(inArray(communityComments.postId, postIds))
      await tx.delete(communityPostImages).where(inArray(communityPostImages.postId, postIds))
      await tx.delete(communityPosts).where(inArray(communityPosts.id, postIds))
    }
    // Comments left on other users' posts
    await tx.delete(communityComments).where(eq(communityComments.userId, userId))
    await tx.delete(communityReactions).where(eq(communityReactions.userId, userId))

    // ── Chat ──────────────────────────────────────────────────────────
    await tx.delete(chatMessages).where(eq(chatMessages.userId, userId))
    await tx.delete(chatParticipants).where(eq(chatParticipants.userId, userId))

    // ── Kanban tasks created by user ──────────────────────────────────
    const tasks = await tx
      .select({ id: kanbanTasks.id })
      .from(kanbanTasks)
      .where(eq(kanbanTasks.createdBy, userId))
    const taskIds = tasks.map((t) => t.id)
    if (taskIds.length > 0) {
      await tx.delete(userMessages).where(inArray(userMessages.taskId, taskIds))
      await tx.delete(kanbanTaskFiles).where(inArray(kanbanTaskFiles.taskId, taskIds))
      await tx.delete(kanbanTaskNotes).where(inArray(kanbanTaskNotes.taskId, taskIds))
      await tx.delete(kanbanTasks).where(inArray(kanbanTasks.id, taskIds))
    }
    await tx.delete(kanbanStages).where(eq(kanbanStages.userId, userId))

    // ── Cart sessions & payment ───────────────────────────────────────
    const sessions = await tx
      .select({ id: cartSessions.id })
      .from(cartSessions)
      .where(eq(cartSessions.userId, userId))
    const sessionIds = sessions.map((s) => s.id)
    if (sessionIds.length > 0) {
      await tx.delete(cartAbandonedReminders).where(inArray(cartAbandonedReminders.sessionId, sessionIds))
      await tx.delete(cartTransactions).where(inArray(cartTransactions.sessionId, sessionIds))
      await tx.delete(cartItems).where(inArray(cartItems.sessionId, sessionIds))
      await tx.delete(cartSessions).where(inArray(cartSessions.id, sessionIds))
    }
    await tx.delete(carts).where(eq(carts.userId, userId))
    await tx.delete(payment).where(eq(payment.userId, userId))
    await tx.delete(payfile).where(eq(payfile.userId, userId))
    await tx.delete(paymentLinks).where(eq(paymentLinks.userId, userId))

    // ── Remaining user-owned / user-linked rows (non-cascade) ─────────
    await tx.delete(consolidatedReports).where(eq(consolidatedReports.userId, userId))
    await tx.delete(approvals).where(eq(approvals.userId, userId))
    await tx.delete(translations).where(eq(translations.userId, userId))
    await tx.delete(releaseOptions).where(eq(releaseOptions.userId, userId))
    await tx.delete(brandCredits).where(eq(brandCredits.userId, userId))
    await tx.delete(profileCategories).where(eq(profileCategories.userId, userId))
    await tx.delete(profileRegions).where(eq(profileRegions.userId, userId))
    await tx.delete(staffNotes).where(eq(staffNotes.userId, userId))
    await tx.delete(messages).where(or(eq(messages.fromId, userId), eq(messages.toId, userId)))
    await tx.delete(userMessages).where(or(eq(userMessages.fromId, userId), eq(userMessages.toId, userId)))
    await tx.delete(followedCompanies).where(eq(followedCompanies.userId, userId))
    await tx.delete(newsLike).where(eq(newsLike.userId, userId))
    await tx.delete(newsBookmark).where(eq(newsBookmark.userId, userId))
    await tx.delete(listSubscriptions).where(eq(listSubscriptions.userId, userId))
    await tx.delete(smsSubscriptions).where(eq(smsSubscriptions.userId, userId))
    await tx.delete(tinyUrl).where(eq(tinyUrl.userId, userId))
    await tx.delete(returnRoutes).where(eq(returnRoutes.userId, userId))
    await tx.delete(newsramp).where(eq(newsramp.userId, userId))
    await tx.delete(blockchain).where(eq(blockchain.userId, userId))
    await tx.delete(emailCampaigns).where(eq(emailCampaigns.userId, userId))
    await tx.delete(aiJobs).where(eq(aiJobs.userId, userId))
    await tx.delete(aiVideos).where(eq(aiVideos.userId, userId))
    await tx.delete(pdfDownloads).where(eq(pdfDownloads.userId, userId))
    await tx.delete(journalists).where(eq(journalists.userId, userId))
    await tx.delete(oauth).where(eq(oauth.userId, userId))
    await tx.delete(crmContacts).where(eq(crmContacts.userId, userId))
    await tx.delete(a2aApiKeys).where(eq(a2aApiKeys.userId, userId))
    await tx.delete(podcastFeeds).where(eq(podcastFeeds.userId, userId))
    await tx.delete(adCampaigns).where(eq(adCampaigns.userId, userId))
    await tx.delete(nwaiAssets).where(eq(nwaiAssets.userId, userId))
    await tx.delete(oauthAuthorizationCodes).where(eq(oauthAuthorizationCodes.userId, userId))
    await tx.delete(oauthAccessTokens).where(eq(oauthAccessTokens.userId, userId))
    await tx.delete(oauthRefreshTokens).where(eq(oauthRefreshTokens.userId, userId))
    // Influencer marketplace (requests/inventory before influencer profile)
    const influencerRows = await tx
      .select({ id: influencer.id })
      .from(influencer)
      .where(eq(influencer.userId, userId))
    const influencerIds = influencerRows.map((r) => r.id)

    const invRows = await tx
      .select({ id: influencerInventory.id })
      .from(influencerInventory)
      .where(
        influencerIds.length > 0
          ? or(
              eq(influencerInventory.userId, userId),
              inArray(influencerInventory.influencerId, influencerIds),
            )
          : eq(influencerInventory.userId, userId),
      )
    const invIds = invRows.map((r) => r.id)

    const mpReqConditions = [eq(mpRequests.userId, userId)]
    if (influencerIds.length > 0) {
      mpReqConditions.push(inArray(mpRequests.influencerId, influencerIds))
    }
    if (invIds.length > 0) {
      mpReqConditions.push(inArray(mpRequests.serviceId, invIds))
    }
    const mpReqRows = await tx
      .select({ id: mpRequests.id })
      .from(mpRequests)
      .where(or(...mpReqConditions))
    const mpReqIds = mpReqRows.map((r) => r.id)
    if (mpReqIds.length > 0) {
      await tx.delete(mpMessages).where(inArray(mpMessages.projectId, mpReqIds))
      await tx.delete(mpRequestLog).where(inArray(mpRequestLog.requestId, mpReqIds))
      await tx.delete(mpRequests).where(inArray(mpRequests.id, mpReqIds))
    }

    if (invIds.length > 0) {
      await tx.delete(inventoryCategories).where(inArray(inventoryCategories.inventoryId, invIds))
      await tx.delete(inventoryRegions).where(inArray(inventoryRegions.inventoryId, invIds))
      await tx.delete(queueMp).where(inArray(queueMp.offerId, invIds))
      await tx.delete(influencerInventory).where(inArray(influencerInventory.id, invIds))
    }
    if (influencerIds.length > 0) {
      await tx.delete(mpPrefs).where(inArray(mpPrefs.influencerId, influencerIds))
      await tx.delete(influencer).where(inArray(influencer.id, influencerIds))
    }
    await tx.delete(mpPrefs).where(eq(mpPrefs.userId, userId))
    await tx.delete(mpFunds).where(eq(mpFunds.userId, userId))
    await tx.delete(mpRequestLog).where(eq(mpRequestLog.userId, userId))
    await tx.delete(mpInvite).where(or(eq(mpInvite.userId, userId), eq(mpInvite.invitedUserId, userId)))

    // Legacy newsdb / pitch / advocacy lists
    await tx.delete(pitchCampaigns).where(eq(pitchCampaigns.userId, userId))
    await tx.delete(pitchList).where(eq(pitchList.userId, userId))
    await tx.delete(pitchGroups).where(eq(pitchGroups.userId, userId))
    await tx.delete(advocacyCampaigns).where(eq(advocacyCampaigns.userId, userId))
    await tx.delete(advocates).where(eq(advocates.userId, userId))
    await tx.delete(advocacyGroups).where(eq(advocacyGroups.userId, userId))
    await tx.delete(newsDbQueries).where(eq(newsDbQueries.userId, userId))
    await tx.delete(newsDbNotfound).where(eq(newsDbNotfound.userId, userId))

    await tx.delete(contact).where(eq(contact.userId, userId))
    await tx.delete(images).where(eq(images.userId, userId))
    await tx.delete(files).where(eq(files.userId, userId))
    await tx.delete(banners).where(eq(banners.userId, userId))
    await tx.delete(socials).where(eq(socials.userId, userId))

    // Team membership / invites on brands the user does not own
    await tx.delete(companyMembers).where(eq(companyMembers.userId, userId))
    await tx.delete(companyInvites).where(eq(companyInvites.invitedBy, userId))
    await tx
      .update(companyMembers)
      .set({ invitedBy: null })
      .where(eq(companyMembers.invitedBy, userId))

    // Clear optional partner ownership pointer
    await tx.update(partners).set({ userId: null }).where(eq(partners.userId, userId))

    // Clear editorial queue assignment
    await tx.update(queue).set({ editorId: null }).where(eq(queue.editorId, userId))

    // Cascading user tables (explicit for clarity; also covered by FK cascade)
    await tx.delete(partnerManagers).where(eq(partnerManagers.userId, userId))
    await tx.delete(contentCalendar).where(eq(contentCalendar.userId, userId))
    await tx.delete(slackConnections).where(eq(slackConnections.userId, userId))
    await tx.delete(googleChatConnections).where(eq(googleChatConnections.userId, userId))
    await tx
      .delete(adminUserFavorites)
      .where(
        or(
          eq(adminUserFavorites.adminUserId, userId),
          eq(adminUserFavorites.favoritedUserId, userId)
        )
      )
    await tx.delete(verify).where(eq(verify.userId, userId))
    await tx.delete(userSubscription).where(eq(userSubscription.userId, userId))
    await tx.delete(userProfiles).where(eq(userProfiles.userId, userId))

    // Any leftover releases authored by user (e.g. on someone else's brand)
    await tx.delete(releases).where(eq(releases.userId, userId))

    await tx.delete(users).where(eq(users.id, userId))

    return {
      companiesDeleted: companyIds.length,
      releasesDeleted: releaseIds.length,
    }
  })
}
