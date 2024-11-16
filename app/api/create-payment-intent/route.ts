import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { CartItem } from '@/lib/cart'
import { headers } from 'next/headers'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const MAX_RETRIES = 3
const RETRY_DELAY = 1000

async function validateCartItems(items: CartItem[], total: number) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Cart is empty')
  }

  const calculatedTotal = items.reduce((sum, item) => {
    if (!item?.template?.id || !item?.tier || !item?.quantity || !item?.price) {
      throw new Error('Invalid cart item structure')
    }
    if (item.quantity < 1) {
      throw new Error('Invalid quantity')
    }
    if (item.price <= 0) {
      throw new Error('Invalid price')
    }
    return sum + (item.price * item.quantity)
  }, 0)

  // Use a small epsilon for floating point comparison
  if (Math.abs(calculatedTotal - total) > 0.01) {
    throw new Error('Cart total mismatch')
  }

  return true
}

async function createPaymentWithRetry(
  amount: number,
  metadata: object,
  retries = MAX_RETRIES
): Promise<any> {
  try {
    return await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata,
    })
  } catch (error) {
    if (retries > 0 && error instanceof Error && error.message.includes('rate_limit')) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
      return createPaymentWithRetry(amount, metadata, retries - 1)
    }
    throw error
  }
}

export async function POST(request: Request) {
  const headersList = headers()
  const origin = headersList.get('origin')
  const requestId = crypto.randomUUID()

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('Stripe configuration missing')
    }

    const { items, amount } = await request.json()

    if (!items || !amount) {
      throw new Error('Missing required fields')
    }

    await validateCartItems(items, amount)

    const amountInCents = Math.round(amount * 100)

    if (amountInCents < 50) {
      throw new Error('Minimum order amount is $0.50')
    }

    const paymentIntent = await createPaymentWithRetry(
      amountInCents,
      {
        requestId,
        orderItems: JSON.stringify(
          items.map((item: CartItem) => ({
            templateId: item.template.id,
            tier: item.tier,
            quantity: item.quantity,
            price: item.price,
          }))
        ),
      }
    )

    if (!paymentIntent?.client_secret) {
      throw new Error('Payment intent creation failed')
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      amount: amountInCents,
    })
  } catch (error) {
    console.error('Payment initialization error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Payment initialization failed'
    const status = errorMessage.includes('Invalid') ? 400 : 500

    return NextResponse.json(
      { 
        error: errorMessage,
        requestId,
      },
      { status }
    )
  }
}