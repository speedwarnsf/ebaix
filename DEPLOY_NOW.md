# 🚀 DEPLOY NOW - 3 Steps, 7 Minutes

**You're at:** All code ready, just need to configure 3 dashboards

---

## Step 1: Vercel (2 minutes)

**Go to:** https://vercel.com/dashboard → Your Project → Settings → Environment Variables

**Click "Add New"** and paste these **one at a time**:

### Variable 1:
```
Name: REACT_APP_SUPABASE_URL
Value: [YOUR SUPABASE URL - Get from Supabase Dashboard → Settings → API]
```

### Variable 2:
```
Name: REACT_APP_SUPABASE_ANON_KEY
Value: [YOUR SUPABASE ANON KEY - Get from Supabase Dashboard → Settings → API]
```

### Variable 3:
```
Name: REACT_APP_STRIPE_PUBLIC_KEY
Value: [Copy from frontend/.env.local - starts with pk_live_51Rt0uY...]
```

**Click "Save"** then **"Redeploy"**

---

## Step 2: Supabase (2 minutes)

### A. Add Secrets

**Go to:** https://supabase.com/dashboard → Your Project → Settings → Edge Functions → Secrets

**Click "Add Secret"** and paste these:

```
Secret 1:
Name: GEMINI_API_KEY
Value: [See HANDOFF_TO_DESKTOP_CLAUDE.md line 110]

Secret 2:
Name: STRIPE_SECRET_KEY
Value: [Copy from frontend/.env.local - starts with sk_live_51Rt0uY...]
```

### B. Deploy Functions (Manual)

**Go to:** https://supabase.com/dashboard → Your Project → Edge Functions

#### Function 1: process-listing
1. Click "Create New Function"
2. Name: `process-listing`
3. Copy/paste code from: `supabase/functions/process-listing/index.ts`
4. Click "Deploy"

#### Function 2: create-checkout-session
1. Click "Create New Function"
2. Name: `create-checkout-session`
3. Copy/paste code from: `supabase/functions/create-checkout-session/index.ts`
4. Click "Deploy"

---

## Step 3: Stripe (3 minutes)

**Go to:** https://dashboard.stripe.com/products

**Create 4 products** (click "Add Product" for each):

### Product 1:
```
Name: 10 eBai Listings
Price: $4.00 USD
Type: One-time payment
```
**After creation:** Click product → Scroll to "Product ID" → Click "Edit" → Change to: `prod_ebai_10`

### Product 2:
```
Name: 50 eBai Listings
Price: $6.00 USD
Type: One-time payment
```
**After creation:** Edit Product ID to: `prod_ebai_50`

### Product 3:
```
Name: 100 eBai Listings
Price: $12.00 USD
Type: One-time payment
```
**After creation:** Edit Product ID to: `prod_ebai_100`

### Product 4:
```
Name: 200 eBai Listings Per Month
Price: $14.99 USD
Type: Recurring (monthly)
```
**After creation:** Edit Product ID to: `prod_ebai_subscription`

---

## ✅ Done! Test It:

1. Go to your Vercel URL (will be shown after deploy)
2. Register with: `speedwarnsf@gmail.com`
3. See "OWNER ACCESS" badge + ∞ credits
4. Click Photo Enhancer → upload image → should work
5. Click Text Assistant → enter text → should work
6. Click "Buy More Credits" → should see pricing

---

## 🐛 If Something Breaks:

**"SUPABASE_URL not found"**
→ Redeploy Vercel after adding env vars

**"Image enhancement failed"**
→ Check Supabase Edge Functions → Logs

**"Stripe checkout not working"**
→ Verify product IDs match exactly

---

**Time estimate:** 7 minutes if you follow exactly ⏱️

**Owner access:** speedwarnsf@gmail.com = unlimited credits ∞
