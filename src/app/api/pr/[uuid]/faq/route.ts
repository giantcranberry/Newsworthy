import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, releaseFaqs } from '@/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { NextResponse } from 'next/server'

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
    const release = await db.query.releases.findFirst({
      where: and(
        eq(releases.uuid, uuid),
        eq(releases.userId, userId)
      ),
    })

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    const faqs = await db.query.releaseFaqs.findMany({
      where: eq(releaseFaqs.prId, release.id),
      orderBy: [asc(releaseFaqs.sortOrder)],
    })

    return NextResponse.json({ faqs })
  } catch (error) {
    console.error('[API] Error fetching FAQs:', error)
    return NextResponse.json({ error: 'Failed to fetch FAQs' }, { status: 500 })
  }
}

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
    const release = await db.query.releases.findFirst({
      where: and(
        eq(releases.uuid, uuid),
        eq(releases.userId, userId)
      ),
    })

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    const body = await request.json()
    const { faqs } = body

    if (!Array.isArray(faqs)) {
      return NextResponse.json({ error: 'Invalid FAQs data' }, { status: 400 })
    }

    // Delete existing FAQs
    await db.delete(releaseFaqs)
      .where(eq(releaseFaqs.prId, release.id))

    // Insert new FAQs
    if (faqs.length > 0) {
      await db.insert(releaseFaqs).values(
        faqs.map((faq: { question: string; answer: string }, index: number) => ({
          prId: release.id,
          question: faq.question,
          answer: faq.answer,
          sortOrder: index,
        }))
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Error saving FAQs:', error)
    return NextResponse.json({ error: 'Failed to save FAQs' }, { status: 500 })
  }
}
