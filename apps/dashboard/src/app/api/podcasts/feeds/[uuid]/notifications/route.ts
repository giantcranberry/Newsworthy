import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { podcastFeeds } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { getUserCompanyIds } from '@/lib/team-auth'

const bodySchema = z
  .object({
    notifyEmail: z.boolean(),
    notifyEmailTo: z.string().email().nullable().optional(),
    notifySms: z.boolean(),
    notifySmsPhone: z.string().nullable().optional(),
    notifyInApp: z.boolean(),
    notifySlack: z.boolean(),
    notifySlackWebhookUrl: z.string().url().nullable().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.notifySms && !val.notifySmsPhone?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['notifySmsPhone'],
        message: 'Phone number is required when SMS notifications are on.',
      })
    }
    if (val.notifySlack) {
      const url = val.notifySlackWebhookUrl?.trim()
      if (!url) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['notifySlackWebhookUrl'],
          message: 'Slack webhook URL is required when Slack notifications are on.',
        })
      } else if (!/^https:\/\/hooks\.slack\.com\//.test(url)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['notifySlackWebhookUrl'],
          message: 'Slack webhook URLs start with https://hooks.slack.com/.',
        })
      }
    }
  })

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = parseInt(session.user.id)

  const { uuid } = await params
  const json = await request.json().catch(() => ({}))
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid request', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const feed = await db.query.podcastFeeds.findFirst({
    where: and(eq(podcastFeeds.uuid, uuid), eq(podcastFeeds.isDeleted, false)),
    columns: { id: true, companyId: true },
  })
  if (!feed) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const allowed = await getUserCompanyIds(userId, 'collaborator')
  if (!allowed.includes(feed.companyId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const data = parsed.data
  await db
    .update(podcastFeeds)
    .set({
      notifyEmail: data.notifyEmail,
      notifyEmailTo: data.notifyEmailTo?.trim() || null,
      notifySms: data.notifySms,
      notifySmsPhone: data.notifySms ? data.notifySmsPhone?.trim() || null : null,
      notifyInApp: data.notifyInApp,
      notifySlack: data.notifySlack,
      notifySlackWebhookUrl: data.notifySlack ? data.notifySlackWebhookUrl?.trim() || null : null,
      notificationsSavedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(podcastFeeds.id, feed.id))

  return NextResponse.json({ ok: true })
}
