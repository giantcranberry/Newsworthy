const CRMWORTHY_API_URL = 'https://crmworthy.com/api/v1'
const CRMWORTHY_SOURCE_NAME = 'newsworthy.ai'

/**
 * Create a contact in CRMWorthy for a newly registered user.
 *
 * Non-blocking: failures are logged and swallowed so they never break signup.
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
}) {
  const apiKey = process.env.CRMWORTHY_API_KEY
  if (!apiKey) {
    console.warn('[CRMWorthy] CRMWORTHY_API_KEY not set, skipping CRM sync')
    return
  }

  try {
    const body: Record<string, string> = {
      email,
      sourceId,
      sourceName: CRMWORTHY_SOURCE_NAME,
      contactType: 'Registered User',
      workflowId: 'f9debead-6335-4d4f-933c-e0bfbfc72383',
    }
    if (firstName) body.firstName = firstName
    if (lastName) body.lastName = lastName
    if (partner) body.notes = `Partner: ${partner}`

    const response = await fetch(`${CRMWORTHY_API_URL}/contacts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[CRMWorthy] Failed to add contact:', response.status, error)
      return
    }

    const data = await response.json()
    console.log('[CRMWorthy] Contact created:', email, data.id)
    return data
  } catch (error) {
    console.error('[CRMWorthy] Error adding contact:', error)
  }
}

/**
 * Delete a CRMWorthy contact by Newsworthy source id (users.uuid).
 *
 * Non-blocking: failures are logged and swallowed so they never block user deletion.
 */
export async function deleteContactFromCrmWorthy(sourceId: string) {
  const apiKey = process.env.CRMWORTHY_API_KEY
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
