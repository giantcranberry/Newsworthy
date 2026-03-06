import { db } from '@/db'
import { approvals, releases, users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params

  try {
    // Find the approval
    const approval = await db.query.approvals.findFirst({
      where: eq(approvals.uuid, uuid),
    })

    if (!approval) {
      return NextResponse.json({ error: 'Approval request not found' }, { status: 404 })
    }

    // Check if already responded
    if (approval.signedAt) {
      return NextResponse.json({ error: 'This approval has already been responded to' }, { status: 400 })
    }

    const body = await request.json()
    const { signature, feedback, approved } = body

    if (!signature || typeof signature !== 'string') {
      return NextResponse.json({ error: 'Signature is required' }, { status: 400 })
    }

    // Update the approval
    await db.update(approvals)
      .set({
        signature,
        feedback: feedback || null,
        approved: approved === true,
        signedAt: new Date(),
      })
      .where(eq(approvals.uuid, uuid))

    // Get the release and user to send notification email
    const release = await db.query.releases.findFirst({
      where: eq(releases.id, approval.releaseId),
    })

    const user = await db.query.users.findFirst({
      where: eq(users.id, approval.userId),
    })

    // Send notification email to the release owner
    if (user?.email && release) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.newsworthy.ai'

      try {
        await sendEmail({
          to: user.email,
          subject: `Approval ${approved ? 'Received' : 'Response'}: ${release.title || 'Your Press Release'}`,
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <title>Approval Response</title>
              </head>
              <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
                  <h1 style="color: #1a1a1a; margin-bottom: 20px;">
                    ${approved ? '✓ Approval Received' : 'Response Received'}
                  </h1>

                  <p style="margin-bottom: 20px;">
                    <strong>${approval.emailTo || signature}</strong> has ${approved ? 'approved' : 'declined'} your press release.
                  </p>

                  <div style="background-color: #fff; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
                    <p style="margin: 0 0 5px 0; color: #666;">Press Release:</p>
                    <p style="margin: 0; font-weight: 600;">${release.title || 'Untitled'}</p>
                  </div>

                  ${feedback ? `
                  <div style="background-color: #fff; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
                    <p style="margin: 0 0 5px 0; color: #666;">Feedback:</p>
                    <p style="margin: 0; font-style: italic;">"${feedback}"</p>
                  </div>
                  ` : ''}

                  <a href="${appUrl}/pr/${release.uuid}/finalize" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">View Approvals</a>
                </div>
              </body>
            </html>
          `,
          text: `${approved ? 'Approval' : 'Response'} received from ${approval.emailTo || signature} for "${release.title || 'your press release'}". ${feedback ? `Feedback: "${feedback}"` : ''}`,
        })
      } catch (emailError) {
        console.error('[API] Error sending notification email:', emailError)
        // Continue even if email fails
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Error processing approval response:', error)
    return NextResponse.json({ error: 'Failed to process response' }, { status: 500 })
  }
}
