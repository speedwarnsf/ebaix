# eBai - E-commerce Background AI

Transform your product photos into professional studio shots with AI-powered descriptions.

## Architecture

**Simple, 2-platform stack:**
- **Frontend:** Vercel (static HTML)
- **Backend + Database:** Supabase (Edge Functions + PostgreSQL)

## Quick Deploy

### 1. Deploy Backend (Supabase Edge Function)

**Option A: Dashboard**
1. Go to https://supabase.com/dashboard/project/cllofhltncusnakhehdw/functions
2. Create new function: `optimize-listing`
3. Copy code from `supabase/functions/optimize-listing/index.ts`
4. Add secret: `GEMINI_API_KEY`
5. Deploy

**Option B: CLI**
```bash
supabase functions deploy optimize-listing --project-ref cllofhltncusnakhehdw
supabase secrets set GEMINI_API_KEY=your_key --project-ref cllofhltncusnakhehdw
```

### 2. Deploy Frontend (Vercel)

1. Import this repo to Vercel
2. Deploy (auto-detects static HTML)
3. Add custom domain: ebai.me

## Database Setup

Run this SQL in Supabase dashboard:

```sql
CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  original_image_url TEXT,
  enhanced_image_url TEXT,
  original_description TEXT,
  optimized_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON listings FOR ALL USING (true);
```

## Tech Stack

- **Frontend:** Vanilla JS + HTML + CSS
- **Backend:** Deno Edge Functions (Supabase)
- **Database:** PostgreSQL (Supabase)
- **AI:** Google Gemini 2.0 Flash
- **Deployment:** Vercel + Supabase

## Economics

- **API Cost:** $0.01/image
- **Pricing:** $0.99/listing
- **Margins:** 67% per listing
- **Target:** 200M+ sellers across all marketplaces

## Development

All code is production-ready. No local setup needed - deploy directly to Supabase + Vercel.

---

Built with ❤️ for online sellers everywhere.
