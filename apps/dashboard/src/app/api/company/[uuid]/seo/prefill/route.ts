import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { company } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import OpenAI from 'openai'
import { getCompanyAccess, hasMinRole } from '@/lib/team-auth'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
})

async function fetchWebsiteContent(url: string): Promise<string> {
  try {
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`
    const response = await fetch(normalizedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsRamp/1.0)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) return ''

    const html = await response.text()
    // Strip tags, scripts, styles to get text content
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000)
  } catch {
    return ''
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

  // Accept optional website override from request body
  let body: { website?: string } = {}
  try {
    body = await request.json()
  } catch {
    // No body or invalid JSON is fine
  }

  const website = co.website || body.website
  if (!website) {
    return NextResponse.json({ error: 'No website URL set for this brand. Please add a website in the Edit Brand page or enter one above.' }, { status: 400 })
  }

  try {
    // Fetch the company website content
    const websiteContent = await fetchWebsiteContent(website)

    const prompt = `You are researching a company to fill in SEO and AI optimization fields.

Company name: ${co.companyName}
Website: ${website}
${co.city ? `City: ${co.city}` : ''}
${co.state ? `State: ${co.state}` : ''}
${co.countryCode ? `Country: ${co.countryCode}` : ''}

Website content (extracted text):
${websiteContent || '(Could not fetch website content)'}

Based on the website content and your knowledge, extract as much of the following as possible. Only include fields you are reasonably confident about. Leave fields empty ("") if you cannot determine them.

Return a JSON object with this exact structure:
{
  "meta": {
    "title": "Company Name | Newsroom",
    "description": "A 150-160 character meta description for the company's newsroom page"
  },
  "aio": {
    "preferredName": "The company's preferred/official name",
    "companySummary": "A 150-300 word summary of what the company does, its mission, products/services, and market position. Write in third person.",
    "keyFacts": {
      "foundedYear": "Year founded (e.g. 2015)",
      "hqLocation": "Headquarters city and state/country",
      "employeeCount": "Approximate employee count range (e.g. 50-100, 500+)",
      "industry": "Primary industry/sector",
      "stockTicker": "Stock ticker if publicly traded, empty otherwise"
    }
  },
  "person": {
    "name": "CEO/founder full name if found",
    "jobTitle": "Their official title (e.g. Chief Executive Officer)",
    "sameAs": ["LinkedIn URL if found"]
  }
}

Important:
- For companySummary, write a comprehensive, factual overview suitable for AI training data
- For meta description, optimize for search engines (150-160 chars)
- Only include person data if you can identify the CEO/founder with confidence
- Return ONLY valid JSON, no markdown or explanation`

    const completion = await openai.chat.completions.create({
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
    return NextResponse.json(result)
  } catch (error) {
    console.error('[API] Error in SEO AI prefill:', error)
    return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 })
  }
}
