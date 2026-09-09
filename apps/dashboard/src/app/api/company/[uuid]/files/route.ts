import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { files, releaseFiles } from '@/db/schema'
import { eq, and, desc, or, isNull, sql } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getCompanyFileUploadUrl, deleteCompanyFile, makeObjectPublic } from '@/services/s3'
import { getCompanyAccess, hasMinRole } from '@/lib/team-auth'
import {
  MAX_FILE_SIZE_BYTES,
  getUploadRejectionReason,
  isSafePublicUrl,
  resolveMimeType,
  truncateTitle,
} from '@/lib/file-attachments'
import { verifyUploadedObjectHead } from '@/lib/file-attachments-server'

async function requireAccess(uuid: string, userId: number, isAdmin: boolean) {
  return getCompanyAccess(uuid, userId, isAdmin)
}

// GET: paginated brand files
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params
  const session = await getEffectiveSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)
  const isAdmin = !!(session?.user as any)?.isAdmin || !!(session?.user as any)?.isStaff
  const access = await requireAccess(uuid, userId, isAdmin)
  if (!access) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  const co = access.company
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const perPage = 24

  const notDeleted = and(
    eq(files.companyId, co.id),
    or(eq(files.isDeleted, false), isNull(files.isDeleted)),
  )

  const items = await db
    .select()
    .from(files)
    .where(notDeleted)
    .orderBy(desc(files.id))
    .limit(perPage)
    .offset((page - 1) * perPage)

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(files)
    .where(notDeleted)

  const total = Number(countRow?.count || 0)

  return NextResponse.json({
    files: items,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage) || 1,
  })
}

// POST: presign | confirm | link
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params
  const session = await getEffectiveSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)
  const isAdmin = !!(session?.user as any)?.isAdmin || !!(session?.user as any)?.isStaff
  const access = await requireAccess(uuid, userId, isAdmin)
  if (!access) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }
  if (!hasMinRole(access.role, 'brand_admin')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const co = access.company
  const body = await request.json()
  const action = body.action as string

  try {
    if (action === 'presign') {
      const filename = String(body.filename || '')
      const mimeType = resolveMimeType(filename, body.mimeType)
      const filesize = Number(body.filesize || 0)
      const title = truncateTitle(String(body.title || filename || 'Untitled'))

      if (!filename || !title) {
        return NextResponse.json({ error: 'Filename and title are required' }, { status: 400 })
      }
      const rejectReason = getUploadRejectionReason(filename, mimeType)
      if (rejectReason) {
        return NextResponse.json({ error: rejectReason }, { status: 400 })
      }
      if (filesize <= 0 || filesize > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json({ error: 'File must be between 1 byte and 150MB' }, { status: 400 })
      }

      const { uploadUrl, key, publicUrl } = await getCompanyFileUploadUrl(co.id, filename, mimeType)
      return NextResponse.json({
        uploadUrl,
        key,
        publicUrl,
        mimeType,
        title,
        description: body.description ? String(body.description).trim() : null,
      })
    }

    if (action === 'confirm') {
      const filename = String(body.filename || '')
      const mimeType = resolveMimeType(filename, body.mimeType)
      const filesize = Number(body.filesize || 0)
      const title = truncateTitle(String(body.title || filename || 'Untitled'))
      const publicUrl = String(body.publicUrl || '')
      const key = String(body.key || '')

      if (!publicUrl || !key || !title) {
        return NextResponse.json({ error: 'Upload confirmation incomplete' }, { status: 400 })
      }
      if (!publicUrl.includes(key)) {
        return NextResponse.json({ error: 'Invalid upload key' }, { status: 400 })
      }
      const rejectReason = getUploadRejectionReason(filename, mimeType)
      if (rejectReason) {
        await deleteCompanyFile(publicUrl)
        return NextResponse.json({ error: rejectReason }, { status: 400 })
      }

      const contentIssue = await verifyUploadedObjectHead(key, filename)
      if (contentIssue) {
        await deleteCompanyFile(publicUrl)
        return NextResponse.json({ error: contentIssue }, { status: 400 })
      }

      const [file] = await db
        .insert(files)
        .values({
          uuid: randomUUID(),
          userId,
          companyId: co.id,
          title,
          description: body.description ? String(body.description).trim() : null,
          filename,
          url: publicUrl,
          mimeType,
          filesize,
          source: 'linode',
        })
        .returning()

      return NextResponse.json({ success: true, file })
    }

    if (action === 'link') {
      const url = String(body.url || '').trim()
      const title = truncateTitle(String(body.title || 'Shared link'))
      const description = body.description ? String(body.description).trim() : null

      if (!title) {
        return NextResponse.json({ error: 'Title is required' }, { status: 400 })
      }
      if (!isSafePublicUrl(url)) {
        return NextResponse.json({ error: 'Enter a valid http(s) URL' }, { status: 400 })
      }

      const [file] = await db
        .insert(files)
        .values({
          uuid: randomUUID(),
          userId,
          companyId: co.id,
          title,
          description,
          filename: null,
          url,
          mimeType: 'text/uri-list',
          filesize: 0,
          source: 'external',
        })
        .returning()

      return NextResponse.json({ success: true, file })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('[API] Error managing brand files:', error)
    return NextResponse.json({ error: 'Failed to manage files' }, { status: 500 })
  }
}

// PUT: update metadata
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params
  const session = await getEffectiveSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)
  const isAdmin = !!(session?.user as any)?.isAdmin || !!(session?.user as any)?.isStaff
  const access = await requireAccess(uuid, userId, isAdmin)
  if (!access) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }
  if (!hasMinRole(access.role, 'brand_admin')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const co = access.company
  const body = await request.json()
  const fileId = Number(body.fileId)
  if (!fileId) {
    return NextResponse.json({ error: 'fileId is required' }, { status: 400 })
  }

  const updates: Partial<typeof files.$inferInsert> = {}
  if (typeof body.title === 'string' && body.title.trim()) {
    updates.title = truncateTitle(body.title)
  }
  if (typeof body.description === 'string') {
    updates.description = body.description.trim() || null
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const [updated] = await db
    .update(files)
    .set(updates)
    .where(
      and(
        eq(files.id, fileId),
        eq(files.companyId, co.id),
        or(eq(files.isDeleted, false), isNull(files.isDeleted)),
      )
    )
    .returning()

  if (!updated) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, file: updated })
}

// DELETE: soft-delete (+ best-effort S3 delete for linode files)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params
  const session = await getEffectiveSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)
  const isAdmin = !!(session?.user as any)?.isAdmin || !!(session?.user as any)?.isStaff
  const access = await requireAccess(uuid, userId, isAdmin)
  if (!access) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }
  if (!hasMinRole(access.role, 'brand_admin')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const co = access.company
  const { searchParams } = new URL(request.url)
  const fileId = Number(searchParams.get('fileId'))
  if (!fileId) {
    return NextResponse.json({ error: 'fileId is required' }, { status: 400 })
  }

  const [existing] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.companyId, co.id)))
    .limit(1)

  if (!existing) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  await db
    .update(files)
    .set({ isDeleted: true })
    .where(eq(files.id, fileId))

  // Soft-delete does not cascade; detach from releases explicitly
  await db.delete(releaseFiles).where(eq(releaseFiles.fileId, fileId))

  if (existing.source === 'linode' && existing.url) {
    await deleteCompanyFile(existing.url)
  }

  return NextResponse.json({ success: true })
}
