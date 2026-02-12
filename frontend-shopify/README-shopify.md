# Shopify Build Notes

This fork is meant to be served by the FastAPI Shopify backend at `/shopify/app`.

## Frontend build

Build the Shopify frontend with:

```
npm run build:shopify
```

This sets `PUBLIC_URL=/shopify/app` so static asset paths resolve correctly when the backend serves the HTML shell.

## Uploads

Large files are auto-optimized client-side. HEIC/HEIF uploads are converted to JPEG in-browser before optimization.

## Backend serving

The backend serves the embedded HTML shell with dynamic CSP and static assets from the build output:

- Build output path (default): `../frontend-shopify/build`
- Backend route: `/shopify/app`

## Session token auth

The backend requires Shopify App Bridge session tokens for all `/shopify/*` API routes (billing/products).
The frontend uses `getSessionToken()` and sends `Authorization: Bearer <token>` on every request.

## Required environment variables

Frontend (Shopify fork):
- `REACT_APP_SHOPIFY_BACKEND_URL` (base URL of the FastAPI Shopify backend)
- `REACT_APP_SHOPIFY_API_KEY`
- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`

Backend (`shopify_app.py`):
- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SHOPIFY_SCOPES` (recommend: `read_products,write_products`)
- `SHOPIFY_APP_URL` (default: `https://app.nudio.ai/shopify/app`)
- `SHOPIFY_OAUTH_CALLBACK` (default: `https://app.nudio.ai/shopify/oauth/callback`)
- `SHOPIFY_ADMIN_API_VERSION` (default: `2024-10`; pin explicitly in production)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `SHOPIFY_SHOPS_TABLE` (default: `shopify_shops`)
- `SHOPIFY_FRONTEND_BUILD_DIR` (default: `../frontend-shopify/build`)
- `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET` are required for session token verification

## Shopify mode gating

Supabase edge function (`optimize-listing`) must run with:
- `NUDIO_SHOPIFY_MODE=true`

This enforces product-only + palette restrictions at the API level.

## Supabase table

Create once:

```sql
create table if not exists shopify_shops (
  shop_domain text primary key,
  access_token text not null,
  scope text,
  installed_at timestamptz,
  updated_at timestamptz
);
```

## CSP requirement

The backend sets a dynamic CSP header per shop:
- `Content-Security-Policy: frame-ancestors https://{shop}.myshopify.com https://admin.shopify.com;`
If `shop` is missing/invalid, CSP falls back to `frame-ancestors https://admin.shopify.com https://*.myshopify.com;`.

## Webhooks (for Shopify review)

Register these webhook endpoints in your Shopify app settings:
- `app/uninstalled` → `/shopify/webhooks/app/uninstalled`
- `customers/data_request` → `/shopify/webhooks/compliance`
- `customers/redact` → `/shopify/webhooks/compliance`
- `shop/redact` → `/shopify/webhooks/compliance`

Legacy underscore routes remain supported by the backend for compatibility.

## Health endpoint

For monitoring:
- `GET /shopify/health`
