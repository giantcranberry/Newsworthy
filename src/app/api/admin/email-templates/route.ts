import { auth } from '@/lib/auth'
import { db } from '@/db'
import { emailTemplates } from '@/db/schema'
import { asc } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!(session?.user as any)?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const templates = await db
    .select()
    .from(emailTemplates)
    .orderBy(asc(emailTemplates.name))

  return NextResponse.json(templates)
}
