import { NextRequest, NextResponse } from "next/server";
import { getEffectiveSession } from "@/lib/auth";
import { db } from "@/db";
import { cartSessions, cartItems, products } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";
import { v4 as uuidv4 } from "uuid";
import { getPostHog } from "@/lib/posthog";

export async function POST(request: NextRequest) {
  const stripe = await getStripe();
  const session = await getEffectiveSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = parseInt(session.user.id);
  const partnerId = (session.user as any).partnerId || 1;

  try {
    const body = await request.json();
    const { productIds } = body as { productIds: number[] };

    if (!productIds || productIds.length === 0) {
      return NextResponse.json(
        { error: "No products selected" },
        { status: 400 },
      );
    }

    // Get all selected products
    const selectedProducts = await db
      .select()
      .from(products)
      .where(
        and(
          inArray(products.id, productIds),
          eq(products.isActive, true),
          eq(products.isDeleted, false),
        ),
      );

    if (selectedProducts.length === 0) {
      return NextResponse.json(
        { error: "No valid products found" },
        { status: 404 },
      );
    }

    // Calculate totals
    const subtotal = selectedProducts.reduce(
      (sum, p) => sum + (p.price || 0),
      0,
    );

    // Create cart session
    const sessionUuid = uuidv4();
    const [cartSession] = await db
      .insert(cartSessions)
      .values({
        sessionUuid,
        userId,
        partnerId,
        status: "draft",
        subtotal,
        taxAmount: 0,
        totalAmount: subtotal,
      })
      .returning();

    // Add all items to cart
    await db.insert(cartItems).values(
      selectedProducts.map((product) => ({
        sessionId: cartSession.id,
        productId: product.id,
        productName: product.displayName || product.shortName || "Product",
        productType: product.productType || "credits",
        productCredits: product.productCredits,
        unitPrice: product.price || 0,
        quantity: 1,
        totalPrice: product.price || 0,
        stripePriceId: product.stripeLivePrice || product.stripeTestPrice,
      })),
    );

    // Create Stripe checkout session with all line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
      selectedProducts.map((product) => ({
        price_data: {
          currency: "usd",
          product_data: {
            name: product.displayName || product.shortName || "Product",
          },
          unit_amount: product.price || 0,
        },
        quantity: 1,
      }));

    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/paygo`,
      customer_email: session.user.email || undefined,
      metadata: {
        userId: userId.toString(),
        cartSessionId: cartSession.id.toString(),
        productIds: productIds.join(","),
      },
    });

    // Update cart session with Stripe info
    await db
      .update(cartSessions)
      .set({
        stripePaymentIntentId: checkoutSession.payment_intent as string,
        stripeClientSecret: undefined,
        paymentAttemptedAt: new Date(),
      })
      .where(eq(cartSessions.id, cartSession.id));

    getPostHog().capture({
      distinctId: String(userId),
      event: 'checkout_initiated',
      properties: {
        cart_session_id: cartSession.id,
        product_count: selectedProducts.length,
        product_ids: productIds,
        subtotal_cents: subtotal,
        partner_id: partnerId,
      },
    })

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    getPostHog().captureException(error, String(userId))
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
