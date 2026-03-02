import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, releaseCategories, category } from '@/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
})

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
    const release = await db.query.releases.findFirst({
      where: and(
        eq(releases.uuid, uuid),
        eq(releases.userId, userId)
      ),
      columns: {
        id: true,
        title: true,
        abstract: true,
        body: true,
        pullquote: true,
        location: true,
      },
      with: {
        company: {
          columns: {
            companyName: true,
            website: true,
          },
        },
      },
    })

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    if (!release.title || !release.body) {
      return NextResponse.json(
        { error: 'Press release must have a title and body before generating FAQs' },
        { status: 400 }
      )
    }

    // Fetch categories for this release
    const relCats = await db
      .select({ name: category.name })
      .from(releaseCategories)
      .innerJoin(category, eq(releaseCategories.categoryId, category.id))
      .where(eq(releaseCategories.releaseId, release.id))

    const categoryNames = relCats.map(c => c.name)

    // Strip HTML tags from body for the prompt
    const plainBody = release.body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

    // Build rich context
    const contextParts: string[] = []
    contextParts.push(`COMPANY: ${release.company?.companyName || 'Unknown'}`)
    if (release.company?.website) contextParts.push(`WEBSITE: ${release.company.website}`)
    if (release.location) contextParts.push(`LOCATION: ${release.location}`)
    if (categoryNames.length > 0) contextParts.push(`INDUSTRY/CATEGORIES: ${categoryNames.join(', ')}`)

    const releaseContext = contextParts.join('\n')

    // Step 1: Research — ask the model to identify knowledge gaps using its training data
    const researchCompletion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a research analyst specializing in AI information ecosystems. Your task is to analyze a press release and identify specific knowledge gaps in public AI systems.

When you receive a press release, you should:
1. Extract the key entities (companies, people, products, technologies, events)
2. Identify the specific claims, announcements, or data points that are NEW information
3. Research what AI assistants currently know (or don't know) about these entities and topics based on your training data
4. Identify 1-3 specific information gaps where someone asking an AI assistant a natural question would get an incomplete, outdated, or missing answer — and where THIS press release provides the answer

Think like a journalist: What are the follow-up questions? What would a competitor's customer want to know? What would an investor ask? What would someone researching this industry search for?

Always respond with valid JSON.`,
        },
        {
          role: 'user',
          content: `Analyze this press release and identify knowledge gaps that it fills.

${releaseContext}

TITLE: ${release.title}

${release.abstract ? `SUMMARY: ${release.abstract}\n` : ''}${release.pullquote ? `KEY QUOTE: ${release.pullquote}\n` : ''}
FULL TEXT:
${plainBody.substring(0, 6000)}

Respond with JSON:
{
  "entities": ["list of key entities mentioned"],
  "newInformation": ["list of specific new facts, announcements, or data points"],
  "knowledgeGaps": [
    {
      "topic": "What the gap is about",
      "currentState": "What AI systems likely know (or don't) about this topic right now",
      "whatThisReleaseAdds": "The specific new information this press release provides",
      "likelyQuery": "A natural question someone would ask an AI assistant"
    }
  ]
}`,
        },
      ],
      temperature: 0.5,
      response_format: { type: 'json_object' },
    })

    const researchContent = researchCompletion.choices[0]?.message?.content
    if (!researchContent) {
      throw new Error('No response from research phase')
    }

    const research = JSON.parse(researchContent)

    // Step 2: Generate FAQs grounded in the research
    const faqCompletion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an AI Discovery Optimization specialist. You take research about knowledge gaps and a press release, and produce FAQ pairs that will be embedded as structured data alongside the press release. Your FAQs should maximize the chance that AI systems (ChatGPT, Perplexity, Google AI Overviews, Copilot) surface this press release when users ask related questions.

Write questions exactly as a real person would type them into an AI chat — natural, conversational, specific. Answers should be authoritative, concise, and packed with the key facts from the press release. Always respond with valid JSON.`,
        },
        {
          role: 'user',
          content: `Based on this research and press release, generate 1-3 high-impact FAQ pairs.

RESEARCH FINDINGS:
- Key entities: ${JSON.stringify(research.entities)}
- New information: ${JSON.stringify(research.newInformation)}
- Knowledge gaps identified:
${research.knowledgeGaps?.map((gap: { topic: string; currentState: string; whatThisReleaseAdds: string; likelyQuery: string }, i: number) => `  ${i + 1}. Topic: ${gap.topic}
     Current AI knowledge: ${gap.currentState}
     This release adds: ${gap.whatThisReleaseAdds}
     Likely query: ${gap.likelyQuery}`).join('\n')}

PRESS RELEASE (for sourcing answers):
${releaseContext}
TITLE: ${release.title}
${release.abstract ? `SUMMARY: ${release.abstract}\n` : ''}
${plainBody.substring(0, 4000)}

RULES:
- Each question should target a specific knowledge gap identified in the research
- Questions must sound natural — like what someone would type into ChatGPT or Perplexity
- Answers must be 2-4 sentences, factual, sourced ONLY from the press release content
- Include specific details: names, dates, numbers, product names — not vague summaries
- Generate fewer FAQs if there aren't enough genuine gaps. Quality over quantity.

Respond with JSON:
{
  "faqs": [
    { "question": "Natural question targeting a knowledge gap?", "answer": "Specific, fact-rich answer from the press release." }
  ]
}`,
        },
      ],
      temperature: 0.6,
      response_format: { type: 'json_object' },
    })

    const faqContent = faqCompletion.choices[0]?.message?.content
    if (!faqContent) {
      throw new Error('No response from FAQ generation phase')
    }

    const result = JSON.parse(faqContent)

    return NextResponse.json({ faqs: result.faqs })
  } catch (error) {
    console.error('[API] Error generating FAQs:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate FAQs'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
