import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import OpenAI from 'openai'
import { getCompanyAccess, hasMinRole } from '@/lib/team-auth'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_KEY })
}

function extractSocialLinks(html: string, baseUrl: string): Record<string, string> {
  const found: Record<string, string> = {}
  const hrefRegex = /href\s*=\s*["']([^"']+)["']/gi
  let match: RegExpExecArray | null

  const patterns: { key: string; test: (href: string) => boolean }[] = [
    { key: 'linkedinUrl', test: (h) => /linkedin\.com\/(company|in|school)\//i.test(h) },
    { key: 'xUrl', test: (h) => /(twitter\.com|x\.com)\//i.test(h) && !/\/share/i.test(h) },
    { key: 'facebookUrl', test: (h) => /facebook\.com\//i.test(h) && !/\/sharer/i.test(h) },
    { key: 'instagramUrl', test: (h) => /instagram\.com\//i.test(h) },
    { key: 'youtubeUrl', test: (h) => /(youtube\.com|youtu\.be)\//i.test(h) },
    { key: 'tiktokUrl', test: (h) => /tiktok\.com\/@/i.test(h) },
  ]

  while ((match = hrefRegex.exec(html)) !== null) {
    let href = match[1]
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue

    try {
      href = new URL(href, baseUrl).toString()
    } catch {
      continue
    }

    for (const { key, test } of patterns) {
      if (!found[key] && test(href)) {
        found[key] = href.split('?')[0]
      }
    }
  }

  return found
}

async function fetchWebsite(url: string): Promise<{ text: string; social: Record<string, string> }> {
  try {
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`
    const response = await fetch(normalizedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsRamp/1.0)',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    })

    if (!response.ok) return { text: '', social: {} }

    const html = await response.text()
    const social = extractSocialLinks(html, normalizedUrl)
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000)

    return { text, social }
  } catch {
    return { text: '', social: {} }
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params
  const session = await getEffectiveSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)
  const isAdmin = !!(session?.user as any)?.isAdmin || !!(session?.user as any)?.isStaff

  const access = await getCompanyAccess(uuid, userId, isAdmin)
  if (!access) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  if (!hasMinRole(access.role, 'brand_admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const co = access.company

  let body: { website?: string } = {}
  try {
    body = await request.json()
  } catch {
    // optional body
  }

  const website = body.website || co.website
  if (!website) {
    return NextResponse.json(
      {
        error:
          'No website URL set for this brand. Add a website on the brand profile, then try again.',
      },
      { status: 400 }
    )
  }

  try {
    const { text: websiteContent, social } = await fetchWebsite(website)

    const prompt = `You are helping set up a company newsroom page for a press release platform.

Company name: ${co.companyName}
Website: ${website}
${co.city ? `City: ${co.city}` : ''}
${co.state ? `State: ${co.state}` : ''}

Website content (extracted text):
${websiteContent || '(Could not fetch website content — use the company name and website domain.)'}

Social links already found on the site (prefer these when filling social fields):
${JSON.stringify(social, null, 2)}

Return a JSON object with this exact structure:
{
  "nrUri": "short-url-slug",
  "nrTitle": "Company Name Newsroom",
  "nrDesc": "<p>2-4 short HTML paragraphs describing the company for journalists and media visitors. Use only <p>, <strong>, <em>, <ul>, <li>, and <a href> tags. Factual, third person, no marketing fluff.</p>",
  "linkedinUrl": "",
  "xUrl": "",
  "facebookUrl": "",
  "instagramUrl": "",
  "youtubeUrl": "",
  "tiktokUrl": "",
  "blogUrl": "",
  "podcastFeedUrl": "",
  "website": "${website.startsWith('http') ? website : `https://${website}`}"
}

Rules:
- nrUri: 3-32 chars, lowercase letters/numbers/hyphens only, derived from the company name or domain (no "newsroom" suffix needed)
- nrTitle: under 128 characters, typically "{Company} Newsroom"
- nrDesc: valid HTML snippet, 100-350 words worth of content, suitable for a public newsroom About section
- Social URLs: only include if reasonably confident; otherwise ""
- blogUrl: company blog URL if clearly identifiable
- podcastFeedUrl: only a real RSS/podcast feed URL if found; otherwise ""
- Prefer the social links already found on the site when present
- Return ONLY valid JSON`

    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: 'AI returned no results' }, { status: 500 })
    }

    const result = JSON.parse(content)

    // Prefer scraped social links when AI left them blank
    for (const [key, value] of Object.entries(social)) {
      if (value && !result[key]) {
        result[key] = value
      }
    }

    if (result.nrUri) {
      result.nrUri = String(result.nrUri)
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .slice(0, 32)
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[API] Error in newsroom AI prefill:', error)
    return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 })
  }
}
