/**
 * Media lists (pitch_groups) for a brand.
 *
 * - A brand can have many user-created lists plus at most one Newsworthy Curated
 *   list (pitch_groups.is_curated), which only the journalist hunter writes.
 * - Users can't add to, remove from, rename, delete, or copy out of the curated
 *   list, and never see curated emails — only name + publication.
 * - No contact may be on any list without an email.
 * - A brand may email each curated journalist at most once every 28 days
 *   (per brand). User lists have no frequency limit.
 *
 * Scope: media lists only. The Share list (advocacy_groups / advocate rows in
 * crm_contacts) is not read or written here.
 */
import { db } from '@/db'
import {
  pitchGroups,
  crmContacts,
  mediaListMembers,
  curatedJournalists,
  curatedListMembers,
  curatedJournalistSends,
  releaseMediaLists,
  CURATED_SEND_WINDOW_DAYS,
} from '@/db/schema'
import { and, asc, desc, eq, ilike, inArray, isNull, notInArray, or, sql, type SQL } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export { CURATED_LIST_NAME, CURATED_SEND_WINDOW_DAYS } from '@/db/schema'

export const MAX_LIST_NAME_LENGTH = 48

/** Advisory-lock namespace for per-brand curated send claims. */
const CURATED_SEND_LOCK_NS = 72_810

export type MediaList = typeof pitchGroups.$inferSelect

export interface MediaListSummary {
  id: number
  uuid: string
  name: string
  description: string | null
  isCurated: boolean
  contactCount: number
  createdAt: string | null
}

const newUuid = () => randomUUID().replace(/-/g, '')

function activeListsFor(companyId: number) {
  return and(eq(pitchGroups.coId, companyId), sql`${pitchGroups.isDeleted} IS NOT TRUE`)
}

/** A crm_contacts row that is allowed on a media list. */
function listableContact(companyId: number): SQL {
  return and(
    eq(crmContacts.companyId, companyId),
    inArray(crmContacts.contactType, ['media', 'both']),
    sql`${crmContacts.isDeleted} IS NOT TRUE`,
    sql`coalesce(${crmContacts.email}, '') <> ''`,
  )!
}

const curatedWindowStart = sql`now() - make_interval(days => ${CURATED_SEND_WINDOW_DAYS})`

/** Curated journalist was emailed by this brand inside the 28-day window. */
function curatedRecentlySent(companyId: number): SQL {
  return sql`exists (
    select 1 from ${curatedJournalistSends}
    where ${curatedJournalistSends.companyId} = ${companyId}
      and ${curatedJournalistSends.curatedJournalistId} = ${curatedJournalists.id}
      and ${curatedJournalistSends.sentAt} > ${curatedWindowStart}
  )`
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

/** The brand's default (lowest-id) user list; created if the brand has none. */
export async function getOrCreateDefaultMediaList(companyId: number, userId: number, companyName: string) {
  const existing = await db.query.pitchGroups.findFirst({
    where: and(activeListsFor(companyId), eq(pitchGroups.isCurated, false)),
    orderBy: [asc(pitchGroups.id)],
  })
  if (existing) return existing

  const [created] = await db.insert(pitchGroups).values({
    uuid: newUuid(),
    userId,
    coId: companyId,
    groupName: companyName.slice(0, MAX_LIST_NAME_LENGTH),
  }).returning()
  return created
}

export async function getMediaList(companyId: number, listUuid: string) {
  return db.query.pitchGroups.findFirst({
    where: and(activeListsFor(companyId), eq(pitchGroups.uuid, listUuid)),
  })
}

/** All of a brand's media lists with contact counts. Curated list first. */
export async function getBrandMediaLists(companyId: number): Promise<MediaListSummary[]> {
  const groups = await db.select().from(pitchGroups)
    .where(activeListsFor(companyId))
    .orderBy(desc(pitchGroups.isCurated), asc(pitchGroups.id))
  if (groups.length === 0) return []

  const ids = groups.map((g) => g.id)

  const userCounts = await db
    .select({ listId: mediaListMembers.pitchGroupId, count: sql<number>`count(*)::int` })
    .from(mediaListMembers)
    .innerJoin(crmContacts, eq(crmContacts.id, mediaListMembers.crmContactId))
    .where(and(inArray(mediaListMembers.pitchGroupId, ids), listableContact(companyId)))
    .groupBy(mediaListMembers.pitchGroupId)

  const curatedCounts = await db
    .select({ listId: curatedListMembers.pitchGroupId, count: sql<number>`count(*)::int` })
    .from(curatedListMembers)
    .where(inArray(curatedListMembers.pitchGroupId, ids))
    .groupBy(curatedListMembers.pitchGroupId)

  const counts = new Map<number, number>()
  for (const row of [...userCounts, ...curatedCounts]) counts.set(row.listId, Number(row.count))

  return groups.map((g) => ({
    id: g.id,
    uuid: g.uuid || '',
    name: g.groupName || 'Untitled list',
    description: g.description,
    isCurated: g.isCurated,
    contactCount: counts.get(g.id) ?? 0,
    createdAt: g.createdAt ? g.createdAt.toISOString() : null,
  }))
}

export async function createMediaList(companyId: number, userId: number, name: string, description?: string | null) {
  const [created] = await db.insert(pitchGroups).values({
    uuid: newUuid(),
    userId,
    coId: companyId,
    groupName: name.slice(0, MAX_LIST_NAME_LENGTH),
    description: description || null,
    isCurated: false,
  }).returning()
  return created
}

// ---------------------------------------------------------------------------
// User-list membership
// ---------------------------------------------------------------------------

/**
 * Add a brand's media contacts to one of its user lists. Contacts that don't
 * belong to the brand, aren't media contacts, are deleted, or have no email are
 * skipped. Returns how many were newly added.
 */
export async function addContactsToList(list: MediaList, companyId: number, contactUuids: string[]) {
  if (list.isCurated) throw new Error('The Newsworthy Curated list is read-only')
  if (contactUuids.length === 0) return { added: 0, skipped: 0 }

  const contacts = await db.select({ id: crmContacts.id }).from(crmContacts)
    .where(and(listableContact(companyId), inArray(crmContacts.uuid, contactUuids)))

  if (contacts.length === 0) return { added: 0, skipped: contactUuids.length }

  const inserted = await db.insert(mediaListMembers)
    .values(contacts.map((c) => ({ pitchGroupId: list.id, crmContactId: c.id })))
    .onConflictDoNothing()
    .returning({ id: mediaListMembers.id })

  return { added: inserted.length, skipped: contactUuids.length - inserted.length }
}

/** Add contacts by internal id (used right after creating them). */
export async function addContactIdsToList(listId: number, contactIds: number[]) {
  if (contactIds.length === 0) return
  await db.insert(mediaListMembers)
    .values(contactIds.map((id) => ({ pitchGroupId: listId, crmContactId: id })))
    .onConflictDoNothing()
}

export async function removeContactsFromList(list: MediaList, companyId: number, contactUuids: string[]) {
  if (list.isCurated) throw new Error('The Newsworthy Curated list is read-only')
  if (contactUuids.length === 0) return 0

  const contacts = await db.select({ id: crmContacts.id }).from(crmContacts)
    .where(and(eq(crmContacts.companyId, companyId), inArray(crmContacts.uuid, contactUuids)))
  if (contacts.length === 0) return 0

  const removed = await db.delete(mediaListMembers)
    .where(and(
      eq(mediaListMembers.pitchGroupId, list.id),
      inArray(mediaListMembers.crmContactId, contacts.map((c) => c.id)),
    ))
    .returning({ id: mediaListMembers.id })
  return removed.length
}

/** List uuids each contact belongs to (for showing list badges). */
export async function getListUuidsForContacts(contactIds: number[]) {
  const out = new Map<number, string[]>()
  if (contactIds.length === 0) return out
  const rows = await db
    .select({ contactId: mediaListMembers.crmContactId, listUuid: pitchGroups.uuid })
    .from(mediaListMembers)
    .innerJoin(pitchGroups, eq(pitchGroups.id, mediaListMembers.pitchGroupId))
    .where(and(inArray(mediaListMembers.crmContactId, contactIds), sql`${pitchGroups.isDeleted} IS NOT TRUE`))
  for (const r of rows) {
    if (!r.listUuid) continue
    out.set(r.contactId, [...(out.get(r.contactId) ?? []), r.listUuid])
  }
  return out
}

/** SQL condition: crm contact is on the given list. For filtering contact queries. */
export function contactOnList(listId: number): SQL {
  return sql`exists (
    select 1 from ${mediaListMembers}
    where ${mediaListMembers.pitchGroupId} = ${listId}
      and ${mediaListMembers.crmContactId} = ${crmContacts.id}
  )`
}

// ---------------------------------------------------------------------------
// Curated list (masked)
// ---------------------------------------------------------------------------

export interface CuratedContactView {
  /** curated_list_members.id — opaque to the user; not the journalist id. */
  id: number
  name: string
  publication: string | null
  /** Emailed by this brand in the last 28 days, so it will be skipped if sent now. */
  recentlyEmailed: boolean
}

/**
 * Curated list members for display. Never selects the email or any field that
 * could reveal it — keep it that way.
 */
export async function getCuratedListPage(
  list: MediaList,
  companyId: number,
  { page, perPage, query }: { page: number; perPage: number; query?: string },
) {
  if (!list.isCurated) throw new Error('Not a curated list')

  let where: SQL = eq(curatedListMembers.pitchGroupId, list.id)
  if (query) {
    where = and(where, or(
      ilike(curatedJournalists.name, `%${query}%`),
      ilike(curatedJournalists.publication, `%${query}%`),
    ))!
  }

  const items: CuratedContactView[] = await db
    .select({
      id: curatedListMembers.id,
      name: curatedJournalists.name,
      publication: curatedJournalists.publication,
      recentlyEmailed: sql<boolean>`${curatedRecentlySent(companyId)}`,
    })
    .from(curatedListMembers)
    .innerJoin(curatedJournalists, eq(curatedJournalists.id, curatedListMembers.curatedJournalistId))
    .where(where)
    .orderBy(asc(curatedJournalists.publication), asc(curatedJournalists.name))
    .limit(perPage)
    .offset((page - 1) * perPage)

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(curatedListMembers)
    .innerJoin(curatedJournalists, eq(curatedJournalists.id, curatedListMembers.curatedJournalistId))
    .where(where)

  const total = Number(countRow?.count || 0)
  return { items, total, page, perPage, totalPages: Math.max(1, Math.ceil(total / perPage)) }
}

// ---------------------------------------------------------------------------
// Release recipients
// ---------------------------------------------------------------------------

export interface UserListRecipient {
  crmContactId: number
  email: string
  md5: string
  firstName: string | null
  lastName: string | null
  pitchGroupId: number
}

export interface CuratedRecipient {
  curatedJournalistId: number
  email: string
  md5: string
  name: string
  pitchGroupId: number
}

/** The lists selected for a release that still belong to the brand. */
export async function getReleaseListSelection(prId: number, companyId: number) {
  return db
    .select({ id: pitchGroups.id, uuid: pitchGroups.uuid, isCurated: pitchGroups.isCurated })
    .from(releaseMediaLists)
    .innerJoin(pitchGroups, eq(pitchGroups.id, releaseMediaLists.pitchGroupId))
    .where(and(eq(releaseMediaLists.prId, prId), activeListsFor(companyId)))
}

/** Replace a release's list selection. Unknown/foreign list uuids are ignored. */
export async function setReleaseListSelection(prId: number, companyId: number, listUuids: string[]) {
  const lists = listUuids.length
    ? await db.select({ id: pitchGroups.id }).from(pitchGroups)
        .where(and(activeListsFor(companyId), inArray(pitchGroups.uuid, listUuids)))
    : []
  const keepIds = lists.map((l) => l.id)

  await db.transaction(async (tx) => {
    // Never touch rows the sender already processed.
    await tx.delete(releaseMediaLists).where(and(
      eq(releaseMediaLists.prId, prId),
      isNull(releaseMediaLists.sentAt),
      keepIds.length ? notInArray(releaseMediaLists.pitchGroupId, keepIds) : undefined,
    ))
    if (keepIds.length) {
      await tx.insert(releaseMediaLists)
        .values(keepIds.map((id) => ({ prId, pitchGroupId: id })))
        .onConflictDoNothing()
    }
  })
  return keepIds
}

async function userListRecipients(companyId: number, listIds: number[]): Promise<UserListRecipient[]> {
  if (listIds.length === 0) return []
  const rows = await db
    .selectDistinctOn([crmContacts.md5], {
      crmContactId: crmContacts.id,
      email: crmContacts.email,
      md5: crmContacts.md5,
      firstName: crmContacts.firstName,
      lastName: crmContacts.lastName,
      pitchGroupId: mediaListMembers.pitchGroupId,
    })
    .from(mediaListMembers)
    .innerJoin(crmContacts, eq(crmContacts.id, mediaListMembers.crmContactId))
    .where(and(
      inArray(mediaListMembers.pitchGroupId, listIds),
      listableContact(companyId),
      isNull(crmContacts.unsubscribeAt),
      isNull(crmContacts.bouncedAt),
    ))
    .orderBy(crmContacts.md5, asc(mediaListMembers.pitchGroupId))
  return rows
    .filter((r) => r.email && r.md5)
    .map((r) => ({ ...r, email: r.email!, md5: r.md5! }))
}

/**
 * Curated recipients for the given curated lists, excluding unsubscribed,
 * bounced, recently emailed (28-day rule), and anyone already reached through a
 * user list for this release (`excludeMd5`).
 */
async function curatedRecipients(
  executor: Pick<typeof db, 'selectDistinctOn'>,
  companyId: number,
  listIds: number[],
  excludeMd5: Set<string>,
): Promise<{ eligible: CuratedRecipient[]; total: number; recentlyEmailed: number }> {
  if (listIds.length === 0) return { eligible: [], total: 0, recentlyEmailed: 0 }
  const rows = await executor
    .selectDistinctOn([curatedJournalists.id], {
      curatedJournalistId: curatedJournalists.id,
      email: curatedJournalists.email,
      md5: curatedJournalists.emailMd5,
      name: curatedJournalists.name,
      pitchGroupId: curatedListMembers.pitchGroupId,
      unsubscribed: sql<boolean>`${curatedJournalists.unsubscribeAt} is not null or ${curatedJournalists.bouncedAt} is not null`,
      recentlyEmailed: sql<boolean>`${curatedRecentlySent(companyId)}`,
    })
    .from(curatedListMembers)
    .innerJoin(curatedJournalists, eq(curatedJournalists.id, curatedListMembers.curatedJournalistId))
    .where(inArray(curatedListMembers.pitchGroupId, listIds))
    .orderBy(curatedJournalists.id)

  const eligible: CuratedRecipient[] = []
  let recentlyEmailed = 0
  for (const r of rows) {
    if (r.recentlyEmailed) { recentlyEmailed++; continue }
    if (r.unsubscribed || excludeMd5.has(r.md5)) continue
    eligible.push({ curatedJournalistId: r.curatedJournalistId, email: r.email, md5: r.md5, name: r.name, pitchGroupId: r.pitchGroupId })
  }
  return { eligible, total: rows.length, recentlyEmailed }
}

function splitLists(lists: { id: number; isCurated: boolean }[]) {
  return {
    userIds: lists.filter((l) => !l.isCurated).map((l) => l.id),
    curatedIds: lists.filter((l) => l.isCurated).map((l) => l.id),
  }
}

/** Counts for the Share step: who would receive the release if sent now. */
export async function previewRecipients(companyId: number, lists: { id: number; isCurated: boolean }[]) {
  const { userIds, curatedIds } = splitLists(lists)
  const users = await userListRecipients(companyId, userIds)
  const curated = await curatedRecipients(db, companyId, curatedIds, new Set(users.map((u) => u.md5)))
  return {
    userRecipients: users.length,
    curatedRecipients: curated.eligible.length,
    curatedTotal: curated.total,
    curatedRecentlyEmailed: curated.recentlyEmailed,
    total: users.length + curated.eligible.length,
  }
}

/**
 * For the release sender. Resolves the release's selected lists into a
 * de-duplicated recipient set and atomically claims the curated recipients:
 * under a per-brand lock it re-checks the 28-day window and records a
 * curated_journalist_sends row for each one returned. Only send to what this
 * returns; call it once per release send.
 */
export async function claimReleaseRecipients(prId: number, companyId: number) {
  const lists = await getReleaseListSelection(prId, companyId)
  const { userIds, curatedIds } = splitLists(lists)
  const users = await userListRecipients(companyId, userIds)
  const userMd5 = new Set(users.map((u) => u.md5))

  const curated = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${CURATED_SEND_LOCK_NS}, ${companyId})`)
    const { eligible } = await curatedRecipients(tx, companyId, curatedIds, userMd5)
    if (eligible.length) {
      await tx.insert(curatedJournalistSends)
        .values(eligible.map((r) => ({ companyId, curatedJournalistId: r.curatedJournalistId, prId })))
        .onConflictDoNothing()
    }
    if (lists.length) {
      await tx.update(releaseMediaLists)
        .set({ sentAt: new Date() })
        .where(and(eq(releaseMediaLists.prId, prId), inArray(releaseMediaLists.pitchGroupId, lists.map((l) => l.id))))
    }
    return eligible
  })

  return { userRecipients: users, curatedRecipients: curated }
}

/**
 * Put newly created/converted media contacts on the brand's default list so they
 * are reachable when a release is sent. No-op for advocate-only contacts.
 */
export async function ensureMediaContactsListed(
  co: { id: number; userId: number; companyName: string },
  contacts: { id: number; contactType: string | null; email: string | null }[],
) {
  const ids = contacts
    .filter((c) => (c.contactType === 'media' || c.contactType === 'both') && !!c.email)
    .map((c) => c.id)
  if (ids.length === 0) return
  const list = await getOrCreateDefaultMediaList(co.id, co.userId, co.companyName)
  await addContactIdsToList(list.id, ids)
}
