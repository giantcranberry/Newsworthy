import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { a2aApiKeys, company } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { hash, genSalt } from 'bcryptjs'
import { randomBytes } from 'crypto'
import { getCompanyAccess, hasMinRole } from '@/lib/team-auth'

function generateApiKey(): string {
  return `nw_a2a_${randomBytes(16).toString('hex')}`
}

// GET — List user's API keys
export async function GET() {
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)

  const keys = await db
    .select({
      uuid: a2aApiKeys.uuid,
      name: a2aApiKeys.name,
      keyPrefix: a2aApiKeys.keyPrefix,
      companyId: a2aApiKeys.companyId,
      companyName: company.companyName,
      companyUuid: company.uuid,
      isActive: a2aApiKeys.isActive,
      lastUsedAt: a2aApiKeys.lastUsedAt,
      expiresAt: a2aApiKeys.expiresAt,
      createdAt: a2aApiKeys.createdAt,
    })
    .from(a2aApiKeys)
    .innerJoin(company, eq(a2aApiKeys.companyId, company.id))
    .where(eq(a2aApiKeys.userId, userId))
    .orderBy(a2aApiKeys.createdAt)

  return NextResponse.json({ keys })
}

// POST — Create new API key
export async function POST(request: NextRequest) {
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)
  const isAdmin = !!(session.user as any)?.isAdmin

  try {
    const body = await request.json()
    const { name, companyUuid } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Key name is required' }, { status: 400 })
    }

    if (name.length > 100) {
      return NextResponse.json({ error: 'Key name must be 100 characters or less' }, { status: 400 })
    }

    if (!companyUuid) {
      return NextResponse.json({ error: 'Company UUID is required' }, { status: 400 })
    }

    // Validate user has access to this company
    const access = await getCompanyAccess(companyUuid, userId, isAdmin)
    if (!access || !hasMinRole(access.role, 'collaborator')) {
      return NextResponse.json(
        { error: 'You do not have sufficient access to this brand' },
        { status: 403 }
      )
    }

    // Check for duplicate name for this user + company
    const existing = await db.query.a2aApiKeys.findFirst({
      where: and(
        eq(a2aApiKeys.userId, userId),
        eq(a2aApiKeys.companyId, access.company.id),
        eq(a2aApiKeys.name, name.trim()),
        eq(a2aApiKeys.isActive, true),
      ),
    })

    if (existing) {
      return NextResponse.json(
        { error: 'An active key with this name already exists for this brand' },
        { status: 409 }
      )
    }

    // Generate key and hash
    const apiKey = generateApiKey()
    const keyPrefix = apiKey.substring(0, 12)
    const salt = await genSalt(10)
    const keyHash = await hash(apiKey, salt)

    const [newKey] = await db.insert(a2aApiKeys).values({
      uuid: uuidv4(),
      userId,
      companyId: access.company.id,
      name: name.trim(),
      keyHash,
      keyPrefix,
    }).returning()

    // Return the full key — shown only once
    return NextResponse.json({
      key: {
        uuid: newKey.uuid,
        name: newKey.name,
        keyPrefix: newKey.keyPrefix,
        companyName: access.company.companyName,
        companyUuid: access.company.uuid,
        isActive: newKey.isActive,
        createdAt: newKey.createdAt,
      },
      apiKey, // Full key — only returned on creation
    })
  } catch (error) {
    console.error('Error creating API key:', error)
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 })
  }
}

// DELETE — Revoke API key
export async function DELETE(request: NextRequest) {
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)

  try {
    const { searchParams } = new URL(request.url)
    const keyUuid = searchParams.get('uuid')

    if (!keyUuid) {
      return NextResponse.json({ error: 'Key UUID is required' }, { status: 400 })
    }

    const key = await db.query.a2aApiKeys.findFirst({
      where: and(
        eq(a2aApiKeys.uuid, keyUuid),
        eq(a2aApiKeys.userId, userId),
      ),
    })

    if (!key) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    // Soft-deactivate
    await db.update(a2aApiKeys)
      .set({ isActive: false })
      .where(eq(a2aApiKeys.id, key.id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error revoking API key:', error)
    return NextResponse.json({ error: 'Failed to revoke API key' }, { status: 500 })
  }
}
