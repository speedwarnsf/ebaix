# 🚀 GO LIVE CHECKLIST

## Prerequisites
- ✅ All code committed and pushed to GitHub
- ✅ Stripe live keys configured (in `frontend/.env.local`)
- ✅ Owner access backdoor added (speedwarnsf@gmail.com has unlimited credits)

---

## Step 1: Set Up Vercel Environment Variables

Go to: **Vercel Dashboard → Your Project → Settings → Environment Variables**

Add these variables:

```bash
# Required - Get from your Supabase project
REACT_APP_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_anon_key_here

# Required - From frontend/.env.local
REACT_APP_STRIPE_PUBLIC_KEY=pk_live_51Rt0uYKjTATVIGPi...
```

**Where to find Supabase credentials:**
1. Go to Supabase Dashboard → Project Settings → API
2. Copy "Project URL" → REACT_APP_SUPABASE_URL
3. Copy "anon public" key → REACT_APP_SUPABASE_ANON_KEY

---

## Step 2: Deploy Supabase Edge Functions

**Option A: If you have Supabase CLI installed**
```bash
# Login to Supabase
supabase login

# Link your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy functions
supabase functions deploy process-listing
supabase functions deploy create-checkout-session
```

**Option B: Via Supabase Dashboard (Manual)**
1. Go to Supabase Dashboard → Edge Functions
2. Create new function: `process-listing`
   - Copy code from `supabase/functions/process-listing/index.ts`
3. Create new function: `create-checkout-session`
   - Copy code from `supabase/functions/create-checkout-session/index.ts`

---

## Step 3: Set Supabase Secrets

Go to: **Supabase Dashboard → Project Settings → Edge Functions → Secrets**

Add these secrets:

```bash
GEMINI_API_KEY=AIzaSyCqc4v-3iqtaJ02JF_gDdo0Kw5V2bVJ_lE
STRIPE_SECRET_KEY=sk_live_51Rt0uYKjTATVIGPi...
```

(Get Stripe secret key from `frontend/.env.local`)

---

## Step 4: Create Stripe Products

Go to: **Stripe Dashboard → Products**

Create 4 products with these exact details:

### 1. 10 Listings ($4)
- Name: `10 eBai Listings`
- Price: $4.00 USD (one-time)
- **Product ID must be:** `prod_ebai_10`

### 2. 50 Listings ($6) - BEST VALUE
- Name: `50 eBai Listings`
- Price: $6.00 USD (one-time)
- **Product ID must be:** `prod_ebai_50`

### 3. 100 Listings ($12) - MOST POPULAR
- Name: `100 eBai Listings`
- Price: $12.00 USD (one-time)
- **Product ID must be:** `prod_ebai_100`

### 4. Subscription ($14.99/month)
- Name: `200 eBai Listings Per Month`
- Price: $14.99 USD (recurring monthly)
- **Product ID must be:** `prod_ebai_subscription`

---

## Step 5: Deploy to Vercel

**Automatic Deployment (Recommended):**
```bash
git push origin claude/review-handoff-doc-011CUNsaSm52Spq4tDnYa1rx
```

Vercel will automatically detect the push and deploy.

**Manual Deployment:**
1. Go to Vercel Dashboard
2. Click "Deploy" or "Redeploy"
3. Wait for build to complete

---

## Step 6: Test Everything

### Test Owner Access:
1. Register/login with: `speedwarnsf@gmail.com`
2. Verify you see "OWNER ACCESS" badge
3. Verify credits show as "∞"
4. Use Photo Enhancer - credits should NOT decrease
5. Use Text Assistant - credits should NOT decrease

### Test Regular User:
1. Register with a different email
2. Verify credits start at 50
3. Use Photo Enhancer - credits decrease to 49
4. Use Text Assistant - credits decrease to 48

### Test Stripe Payments:
1. Click "Buy More Credits"
2. Select a bundle
3. Complete checkout (use test card: 4242 4242 4242 4242)
4. Verify redirect back to app

---

## Troubleshooting

### "SUPABASE_URL not found"
- Double-check environment variables in Vercel
- Make sure you redeployed after adding them

### "STRIPE_SECRET_KEY not configured"
- Check Supabase secrets are set correctly
- Redeploy Edge Functions after adding secrets

### "Image enhancement failed"
- Verify GEMINI_API_KEY is set in Supabase
- Check Gemini API quota/limits

### Stripe checkout not working
- Verify product IDs match exactly in Stripe Dashboard
- Check REACT_APP_STRIPE_PUBLIC_KEY in Vercel

---

## Post-Launch

### Monitor:
- Vercel deployment logs
- Supabase Edge Function logs
- Stripe Dashboard for payments

### Next Steps:
- Set up Stripe webhooks for automatic credit fulfillment
- Add email notifications
- Create admin dashboard
- Add analytics tracking

---

## Quick Reference

**Owner Emails (Unlimited Access):**
- speedwarnsf@gmail.com
- admin@ebai.me
- test@ebai.me

**Live URLs:**
- Frontend: `https://your-app.vercel.app`
- Supabase Functions: `https://YOUR-PROJECT.supabase.co/functions/v1/`

**Important Files:**
- Environment: `frontend/.env.local` (NOT committed)
- Deployment Guide: `DEPLOYMENT.md`
- This Guide: `GO_LIVE.md`

---

## Support

If something doesn't work:
1. Check Vercel build logs
2. Check Supabase Edge Function logs
3. Check browser console for errors
4. Review `DEPLOYMENT.md` for detailed setup

**Ready to go live? Let's do this! 🚀**
