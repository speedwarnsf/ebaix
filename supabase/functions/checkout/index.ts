import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY not configured')
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const body = await req.json()
    const { bundleType, userId, email, credits, priceInCents, isRecurring } = body

    console.log('Creating checkout session:', { bundleType, userId, email, credits, priceInCents, isRecurring })

    // Define product names
    const productNames = {
      small: '10 nudio credits',
      medium: '50 nudio credits',
      large: '100 nudio credits',
      subscription: '200 nudios per month (no watermark)'
    }

    const productName = productNames[bundleType] || `${credits} nudio credits`
    const origin = req.headers.get('origin') ?? 'https://nudio.ai'
    const successParams = new URLSearchParams({
      success: 'true',
      bundle: bundleType ?? 'unknown',
      session_id: '{CHECKOUT_SESSION_ID}',
    }).toString()

    // Create checkout session parameters
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: productName,
              description: isRecurring
                ? 'Includes no watermark on all images'
                : `${credits} credits for photo enhancement and text generation`,
            },
            unit_amount: priceInCents,
            ...(isRecurring && {
              recurring: {
                interval: 'month',
              },
            }),
          },
          quantity: 1,
        },
      ],
      mode: isRecurring ? 'subscription' : 'payment',
      success_url: `${origin}/?${successParams}`,
      cancel_url: `${origin}/?canceled=true`,
      customer_email: email,
      metadata: {
        userId,
        bundleType,
        credits: credits.toString(),
        isRecurring: isRecurring ? 'true' : 'false',
      },
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    console.log('Checkout session created:', session.id)

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        url: session.url
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Checkout error:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to create checkout session',
        details: error.toString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
