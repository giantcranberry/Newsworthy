import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, approvals } from '@/db/schema'
import { eq, and, ne } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { sendApprovalRequestEmail } from '@/lib/email'

async function getReleaseForUser(uuid: string, userId: number) {
  return db.query.releases.findFirst({
    where: and(
      eq(releases.uuid, uuid),
      eq(releases.userId, userId)
    ),
  })
}

export async function GET(
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
    const release = await getReleaseForUser(uuid, userId)

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    // Fetch approvals for this release
    const releaseApprovals = await db
      .select()
      .from(approvals)
      .where(eq(approvals.releaseId, release.id))
      .orderBy(approvals.requestedAt)

    // Fetch prior approvers from same company (different releases)
    const priorApprovers = await db
      .selectDistinctOn([approvals.email], {
        email: approvals.email,
        emailTo: approvals.emailTo,
      })
      .from(approvals)
      .where(
        and(
          eq(approvals.companyId, release.companyId),
          ne(approvals.releaseId, release.id)
        )
      )

    return NextResponse.json({
      approvals: releaseApprovals,
      priorApprovers: priorApprovers.filter((p) => p.email),
    })
  } catch (error) {
    console.error('[API] Error fetching approvals:', error)
    return NextResponse.json({ error: 'Failed to fetch approvals' }, { status: 500 })
  }
}

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
    const release = await getReleaseForUser(uuid, userId)

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    const body = await request.json()
    const { email, emailTo, notes, priorApprovers: priorIds } = body

    // Get requestor name from session
    const requestorName = session.user.name || session.user.email || 'A Newsworthy user'

    const created: (typeof approvals.$inferSelect)[] = []

    // Handle prior approver selections
    if (priorIds && Array.isArray(priorIds) && priorIds.length > 0) {
      for (const prior of priorIds) {
        const approvalUuid = uuidv4()
        const [row] = await db.insert(approvals).values({
          uuid: approvalUuid,
          releaseId: release.id,
          email: prior.email,
          emailTo: prior.emailTo,
          notes: notes || null,
          companyId: release.companyId,
          userId,
          requestedAt: new Date(),
          approved: false,
        }).returning()
        created.push(row)

        // Send email to prior approver
        if (prior.email) {
          try {
            await sendApprovalRequestEmail({
              to: prior.email,
              approverName: prior.emailTo || 'Stakeholder',
              requestorName,
              releaseTitle: release.title || 'Untitled Press Release',
              notes,
              approvalUuid,
            })
          } catch (emailError) {
            console.error('[API] Error sending approval email:', emailError)
            // Continue even if email fails
          }
        }
      }
    }

    // Handle new approver
    if (email && emailTo) {
      const approvalUuid = uuidv4()
      const [row] = await db.insert(approvals).values({
        uuid: approvalUuid,
        releaseId: release.id,
        email,
        emailTo,
        notes: notes || null,
        companyId: release.companyId,
        userId,
        requestedAt: new Date(),
        approved: false,
      }).returning()
      created.push(row)

      // Send email to new approver
      try {
        await sendApprovalRequestEmail({
          to: email,
          approverName: emailTo,
          requestorName,
          releaseTitle: release.title || 'Untitled Press Release',
          notes,
          approvalUuid,
        })
      } catch (emailError) {
        console.error('[API] Error sending approval email:', emailError)
        // Continue even if email fails
      }
    }

    if (created.length === 0) {
      return NextResponse.json({ error: 'No approver specified' }, { status: 400 })
    }

    return NextResponse.json({ success: true, approvals: created })
  } catch (error) {
    console.error('[API] Error creating approval:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to create approval'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

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
    const release = await getReleaseForUser(uuid, userId)

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    const { approvalUuid } = await request.json()

    if (!approvalUuid) {
      return NextResponse.json({ error: 'Approval UUID required' }, { status: 400 })
    }

    // Find the approval and ensure it belongs to this release and isn't signed
    const approval = await db.query.approvals.findFirst({
      where: and(
        eq(approvals.uuid, approvalUuid),
        eq(approvals.releaseId, release.id)
      ),
    })

    if (!approval) {
      return NextResponse.json({ error: 'Approval not found' }, { status: 404 })
    }

    if (approval.signedAt) {
      return NextResponse.json({ error: 'Cannot delete a signed approval' }, { status: 400 })
    }

    await db.delete(approvals).where(eq(approvals.uuid, approvalUuid))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Error deleting approval:', error)
    return NextResponse.json({ error: 'Failed to delete approval' }, { status: 500 })
  }
}
