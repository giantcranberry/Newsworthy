import { db } from '@/db'
import { releases, releaseAnalysis, company } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import OpenAI from 'openai'
import type { Message, SkillResult, DataPart, TextPart } from '../types'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_KEY })
}

function parseUuid(message: Message): string {
  for (const part of message.parts) {
    if (part.type === 'text') {
      const uuidMatch = part.text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
      if (uuidMatch) return uuidMatch[0]
      // Try after command words
      const cmdMatch = part.text.match(/(?:analyze|analyse|review)\s+(?:release\s+)?(.+)/i)
      if (cmdMatch) return cmdMatch[1].trim()
      return part.text.trim()
    }
    if (part.type === 'data' && part.data.uuid) {
      return part.data.uuid as string
    }
  }
  return ''
}

interface AnalysisResult {
  seoScore: number
  readabilityScore: number
  fleschEase: number | null
  readTime: number | null
  keyEntities: string[]
  summary: string
  suggestedImprovements: string[]
}

export async function analyzeRelease(message: Message): Promise<SkillResult> {
  const uuid = parseUuid(message)

  if (!uuid) {
    return {
      artifacts: [{
        id: 'error',
        name: 'Error',
        parts: [{ type: 'text', text: 'Please provide a release UUID to analyze.' }],
      }],
    }
  }

  // Fetch the release
  const [release] = await db
    .select({
      id: releases.id,
      uuid: releases.uuid,
      title: releases.title,
      abstract: releases.abstract,
      body: releases.body,
      pullquote: releases.pullquote,
      location: releases.location,
      fleschEase: releases.fleschEase,
      readTime: releases.readTime,
      score: releases.score,
      companyName: company.companyName,
    })
    .from(releases)
    .innerJoin(company, eq(releases.companyId, company.id))
    .where(
      and(
        eq(releases.uuid, uuid),
        eq(releases.status, 'sent'),
        eq(releases.isDeleted, false),
      )
    )
    .limit(1)

  if (!release) {
    return {
      artifacts: [{
        id: 'error',
        name: 'Error',
        parts: [{ type: 'text', text: `No published release found for UUID "${uuid}".` }],
      }],
    }
  }

  // Check for cached analysis
  const [cached] = await db
    .select({ analysis: releaseAnalysis.analysis })
    .from(releaseAnalysis)
    .where(eq(releaseAnalysis.prId, release.id))
    .limit(1)

  let analysis: AnalysisResult

  if (cached?.analysis) {
    analysis = cached.analysis as unknown as AnalysisResult
  } else {
    // Generate analysis with OpenAI
    const prompt = `Analyze this press release and provide a structured assessment.

TITLE: ${release.title}
ABSTRACT: ${release.abstract || ''}
BODY: ${release.body || ''}
PULLQUOTE: ${release.pullquote || ''}
LOCATION: ${release.location || ''}
COMPANY: ${release.companyName}

Provide a JSON response with:
1. seoScore (0-100): How well optimized for search engines
2. readabilityScore (0-100): Overall readability assessment
3. keyEntities: Array of key people, organizations, products mentioned
4. summary: One-paragraph summary of the press release
5. suggestedImprovements: Array of specific improvement suggestions

Respond with valid JSON only.`

    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a press release analyst. Analyze press releases for quality, SEO, readability, and key entities. Respond with valid JSON only.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    })

    const responseContent = completion.choices[0]?.message?.content
    if (!responseContent) {
      throw new Error('No response from AI analysis')
    }

    const aiResult = JSON.parse(responseContent)

    analysis = {
      seoScore: aiResult.seoScore ?? 0,
      readabilityScore: aiResult.readabilityScore ?? 0,
      fleschEase: release.fleschEase,
      readTime: release.readTime,
      keyEntities: aiResult.keyEntities ?? [],
      summary: aiResult.summary ?? '',
      suggestedImprovements: aiResult.suggestedImprovements ?? [],
    }

    // Cache the analysis
    await db.insert(releaseAnalysis).values({
      prId: release.id,
      analysis: analysis as unknown as Record<string, unknown>,
    }).onConflictDoUpdate({
      target: releaseAnalysis.prId,
      set: {
        analysis: analysis as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      },
    })
  }

  const textPart: TextPart = {
    type: 'text',
    text: `Analysis of "${release.title}": SEO Score ${analysis.seoScore}/100, Readability ${analysis.readabilityScore}/100.`,
  }

  const dataPart: DataPart = {
    type: 'data',
    mimeType: 'application/json',
    data: analysis as unknown as Record<string, unknown>,
  }

  return {
    artifacts: [
      {
        id: 'analysis',
        name: `Analysis: ${release.title}`,
        parts: [textPart, dataPart],
      },
    ],
  }
}
