import { NextRequest, NextResponse } from 'next/server'
import {
  createMediaList,
  getBrandMediaLists,
  getOrCreateDefaultMediaList,
  MAX_LIST_NAME_LENGTH,
  CURATED_LIST_NAME,
} from '@/lib/media-lists'
import { mediaListAccess } from './access'

// GET: the brand's media lists (curated first) with contact counts
export async function GET(_request: NextRequest, { params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = await params
  const auth = await mediaListAccess(uuid, { write: false })
  if (!auth.ok) return auth.response
  const co = auth.access.company

  await getOrCreateDefaultMediaList(co.id, auth.userId, co.companyName)
  const lists = await getBrandMediaLists(co.id)
  return NextResponse.json({ lists })
}

// POST: create a user list { name, description? }
export async function POST(request: NextRequest, { params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = await params
  const auth = await mediaListAccess(uuid, { write: true })
  if (!auth.ok) return auth.response
  const co = auth.access.company

  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''

  if (!name) return NextResponse.json({ error: 'List name is required' }, { status: 400 })
  if (name.length > MAX_LIST_NAME_LENGTH) {
    return NextResponse.json({ error: `List name must be ${MAX_LIST_NAME_LENGTH} characters or fewer` }, { status: 400 })
  }
  if (name.toLowerCase() === CURATED_LIST_NAME.toLowerCase()) {
    return NextResponse.json({ error: `"${CURATED_LIST_NAME}" is reserved` }, { status: 400 })
  }

  const list = await createMediaList(co.id, auth.userId, name, description || null)
  return NextResponse.json({
    success: true,
    list: { uuid: list.uuid, name: list.groupName, description: list.description, isCurated: false, contactCount: 0 },
  })
}
