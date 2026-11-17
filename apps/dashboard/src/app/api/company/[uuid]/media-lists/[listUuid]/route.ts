import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { pitchGroups } from '@/db/schema'
import { eq } from 'drizzle-orm'
import {
  getCuratedListPage,
  getMediaList,
  MAX_LIST_NAME_LENGTH,
  CURATED_LIST_NAME,
} from '@/lib/media-lists'
import { curatedReadOnly, mediaListAccess } from '../access'

type Params = { params: Promise<{ uuid: string; listUuid: string }> }

// GET: list details. For the curated list, returns masked members (name + publication only).
// User-list members are browsed on the Manage Contacts page (?list=<uuid>).
export async function GET(request: NextRequest, { params }: Params) {
  const { uuid, listUuid } = await params
  const auth = await mediaListAccess(uuid, { write: false })
  if (!auth.ok) return auth.response
  const co = auth.access.company

  const list = await getMediaList(co.id, listUuid)
  if (!list) return NextResponse.json({ error: 'List not found' }, { status: 404 })

  const summary = { uuid: list.uuid, name: list.groupName, description: list.description, isCurated: list.isCurated }
  if (!list.isCurated) return NextResponse.json({ list: summary })

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
  const perPage = [10, 20, 50].includes(Number(searchParams.get('perPage'))) ? Number(searchParams.get('perPage')) : 20
  const query = (searchParams.get('q') || '').trim()

  const members = await getCuratedListPage(list, co.id, { page, perPage, query })
  return NextResponse.json({ list: summary, ...members })
}

// PATCH: rename / describe a user list
export async function PATCH(request: NextRequest, { params }: Params) {
  const { uuid, listUuid } = await params
  const auth = await mediaListAccess(uuid, { write: true })
  if (!auth.ok) return auth.response
  const co = auth.access.company

  const list = await getMediaList(co.id, listUuid)
  if (!list) return NextResponse.json({ error: 'List not found' }, { status: 404 })
  if (list.isCurated) return curatedReadOnly()

  const body = await request.json().catch(() => ({}))
  const updates: Partial<typeof pitchGroups.$inferInsert> = { updatedAt: new Date() }

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return NextResponse.json({ error: 'List name is required' }, { status: 400 })
    if (name.length > MAX_LIST_NAME_LENGTH) {
      return NextResponse.json({ error: `List name must be ${MAX_LIST_NAME_LENGTH} characters or fewer` }, { status: 400 })
    }
    if (name.toLowerCase() === CURATED_LIST_NAME.toLowerCase()) {
      return NextResponse.json({ error: `"${CURATED_LIST_NAME}" is reserved` }, { status: 400 })
    }
    updates.groupName = name
  }
  if (body.description !== undefined) {
    updates.description = typeof body.description === 'string' && body.description.trim() ? body.description.trim() : null
  }

  await db.update(pitchGroups).set(updates).where(eq(pitchGroups.id, list.id))
  return NextResponse.json({ success: true })
}

// DELETE: soft-delete a user list. Contacts stay in the brand's contact book.
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { uuid, listUuid } = await params
  const auth = await mediaListAccess(uuid, { write: true })
  if (!auth.ok) return auth.response
  const co = auth.access.company

  const list = await getMediaList(co.id, listUuid)
  if (!list) return NextResponse.json({ error: 'List not found' }, { status: 404 })
  if (list.isCurated) return curatedReadOnly()

  await db.update(pitchGroups)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(eq(pitchGroups.id, list.id))
  return NextResponse.json({ success: true })
}
