import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, approvals } from '@/db/schema'
import { eq, and, ne } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { sendApprovalRequestEmail } from '@/lib/email'
import { getUserCompanyIds } from '@/lib/team-auth'

async function getReleaseForUser(uuid: string, userId: number) {
  const release = await db.query.releases.findFirst({
    where: eq(releases.uuid, uuid),
  })

  if (!release) return null

  if (release.userId !== userId) {
    const companyIds = await getUserCompanyIds(userId)
    if (!companyIds.includes(release.companyId)) {
      return null
    }
  }

  return release
}

async function createAndEmailApproval({
  release,
  userId,
  requestorName,
  email,
  emailTo,
  notes,
}: {
  release: { id: number; companyId: number; title: string | null }
  userId: number
  requestorName: string
  email: string
  emailTo: string
  notes?: string | null
}) {
  const approvalUuid = uuidv4()
  const [row] = await db
    .insert(approvals)
    .values({
      uuid: approvalUuid,
      releaseId: release.id,
      email,
      emailTo,
      notes: notes || null,
      companyId: release.companyId,
      userId,
      requestedAt: new Date(),
      approved: false,
    })
    .returning()

  try {
    await sendApprovalRequestEmail({
      to: email,
      approverName: emailTo || 'Stakeholder',
      requestorName,
      releaseTitle: release.title || 'Untitled Press Release',
      notes,
      approvalUuid,
    })
  } catch (emailError) {
    // Don't leave a pending request that never reached the stakeholder
    await db.delete(approvals).where(eq(approvals.uuid, approvalUuid))
    const detail =
      emailError instanceof Error ? emailError.message : 'Unknown email error'
    throw new Error(`Failed to send approval email to ${email}: ${detail}`)
  }

  return row
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

    const releaseApprovals = await db
      .select()
      .from(approvals)
      .where(eq(approvals.releaseId, release.id))
      .orderBy(approvals.requestedAt)

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
    const requestorName = session.user.name || session.user.email || 'A Newsworthy user'

    // Resend an existing pending approval email via Resend
    if (body?.action === 'resend') {
      const approvalUuid = body.approvalUuid as string | undefined
      if (!approvalUuid) {
        return NextResponse.json({ error: 'Approval UUID required' }, { status: 400 })
      }

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
        return NextResponse.json(
          { error: 'This approval has already been responded to' },
          { status: 400 }
        )
      }
      if (!approval.email) {
        return NextResponse.json({ error: 'Approval has no email address' }, { status: 400 })
      }

      await sendApprovalRequestEmail({
        to: approval.email,
        approverName: approval.emailTo || 'Stakeholder',
        requestorName,
        releaseTitle: release.title || 'Untitled Press Release',
        notes: approval.notes,
        approvalUuid: approval.uuid,
      })

      return NextResponse.json({ success: true, emailSent: true })
    }

    const { email, emailTo, notes, priorApprovers: priorIds } = body
    const created: (typeof approvals.$inferSelect)[] = []
    const emailErrors: string[] = []

    if (priorIds && Array.isArray(priorIds) && priorIds.length > 0) {
      for (const prior of priorIds) {
        if (!prior.email) continue
        try {
          const row = await createAndEmailApproval({
            release,
            userId,
            requestorName,
            email: prior.email,
            emailTo: prior.emailTo || 'Stakeholder',
            notes,
          })
          created.push(row)
        } catch (err) {
          console.error('[API] Error sending approval email:', err)
          emailErrors.push(err instanceof Error ? err.message : String(err))
        }
      }
    }

    if (email && emailTo) {
      try {
        const row = await createAndEmailApproval({
          release,
          userId,
          requestorName,
          email,
          emailTo,
          notes,
        })
        created.push(row)
      } catch (err) {
        console.error('[API] Error sending approval email:', err)
        emailErrors.push(err instanceof Error ? err.message : String(err))
      }
    }

    if (created.length === 0) {
      if (emailErrors.length > 0) {
        return NextResponse.json(
          {
            error:
              'Could not send the stakeholder approval email via Resend. No request was saved. ' +
              emailErrors.join('; '),
          },
          { status: 502 }
        )
      }
      return NextResponse.json({ error: 'No approver specified' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      approvals: created,
      emailSent: true,
      ...(emailErrors.length > 0
        ? { warning: `Some emails failed: ${emailErrors.join('; ')}` }
        : {}),
    })
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

    const approval = await db.query.approvals.findFirst({
      where: and(
        eq(approvals.uuid, approvalUuid),
        eq(approvals.releaseId, release.id)
      ),
    })

    if (!approval) {
      return NextResponse.json({ error: 'Approval not found' }, { status: 404 })
    }

    await db.delete(approvals).where(eq(approvals.uuid, approvalUuid))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Error deleting approval:', error)
    return NextResponse.json({ error: 'Failed to delete approval' }, { status: 500 })
  }
}
