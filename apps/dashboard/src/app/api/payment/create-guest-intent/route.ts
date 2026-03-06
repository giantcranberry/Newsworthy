import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { paymentLinks } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getStripe } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, email } = body as { token: string; email: string }

    if (!token || !email) {
      return NextResponse.json({ error: 'Token and email are required' }, { status: 400 })
    }

    // Look up payment link
    const link = await db.query.paymentLinks.findFirst({
      where: eq(paymentLinks.token, token),
    })

    if (!link) {
      return NextResponse.json({ error: 'Invalid payment link' }, { status: 404 })
    }

    if (link.usedAt) {
      return NextResponse.json({ error: 'This payment link has already been used' }, { status: 400 })
    }

    if (link.expiresAt && new Date() > link.expiresAt) {
      return NextResponse.json({ error: 'This payment link has expired' }, { status: 400 })
    }

    // Save client email
    await db
      .update(paymentLinks)
      .set({ clientEmail: email })
      .where(eq(paymentLinks.id, link.id))

    // Create Stripe Payment Intent
    const stripe = await getStripe()

    const intent = await stripe.paymentIntents.create({
      amount: link.cartTotal,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      receipt_email: email,
      metadata: {
        payment_link_token: link.token,
        payment_link_id: link.id.toString(),
        user_id: link.userId.toString(),
        company_id: link.companyId.toString(),
        client_email: email,
      },
    })

    // Save payment intent ID
    await db
      .update(paymentLinks)
      .set({ paymentIntent: intent.id })
      .where(eq(paymentLinks.id, link.id))

    return NextResponse.json({ clientSecret: intent.client_secret })
  } catch (error) {
    console.error('Error creating guest payment intent:', error)
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 })
  }
}
