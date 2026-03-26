import { auth } from '@/lib/auth'
import { db } from '@/db'
import { users, userProfiles, company, advocacyGroups, crmContacts } from '@/db/schema'
import { eq, and, sql, inArray } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { randomUUID, createHash } from 'crypto'
import { sendEmail } from '@/lib/email'

function getMd5(email: string) {
  return createHash('md5').update(email.toLowerCase()).digest('hex')
}

const DEFAULT_INVITE_MSG =
  'The purpose of this advocacy group is to help bring more attention to our press releases. As a member of this advocacy group, you will be notified via email when we distribute a new press release — with an invitation to share the news with your social networks.'

// GET: Return brands owned by admin users
export async function GET() {
  const session = await auth()
  if (!(session?.user as any)?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get all brands owned by admin users
  const adminBrands = await db
    .select({
      id: company.id,
      uuid: company.uuid,
      companyName: company.companyName,
      ownerEmail: users.email,
    })
    .from(company)
    .innerJoin(users, eq(company.userId, users.id))
    .where(and(
      eq(users.isAdmin, true),
      eq(company.isDeleted, false),
      eq(company.isArchived, false),
    ))
    .orderBy(company.companyName)

  return NextResponse.json({ brands: adminBrands })
}

// POST: Sync all users into a brand's Share List
export async function POST(request: Request) {
  const session = await auth()
  if (!(session?.user as any)?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { companyId } = await request.json()

  if (!companyId) {
    return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
  }

  // Verify the brand exists and is owned by an admin
  const [brand] = await db
    .select({
      id: company.id,
      uuid: company.uuid,
      companyName: company.companyName,
      userId: company.userId,
    })
    .from(company)
    .innerJoin(users, eq(company.userId, users.id))
    .where(and(
      eq(company.id, companyId),
      eq(users.isAdmin, true),
      eq(company.isDeleted, false),
    ))

  if (!brand) {
    return NextResponse.json({ error: 'Brand not found or not owned by admin' }, { status: 404 })
  }

  // Get or create advocacy group for this brand
  let group = await db.query.advocacyGroups.findFirst({
    where: eq(advocacyGroups.coId, brand.id),
  })

  if (!group) {
    const [newGroup] = await db.insert(advocacyGroups).values({
      uuid: randomUUID().replace(/-/g, ''),
      userId: brand.userId,
      coId: brand.id,
      groupName: brand.companyName,
      inviteMsg: DEFAULT_INVITE_MSG,
    }).returning()
    group = newGroup
  }

  // Get all active users with their profiles
  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: userProfiles.firstName,
      lastName: userProfiles.lastName,
    })
    .from(users)
    .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(eq(users.isDeleted, false))

  // Get existing advocates for this company (md5 + email lookup for dedup)
  const existingContacts = await db
    .select({ md5: crmContacts.md5, email: crmContacts.email, contactType: crmContacts.contactType, id: crmContacts.id })
    .from(crmContacts)
    .where(and(
      eq(crmContacts.companyId, brand.id),
      sql`${crmContacts.isDeleted} IS NOT TRUE`,
    ))

  const existingMd5Map = new Map(existingContacts.filter(c => c.md5).map(c => [c.md5, c]))
  const existingEmailMap = new Map(existingContacts.filter(c => c.email).map(c => [c.email!.toLowerCase(), c]))

  let added = 0
  let skipped = 0
  let emailsSent = 0
  let emailErrors = 0
  const newContacts: { email: string; firstName: string | null; lastName: string | null }[] = []

  for (const user of allUsers) {
    if (!user.email) {
      skipped++
      continue
    }

    const emailMd5 = getMd5(user.email)
    const existing = existingMd5Map.get(emailMd5) || existingEmailMap.get(user.email.toLowerCase())

    if (existing) {
      // If exists as 'media' only, upgrade to 'both'
      if (existing.contactType === 'media') {
        await db.update(crmContacts)
          .set({ contactType: 'both', updatedAt: new Date() })
          .where(eq(crmContacts.id, existing.id))
        added++
        newContacts.push({ email: user.email, firstName: user.firstName, lastName: user.lastName })
      } else {
        skipped++
      }
      continue
    }

    await db.insert(crmContacts).values({
      uuid: randomUUID().replace(/-/g, ''),
      userId: brand.userId,
      companyId: brand.id,
      contactType: 'advocate',
      email: user.email.toLowerCase(),
      md5: emailMd5,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      fullName: [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
      source: 'admin-sync',
    })

    added++
    newContacts.push({ email: user.email, firstName: user.firstName, lastName: user.lastName })
  }

  // Send welcome emails to newly added contacts
  const inviteMsg = group.inviteMsg || DEFAULT_INVITE_MSG
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.newsworthyai.com'

  for (const contact of newContacts) {
    try {
      const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'there'
      await sendEmail({
        to: contact.email,
        subject: `You've been added to the ${brand.companyName} Share List`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <p>Hi ${name},</p>
            <p>You have been added to the <strong>${brand.companyName}</strong> Share List on Newsworthy.ai.</p>
            <p style="color: #333; background: #f9f9f9; padding: 12px; border-radius: 6px;">${inviteMsg}</p>
            <p>Sincerely,<br/>${brand.companyName}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #999;">
              You can unsubscribe from this list at any time by clicking the unsubscribe link in future emails.
            </p>
          </div>
        `,
      })
      emailsSent++
    } catch (err) {
      console.error(`[SyncShareList] Failed to send welcome email to ${contact.email}:`, err)
      emailErrors++
    }
  }

  return NextResponse.json({
    success: true,
    added,
    skipped,
    emailsSent,
    emailErrors,
    total: allUsers.length,
  })
}
