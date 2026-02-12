import { getEffectiveSession } from '@/lib/auth'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
})

interface Category {
  id: number
  name: string
  slug: string
}

interface Region {
  id: number
  name: string
  state: string
}

interface DraftResult {
  title: string
  abstract: string
  pullquote: string
  location: string
  body: string
  suggestedCategoryId: number | null
  suggestedRegionIds: number[]
}

async function generateDraftWithAI(
  input: string,
  categories: Category[],
  regions: Region[],
  sourceUrl?: string,
  sourceContent?: string
): Promise<DraftResult> {
  const categoryList = categories.map(c => `${c.id}: ${c.name}`).join('\n')
  const regionList = regions.map(r => `${r.id}: ${r.name}, ${r.state}`).join('\n')

  let contentSection = ''
  if (sourceContent) {
    contentSection = `
SOURCE PAGE CONTENT (from ${sourceUrl}):
${sourceContent.substring(0, 10000)}

`
  }

  const userInputSection = input.trim()
    ? `USER'S ADDITIONAL INPUT/DETAILS:
${input}`
    : ''

  const prompt = `You are an expert press release writer. Based on the provided content, create a professional press release.

${contentSection}${userInputSection}

AVAILABLE CATEGORIES:
${categoryList}

AVAILABLE REGIONS:
${regionList}

Please generate a complete, professional press release with the following:

1. **Title/Headline**: Create a compelling, SEO-friendly headline (max 120 characters). Use Title Case. Make it newsworthy and attention-grabbing.

2. **Abstract/Summary**: Write a 2-3 sentence summary that captures the key news (max 350 characters). This should entice readers to read more.

3. **Pull Quote**: Create a notable, quotable statement. If the user provided a quote, use or refine it. If not, create an appropriate quote attributed to a company representative (max 350 characters).

4. **Location/Dateline**: Extract or infer the city and state/country where the news originates (e.g., "New York, NY" or "London, UK").

5. **Body Content**: Write the full press release body in HTML format:
   - Start with a strong opening paragraph that summarizes the news (the lede)
   - Include relevant details, context, and background
   - Incorporate the quote naturally within the body
   - Use proper HTML: <p> for paragraphs, <strong> for emphasis, <h3> for section headings if needed
   - Write in third person, professional news style
   - Aim for 300-500 words
   - End with a brief company description (boilerplate) if company info was provided

6. **Category**: Select the single most appropriate category ID from the list above.

7. **Regions**: Select up to 3 most relevant region IDs from the list above based on the geographic focus of the news.

Respond with valid JSON in this exact format:
{
  "title": "The headline here",
  "abstract": "The summary here",
  "pullquote": "The notable quote here",
  "location": "City, State",
  "body": "<p>Professional press release content in HTML...</p>",
  "suggestedCategoryId": 123,
  "suggestedRegionIds": [1, 2, 3]
}`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are an expert press release writer with years of experience in PR and journalism. Write in a professional, newsworthy style. Always respond with valid JSON.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' },
  })

  const responseContent = completion.choices[0]?.message?.content
  if (!responseContent) {
    throw new Error('No response from AI')
  }

  return JSON.parse(responseContent)
}

export async function POST(request: Request) {
  const session = await getEffectiveSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { input = '', sourceUrl, sourceContent, categories = [], regions = [] } = body

    // Require either meaningful input or source content
    const hasInput = input && typeof input === 'string' && input.trim().length >= 100
    const hasSource = sourceContent && typeof sourceContent === 'string' && sourceContent.trim().length > 0

    if (!hasInput && !hasSource) {
      return NextResponse.json(
        { error: 'Please provide at least 100 characters of information about your news, or a source URL' },
        { status: 400 }
      )
    }

    // Generate draft with AI
    const result = await generateDraftWithAI(input, categories, regions, sourceUrl, sourceContent)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('[API] Error generating draft:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate draft'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
