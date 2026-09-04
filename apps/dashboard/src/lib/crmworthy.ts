const CRMWORTHY_API_URL = 'https://crmworthy.com/api/v1'
const CRMWORTHY_SOURCE_NAME = 'newsworthy.ai'
const CONTACT_WORKFLOW_ID = 'f9debead-6335-4d4f-933c-e0bfbfc72383'

function getApiKey() {
  // Prefer correct spelling; tolerate common typo CRMWROTHY_API_KEY
  const raw =
    process.env.CRMWORTHY_API_KEY || process.env.CRMWROTHY_API_KEY || ''
  // .env.local had a leading "-" typo (-crmw_…) which causes 401s
  return raw.trim().replace(/^-+/, '') || undefined
}

function authHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

/** CRMWorthy contact create returns `{ contact: { id } }` (not top-level id). */
function parseContactId(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const obj = data as Record<string, unknown>
  if (typeof obj.id === 'string') return obj.id
  const contact = obj.contact
  if (contact && typeof contact === 'object' && typeof (contact as any).id === 'string') {
    return (contact as { id: string }).id
  }
  return null
}

/**
 * Create or upsert a contact in CRMWorthy.
 * Returns CRMWorthy's contact.id (NOT users.uuid / sourceId).
 */
export async function addContactToCrmWorthy({
  email,
  firstName,
  lastName,
  partner,
  sourceId,
}: {
  email: string
  firstName?: string
  lastName?: string
  partner?: string
  sourceId: string
}): Promise<string | null> {
  const apiKey = getApiKey()
  if (!apiKey) {
    console.warn('[CRMWorthy] CRMWORTHY_API_KEY not set, skipping CRM sync')
    return null
  }

  try {
    const body: Record<string, string> = {
      email,
      sourceId,
      sourceName: CRMWORTHY_SOURCE_NAME,
      contactType: 'Registered User',
      workflowId: CONTACT_WORKFLOW_ID,
    }
    if (firstName) body.firstName = firstName
    if (lastName) body.lastName = lastName
    if (partner) body.notes = `Partner: ${partner}`

    const response = await fetch(`${CRMWORTHY_API_URL}/contacts`, {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: JSON.stringify(body),
    })

    const text = await response.text()
    let data: unknown = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      /* ignore */
    }

    if (!response.ok && response.status !== 409) {
      console.error('[CRMWorthy] Failed to add contact:', response.status, text)
      return null
    }

    const contactId = parseContactId(data)
    if (!contactId) {
      console.error('[CRMWorthy] Contact response missing id:', text.slice(0, 300))
      return null
    }

    console.log('[CRMWorthy] Contact upserted:', email, contactId)
    return contactId
  } catch (error) {
    console.error('[CRMWorthy] Error adding contact:', error)
    return null
  }
}

/**
 * Delete a CRMWorthy contact by Newsworthy source id (users.uuid).
 *
 * Non-blocking: failures are logged and swallowed so they never block user deletion.
 */
export async function deleteContactFromCrmWorthy(sourceId: string) {
  const apiKey = getApiKey()
  if (!apiKey) {
    console.warn('[CRMWorthy] CRMWORTHY_API_KEY not set, skipping CRM delete')
    return
  }
  if (!sourceId) {
    console.warn('[CRMWorthy] No sourceId provided, skipping CRM delete')
    return
  }

  try {
    const response = await fetch(`${CRMWORTHY_API_URL}/contacts`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sourceName: CRMWORTHY_SOURCE_NAME,
        sourceId,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[CRMWorthy] Failed to delete contact:', response.status, error)
      return
    }

    console.log('[CRMWorthy] Contact deleted:', sourceId)
  } catch (error) {
    console.error('[CRMWorthy] Error deleting contact:', error)
  }
}

function formatSpendDate(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Report a completed purchase to CRMWorthy spend tracking.
 *
 * Non-blocking: failures are logged and swallowed so they never break payment fulfillment.
 * sourceId must be users.uuid.
 */
export async function reportSpendToCrmWorthy({
  sourceId,
  amountCents,
  nomen,
  transactionId,
  date,
}: {
  sourceId: string
  amountCents: number
  nomen: string
  transactionId: string
  date?: Date | string
}) {
  const apiKey = getApiKey()
  if (!apiKey) {
    console.warn('[CRMWorthy] CRMWORTHY_API_KEY not set, skipping spend report')
    return
  }
  if (!sourceId) {
    console.warn('[CRMWorthy] No sourceId provided, skipping spend report')
    return
  }
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    console.warn('[CRMWorthy] Invalid amount, skipping spend report', amountCents)
    return
  }
  if (!transactionId) {
    console.warn('[CRMWorthy] No transactionId provided, skipping spend report')
    return
  }

  const amount = Math.round(amountCents) / 100
  const dateStr =
    typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : formatSpendDate(date instanceof Date ? date : new Date())

  try {
    const response = await fetch(`${CRMWORTHY_API_URL}/spend`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        date: dateStr,
        amount,
        nomen: (nomen || 'Purchase').slice(0, 500),
        sourceName: CRMWORTHY_SOURCE_NAME,
        sourceId,
        transactionId,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[CRMWorthy] Failed to report spend:', response.status, error)
      return
    }

    console.log('[CRMWorthy] Spend reported:', {
      sourceId,
      amount,
      transactionId,
    })
  } catch (error) {
    console.error('[CRMWorthy] Error reporting spend:', error)
  }
}

/**
 * Public news URL for a release (same shape as IndexNow / site).
 * Works before distribution as long as release_at + slug exist.
 */
export function buildCrmWorthyReleaseUrl(release: {
  id: number
  slug: string | null
  releaseAt: Date | string | null
}): string | null {
  if (!release.releaseAt || !release.slug) return null
  const d = new Date(release.releaseAt)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `https://www.newsworthy.ai/news/${y}${m}${day}${release.id}/${release.slug}`
}

/** Public clipping report URL (login-free). */
export function buildCrmWorthyReportingUrl(releaseUuid: string): string {
  return `https://app.newsworthyai.com/pr/clipsreport/${releaseUuid}`
}

/**
 * Notify CRMWorthy when a press release is approved.
 *
 * Identify the contact via sourceName + sourceId (users.uuid), per CRMWorthy API:
 * "Identify the contact by contactId, or sourceName + sourceId"
 */
export async function reportPressReleaseToCrmWorthy({
  releaseId,
  releaseUuid,
  slug,
  releaseAt,
  sourceId,
}: {
  releaseId: number
  releaseUuid: string
  slug: string | null
  releaseAt: Date | string | null
  /** users.uuid */
  sourceId: string
}) {
  const apiKey = getApiKey()
  if (!apiKey) {
    console.warn('[CRMWorthy] CRMWORTHY_API_KEY not set, skipping press-release sync')
    return
  }
  if (!sourceId) {
    console.warn('[CRMWorthy] Missing sourceId (users.uuid), skipping press-release sync')
    return
  }
  if (!releaseAt) {
    console.warn('[CRMWorthy] No releaseAt, skipping press-release sync', releaseId)
    return
  }

  const releaseUrl = buildCrmWorthyReleaseUrl({ id: releaseId, slug, releaseAt })
  if (!releaseUrl) {
    console.warn('[CRMWorthy] Could not build releaseUrl, skipping press-release sync', releaseId)
    return
  }

  const d = new Date(releaseAt)
  const releaseDate = formatSpendDate(d)
  const reportingUrl = buildCrmWorthyReportingUrl(releaseUuid)

  try {
    const response = await fetch(`${CRMWORTHY_API_URL}/press-releases`, {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: JSON.stringify({
        releaseId,
        releaseUrl,
        reportingUrl,
        releaseDate,
        sourceId,
        sourceName: CRMWORTHY_SOURCE_NAME,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[CRMWorthy] Failed to report press release:', response.status, error)
      return
    }

    console.log('[CRMWorthy] Press release reported:', {
      releaseId,
      sourceId,
      releaseUrl,
    })
  } catch (error) {
    console.error('[CRMWorthy] Error reporting press release:', error)
  }
}
