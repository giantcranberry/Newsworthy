import { auth } from '@/lib/auth'
import { db } from '@/db'
import { emailTemplates } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!(session?.user as any)?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { id } = await params
  const template = await db.query.emailTemplates.findFirst({
    where: eq(emailTemplates.id, parseInt(id, 10)),
  })

  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  return NextResponse.json(template)
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!(session?.user as any)?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const { name, subject, htmlBody, textBody, description } = body

  if (!name || !subject || !htmlBody) {
    return NextResponse.json(
      { error: 'Name, subject, and HTML body are required' },
      { status: 400 }
    )
  }

  const [updated] = await db
    .update(emailTemplates)
    .set({
      name,
      subject,
      htmlBody,
      textBody: textBody || null,
      description: description || null,
      updatedAt: new Date(),
    })
    .where(eq(emailTemplates.id, parseInt(id, 10)))
    .returning()

  if (!updated) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  return NextResponse.json(updated)
}
