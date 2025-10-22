# eBai Deployment Guide

## Environment Variables

### Vercel Environment Variables

Go to Vercel Dashboard → Your Project → Settings → Environment Variables and add:

```bash
# Supabase
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key

# Stripe (Get from frontend/.env.local)
REACT_APP_STRIPE_PUBLIC_KEY=<YOUR_STRIPE_PUBLISHABLE_KEY>
```

### Supabase Secrets

Go to Supabase Dashboard → Project Settings → Edge Functions → Secrets and add:

```bash
# Gemini AI
GEMINI_API_KEY=AIzaSyCqc4v-3iqtaJ02JF_gDdo0Kw5V2bVJ_lE

# Stripe (Get from frontend/.env.local)
STRIPE_SECRET_KEY=<YOUR_STRIPE_SECRET_KEY>
```

## Deploy Edge Functions

Deploy both Supabase Edge Functions:

```bash
# Deploy image/text processing function
supabase functions deploy process-listing

# Deploy Stripe checkout function
supabase functions deploy create-checkout-session
```

## Stripe Products Setup

Create these products in your Stripe Dashboard (Dashboard → Products):

### One-Time Purchases (Payment Mode)

1. **10 Listings - $4.00**
   - Product ID: `prod_ebai_10`
   - Price: $4.00 USD
   - Type: One-time payment

2. **50 Listings - $6.00** (BEST VALUE)
   - Product ID: `prod_ebai_50`
   - Price: $6.00 USD
   - Type: One-time payment

3. **100 Listings - $12.00** (MOST POPULAR)
   - Product ID: `prod_ebai_100`
   - Price: $12.00 USD
   - Type: One-time payment

### Subscription (Subscription Mode)

4. **200 Listings/Month - $14.99**
   - Product ID: `prod_ebai_subscription`
   - Price: $14.99 USD
   - Billing: Monthly recurring

## Database Setup (Optional)

If you want to track purchases, create this table in Supabase SQL Editor:

```sql
CREATE TABLE credit_purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  stripe_session_id TEXT NOT NULL,
  bundle_type TEXT NOT NULL,
  credits INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX idx_credit_purchases_user_id ON credit_purchases(user_id);
CREATE INDEX idx_credit_purchases_session_id ON credit_purchases(stripe_session_id);
```

## Stripe Webhooks (Coming Soon)

To handle successful payments, you'll need to set up a Stripe webhook:

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-project.supabase.co/functions/v1/stripe-webhook`
3. Select events: `checkout.session.completed`, `invoice.payment_succeeded`
4. Copy the webhook signing secret
5. Add to Supabase secrets: `STRIPE_WEBHOOK_SECRET=whsec_...`

## Test the Integration

1. **Frontend**: Visit your app and click "Buy More Credits"
2. **Checkout**: Select a bundle and click "Purchase"
3. **Stripe**: You'll be redirected to Stripe Checkout
4. **Test Card**: Use `4242 4242 4242 4242` with any future date and any CVC

## Deployment Checklist

- [ ] Add all environment variables to Vercel
- [ ] Add all secrets to Supabase
- [ ] Deploy `process-listing` Edge Function
- [ ] Deploy `create-checkout-session` Edge Function
- [ ] Create Stripe products with correct IDs
- [ ] Create `credit_purchases` table (optional)
- [ ] Test checkout flow with test card
- [ ] Set up Stripe webhooks (optional)
- [ ] Push changes to GitHub
- [ ] Verify Vercel auto-deploy

## Important Notes

⚠️ **LIVE KEYS**: Your actual Stripe keys are stored in `frontend/.env.local` (not committed to git). Use those values when deploying.

🔒 **Security**: Never commit `.env.local` or any file with these keys to git.

✅ **Testing**: Use Stripe test mode first if you want to test without real charges.

📧 **Support**: If you need help, check the handoff document or contact the developer.
