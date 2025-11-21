import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

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
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!stripeKey || !webhookSecret || !supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables')
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Get the raw body and signature
    const body = await req.text()
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
      throw new Error('No stripe signature header')
    }

    // Verify the webhook signature
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return new Response(`Webhook Error: ${err.message}`, { status: 400 })
    }

    console.log('Received webhook event:', event.type, event.id)

    // Initialize Supabase client with service role key for admin access
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        console.log('Processing checkout.session.completed:', session.id)

        // Extract metadata from the session
        const { userId, credits, bundleType, isRecurring } = session.metadata || {}

        if (!userId || !credits) {
          console.error('Missing required metadata:', { userId, credits, bundleType })
          return new Response('Missing required metadata', { status: 400 })
        }

        const creditsToAdd = parseInt(credits)
        const isSubscription = isRecurring === 'true'

        console.log('Adding credits:', { userId, creditsToAdd, bundleType, isSubscription })

        // Add credits to user's account
        const { data: currentProfile, error: fetchError } = await supabase
          .from('profiles')
          .select('credits_balance')
          .eq('id', userId)
          .single()

        if (fetchError) {
          console.error('Error fetching user profile:', fetchError)
          return new Response('Error fetching user profile', { status: 500 })
        }

        const currentCredits = currentProfile?.credits_balance || 0
        const newCreditsBalance = currentCredits + creditsToAdd

        // Update the user's credits
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            credits_balance: newCreditsBalance,
            ...(isSubscription && { subscription_active: true })
          })
          .eq('id', userId)

        if (updateError) {
          console.error('Error updating user credits:', updateError)
          return new Response('Error updating user credits', { status: 500 })
        }

        // Log the transaction for record keeping
        const { error: logError } = await supabase
          .from('credit_transactions')
          .insert({
            user_id: userId,
            amount: creditsToAdd,
            transaction_type: 'purchase',
            bundle_type: bundleType,
            stripe_session_id: session.id,
            payment_intent_id: session.payment_intent,
            is_subscription: isSubscription
          })

        if (logError) {
          console.error('Error logging transaction:', logError)
          // Don't fail the webhook for logging errors
        }

        console.log(`Successfully added ${creditsToAdd} credits to user ${userId}. New balance: ${newCreditsBalance}`)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        console.log('Processing subscription cancellation:', subscription.id)

        // Find user by customer ID and deactivate subscription
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ subscription_active: false })
          .eq('stripe_customer_id', subscription.customer)

        if (updateError) {
          console.error('Error updating subscription status:', updateError)
        }

        console.log('Subscription deactivated for customer:', subscription.customer)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Webhook processing failed',
        details: error.toString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})