import { NextRequest, NextResponse } from 'next/server'
import { addContactsToList, getMediaList, removeContactsFromList } from '@/lib/media-lists'
import { curatedReadOnly, mediaListAccess } from '../../access'

type Params = { params: Promise<{ uuid: string; listUuid: string }> }

function readUuids(body: any): string[] {
  const raw = Array.isArray(body?.contactUuids) ? body.contactUuids : []
  return [...new Set(raw.filter((u: unknown): u is string => typeof u === 'string' && u.length > 0))] as string[]
}

// POST: add the brand's media contacts to a user list { contactUuids: string[] }.
// Contacts without an email are skipped. The curated list is read-only.
export async function POST(request: NextRequest, { params }: Params) {
  const { uuid, listUuid } = await params
  const auth = await mediaListAccess(uuid, { write: true })
  if (!auth.ok) return auth.response
  const co = auth.access.company

  const list = await getMediaList(co.id, listUuid)
  if (!list) return NextResponse.json({ error: 'List not found' }, { status: 404 })
  if (list.isCurated) return curatedReadOnly()

  const uuids = readUuids(await request.json().catch(() => ({})))
  if (uuids.length === 0) return NextResponse.json({ error: 'contactUuids is required' }, { status: 400 })
  if (uuids.length > 500) return NextResponse.json({ error: 'Add at most 500 contacts at a time' }, { status: 400 })

  const result = await addContactsToList(list, co.id, uuids)
  return NextResponse.json({ success: true, ...result })
}

// DELETE: remove contacts from a user list { contactUuids: string[] } (they stay in the contact book)
export async function DELETE(request: NextRequest, { params }: Params) {
  const { uuid, listUuid } = await params
  const auth = await mediaListAccess(uuid, { write: true })
  if (!auth.ok) return auth.response
  const co = auth.access.company

  const list = await getMediaList(co.id, listUuid)
  if (!list) return NextResponse.json({ error: 'List not found' }, { status: 404 })
  if (list.isCurated) return curatedReadOnly()

  const uuids = readUuids(await request.json().catch(() => ({})))
  if (uuids.length === 0) return NextResponse.json({ error: 'contactUuids is required' }, { status: 400 })

  const removed = await removeContactsFromList(list, co.id, uuids)
  return NextResponse.json({ success: true, removed })
}
