const FOLK_API_URL = 'https://api.folk.app/v1'
const LEADS_GROUP_ID = 'grp_f0e2d2c4-ab11-447f-82c0-ce0eda41e120'

export async function addPersonToFolk({
  email,
  firstName,
  lastName,
  company,
  channel = 'Website',
}: {
  email: string
  firstName?: string
  lastName?: string
  company?: string
  channel?: string
}) {
  const apiKey = process.env.FOLK_API_KEY
  if (!apiKey) {
    console.warn('[Folk] FOLK_API_KEY not set, skipping CRM sync')
    return
  }

  try {
    const body: Record<string, any> = {
      emails: [email],
      groups: [{ id: LEADS_GROUP_ID }],
      customFieldValues: {
        [LEADS_GROUP_ID]: {
          Channel: channel,
          Status: 'Lead',
        },
      },
    }

    if (firstName) body.firstName = firstName
    if (lastName) body.lastName = lastName
    if (company) body.companies = [{ name: company }]

    const response = await fetch(`${FOLK_API_URL}/people`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[Folk] Failed to add person:', response.status, error)
      return
    }

    const data = await response.json()
    console.log('[Folk] Person added to Leads:', email, data.id)
    return data
  } catch (error) {
    console.error('[Folk] Error adding person:', error)
  }
}
