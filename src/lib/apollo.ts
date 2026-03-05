import { createHmac, timingSafeEqual } from 'crypto'

const APOLLO_API_URL = 'https://api.apollo.io/api/v1'

// --- Types ---

export interface ApolloEnrichParams {
  email?: string
  firstName?: string
  lastName?: string
  organizationName?: string
  domain?: string
  linkedinUrl?: string
  revealPhoneNumber?: boolean
  webhookUrl?: string
}

export interface ApolloPhoneNumber {
  raw_number: string
  sanitized_number: string
  status_cd?: string
  type_cd?: string
  confidence_cd?: string
  dnc_status_cd?: string
  position?: number
}

export interface ApolloOrganization {
  id?: string
  name?: string
  website_url?: string
  linkedin_url?: string
  twitter_url?: string
  industry?: string
  estimated_num_employees?: number
  founded_year?: number
  primary_domain?: string
  logo_url?: string
}

export interface ApolloEmployment {
  organization_name?: string
  title?: string
  start_date?: string
  end_date?: string | null
  current?: boolean
}

export interface ApolloPerson {
  id?: string
  first_name?: string
  last_name?: string
  name?: string
  title?: string
  headline?: string
  email?: string
  email_status?: string
  linkedin_url?: string
  twitter_url?: string
  facebook_url?: string
  github_url?: string
  photo_url?: string
  city?: string
  state?: string
  country?: string
  organization_id?: string
  organization?: ApolloOrganization
  employment_history?: ApolloEmployment[]
  departments?: string[]
  seniority?: string
  phone_numbers?: ApolloPhoneNumber[]
}

export interface ApolloEnrichResponse {
  person?: ApolloPerson | null
  waterfall?: {
    status?: string
    message?: string
  }
}

// --- Apollo API ---

export async function enrichPerson(params: ApolloEnrichParams): Promise<ApolloEnrichResponse> {
  const apiKey = process.env.APOLLO_API_KEY
  if (!apiKey) {
    throw new Error('APOLLO_API_KEY is not configured')
  }

  const body: Record<string, unknown> = {}
  if (params.email) body.email = params.email
  if (params.firstName) body.first_name = params.firstName
  if (params.lastName) body.last_name = params.lastName
  if (params.organizationName) body.organization_name = params.organizationName
  if (params.domain) body.domain = params.domain
  if (params.linkedinUrl) body.linkedin_url = params.linkedinUrl
  if (params.revealPhoneNumber) {
    body.reveal_phone_number = true
    if (params.webhookUrl) body.webhook_url = params.webhookUrl
  }

  const response = await fetch(`${APOLLO_API_URL}/people/match`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text()
    console.error('[Apollo] Enrichment failed:', response.status, text)
    let message = `Apollo API error: ${response.status}`
    try {
      const parsed = JSON.parse(text)
      if (parsed.error) message = parsed.error
    } catch {}
    throw new Error(message)
  }

  return response.json()
}

// --- Webhook Security ---

export function generateWebhookToken(contactUuid: string): string {
  const secret = process.env.APOLLO_WEBHOOK_SECRET
  if (!secret) throw new Error('APOLLO_WEBHOOK_SECRET is not configured')
  return createHmac('sha256', secret).update(contactUuid).digest('hex')
}

export function verifyWebhookToken(contactUuid: string, token: string): boolean {
  const secret = process.env.APOLLO_WEBHOOK_SECRET
  if (!secret) return false
  const expected = createHmac('sha256', secret).update(contactUuid).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(token))
  } catch {
    return false
  }
}

export function buildWebhookUrl(contactUuid: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.newsworthy.ai'
  const token = generateWebhookToken(contactUuid)
  return `${baseUrl}/api/webhooks/apollo?contact=${contactUuid}&token=${token}`
}
