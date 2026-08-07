import { getEffectiveSession } from '@/lib/auth'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { db } from '@/db'
import { releases } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getUserCompanyIds } from '@/lib/team-auth'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_KEY })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { chunkContent, currentIssue, recommendation, companyName } =
      await request.json()

    if (!chunkContent || !recommendation) {
      return NextResponse.json(
        { error: 'chunkContent and recommendation are required' },
        { status: 400 }
      )
    }

    const release = await db.query.releases.findFirst({
      where: eq(releases.uuid, uuid),
    })

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    if (release.userId !== userId) {
      const companyIds = await getUserCompanyIds(userId)
      if (!companyIds.includes(release.companyId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const prompt = `You are an expert press release editor specializing in SEO and AI/RAG brandability.

Rewrite the following content chunk from a press release. Apply the recommendation while preserving factual accuracy, tone, and roughly the same length.

${companyName ? `BRAND NAME: ${companyName}\n` : ''}ISSUE: ${currentIssue || 'Brand visibility could be stronger in this segment.'}

RECOMMENDATION: ${recommendation}

ORIGINAL CHUNK:
"""
${chunkContent}
"""

Rules:
- Return ONLY the rewritten chunk text (plain text, no markdown fences, no commentary)
- Keep the same general meaning and facts
- Do not invent quotes, statistics, or claims not present in the original
- Preserve proper names and product names exactly
- The rewrite should be a drop-in replacement for the original chunk`

    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You rewrite press release segments for stronger brandability. Respond with only the rewritten plain text.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.5,
    })

    const rewritten = completion.choices[0]?.message?.content?.trim()
    if (!rewritten) {
      throw new Error('No rewrite returned from OpenAI')
    }

    // Strip accidental markdown fences if the model adds them
    const cleaned = rewritten
      .replace(/^```(?:\w+)?\n?/, '')
      .replace(/\n?```$/, '')
      .trim()

    return NextResponse.json({
      success: true,
      originalText: chunkContent,
      rewrittenText: cleaned,
    })
  } catch (error) {
    console.error('[API] Error rewriting chunk:', error)
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to rewrite section'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
