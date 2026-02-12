import { pgTable, serial, varchar, text, boolean, timestamp, integer } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './users'
import { company } from './company'
import { releases } from './releases'
import { products } from './partners'

export const payment = pgTable('payment', {
  id: serial('id').primaryKey(),
  userId: integer('user_id'),
  stripeCustomer: varchar('stripe_customer', { length: 128 }),
  stripeIntent: varchar('stripe_intent', { length: 128 }),
  stripeSession: varchar('stripe_session', { length: 128 }).unique(),
  stripeProductName: varchar('stripe_product_name', { length: 35 }),
  createdAt: timestamp('created_at').defaultNow(),
  total: integer('total').default(0),
})

export const carts = pgTable('carts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  companyId: integer('company_id').references(() => company.id),
  prId: integer('pr_id').references(() => releases.id),
  productId: integer('product_id'),
  partnerId: integer('partner_id').notNull(),
  productCredits: integer('product_credits'),
  productType: varchar('product_type', { length: 12 }),
  cartUuid: varchar('cart_uuid', { length: 36 }).notNull(),
  stripePrice: varchar('stripe_price', { length: 64 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  paidAt: timestamp('paid_at'),
  isPr: boolean('is_pr').default(false),
  canceledAt: timestamp('canceled_at'),
  refundedAt: timestamp('refunded_at'),
  fulfilledAt: timestamp('fulfilled_at'),
  paymentIntent: varchar('payment_intent', { length: 128 }),
})

export const cartSessions = pgTable('cart_sessions', {
  id: serial('id').primaryKey(),
  sessionUuid: varchar('session_uuid', { length: 36 }).unique().notNull(),
  userId: integer('user_id').notNull().references(() => users.id),
  partnerId: integer('partner_id').notNull(),
  status: varchar('status', { length: 20 }).default('draft').notNull(),
  subtotal: integer('subtotal').default(0).notNull(),
  taxAmount: integer('tax_amount').default(0).notNull(),
  totalAmount: integer('total_amount').default(0).notNull(),
  stripeCustomerId: varchar('stripe_customer_id', { length: 128 }),
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 128 }),
  stripeClientSecret: varchar('stripe_client_secret', { length: 256 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  paymentAttemptedAt: timestamp('payment_attempted_at'),
  completedAt: timestamp('completed_at'),
  abandonedAt: timestamp('abandoned_at'),
})

export const cartItems = pgTable('cart_items', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id').notNull().references(() => cartSessions.id),
  productId: integer('product_id').notNull().references(() => products.id),
  productName: varchar('product_name', { length: 128 }).notNull(),
  productType: varchar('product_type', { length: 20 }).notNull(),
  productCredits: integer('product_credits'),
  unitPrice: integer('unit_price').notNull(),
  quantity: integer('quantity').default(1).notNull(),
  totalPrice: integer('total_price').notNull(),
  stripePriceId: varchar('stripe_price_id', { length: 128 }),
  addedAt: timestamp('added_at').defaultNow().notNull(),
  removedAt: timestamp('removed_at'),
})

export const cartTransactions = pgTable('cart_transactions', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id').notNull().references(() => cartSessions.id),
  transactionType: varchar('transaction_type', { length: 20 }).notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  amount: integer('amount').notNull(),
  currency: varchar('currency', { length: 3 }).default('usd').notNull(),
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 128 }),
  stripeChargeId: varchar('stripe_charge_id', { length: 128 }),
  stripeRefundId: varchar('stripe_refund_id', { length: 128 }),
  stripeReceiptUrl: varchar('stripe_receipt_url', { length: 512 }),
  errorCode: varchar('error_code', { length: 50 }),
  errorMessage: text('error_message'),
  customerEmail: varchar('customer_email', { length: 256 }),
  customerName: varchar('customer_name', { length: 256 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  processedAt: timestamp('processed_at'),
})

export const cartAbandonedReminders = pgTable('cart_abandoned_reminders', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id').notNull().references(() => cartSessions.id),
  reminderNumber: integer('reminder_number').notNull(),
  sentAt: timestamp('sent_at').defaultNow().notNull(),
  openedAt: timestamp('opened_at'),
  clickedAt: timestamp('clicked_at'),
  recoveredAt: timestamp('recovered_at'),
  emailSentTo: varchar('email_sent_to', { length: 256 }).notNull(),
  emailSubject: varchar('email_subject', { length: 256 }),
})

export const payfile = pgTable('payfile', {
  id: serial('id').primaryKey(),
  partnerId: integer('partner_id'),
  userId: integer('user_id'),
  cartUuid: varchar('cart_uuid', { length: 36 }),
  receiptUrl: varchar('receipt_url', { length: 256 }),
  stripeCustomer: varchar('stripe_customer', { length: 64 }),
  stripeIntent: varchar('stripe_intent', { length: 64 }),
  stripeCharge: varchar('stripe_charge', { length: 64 }),
  amount: integer('amount'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  settledAt: timestamp('settled_at'),
  paidVia: varchar('paid_via', { length: 12 }),
})

export const paymentLinks = pgTable('payment_links', {
  id: serial('id').primaryKey(),
  uuid: varchar('uuid', { length: 36 }).unique().notNull(),
  userId: integer('user_id'),
  productId: integer('product_id'),
  description: text('description'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
})

// Relations
export const cartSessionsRelations = relations(cartSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [cartSessions.userId],
    references: [users.id],
  }),
  items: many(cartItems),
  transactions: many(cartTransactions),
}))

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  session: one(cartSessions, {
    fields: [cartItems.sessionId],
    references: [cartSessions.id],
  }),
  product: one(products, {
    fields: [cartItems.productId],
    references: [products.id],
  }),
}))

export const cartTransactionsRelations = relations(cartTransactions, ({ one }) => ({
  session: one(cartSessions, {
    fields: [cartTransactions.sessionId],
    references: [cartSessions.id],
  }),
}))
