import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY not configured')
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const body = await req.json()
    const { bundleType, userId, email, credits, priceInCents, isRecurring } = body

    console.log('Creating checkout session for:', { bundleType, userId, email, credits, priceInCents })

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: isRecurring ? 'subscription' : 'payment',
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: isRecurring
                ? '200 Listings/Month Subscription'
                : `${credits} eBai Credits`,
              description: isRecurring
                ? 'Recurring monthly subscription for 200 listing credits'
                : `One-time purchase of ${credits} listing credits`,
            },
            unit_amount: priceInCents,
            ...(isRecurring && {
              recurring: {
                interval: 'month',
                interval_count: 1,
              },
            }),
          },
          quantity: 1,
        },
      ],
      success_url: `${req.headers.get('origin')}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get('origin')}/`,
      metadata: {
        userId,
        bundleType,
        credits: credits.toString(),
        isRecurring: isRecurring ? 'true' : 'false',
      },
    })

    console.log('Checkout session created:', session.id)

    // Optionally store pending purchase in database
    const { error: dbError } = await supabaseClient
      .from('credit_purchases')
      .insert({
        user_id: userId,
        stripe_session_id: session.id,
        bundle_type: bundleType,
        credits: credits,
        price_cents: priceInCents,
        status: 'pending',
      })

    if (dbError) {
      console.warn('Failed to store purchase record:', dbError)
      // Don't fail the whole request - Stripe session is created
    }

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        url: session.url,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Stripe checkout error:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to create checkout session',
        details: error.toString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
