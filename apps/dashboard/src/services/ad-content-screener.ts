import OpenAI from 'openai'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_KEY })
}

export interface AdScreeningResult {
  eligible: boolean
  reason: string | null
  categories: string[]
  screenedAt: string
}

export interface AdScreeningInput {
  title: string | null
  abstract: string | null
  body: string | null
}

const SYSTEM_PROMPT = `You are a Google Ads policy compliance screener. Your job is to determine whether a press release's content is eligible for Google Search Ads promotion.

All ads run under a single Google Ads account. A policy violation on ANY ad can trigger account-level review or suspension. Be conservative — flag anything risky.

PROHIBITED CATEGORIES (Google will disapprove or suspend):
- Regulated substances: cannabis, CBD, tobacco, vaping, kratom, nootropics marketed as drugs
- Weapons & explosives: firearms, ammunition, fireworks, tactical gear
- Adult content: sexually explicit/suggestive material, adult entertainment
- Gambling & betting: online casinos, sports betting, fantasy sports with entry fees, lottery
- Healthcare claims: unapproved treatments, miracle cures, weight loss supplements with guarantees
- Financial products: crypto trading platforms, payday loans, penny stocks, binary options, get-rich-quick
- Counterfeit & IP: knockoff brands, replica goods
- Hacking & surveillance: spyware, tracking tools, exploit kits
- Political ads: election campaigns, ballot measures, political advocacy
- Bail bonds

HIGH-RISK CATEGORIES (likely disapproved):
- Legal services (especially personal injury)
- Addiction treatment / rehab centers
- Cosmetic procedures (botox, fillers, plastic surgery)
- Dietary supplements with health claims
- Financial advisory / investment advice
- Real estate investment with "guaranteed returns"
- MLM / network marketing
- Funeral services

CONTENT ISSUES:
- Misleading claims ("world's best", "#1 rated", "guaranteed results")
- Clickbait language
- Unsubstantiated price claims

Respond with JSON only:
{
  "eligible": true/false,
  "reason": "Brief explanation if not eligible, null if eligible",
  "categories": ["list of flagged category names, empty if eligible"]
}`

/**
 * Screen press release content for Google Ads eligibility.
 * Uses GPT-4o-mini for fast, cheap screening (~$0.001 per call).
 * Fail-open: returns eligible on any error.
 */
export async function screenAdContent(input: AdScreeningInput): Promise<AdScreeningResult> {
  try {
    const title = input.title || ''
    const abstract = input.abstract || ''
    const body = (input.body || '').substring(0, 2000)

    const userPrompt = `Screen this press release for Google Ads eligibility:

TITLE: ${title}
SUMMARY: ${abstract}
BODY (truncated): ${body}`

    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    })

    const content = completion.choices[0]?.message?.content
    if (!content) throw new Error('No response from AI')

    const result = JSON.parse(content) as { eligible: boolean; reason: string | null; categories: string[] }

    return {
      eligible: result.eligible,
      reason: result.reason || null,
      categories: Array.isArray(result.categories) ? result.categories : [],
      screenedAt: new Date().toISOString(),
    }
  } catch (error) {
    console.error('[AdScreener] Screening failed, defaulting to eligible:', error)
    // Fail-open: don't block upgrades if screening fails
    return {
      eligible: true,
      reason: null,
      categories: [],
      screenedAt: new Date().toISOString(),
    }
  }
}
