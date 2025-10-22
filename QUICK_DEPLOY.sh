#!/bin/bash

echo "🚀 eBai Quick Deploy Helper"
echo "================================"
echo ""
echo "This script will help you deploy eBai to production."
echo ""

# Check if Supabase CLI is available
if command -v supabase &> /dev/null; then
    echo "✅ Supabase CLI found"
    echo ""
    read -p "Deploy Supabase functions? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "📦 Deploying process-listing..."
        supabase functions deploy process-listing
        echo ""
        echo "📦 Deploying create-checkout-session..."
        supabase functions deploy create-checkout-session
        echo ""
        echo "✅ Functions deployed!"
    fi
else
    echo "❌ Supabase CLI not found"
    echo "   Deploy manually via Supabase Dashboard"
    echo "   See DEPLOY_NOW.md for instructions"
fi

echo ""
echo "================================"
echo "📋 Next Steps:"
echo ""
echo "1. Add environment variables to Vercel"
echo "   - REACT_APP_SUPABASE_URL"
echo "   - REACT_APP_SUPABASE_ANON_KEY"
echo "   - REACT_APP_STRIPE_PUBLIC_KEY"
echo ""
echo "2. Add secrets to Supabase"
echo "   - GEMINI_API_KEY"
echo "   - STRIPE_SECRET_KEY"
echo ""
echo "3. Create Stripe products (4 products)"
echo "   - See DEPLOY_NOW.md for exact IDs"
echo ""
echo "4. Redeploy Vercel"
echo ""
echo "✅ All values are in frontend/.env.local"
echo "📖 Full guide: DEPLOY_NOW.md"
