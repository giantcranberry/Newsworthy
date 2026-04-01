import OpenAI from 'openai'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_KEY })
}

export interface AdCopyInput {
  title: string
  abstract: string
  body: string
  companyName: string
  location?: string
}

export interface AdCopyOutput {
  headlines: Array<{ text: string }>
  descriptions: Array<{ text: string }>
  keywords: Array<{ text: string; matchType: 'BROAD' | 'PHRASE' | 'EXACT' }>
}

/**
 * Generate Google Ads copy from press release content using AI.
 * Produces headlines (max 30 chars), descriptions (max 90 chars), and keywords.
 */
export async function generateAdCopy(input: AdCopyInput): Promise<AdCopyOutput> {
  try {
    return await generateWithAI(input)
  } catch (error) {
    console.error('[AdCopy] AI generation failed, using template fallback:', error)
    return generateFallbackCopy(input)
  }
}

async function generateWithAI(input: AdCopyInput): Promise<AdCopyOutput> {
  const prompt = `Generate Google Search ad copy for promoting this press release as a news article.

PRESS RELEASE:
Title: ${input.title}
Company: ${input.companyName}
Location: ${input.location || 'N/A'}
Summary: ${input.abstract}

Body (first 1000 chars): ${input.body?.substring(0, 1000) || ''}

REQUIREMENTS:
1. Generate exactly 5 headlines. Each MUST be 30 characters or fewer. These are for Google Responsive Search Ads.
   - Make them newsworthy and attention-grabbing
   - Include the company name in at least one headline
   - Use action words and news-style phrasing
   - Do NOT use quotes or special characters

2. Generate exactly 3 descriptions. Each MUST be 90 characters or fewer.
   - Expand on the news angle
   - Include a call to action like "Read more" or "Learn more"
   - Highlight the most newsworthy aspect

3. Generate 5-10 relevant search keywords that people might use to find this news.
   - Mix of broad, phrase, and exact match types
   - Include company name variations
   - Include industry/topic terms
   - Include location-specific terms if relevant

CRITICAL: Character limits are strict. Headlines over 30 chars or descriptions over 90 chars will be rejected by Google.

Respond with valid JSON:
{
  "headlines": [{"text": "string max 30 chars"}],
  "descriptions": [{"text": "string max 90 chars"}],
  "keywords": [{"text": "keyword phrase", "matchType": "BROAD|PHRASE|EXACT"}]
}`

  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are a Google Ads specialist. Generate ad copy that complies with Google Ads policies. Always respond with valid JSON. Never exceed character limits.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' },
  })

  const content = completion.choices[0]?.message?.content
  if (!content) throw new Error('No response from AI')

  const result = JSON.parse(content) as AdCopyOutput

  // Validate and truncate character limits
  result.headlines = result.headlines
    .map(h => ({ text: h.text.substring(0, 30).trim() }))
    .slice(0, 15) // Google allows up to 15 headlines

  result.descriptions = result.descriptions
    .map(d => ({ text: d.text.substring(0, 90).trim() }))
    .slice(0, 4) // Google allows up to 4 descriptions

  result.keywords = result.keywords
    .filter(k => k.text && k.matchType)
    .map(k => ({
      text: k.text,
      matchType: (['BROAD', 'PHRASE', 'EXACT'].includes(k.matchType) ? k.matchType : 'BROAD') as 'BROAD' | 'PHRASE' | 'EXACT',
    }))
    .slice(0, 20)

  // Ensure minimums
  if (result.headlines.length < 3) throw new Error('Too few headlines generated')
  if (result.descriptions.length < 2) throw new Error('Too few descriptions generated')

  return result
}

/**
 * Template-based fallback when AI generation fails.
 */
function generateFallbackCopy(input: AdCopyInput): AdCopyOutput {
  const company = input.companyName.substring(0, 20)
  const titleWords = input.title.split(' ')

  // Build short headline variants from the title
  const headlines: Array<{ text: string }> = []

  // Headline 1: Company name + "News"
  headlines.push({ text: `${company} News`.substring(0, 30) })

  // Headline 2: First few words of title
  let h2 = ''
  for (const word of titleWords) {
    if ((h2 + ' ' + word).trim().length <= 30) {
      h2 = (h2 + ' ' + word).trim()
    } else break
  }
  if (h2) headlines.push({ text: h2 })

  // Headline 3: "Breaking: [company]"
  headlines.push({ text: `Breaking: ${company}`.substring(0, 30) })

  // Headline 4: "Read the Full Story"
  headlines.push({ text: 'Read the Full Story' })

  // Headline 5: "[Company] Announcement"
  headlines.push({ text: `${company} Announcement`.substring(0, 30) })

  // Descriptions from abstract
  const abstract = input.abstract || input.title
  const descriptions: Array<{ text: string }> = [
    { text: abstract.substring(0, 87) + (abstract.length > 87 ? '...' : '') },
    { text: `Read the latest news from ${company}. Learn more today!`.substring(0, 90) },
    { text: `${company} press release. Get the full story now.`.substring(0, 90) },
  ]

  // Keywords from title words and company name
  const keywords: Array<{ text: string; matchType: 'BROAD' | 'PHRASE' | 'EXACT' }> = [
    { text: input.companyName, matchType: 'EXACT' },
    { text: `${input.companyName} news`, matchType: 'PHRASE' },
    { text: input.title.substring(0, 80), matchType: 'BROAD' },
  ]

  // Add location keyword if available
  if (input.location) {
    keywords.push({ text: `${input.companyName} ${input.location}`, matchType: 'BROAD' })
  }

  // Add individual significant words from title as broad keywords
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'has', 'have', 'had', 'its', 'new'])
  for (const word of titleWords) {
    if (word.length > 3 && !stopWords.has(word.toLowerCase()) && keywords.length < 10) {
      keywords.push({ text: word.toLowerCase(), matchType: 'BROAD' })
    }
  }

  return { headlines, descriptions, keywords }
}
