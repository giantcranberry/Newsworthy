import { getEffectiveSession } from '@/lib/auth'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { db } from '@/db'
import { releases, releaseAnalysis } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
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
    const formData = await request.json()
    const { title, abstract, body, pullquote, forceRefresh } = formData

    if (!title || !body) {
      return NextResponse.json(
        { error: 'Release must have a title and body' },
        { status: 400 }
      )
    }

    // Get the release to find the pr_id
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

    // Check for cached analysis (unless force refresh requested)
    if (!forceRefresh) {
      const cached = await db.query.releaseAnalysis.findFirst({
        where: eq(releaseAnalysis.prId, release.id),
      })

      if (cached?.analysis) {
        const analysis = cached.analysis as any
        return NextResponse.json({
          success: true,
          cached: true,
          cachedAt: cached.updatedAt || cached.createdAt,
          currentHeadline: title,
          suggestions: analysis.suggestions || [],
          brandableChunks: analysis.brandableChunks || [],
          suggestedPullquote: analysis.suggestedPullquote || null,
          suggestedAbstract: analysis.suggestedAbstract || null,
          copyImprovements: analysis.copyImprovements || [],
          seoScore: analysis.seoScore || null,
          seoScoreReason: analysis.seoScoreReason || null,
          aiGroundingScore: analysis.aiGroundingScore || null,
          aiGroundingScoreReason: analysis.aiGroundingScoreReason || null,
        })
      }
    }

    // Generate new analysis
    const plainBody = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

    const prompt = `You are an expert SEO and content optimization specialist for press releases. Analyze the following press release and provide:

1. 3 alternative headlines optimized for different SEO strategies
2. Analysis of the top 3 "brandable chunks" - content segments that search engines and AI systems will likely extract for RAG (Retrieval Augmented Generation) indexing
3. A suggested notable quote (pullquote) extracted or derived from the press release content
4. 3-5 specific copy improvement suggestions for the body content

CURRENT HEADLINE: ${title}

PRESS RELEASE CONTENT:
${abstract ? `Abstract: ${abstract}\n\n` : ''}${plainBody}

## PART 1: HEADLINE SUGGESTIONS

Provide exactly 3 alternative headlines, each optimized for a different SEO persona:

1. **Keyword-Focused**: Optimize for primary keywords and search intent
2. **Engagement-Driven**: Optimize for clicks, curiosity, and social sharing
3. **Authority-Building**: Optimize for credibility, expertise, and news value

For each suggestion, provide:
- The suggested headline (keep under 120 characters)
- A brief explanation of the SEO strategy used (1-2 sentences)

## PART 2: BRANDABLE CHUNKS ANALYSIS

Identify the top 3 content chunks that search engines and AI systems will likely extract and index. Consider:
- Semantic boundaries (complete thoughts/ideas)
- Typical chunk sizes (100-300 words)
- Information density and standalone value
- Brand mention placement within chunks

For each chunk:
- Extract the FULL chunk content (the complete text segment, typically 100-300 words)
- Rate its brandability (High/Medium/Low) based on whether your brand name/key message appears prominently
- Provide a specific recommendation to improve brand visibility within that chunk (e.g., move brand mention earlier, add key differentiator, restructure for better context)

## PART 3: SUGGESTED PULLQUOTE

Extract or craft a compelling notable quote from the press release content. The quote should be:
- 30-350 characters
- Quotable and memorable
- Capture the key message or most newsworthy statement
- Something a journalist might highlight

## PART 4: SUGGESTED ABSTRACT

If an abstract is not provided or is very short (under 50 characters), generate a compelling summary abstract for the press release. The abstract should be:
- Maximum 350 characters
- Capture the key news/announcement
- Be engaging and informative
- Work well in news readers and syndication feeds

## PART 5: COPY IMPROVEMENT SUGGESTIONS

Analyze the body content and provide 3-5 specific copy improvements. Look for:
- Passive voice that could be active voice
- Weak or vague language that could be more impactful
- Jargon or complex terms that could be simplified
- Missing context or clarity issues
- Opportunities to strengthen the narrative or add more punch
- Redundant phrases or filler words
- Sentences that bury the lead

For each suggestion:
- The "originalText" MUST be copied VERBATIM character-for-character from the press release content above. Do NOT paraphrase, reword, or summarize. Copy-paste the exact sentence or phrase. If you cannot find the exact text, skip that suggestion.
- Provide the improved/rewritten version
- Briefly explain why this change improves the copy (clarity, impact, SEO, readability, etc.)

## PART 6: OVERALL SCORES

Rate the press release on three dimensions, each scored 1-10:

1. **SEO Score**: How well-optimized is this press release for search engine discovery? Consider: keyword usage, headline effectiveness, meta-description quality (abstract), content structure, internal linking opportunities, readability, and search intent alignment.

2. **AI Training Score**: How useful is this press release as training data for AI models? Consider: factual density, clear attribution, structured data (dates, names, numbers), quotability, standalone comprehensibility, and absence of ambiguity or marketing fluff.

3. **AI Grounding Score**: How well-suited is this press release for RAG chunking and retrieval? Consider: semantic boundary clarity, information density per chunk, brand/entity mention placement, standalone value of content segments, and whether chunks would be useful context for AI-generated answers.

For each score, provide a 1-2 sentence justification.

IMPORTANT: Use the full 1-10 range for scores. Do NOT default to middle scores.
A score of 9-10 means exceptional quality. A score of 4-5 means average.
A score of 1-3 means significant issues. Base scores entirely on the actual content quality.

Format your response as JSON with this exact structure:
{
  "suggestions": [
    {
      "headline": "The suggested headline text",
      "strategy": "Keyword-Focused",
      "explanation": "Why this headline works for SEO"
    }
  ],
  "brandableChunks": [
    {
      "chunkContent": "The full text content of the identified chunk...",
      "brandability": "High",
      "currentIssue": "Brief description of current brand visibility issue",
      "recommendation": "Specific action to improve brand visibility in this chunk"
    }
  ],
  "suggestedPullquote": "The actual extracted or crafted quote text here",
  "suggestedAbstract": "A compelling 350-character max summary of the press release (only if abstract is missing or very short)",
  "copyImprovements": [
    {
      "originalText": "The exact original sentence or phrase from the content",
      "improvedText": "The rewritten/improved version",
      "reason": "Brief explanation of why this change improves the copy"
    }
  ],
  "seoScore": "<integer 1-10>",
  "seoScoreReason": "Brief justification for the SEO score",
  "aiTrainingScore": "<integer 1-10>",
  "aiTrainingScoreReason": "Brief justification for the AI Training score",
  "aiGroundingScore": "<integer 1-10>",
  "aiGroundingScoreReason": "Brief justification for the AI Grounding score"
}`

    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert SEO and PR headline specialist. Always respond with valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    const result = JSON.parse(content)

    // Save the analysis to the database
    const analysisData = {
      suggestions: result.suggestions || [],
      brandableChunks: result.brandableChunks || [],
      suggestedPullquote: result.suggestedPullquote || null,
      suggestedAbstract: result.suggestedAbstract || null,
      copyImprovements: result.copyImprovements || [],
      seoScore: result.seoScore || null,
      seoScoreReason: result.seoScoreReason || null,
      aiTrainingScore: result.aiTrainingScore || null,
      aiTrainingScoreReason: result.aiTrainingScoreReason || null,
      aiGroundingScore: result.aiGroundingScore || null,
      aiGroundingScoreReason: result.aiGroundingScoreReason || null,
      analyzedTitle: title,
      analyzedAt: new Date().toISOString(),
    }

    // Upsert the analysis
    await db
      .insert(releaseAnalysis)
      .values({
        prId: release.id,
        analysis: analysisData,
      })
      .onConflictDoUpdate({
        target: releaseAnalysis.prId,
        set: {
          analysis: analysisData,
          updatedAt: new Date(),
        },
      })

    return NextResponse.json({
      success: true,
      cached: false,
      currentHeadline: title,
      suggestions: result.suggestions,
      brandableChunks: result.brandableChunks || [],
      suggestedPullquote: result.suggestedPullquote || null,
      suggestedAbstract: result.suggestedAbstract || null,
      copyImprovements: result.copyImprovements || [],
      seoScore: result.seoScore || null,
      seoScoreReason: result.seoScoreReason || null,
      aiTrainingScore: result.aiTrainingScore || null,
      aiTrainingScoreReason: result.aiTrainingScoreReason || null,
      aiGroundingScore: result.aiGroundingScore || null,
      aiGroundingScoreReason: result.aiGroundingScoreReason || null,
    })
  } catch (error) {
    console.error('[API] Error generating AI suggestions:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate suggestions'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

// GET endpoint to retrieve cached analysis without regenerating
export async function GET(
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
    // Get the release
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

    // Check for cached analysis
    const cached = await db.query.releaseAnalysis.findFirst({
      where: eq(releaseAnalysis.prId, release.id),
    })

    if (!cached?.analysis) {
      return NextResponse.json({
        success: true,
        cached: false,
        hasAnalysis: false,
      })
    }

    const analysis = cached.analysis as any

    return NextResponse.json({
      success: true,
      cached: true,
      hasAnalysis: true,
      cachedAt: cached.updatedAt || cached.createdAt,
      currentHeadline: analysis.analyzedTitle || null,
      suggestions: analysis.suggestions || [],
      brandableChunks: analysis.brandableChunks || [],
      suggestedPullquote: analysis.suggestedPullquote || null,
      suggestedAbstract: analysis.suggestedAbstract || null,
      copyImprovements: analysis.copyImprovements || [],
      seoScore: analysis.seoScore || null,
      seoScoreReason: analysis.seoScoreReason || null,
      aiTrainingScore: analysis.aiTrainingScore || null,
      aiTrainingScoreReason: analysis.aiTrainingScoreReason || null,
      aiGroundingScore: analysis.aiGroundingScore || null,
      aiGroundingScoreReason: analysis.aiGroundingScoreReason || null,
    })
  } catch (error) {
    console.error('[API] Error fetching cached analysis:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch analysis'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
