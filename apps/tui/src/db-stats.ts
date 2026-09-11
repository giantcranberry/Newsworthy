/**
 * Postgres-backed panels. These mirror the queries behind the admin dashboard
 * page (`apps/dashboard/src/app/(dashboard)/admin/page.tsx`) and the editorial
 * queue, so the numbers here match what the web UI shows.
 */

import {
  db,
  users,
  userProfiles,
  releases,
  approvals,
  company,
  partners,
  adminUserFavorites,
  queue,
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  sql,
} from '@nwai/db'

export interface PlatformStats {
  users: number
  releases: number
  companies: number
  partners: number
  pendingReleases: number
  /** Releases with a stakeholder approval request nobody has answered yet. */
  pendingApprovals: number
}

export interface QueueItem {
  releaseId: number
  uuid: string
  title: string | null
  companyName: string
  ownerEmail: string
  releaseAt: Date | null
  submitted: Date | null
  editorName: string | null
  checkedout: Date | null
  editorialHold: boolean
}

export interface FavoriteUser {
  id: number
  email: string
  emailVerified: boolean | null
  firstName: string | null
  lastName: string | null
}

export interface RecentSignup {
  id: number
  email: string
  createdAt: Date | null
  emailVerified: boolean | null
  regMethod: string | null
  firstName: string | null
  lastName: string | null
  companies: string[]
}

export interface DbSnapshot {
  stats: PlatformStats
  queue: QueueItem[]
  favorites: FavoriteUser[]
  signups: RecentSignup[]
  fetchedAt: number
}

/** Same counts the dashboard's getAdminStats() runs, in one round trip each. */
async function getPlatformStats(): Promise<PlatformStats> {
  const [userCount, releaseCount, companyCount, partnerCount, pending, awaitingApproval] =
    await Promise.all([
      db.select({ value: count() }).from(users),
      db.select({ value: count() }).from(releases),
      db.select({ value: count() }).from(company),
      db.select({ value: count() }).from(partners),
      db.select({ value: count() }).from(releases).where(eq(releases.status, 'review')),
      // A release can have several stakeholders out for signature, so this
      // counts releases waiting, not outstanding requests.
      db
        .select({ value: sql<number>`count(distinct ${approvals.releaseId})::int` })
        .from(approvals)
        .where(and(isNotNull(approvals.requestedAt), isNull(approvals.signedAt))),
    ])

  return {
    users: userCount[0].value,
    releases: releaseCount[0].value,
    companies: companyCount[0].value,
    partners: partnerCount[0].value,
    pendingReleases: pending[0].value,
    pendingApprovals: awaitingApproval[0].value,
  }
}

/** The editorial review queue the "Review Queue" badge counts. */
async function getQueueItems(limit: number): Promise<QueueItem[]> {
  const rows = await db
    .select({
      releaseId: releases.id,
      uuid: releases.uuid,
      title: releases.title,
      companyName: company.companyName,
      ownerEmail: users.email,
      releaseAt: releases.releaseAt,
      editorialHold: releases.editorialHold,
      submitted: queue.submitted,
      editorName: queue.editorName,
      checkedout: queue.checkedout,
    })
    .from(queue)
    .innerJoin(releases, eq(queue.releaseId, releases.id))
    .innerJoin(company, eq(releases.companyId, company.id))
    .innerJoin(users, eq(releases.userId, users.id))
    .where(eq(releases.status, 'review'))
    .orderBy(asc(releases.releaseAt))
    .limit(limit)

  return rows
}

/** Favorites are per-admin, so this needs the signed-in admin's user id. */
async function getFavoriteUsers(adminUserId: number): Promise<FavoriteUser[]> {
  return db
    .select({
      id: users.id,
      email: users.email,
      emailVerified: users.emailVerified,
      firstName: userProfiles.firstName,
      lastName: userProfiles.lastName,
    })
    .from(adminUserFavorites)
    .innerJoin(users, eq(users.id, adminUserFavorites.favoritedUserId))
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(
      and(eq(adminUserFavorites.adminUserId, adminUserId), eq(users.isDeleted, false)),
    )
    .orderBy(desc(adminUserFavorites.createdAt))
    .limit(24)
}

/**
 * The newest registrations. `created_at` is null on some legacy accounts, so
 * those are left out rather than sorted to the end.
 */
async function getRecentSignups(limit: number): Promise<RecentSignup[]> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      createdAt: users.createdAt,
      emailVerified: users.emailVerified,
      regMethod: users.regMethod,
      firstName: userProfiles.firstName,
      lastName: userProfiles.lastName,
    })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(and(eq(users.isDeleted, false), isNotNull(users.createdAt)))
    .orderBy(desc(users.createdAt))
    .limit(limit)

  if (rows.length === 0) return []

  // Joining company here would duplicate a user who owns more than one, so
  // company names are collected in a second pass.
  const companies = await db
    .select({ userId: company.userId, name: company.companyName })
    .from(company)
    .where(inArray(company.userId, rows.map((row) => row.id)))

  const byUser = new Map<number, string[]>()
  for (const item of companies) {
    byUser.set(item.userId, [...(byUser.get(item.userId) ?? []), item.name])
  }

  return rows.map((row) => ({ ...row, companies: byUser.get(row.id) ?? [] }))
}

/** Resolve an admin's user id from their email so favorites can be loaded. */
export async function resolveAdminUserId(email: string): Promise<number | null> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1)
  return rows[0]?.id ?? null
}

export async function fetchDbSnapshot(options: {
  adminUserId: number | null
  queueLimit: number
  signupLimit: number
}): Promise<DbSnapshot> {
  const [stats, queueItems, favorites, signups] = await Promise.all([
    getPlatformStats(),
    getQueueItems(options.queueLimit),
    options.adminUserId ? getFavoriteUsers(options.adminUserId) : Promise.resolve([]),
    getRecentSignups(options.signupLimit),
  ])

  return { stats, queue: queueItems, favorites, signups, fetchedAt: Date.now() }
}
