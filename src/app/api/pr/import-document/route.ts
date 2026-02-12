import { getEffectiveSession } from '@/lib/auth'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import mammoth from 'mammoth'

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

interface ImportResult {
  title: string
  abstract: string
  pullquote: string
  location: string
  body: string
  suggestedCategoryId: number | null
  suggestedRegionIds: number[]
}

async function fetchGoogleDoc(url: string): Promise<string> {
  // Extract document ID from various Google Docs URL formats
  const patterns = [
    /\/document\/d\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
    /^([a-zA-Z0-9_-]+)$/,
  ]

  let docId: string | null = null
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      docId = match[1]
      break
    }
  }

  if (!docId) {
    throw new Error('Could not extract Google Docs ID from URL')
  }

  // Fetch as HTML to preserve formatting (document must be publicly shared)
  const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=html`

  const response = await fetch(exportUrl)

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Document not found. Make sure the document is publicly shared.')
    }
    throw new Error(`Failed to fetch document: ${response.statusText}`)
  }

  const html = await response.text()

  // Extract just the body content and clean up Google's HTML
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  if (bodyMatch) {
    let content = bodyMatch[1]
    // Remove Google Docs specific styles and classes but keep formatting tags
    content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    content = content.replace(/ class="[^"]*"/gi, '')
    content = content.replace(/ style="[^"]*"/gi, '')
    content = content.replace(/ id="[^"]*"/gi, '')
    // Clean up empty spans
    content = content.replace(/<span>\s*<\/span>/gi, '')
    content = content.replace(/<span>([^<]*)<\/span>/gi, '$1')
    return content
  }

  return html
}

async function parseWordDocument(buffer: Buffer): Promise<string> {
  // Convert to HTML to preserve formatting (bold, italics, links, etc.)
  const result = await mammoth.convertToHtml({ buffer }, {
    styleMap: [
      "p[style-name='Heading 1'] => h1:fresh",
      "p[style-name='Heading 2'] => h2:fresh",
      "p[style-name='Heading 3'] => h3:fresh",
      "b => strong",
      "i => em",
      "u => u",
    ]
  })
  return result.value
}

async function analyzeWithAI(
  content: string,
  categories: Category[],
  regions: Region[]
): Promise<ImportResult> {
  const categoryList = categories.map(c => `${c.id}: ${c.name}`).join('\n')
  const regionList = regions.map(r => `${r.id}: ${r.name}, ${r.state}`).join('\n')

  const prompt = `You are an expert press release editor. Analyze the following document (which may contain HTML formatting) and extract information to create a professional press release.

DOCUMENT CONTENT (may include HTML):
${content.substring(0, 15000)}

AVAILABLE CATEGORIES:
${categoryList}

AVAILABLE REGIONS:
${regionList}

Please extract and generate the following:

1. **Title/Headline**: Create a compelling, SEO-friendly headline (max 120 characters). Use Title Case. Return as plain text, not HTML.

2. **Abstract/Summary**: Write a 2-3 sentence summary that captures the key news (max 350 characters). Return as plain text, not HTML.

3. **Pull Quote**: Extract or create a notable, quotable statement from the content (max 350 characters). Return as plain text, not HTML.

4. **Location/Dateline**: Identify the city and state/country where the news originates (e.g., "New York, NY" or "London, UK"). Return as plain text.

5. **Body Content**: This is the main press release body. IMPORTANT:
   - Preserve ALL formatting from the original document including: <strong>/<b> for bold, <em>/<i> for italics, <u> for underline, <a href="..."> for hyperlinks, <h2>/<h3> for section headings
   - Wrap paragraphs in <p> tags
   - Keep all hyperlinks intact with their original URLs
   - Remove any title/headline that would duplicate the extracted title
   - Clean up any messy HTML but preserve semantic formatting
   - The output must be valid HTML suitable for a TinyMCE editor

6. **Category**: Select the single most appropriate category ID from the list above.

7. **Regions**: Select up to 3 most relevant region IDs from the list above based on the geographic focus of the news.

Respond with valid JSON in this exact format:
{
  "title": "The headline here",
  "abstract": "The summary here",
  "pullquote": "The notable quote here",
  "location": "City, State",
  "body": "<p>Formatted HTML content with <strong>bold</strong>, <em>italics</em>, <a href='url'>links</a> preserved...</p>",
  "suggestedCategoryId": 123,
  "suggestedRegionIds": [1, 2, 3]
}`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are an expert press release editor. Always respond with valid JSON.',
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
    const contentType = request.headers.get('content-type') || ''
    let documentContent: string
    let categories: Category[] = []
    let regions: Region[] = []

    if (contentType.includes('multipart/form-data')) {
      // Word document upload
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      const categoriesJson = formData.get('categories') as string | null
      const regionsJson = formData.get('regions') as string | null

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }

      const fileName = file.name.toLowerCase()
      if (!fileName.endsWith('.docx') && !fileName.endsWith('.doc')) {
        return NextResponse.json(
          { error: 'Only Word documents (.docx, .doc) are supported' },
          { status: 400 }
        )
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      documentContent = await parseWordDocument(buffer)

      if (categoriesJson) categories = JSON.parse(categoriesJson)
      if (regionsJson) regions = JSON.parse(regionsJson)
    } else {
      // JSON body with Google Docs URL
      const body = await request.json()
      const { url, categories: cats, regions: regs } = body

      if (!url) {
        return NextResponse.json({ error: 'No URL provided' }, { status: 400 })
      }

      documentContent = await fetchGoogleDoc(url)
      categories = cats || []
      regions = regs || []
    }

    if (!documentContent || documentContent.trim().length < 50) {
      return NextResponse.json(
        { error: 'Document appears to be empty or too short' },
        { status: 400 }
      )
    }

    // Analyze with AI
    const result = await analyzeWithAI(documentContent, categories, regions)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('[API] Error importing document:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to import document'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
