import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { company, crmContacts } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { enrichPerson, buildWebhookUrl } from '@/lib/apollo'
import { getCompanyAccess } from '@/lib/team-auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params
  const session = await getEffectiveSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)
  const isAdmin = !!(session?.user as any)?.isAdmin || !!(session?.user as any)?.isStaff
  const access = await getCompanyAccess(uuid, userId, isAdmin)

  if (!access) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  const co = access.company

  if (!process.env.APOLLO_API_KEY) {
    return NextResponse.json({ error: 'Apollo API is not configured' }, { status: 503 })
  }

  const body = await request.json()
  const { contactUuid } = body

  if (!contactUuid) {
    return NextResponse.json({ error: 'contactUuid is required' }, { status: 400 })
  }

  const contact = await db.query.crmContacts.findFirst({
    where: and(
      eq(crmContacts.uuid, contactUuid),
      eq(crmContacts.companyId, co.id),
      sql`${crmContacts.isDeleted} IS NOT TRUE`
    ),
  })

  if (!contact) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  if (!contact.email) {
    return NextResponse.json({ error: 'Contact must have an email to enrich' }, { status: 400 })
  }

  // Build webhook URL for async phone number delivery (requires public HTTPS)
  let webhookUrl: string | undefined
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  if (appUrl.startsWith('https://') && process.env.APOLLO_WEBHOOK_SECRET) {
    try {
      webhookUrl = buildWebhookUrl(contactUuid)
    } catch {
      console.warn('[Apollo] Failed to build webhook URL, skipping phone enrichment')
    }
  }

  try {
    const result = await enrichPerson({
      email: contact.email,
      firstName: contact.firstName || undefined,
      lastName: contact.lastName || undefined,
      organizationName: contact.publication || undefined,
      domain: contact.tld || undefined,
      linkedinUrl: contact.linkedin || undefined,
      revealPhoneNumber: !!webhookUrl,
      webhookUrl,
    })

    const person = result.person
    console.log('[Apollo] Response:', JSON.stringify(result, null, 2))
    if (!person) {
      // Store the response even if no match
      await db.update(crmContacts)
        .set({
          pdl: { apollo: result, enrichedAt: new Date().toISOString() },
          updatedAt: new Date(),
        })
        .where(eq(crmContacts.id, contact.id))

      return NextResponse.json({
        success: true,
        matched: false,
        message: 'No matching person found in Apollo',
        updated: [],
      })
    }

    // Build update set using fill-if-empty strategy
    const updates: Record<string, unknown> = {}
    const updatedFields: string[] = []

    if (!contact.firstName && person.first_name) {
      updates.firstName = person.first_name
      updatedFields.push('firstName')
    }
    if (!contact.lastName && person.last_name) {
      updates.lastName = person.last_name
      updatedFields.push('lastName')
    }
    if (updates.firstName || updates.lastName) {
      const fName = (updates.firstName as string) || contact.firstName
      const lName = (updates.lastName as string) || contact.lastName
      updates.fullName = [fName, lName].filter(Boolean).join(' ') || null
    }
    if (!contact.linkedin && person.linkedin_url) {
      updates.linkedin = person.linkedin_url
      updatedFields.push('linkedin')
    }
    if (!contact.twitter && person.twitter_url) {
      updates.twitter = person.twitter_url
      updatedFields.push('twitter')
    }
    if (!contact.facebook && person.facebook_url) {
      updates.facebook = person.facebook_url
      updatedFields.push('facebook')
    }
    if (!contact.publication && person.organization?.name) {
      updates.publication = person.organization.name
      updatedFields.push('publication')
    }
    if (!contact.tld && person.organization?.primary_domain) {
      updates.tld = person.organization.primary_domain
      updatedFields.push('tld')
    }

    // Always store full Apollo response
    updates.pdl = { apollo: result, enrichedAt: new Date().toISOString() }
    updates.updatedAt = new Date()

    await db.update(crmContacts)
      .set(updates)
      .where(eq(crmContacts.id, contact.id))

    // Build a map of field values that were set so the client can update form state
    const fieldValues: Record<string, string> = {}
    for (const field of updatedFields) {
      const val = updates[field]
      if (typeof val === 'string') fieldValues[field] = val
    }

    return NextResponse.json({
      success: true,
      matched: true,
      updated: updatedFields,
      fieldValues,
      title: person.title || null,
      headline: person.headline || null,
      company: person.organization?.name || null,
      phoneAsync: !!webhookUrl,
      message: updatedFields.length > 0
        ? `Updated ${updatedFields.length} field${updatedFields.length !== 1 ? 's' : ''}`
        : 'Contact matched but all fields already populated',
    })
  } catch (err) {
    console.error('[Apollo] Enrichment error:', err)
    const message = err instanceof Error ? err.message : 'Enrichment failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
