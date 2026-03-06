import { db } from '@/db'
import { crmContacts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookToken } from '@/lib/apollo'

interface ApolloWebhookPhone {
  raw_number?: string
  sanitized_number?: string
  status_cd?: string
  type_cd?: string
  confidence_cd?: string
  dnc_status_cd?: string
}

interface ApolloWebhookPerson {
  id?: string
  status?: string
  phone_numbers?: ApolloWebhookPhone[]
}

interface ApolloWebhookPayload {
  status?: string
  people?: ApolloWebhookPerson[]
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const contactUuid = searchParams.get('contact')
  const token = searchParams.get('token')

  if (!contactUuid || !token) {
    console.warn('[Apollo Webhook] Missing contact or token params')
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }

  if (!verifyWebhookToken(contactUuid, token)) {
    console.warn('[Apollo Webhook] Invalid token for contact:', contactUuid)
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  let payload: ApolloWebhookPayload
  try {
    payload = await request.json()
  } catch {
    console.error('[Apollo Webhook] Failed to parse JSON body')
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  console.log('[Apollo Webhook] Received for contact:', contactUuid, JSON.stringify(payload).slice(0, 200))

  // Extract phone numbers from the webhook payload
  const phones: string[] = []
  if (payload.people && Array.isArray(payload.people)) {
    for (const person of payload.people) {
      if (person.phone_numbers && Array.isArray(person.phone_numbers)) {
        for (const ph of person.phone_numbers) {
          const number = ph.sanitized_number || ph.raw_number
          if (number) phones.push(number)
        }
      }
    }
  }

  if (phones.length === 0) {
    console.log('[Apollo Webhook] No phone numbers in payload for contact:', contactUuid)
    return NextResponse.json({ received: true, updated: false })
  }

  const contact = await db.query.crmContacts.findFirst({
    where: eq(crmContacts.uuid, contactUuid),
  })

  if (!contact) {
    console.warn('[Apollo Webhook] Contact not found:', contactUuid)
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  // Determine which phone number to use (first valid one)
  const apolloPhone = phones[0]
  const existingPhone = contact.phone?.trim() || ''

  const updates: Record<string, unknown> = { updatedAt: new Date() }

  if (!existingPhone) {
    // No existing phone — set it
    updates.phone = apolloPhone
  } else if (!existingPhone.includes(apolloPhone) && apolloPhone !== existingPhone) {
    // Different phone — append if there's room (varchar 36)
    const combined = `${existingPhone}, ${apolloPhone}`
    if (combined.length <= 36) {
      updates.phone = combined
    }
    // If too long, the phone is still captured in pdl below
  }

  // Merge phone data into existing pdl
  const existingPdl = (contact.pdl as Record<string, unknown>) || {}
  updates.pdl = {
    ...existingPdl,
    apolloPhones: payload.people,
    phoneEnrichedAt: new Date().toISOString(),
  }

  await db.update(crmContacts)
    .set(updates)
    .where(eq(crmContacts.id, contact.id))

  console.log('[Apollo Webhook] Updated phone for contact:', contactUuid, apolloPhone)
  return NextResponse.json({ received: true, updated: true })
}
