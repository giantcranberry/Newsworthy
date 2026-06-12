const SALES_NEXUS_API_URL = 'https://api.salesnex.us/api/v1'

// Multi-select "Accounts" option that registered users belong to.
const NEWSWORTHY_ACCOUNT = 'Newsworthy.ai'

/**
 * Create a contact in SalesNexus CRM for a newly registered user.
 *
 * Custom field keys map to the field `name` (not label) configured in SalesNexus:
 *   - partner              (text)         -> referring partner's name
 *   - RegisteredUserSince  (date, ISO)    -> registration date (YYYY-MM-DD)
 *   - Accounts             (multi-select) -> "Newsworthy.ai"
 *
 * Non-blocking: failures are logged and swallowed so they never break signup.
 */
export async function addContactToSalesNexus({
  email,
  firstName,
  lastName,
  partner,
}: {
  email: string
  firstName?: string
  lastName?: string
  partner?: string
}) {
  const apiKey = process.env.SALES_NEXUS_API_KEY
  if (!apiKey) {
    console.warn('[SalesNexus] SALES_NEXUS_API_KEY not set, skipping CRM sync')
    return
  }

  try {
    const customFields: Record<string, string> = {
      RegisteredUserSince: new Date().toISOString().slice(0, 10),
      Accounts: NEWSWORTHY_ACCOUNT,
    }
    if (partner) customFields.partner = partner

    const body: Record<string, any> = {
      email,
      customFields,
    }
    if (firstName) body.firstName = firstName
    if (lastName) body.lastName = lastName

    const response = await fetch(`${SALES_NEXUS_API_URL}/contacts`, {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[SalesNexus] Failed to add contact:', response.status, error)
      return
    }

    const data = await response.json()
    console.log('[SalesNexus] Contact created:', email, data.id)
    return data
  } catch (error) {
    console.error('[SalesNexus] Error adding contact:', error)
  }
}
