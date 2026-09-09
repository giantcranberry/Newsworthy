import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, files, releaseFiles } from '@/db/schema'
import { eq, and, asc, max, or, isNull, desc, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getCompanyFileUploadUrl, deleteCompanyFile, makeObjectPublic } from '@/services/s3'
import { getUserCompanyIds } from '@/lib/team-auth'
import {
  MAX_FILE_ATTACHMENTS,
  MAX_FILE_SIZE_BYTES,
  getUploadRejectionReason,
  isSafePublicUrl,
  resolveMimeType,
  truncateTitle,
} from '@/lib/file-attachments'
import { verifyUploadedObjectHead } from '@/lib/file-attachments-server'

function isEditorialUser(session: any): boolean {
  const user = session?.user
  return !!(user && ((user as any).isEditor || (user as any).isAdmin))
}

async function getRelease(uuid: string, userId: number, session: any) {
  const release = await db.query.releases.findFirst({
    where: eq(releases.uuid, uuid),
  })
  if (!release) return null
  if (isEditorialUser(session)) return release
  if (release.userId === userId) return release
  const companyIds = await getUserCompanyIds(userId)
  if (companyIds.includes(release.companyId)) return release
  return null
}

async function countAttached(releaseId: number): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(releaseFiles)
    .where(eq(releaseFiles.releaseId, releaseId))
  return Number(row?.count || 0)
}

async function nextSortOrder(releaseId: number): Promise<number> {
  const [maxResult] = await db
    .select({ maxSort: max(releaseFiles.sortOrder) })
    .from(releaseFiles)
    .where(eq(releaseFiles.releaseId, releaseId))
  return (maxResult?.maxSort ?? -1) + 1
}

function mapReleaseFile(rf: {
  id: number | null
  fileId: number
  sortOrder: number
  file: typeof files.$inferSelect
}) {
  return {
    id: rf.id,
    fileId: rf.fileId,
    sortOrder: rf.sortOrder,
    file: rf.file,
  }
}

// GET: attached files + brand file library
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params
  const session = await getEffectiveSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)

  try {
    const release = await getRelease(uuid, userId, session)
    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    const attached = await db.query.releaseFiles.findMany({
      where: eq(releaseFiles.releaseId, release.id),
      orderBy: [asc(releaseFiles.sortOrder)],
      with: { file: true },
    })

    const fileLibrary = await db.query.files.findMany({
      where: and(
        eq(files.companyId, release.companyId),
        or(eq(files.isDeleted, false), isNull(files.isDeleted)),
      ),
      orderBy: [desc(files.id)],
      limit: 50,
    })

    return NextResponse.json({
      releaseFiles: attached.map(mapReleaseFile),
      fileLibrary,
    })
  } catch (error) {
    console.error('[API] Error fetching release files:', error)
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 })
  }
}

// POST: presign | confirm | attach | link
export async function POST(
  request: Request,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params
  const session = await getEffectiveSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)

  try {
    const release = await getRelease(uuid, userId, session)
    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    const ownerId = release.userId
    const body = await request.json()
    const action = body.action as string

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
      if ((await countAttached(release.id)) >= MAX_FILE_ATTACHMENTS) {
        return NextResponse.json({ error: 'Maximum of 3 files per press release' }, { status: 400 })
      }

      const { uploadUrl, key, publicUrl } = await getCompanyFileUploadUrl(
        release.companyId,
        filename,
        mimeType
      )

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
      if ((await countAttached(release.id)) >= MAX_FILE_ATTACHMENTS) {
        await deleteCompanyFile(publicUrl)
        return NextResponse.json({ error: 'Maximum of 3 files per press release' }, { status: 400 })
      }

      const contentIssue = await verifyUploadedObjectHead(key, filename)
      if (contentIssue) {
        await deleteCompanyFile(publicUrl)
        return NextResponse.json({ error: contentIssue }, { status: 400 })
      }

      try {
        await makeObjectPublic(key)
      } catch (err) {
        console.error('[files] makeObjectPublic failed:', err)
        await deleteCompanyFile(publicUrl)
        return NextResponse.json({ error: 'Failed to publish uploaded file' }, { status: 500 })
      }

      const [file] = await db
        .insert(files)
        .values({
          uuid: randomUUID(),
          userId: ownerId,
          companyId: release.companyId,
          title,
          description: body.description ? String(body.description).trim() : null,
          filename,
          url: publicUrl,
          mimeType,
          filesize,
          source: 'linode',
        })
        .returning()

      const sortOrder = await nextSortOrder(release.id)
      const [rf] = await db
        .insert(releaseFiles)
        .values({
          releaseId: release.id,
          fileId: file.id,
          sortOrder,
        })
        .returning()

      return NextResponse.json({
        success: true,
        releaseFile: { id: rf.id, fileId: rf.fileId, sortOrder: rf.sortOrder, file },
      })
    }

    if (action === 'attach') {
      const fileId = Number(body.fileId)
      if (!fileId) {
        return NextResponse.json({ error: 'fileId is required' }, { status: 400 })
      }

      const file = await db.query.files.findFirst({
        where: and(
          eq(files.id, fileId),
          eq(files.companyId, release.companyId),
          or(eq(files.isDeleted, false), isNull(files.isDeleted)),
        ),
      })
      if (!file) {
        return NextResponse.json({ error: 'File not found in brand library' }, { status: 404 })
      }

      if ((await countAttached(release.id)) >= MAX_FILE_ATTACHMENTS) {
        return NextResponse.json({ error: 'Maximum of 3 files per press release' }, { status: 400 })
      }

      const existing = await db.query.releaseFiles.findFirst({
        where: and(
          eq(releaseFiles.releaseId, release.id),
          eq(releaseFiles.fileId, fileId),
        ),
      })
      if (existing) {
        return NextResponse.json({ error: 'File already attached' }, { status: 400 })
      }

      const sortOrder = await nextSortOrder(release.id)
      const [rf] = await db
        .insert(releaseFiles)
        .values({
          releaseId: release.id,
          fileId,
          sortOrder,
        })
        .returning()

      return NextResponse.json({
        success: true,
        releaseFile: { id: rf.id, fileId: rf.fileId, sortOrder: rf.sortOrder, file },
      })
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
      if ((await countAttached(release.id)) >= MAX_FILE_ATTACHMENTS) {
        return NextResponse.json({ error: 'Maximum of 3 files per press release' }, { status: 400 })
      }

      const [file] = await db
        .insert(files)
        .values({
          uuid: randomUUID(),
          userId: ownerId,
          companyId: release.companyId,
          title,
          description,
          filename: null,
          url,
          mimeType: 'text/uri-list',
          filesize: 0,
          source: 'external',
        })
        .returning()

      const sortOrder = await nextSortOrder(release.id)
      const [rf] = await db
        .insert(releaseFiles)
        .values({
          releaseId: release.id,
          fileId: file.id,
          sortOrder,
        })
        .returning()

      return NextResponse.json({
        success: true,
        releaseFile: { id: rf.id, fileId: rf.fileId, sortOrder: rf.sortOrder, file },
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('[API] Error managing release files:', error)
    return NextResponse.json({ error: 'Failed to manage files' }, { status: 500 })
  }
}

// PUT: update title/description on an attached file
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params
  const session = await getEffectiveSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)

  try {
    const release = await getRelease(uuid, userId, session)
    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    const body = await request.json()
    const fileId = Number(body.fileId)
    if (!fileId) {
      return NextResponse.json({ error: 'fileId is required' }, { status: 400 })
    }

    const attached = await db.query.releaseFiles.findFirst({
      where: and(
        eq(releaseFiles.releaseId, release.id),
        eq(releaseFiles.fileId, fileId),
      ),
      with: { file: true },
    })
    if (!attached) {
      return NextResponse.json({ error: 'File not attached to this release' }, { status: 404 })
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
      .where(and(eq(files.id, fileId), eq(files.companyId, release.companyId)))
      .returning()

    return NextResponse.json({
      success: true,
      releaseFile: {
        id: attached.id,
        fileId: attached.fileId,
        sortOrder: attached.sortOrder,
        file: updated,
      },
    })
  } catch (error) {
    console.error('[API] Error updating release file:', error)
    return NextResponse.json({ error: 'Failed to update file' }, { status: 500 })
  }
}

// DELETE: detach from release (keep brand library row)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params
  const session = await getEffectiveSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)

  try {
    const release = await getRelease(uuid, userId, session)
    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const fileId = Number(searchParams.get('fileId'))
    if (!fileId) {
      return NextResponse.json({ error: 'fileId is required' }, { status: 400 })
    }

    await db
      .delete(releaseFiles)
      .where(
        and(
          eq(releaseFiles.releaseId, release.id),
          eq(releaseFiles.fileId, fileId),
        )
      )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Error detaching release file:', error)
    return NextResponse.json({ error: 'Failed to remove file' }, { status: 500 })
  }
}
