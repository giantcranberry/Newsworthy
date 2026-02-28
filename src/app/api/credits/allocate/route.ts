import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { brandCredits, company, companyMembers } from '@/db/schema'
import { eq, and, isNull, sql } from 'drizzle-orm'
import { createSystemMessage } from '@/lib/messages'

export async function POST(request: NextRequest) {
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)

  try {
    const body = await request.json()
    const { creditType, amount, companyId } = body as {
      creditType: string
      amount: number
      companyId: number
    }

    // Validate inputs
    if (!creditType || !amount || !companyId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['pr', 'yahoo', 'enhanced', 'concierge'].includes(creditType)) {
      return NextResponse.json({ error: 'Invalid credit type' }, { status: 400 })
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive integer' }, { status: 400 })
    }

    // Verify user has access to the target company (owner or team member)
    const isOwner = await db.query.company.findFirst({
      where: and(eq(company.id, companyId), eq(company.userId, userId), eq(company.isDeleted, false)),
    })

    const isMember = !isOwner
      ? await db
          .select({ companyId: companyMembers.companyId })
          .from(companyMembers)
          .where(and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, userId)))
          .then((rows) => rows.length > 0)
      : true

    if (!isMember) {
      return NextResponse.json({ error: 'No access to this brand' }, { status: 403 })
    }

    // Check available unallocated balance for this credit type
    // Map 'pr' to both 'pr' and 'credits' product types (matching sumCredits logic)
    const productTypeCondition =
      creditType === 'pr'
        ? sql`(${brandCredits.productType} = 'pr' OR ${brandCredits.productType} = 'credits' OR ${brandCredits.productType} IS NULL)`
        : sql`${brandCredits.productType} = ${creditType}`

    const [balanceRow] = await db
      .select({
        balance: sql<number>`COALESCE(SUM(${brandCredits.credits}), 0)`,
      })
      .from(brandCredits)
      .where(
        and(
          eq(brandCredits.userId, userId),
          isNull(brandCredits.companyId),
          productTypeCondition,
        ),
      )

    const available = Number(balanceRow?.balance || 0)
    if (amount > available) {
      return NextResponse.json(
        { error: `Insufficient credits. You have ${available} available.` },
        { status: 400 },
      )
    }

    // Get the company name for the notes
    const targetCompany = isOwner || await db.query.company.findFirst({
      where: eq(company.id, companyId),
    })
    const companyName = targetCompany?.companyName || `Brand #${companyId}`

    // Determine the productType to store
    const storedProductType = creditType === 'pr' ? 'pr' : creditType

    // Create two entries: debit from personal, credit to brand
    await db.insert(brandCredits).values([
      {
        userId,
        companyId: null,
        credits: -amount,
        productType: storedProductType,
        notes: `Allocated to ${companyName}`.slice(0, 48),
        createdAt: new Date(),
      },
      {
        userId,
        companyId,
        credits: amount,
        productType: storedProductType,
        notes: 'Allocated from account',
        createdAt: new Date(),
      },
    ])

    // Send system message notification
    try {
      const typeLabel = creditType === 'pr' ? 'PR' : creditType
      await createSystemMessage(
        userId,
        'Credits allocated',
        `${amount} ${typeLabel} credits allocated to ${companyName}.`
      )
    } catch (err) {
      console.error('Failed to create system message for credit allocation:', err)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error allocating credits:', error)
    return NextResponse.json({ error: 'Failed to allocate credits' }, { status: 500 })
  }
}
