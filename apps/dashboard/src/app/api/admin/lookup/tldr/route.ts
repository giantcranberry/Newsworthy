import { auth } from '@/lib/auth'
import { db } from '@/db'
import { releases } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
})

export async function POST(request: NextRequest) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  const isEditor = (session?.user as any)?.isEditor

  if (!isAdmin && !isEditor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { releaseId } = await request.json()

  if (!releaseId) {
    return NextResponse.json({ error: 'Release ID required' }, { status: 400 })
  }

  const release = await db.query.releases.findFirst({
    where: eq(releases.id, releaseId),
    columns: {
      title: true,
      abstract: true,
      body: true,
    },
    with: {
      company: {
        columns: { companyName: true },
      },
    },
  })

  if (!release) {
    return NextResponse.json({ error: 'Release not found' }, { status: 404 })
  }

  if (!release.body) {
    return NextResponse.json({ error: 'Release has no body content' }, { status: 400 })
  }

  const plainBody = release.body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a news editor writing in Axios Smart Brevity style. Generate exactly 4 TLDR bullet points for a press release. Each bullet must start with a bold label followed by a colon, then one concise sentence.

Use these labels (pick the 4 most relevant):
- What's new: The core announcement
- Why it matters: The significance or impact
- The big picture: Broader context or industry trend
- By the numbers: Key statistics or data points
- What's next: Future plans or timeline
- Yes, but: Caveats or challenges
- The bottom line: The key takeaway

Respond with valid JSON: { "bullets": [{ "label": "What's new", "text": "..." }, ...] }`,
        },
        {
          role: 'user',
          content: `Company: ${release.company?.companyName || 'Unknown'}
Title: ${release.title || 'Untitled'}
${release.abstract ? `Abstract: ${release.abstract}\n` : ''}
Body:
${plainBody.substring(0, 4000)}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 400,
      response_format: { type: 'json_object' },
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    const result = JSON.parse(content)
    return NextResponse.json({ bullets: result.bullets })
  } catch (error) {
    console.error('[API] Error generating TLDR:', error)
    return NextResponse.json({ error: 'Failed to generate TLDR' }, { status: 500 })
  }
}
