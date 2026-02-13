from __future__ import annotations

import base64
import hashlib
import hmac
import os
import re
from io import BytesIO
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import parse_qsl
from urllib.parse import urlencode
from urllib.parse import urlparse
from urllib.parse import urlunparse

import httpx
import asyncio
import jwt
import logging
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse, Response, JSONResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image
from pillow_heif import register_heif_opener
from pydantic import BaseModel
from supabase import Client, create_client

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

SHOPIFY_API_KEY = os.environ.get("SHOPIFY_API_KEY")
SHOPIFY_API_SECRET = os.environ.get("SHOPIFY_API_SECRET")
SHOPIFY_SCOPES = os.environ.get("SHOPIFY_SCOPES", "read_products,write_products")
SHOPIFY_APP_URL = os.environ.get("SHOPIFY_APP_URL", "https://app.nudio.ai/shopify/app")
# App Store listing slug + admin app handle (apps.shopify.com/<handle> and admin.shopify.com/.../apps/<handle>).
SHOPIFY_APP_HANDLE = os.environ.get("SHOPIFY_APP_HANDLE", "nudio").strip()
SHOPIFY_OAUTH_CALLBACK = os.environ.get(
    "SHOPIFY_OAUTH_CALLBACK", "https://app.nudio.ai/shopify/oauth/callback"
)
SHOPIFY_ADMIN_API_VERSION = os.environ.get("SHOPIFY_ADMIN_API_VERSION", "2024-10")
SHOPIFY_TEST_BILLING = os.environ.get("SHOPIFY_TEST_BILLING", "false").lower() in ("1", "true", "yes")
SHOPIFY_SHOPS_TABLE = os.environ.get("SHOPIFY_SHOPS_TABLE", "shopify_shops")
SHOPIFY_FRONTEND_BUILD_DIR = os.environ.get(
    "SHOPIFY_FRONTEND_BUILD_DIR",
    str(Path(__file__).resolve().parents[1] / "frontend-shopify" / "build"),
)
SHOPIFY_SUBSCRIPTION_NAME = "Nudio (Product Studio)"
SHOPIFY_USAGE_DESCRIPTION = "Nudio image processing"
SHOPIFY_USAGE_PRICE_USD = 0.08

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

SUPABASE_FUNCTION_BASE = f"{SUPABASE_URL}/functions/v1"

app = FastAPI(title="Nudio Shopify App")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

register_heif_opener()
MAX_HEIC_BYTES = 20 * 1024 * 1024

build_dir = Path(SHOPIFY_FRONTEND_BUILD_DIR)
static_dir = build_dir / "static"
if static_dir.exists():
    app.mount("/shopify/app/static", StaticFiles(directory=static_dir), name="shopify_static")


@app.middleware("http")
async def require_shopify_session_token(request: Request, call_next):
    # NOTE: Raising HTTPException from Starlette/FastAPI middleware is handled by
    # ServerErrorMiddleware (500) instead of FastAPI's exception handlers.
    # We must return a JSON response ourselves for auth failures.
    try:
        path = request.url.path
        public_paths = (
            "/shopify/install",
            "/shopify/oauth/callback",
            "/shopify/app",
            "/shopify/health",
            "/shopify/webhooks/compliance",
            "/shopify/webhooks/app/uninstalled",
            "/shopify/webhooks/customers/data_request",
            "/shopify/webhooks/customers/redact",
            "/shopify/webhooks/shop/redact",
            "/shopify/webhooks/app_uninstalled",
            "/shopify/webhooks/customers_redact",
            "/shopify/webhooks/customers_data_request",
            "/shopify/webhooks/shop_redact",
        )
        if path.startswith("/shopify/app") or path in public_paths:
            return await call_next(request)
        if not path.startswith("/shopify/"):
            return await call_next(request)

        auth_header = request.headers.get("authorization", "")
        token = ""
        if auth_header.startswith("Bearer "):
            token = auth_header.replace("Bearer ", "")
        else:
            token = request.query_params.get("id_token", "")
        if not token:
            raise HTTPException(status_code=401, detail="Missing session token.")

        payload = _verify_session_token(token)
        shop = _shop_from_session_token(payload)
        if not shop:
            raise HTTPException(status_code=401, detail="Invalid session token shop.")
        query_shop = request.query_params.get("shop")
        if query_shop and query_shop != shop:
            raise HTTPException(status_code=401, detail="Shop context mismatch.")

        request.state.shop = shop
        return await call_next(request)
    except HTTPException as exc:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    except Exception:
        logging.exception("middleware_auth_failed path=%s", getattr(request.url, "path", ""))
        return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})


@app.middleware("http")
async def add_shopify_csp(request: Request, call_next):
    response = await call_next(request)
    shop = request.query_params.get("shop", "")
    if not _is_valid_shop_domain(shop):
        host_param = request.query_params.get("host", "")
        host_shop = _shop_from_host_param(host_param)
        if _is_valid_shop_domain(host_shop):
            shop = host_shop
        else:
            auth_header = request.headers.get("authorization", "")
            if auth_header.startswith("Bearer "):
                token = auth_header.replace("Bearer ", "")
                try:
                    payload = _verify_session_token(token)
                    shop = _shop_from_session_token(payload) or ""
                except HTTPException:
                    shop = ""
    if _is_valid_shop_domain(shop):
        frame_ancestors = f"https://{shop} https://admin.shopify.com"
    else:
        frame_ancestors = "https://admin.shopify.com https://*.myshopify.com"
    response.headers["Content-Security-Policy"] = f"frame-ancestors {frame_ancestors};"
    if "X-Frame-Options" in response.headers:
        del response.headers["X-Frame-Options"]
    return response


def _is_valid_shop_domain(shop: str) -> bool:
    return bool(shop) and shop.endswith(".myshopify.com") and "/" not in shop


def _shop_from_host_param(host_param: str) -> str:
    if not host_param:
        return ""
    try:
        padding = "=" * (-len(host_param) % 4)
        decoded = base64.b64decode(host_param + padding).decode("utf-8", "ignore")
    except Exception:
        return ""
    if ".myshopify.com" in decoded:
        match = re.search(r"([a-zA-Z0-9-]+\.myshopify\.com)", decoded)
        return match.group(1) if match else ""
    match = re.search(r"admin\.shopify\.com/store/([^/?#]+)", decoded)
    if not match:
        return ""
    return f"{match.group(1)}.myshopify.com"


def _build_hmac_message(params: dict) -> str:
    pairs = []
    for key in sorted(params.keys()):
        if key == "hmac":
            continue
        value = params[key]
        pairs.append(f"{key}={value}")
    return "&".join(pairs)


def _verify_hmac(params: dict, secret: str) -> bool:
    if "hmac" not in params:
        return False
    hmac_provided = params.get("hmac", "")
    message = _build_hmac_message(params)
    digest = hmac.new(secret.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, hmac_provided)


def _verify_webhook_hmac(raw_body: bytes, hmac_header: str) -> bool:
    if not hmac_header or not SHOPIFY_API_SECRET:
        return False
    digest = hmac.new(
        SHOPIFY_API_SECRET.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).digest()
    computed = base64.b64encode(digest).decode("utf-8")
    return hmac.compare_digest(computed, hmac_header)

ACTIVE_SUBSCRIPTIONS_QUERY = """
  query ActiveSubscriptions {
    currentAppInstallation {
      activeSubscriptions {
        id
        name
        status
        lineItems {
          id
          plan {
            pricingDetails {
              __typename
              ... on AppUsagePricing {
                terms
              }
            }
          }
        }
      }
    }
  }
"""

RATE_LIMIT_WINDOW_SECONDS = 60
RATE_LIMIT_MAX_REQUESTS = 45
_RATE_LIMIT_BUCKET: dict[str, list[float]] = {}


def _rate_limit_key(shop: str, action: str) -> str:
    return f"{shop}:{action}"


def _check_rate_limit(shop: str, action: str) -> None:
    now = datetime.now(timezone.utc).timestamp()
    key = _rate_limit_key(shop, action)
    entries = _RATE_LIMIT_BUCKET.get(key, [])
    entries = [ts for ts in entries if now - ts <= RATE_LIMIT_WINDOW_SECONDS]
    if len(entries) >= RATE_LIMIT_MAX_REQUESTS:
        raise HTTPException(status_code=429, detail="Rate limit exceeded.")
    entries.append(now)
    _RATE_LIMIT_BUCKET[key] = entries


def _base64_host(shop: str) -> str:
    slug = shop.replace(".myshopify.com", "")
    if slug:
        raw = f"admin.shopify.com/store/{slug}".encode("utf-8")
    else:
        raw = f"{shop}/admin".encode("utf-8")
    return base64.b64encode(raw).decode("utf-8")


async def _exchange_token(shop: str, code: str) -> dict:
    url = f"https://{shop}/admin/oauth/access_token"
    payload = {
        "client_id": SHOPIFY_API_KEY,
        "client_secret": SHOPIFY_API_SECRET,
        "code": code,
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        return response.json()


def _store_shop_token(shop: str, access_token: str, scope: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    supabase.table(SHOPIFY_SHOPS_TABLE).upsert(
        {
            "shop_domain": shop,
            "access_token": access_token,
            "scope": scope,
            "installed_at": now,
            "updated_at": now,
        },
        on_conflict="shop_domain",
    ).execute()


def _delete_shop_record(shop: str) -> None:
    supabase.table(SHOPIFY_SHOPS_TABLE).delete().eq("shop_domain", shop).execute()


def _get_shop_record(shop: str, host: str | None = None) -> dict:
    result = supabase.table(SHOPIFY_SHOPS_TABLE).select("*").eq("shop_domain", shop).limit(1).execute()
    data = result.data[0] if result.data else None
    if not data:
        raise HTTPException(
            status_code=401,
            detail={
                "error": "shop_not_installed",
                "install_url": _shopify_install_url(shop, host),
            },
        )
    return data


def _shopify_install_url(shop: str, host: str | None = None) -> str:
    if not SHOPIFY_API_KEY or not SHOPIFY_API_SECRET:
        return ""
    if not _is_valid_shop_domain(shop):
        return ""
    origin = _shopify_app_origin()
    if not origin:
        state = _make_oauth_state(shop)
        params = {
            "client_id": SHOPIFY_API_KEY,
            "scope": SHOPIFY_SCOPES,
            "redirect_uri": SHOPIFY_OAUTH_CALLBACK,
            "state": state,
        }
        return f"https://{shop}/admin/oauth/authorize?{urlencode(params)}"
    query = {"shop": shop}
    if host:
        query["host"] = host
    return f"{origin}/shopify/install?{urlencode(query)}"


def _is_valid_public_host(host: str) -> bool:
    # Accept localhost for local dev and standard dotted domains in production.
    if not host:
        return False
    if not re.fullmatch(r"[a-zA-Z0-9.-]+(?::\d+)?", host):
        return False
    hostname = host.split(":", 1)[0].strip(".")
    return hostname == "localhost" or "." in hostname


def _shopify_app_origin() -> str:
    if not SHOPIFY_APP_URL:
        return ""
    parsed = urlparse(SHOPIFY_APP_URL)
    if parsed.scheme and parsed.netloc:
        return f"{parsed.scheme}://{parsed.netloc}"
    if re.match(r"^[a-zA-Z0-9.:-]+(/|$)", SHOPIFY_APP_URL):
        host = SHOPIFY_APP_URL.split("/")[0]
        if _is_valid_public_host(host):
            return f"https://{host}"
    return ""


def _shopify_app_url(request: Request | None = None) -> str:
    if SHOPIFY_APP_URL:
        parsed = urlparse(SHOPIFY_APP_URL)
        if parsed.scheme and parsed.netloc:
            return SHOPIFY_APP_URL
        if re.match(r"^[a-zA-Z0-9.:-]+(/|$)", SHOPIFY_APP_URL):
            host = SHOPIFY_APP_URL.split("/", 1)[0]
            if _is_valid_public_host(host):
                return f"https://{SHOPIFY_APP_URL}"
        if request:
            base = f"{request.url.scheme}://{request.url.netloc}"
            if SHOPIFY_APP_URL.startswith("/"):
                return f"{base}{SHOPIFY_APP_URL}"
            return f"{base}/{SHOPIFY_APP_URL}"
    if request:
        return f"{request.url.scheme}://{request.url.netloc}/shopify/app"
    return ""


def _shopify_admin_app_url(shop: str) -> str:
    if not SHOPIFY_API_KEY or not shop:
        return ""
    slug = shop.replace(".myshopify.com", "")
    if not slug:
        return ""
    if not SHOPIFY_APP_HANDLE:
        return ""
    app_handle = SHOPIFY_APP_HANDLE
    return f"https://admin.shopify.com/store/{slug}/apps/{app_handle}"


async def _shopify_active_subscriptions(shop: str, access_token: str) -> list[dict]:
    data = await _shopify_graphql(shop, access_token, ACTIVE_SUBSCRIPTIONS_QUERY)
    return data.get("data", {}).get("currentAppInstallation", {}).get("activeSubscriptions", [])


def _extract_usage_line_item_id(subscriptions: list[dict]) -> str | None:
    for subscription in subscriptions:
        if subscription.get("name") != SHOPIFY_SUBSCRIPTION_NAME:
            continue
        for line_item in subscription.get("lineItems", []):
            pricing = line_item.get("plan", {}).get("pricingDetails", {})
            if pricing.get("__typename") == "AppUsagePricing":
                return line_item.get("id")
    return None


async def _create_usage_record(
    shop: str,
    access_token: str,
    usage_line_item_id: str,
    description: str = SHOPIFY_USAGE_DESCRIPTION,
    amount: float = SHOPIFY_USAGE_PRICE_USD,
) -> str | None:
    mutation = """
      mutation CreateUsageRecord($id: ID!, $description: String!, $amount: MoneyInput!) {
        appUsageRecordCreate(description: $description, price: $amount, subscriptionLineItemId: $id) {
          appUsageRecord {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    """
    variables = {
        "id": usage_line_item_id,
        "description": description,
        "amount": {"amount": amount, "currencyCode": "USD"},
    }
    created = await _shopify_graphql(shop, access_token, mutation, variables)
    payload = created.get("data", {}).get("appUsageRecordCreate", {})
    if payload.get("userErrors"):
        raise HTTPException(status_code=400, detail=payload["userErrors"])
    return payload.get("appUsageRecord", {}).get("id")


def _make_oauth_state(shop: str) -> str:
    if not SHOPIFY_API_SECRET:
        return base64.urlsafe_b64encode(os.urandom(24)).decode("utf-8").rstrip("=")
    payload = {
        "shop": shop,
        "iat": int(datetime.now(timezone.utc).timestamp()),
        "exp": int(datetime.now(timezone.utc).timestamp()) + 600,
    }
    return jwt.encode(payload, SHOPIFY_API_SECRET, algorithm="HS256")


def _verify_oauth_state(state: str, shop: str) -> bool:
    if not SHOPIFY_API_SECRET:
        return False
    try:
        payload = jwt.decode(state, SHOPIFY_API_SECRET, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        return False
    return payload.get("shop") == shop


async def _shopify_graphql(shop: str, access_token: str, query: str, variables: dict | None = None) -> dict:
    url = f"https://{shop}/admin/api/{SHOPIFY_ADMIN_API_VERSION}/graphql.json"
    payload = {"query": query, "variables": variables or {}}
    headers = {
        "X-Shopify-Access-Token": access_token,
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        return response.json()


async def _shopify_rest(shop: str, access_token: str, method: str, path: str, payload: dict) -> dict:
    url = f"https://{shop}/admin/api/{SHOPIFY_ADMIN_API_VERSION}/{path.lstrip('/')}"
    headers = {
        "X-Shopify-Access-Token": access_token,
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        if method.upper() == "GET":
            response = await client.request(method, url, params=payload, headers=headers)
        else:
            response = await client.request(method, url, json=payload, headers=headers)
        response.raise_for_status()
        return response.json()


async def _shopify_rest_with_retry(
    shop: str,
    access_token: str,
    method: str,
    path: str,
    payload: dict,
    retries: int = 3,
    base_delay: float = 0.6,
) -> dict:
    attempt = 0
    while True:
        try:
            return await _shopify_rest(shop, access_token, method, path, payload)
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            if status not in (429, 500, 502, 503, 504) or attempt >= retries:
                raise
            delay = base_delay * (2 ** attempt)
            logging.warning("shopify_retry shop=%s status=%s delay=%.2f", shop, status, delay)
            await asyncio.sleep(delay)
            attempt += 1


def _extract_base64(data_url: str) -> str:
    if "," in data_url:
        return data_url.split(",", 1)[1]
    return data_url


def _is_allowed_shopify_image_url(src: str) -> bool:
    if not src:
        return False
    parsed = urlparse(src)
    if parsed.scheme.lower() != "https":
        return False
    host = (parsed.hostname or "").lower()
    if not host:
        return False
    return host == "cdn.shopify.com" or host.endswith(".cdn.shopify.com") or host.endswith(".myshopify.com")


def _shop_from_issuer(issuer: str) -> str | None:
    if not issuer:
        return None
    if issuer.startswith("https://admin.shopify.com/store/"):
        match = re.search(r"^https://admin\.shopify\.com/store/([^/?#]+)", issuer)
        if match:
            return f"{match.group(1)}.myshopify.com"
    if issuer.startswith("https://"):
        parsed = urlparse(issuer)
        host = (parsed.hostname or "").lower()
        if host.endswith(".myshopify.com"):
            return host
    return None


def _shop_from_session_token(payload: dict) -> str | None:
    dest = payload.get("dest")
    if isinstance(dest, str) and dest.startswith("https://"):
        return dest.replace("https://", "").strip("/")
    issuer = payload.get("iss")
    if isinstance(issuer, str):
        return _shop_from_issuer(issuer)
    return None


def _verify_session_token(token: str) -> dict:
    if not SHOPIFY_API_KEY or not SHOPIFY_API_SECRET:
        raise HTTPException(status_code=500, detail="Missing Shopify API config.")
    try:
        payload = jwt.decode(
            token,
            SHOPIFY_API_SECRET,
            algorithms=["HS256"],
            audience=SHOPIFY_API_KEY,
            options={
                "require": ["iss", "aud", "exp", "sub", "iat"],
            },
            leeway=10,
        )
        logging.info(
            "session_token_ok iss=%s aud=%s dest=%s",
            payload.get("iss"),
            payload.get("aud"),
            payload.get("dest"),
        )
    except jwt.ExpiredSignatureError as exc:
        logging.warning("session_token_expired")
        raise HTTPException(status_code=401, detail="Session token expired.") from exc
    except jwt.InvalidTokenError as exc:
        logging.warning("session_token_invalid type=%s", exc.__class__.__name__)
        raise HTTPException(status_code=401, detail="Invalid session token.") from exc
    shop = _shop_from_session_token(payload)
    if not shop or not _is_valid_shop_domain(shop):
        raise HTTPException(status_code=401, detail="Invalid session token shop.")
    issuer = payload.get("iss")
    expected_issuer = f"https://{shop}/admin"
    expected_store_issuer = f"https://{shop}"
    expected_admin_store = f"https://admin.shopify.com/store/{shop.replace('.myshopify.com', '')}"
    issuer_ok = False
    if isinstance(issuer, str):
        normalized = issuer.rstrip("/")
        if normalized in (expected_issuer, expected_store_issuer, expected_admin_store):
            issuer_ok = True
        elif normalized.startswith(expected_admin_store + "/"):
            # Shopify may include deeper paths in `iss` when using the new admin URL format.
            issuer_ok = True
    if not issuer_ok:
        raise HTTPException(status_code=401, detail="Invalid session token issuer.")
    audience = payload.get("aud")
    if isinstance(audience, list):
        aud_ok = SHOPIFY_API_KEY in audience
    else:
        aud_ok = audience == SHOPIFY_API_KEY
    if not aud_ok:
        raise HTTPException(status_code=401, detail="Invalid session token audience.")
    if not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Invalid session token subject.")
    return payload


class UsageChargeRequest(BaseModel):
    description: str = SHOPIFY_USAGE_DESCRIPTION
    price: float = SHOPIFY_USAGE_PRICE_USD


class ImageUploadRequest(BaseModel):
    image_base64: str
    filename: str | None = None


class ShopifyOptimizeRequest(BaseModel):
    imageBase64: str
    mode: str = "image"
    userEmail: str | None = None
    variant: str | None = None
    backdropId: str | None = None
    backdropHex: str | None = None


def _frontend_index_path() -> Path:
    return Path(SHOPIFY_FRONTEND_BUILD_DIR) / "index.html"

def _render_shopify_index() -> Response:
    index_path = _frontend_index_path()
    if not index_path.exists():
        raise HTTPException(status_code=500, detail="Shopify frontend build missing.")
    html = index_path.read_text(encoding="utf-8")
    script_src = "https://cdn.shopify.com/shopifycloud/app-bridge.js"
    meta_tag = f'<meta name="shopify-api-key" content="{SHOPIFY_API_KEY or ""}">'
    app_bridge_init = (
        "<script>(function(){"
        "window.AppBridge=window.AppBridge||{};"
        "window.ShopifyAppBridge=window.ShopifyAppBridge||{};"
        "var p=new URLSearchParams(window.location.search);"
        "var host=p.get('host');"
        "if(!host){"
        "var shop=p.get('shop');"
        "if(shop){"
        "var store=shop.replace(/\\.myshopify\\.com$/,'');"
        "if(store){try{host=btoa('admin.shopify.com/store/'+store);}catch(e){}}"
        "}"
        "}"
        "var apiKey="
        + repr(SHOPIFY_API_KEY or "")
        + ";"
        "if(!host||!apiKey){return;}"
        "function init(){"
        "var bridge=window['app-bridge'];"
        "if(!bridge||!bridge.createApp){return;}"
        "try{var app=bridge.createApp({apiKey:apiKey,host:host,forceRedirect:true});"
        "window.AppBridge=window.AppBridge||app;"
        "window.ShopifyAppBridge=window.ShopifyAppBridge||{};"
        "if(!window.ShopifyAppBridge.app){window.ShopifyAppBridge.app=app;}"
        "}catch(e){}}"
        "if(window['app-bridge']){init();return;}"
        "var tries=0;"
        "var timer=setInterval(function(){"
        "if(window['app-bridge']){clearInterval(timer);init();}"
        "else if(++tries>50){clearInterval(timer);}"
        "},100);"
        "})();</script>"
    )
    if script_src not in html and "</head>" in html:
        script_tag = f'<script src="{script_src}"></script>'
        html = html.replace("</head>", f"{meta_tag}{script_tag}{app_bridge_init}</head>", 1)
    else:
        if meta_tag not in html and script_src in html:
            html = html.replace(
                f'<script src="{script_src}"></script>',
                f"{meta_tag}<script src=\"{script_src}\"></script>",
                1,
            )
        if "</head>" in html and "window.AppBridge" not in html:
            html = html.replace("</head>", f"{app_bridge_init}</head>", 1)
    response = Response(content=html, media_type="text/html")
    response.headers["Cache-Control"] = "no-store, max-age=0"
    return response

def _resolve_build_asset(path_fragment: str) -> Path | None:
    if not path_fragment:
        return None
    build_root = Path(SHOPIFY_FRONTEND_BUILD_DIR).resolve()
    candidate = (build_root / path_fragment).resolve()
    try:
        candidate.relative_to(build_root)
    except ValueError:
        return None
    return candidate


@app.api_route("/shopify/app", methods=["GET", "HEAD"])
async def shopify_app_root(request: Request):
    if request.method == "HEAD":
        return Response(status_code=200)
    return _render_shopify_index()

@app.api_route("/", methods=["GET", "HEAD"])
async def shopify_root(request: Request):
    if request.method == "HEAD":
        return Response(status_code=200)
    return _render_shopify_index()


@app.get("/shopify/app/{full_path:path}")
async def shopify_app_catchall(full_path: str):
    index_path = _frontend_index_path()
    if not index_path.exists():
        raise HTTPException(status_code=500, detail="Shopify frontend build missing.")
    asset_path = _resolve_build_asset(full_path)
    if asset_path and asset_path.is_file():
        return FileResponse(asset_path)
    return _render_shopify_index()


@app.get("/shopify/install")
async def shopify_install(shop: str, host: str | None = None):
    if not SHOPIFY_API_KEY or not SHOPIFY_API_SECRET:
        raise HTTPException(status_code=500, detail="Missing Shopify API config.")
    if not _is_valid_shop_domain(shop):
        raise HTTPException(status_code=400, detail="Invalid shop domain.")

    state = _make_oauth_state(shop)
    redirect_uri = SHOPIFY_OAUTH_CALLBACK
    params = {
        "client_id": SHOPIFY_API_KEY,
        "scope": SHOPIFY_SCOPES,
        "redirect_uri": redirect_uri,
        "state": state,
    }
    install_url = f"https://{shop}/admin/oauth/authorize?{urlencode(params)}"
    response = RedirectResponse(url=install_url, status_code=302)
    response.set_cookie(
        "shopify_oauth_state",
        state,
        httponly=True,
        secure=True,
        samesite="none",
    )
    return response


@app.get("/shopify/oauth/callback")
async def shopify_oauth_callback(request: Request, shop: str, code: str, state: str, host: str | None = None):
    if not SHOPIFY_API_KEY or not SHOPIFY_API_SECRET:
        raise HTTPException(status_code=500, detail="Missing Shopify API config.")
    if not _is_valid_shop_domain(shop):
        raise HTTPException(status_code=400, detail="Invalid shop domain.")

    query_params = dict(request.query_params)
    if not _verify_hmac(query_params, SHOPIFY_API_SECRET):
        raise HTTPException(status_code=400, detail="Invalid HMAC signature.")

    cookie_state = request.cookies.get("shopify_oauth_state")
    state_ok = False
    if cookie_state:
        if cookie_state == state:
            state_ok = True
        else:
            state_ok = _verify_oauth_state(state, shop)
    else:
        state_ok = _verify_oauth_state(state, shop)
    if not state_ok:
        logging.warning("oauth_state_invalid shop=%s", shop)
        raise HTTPException(status_code=400, detail="Invalid OAuth state.")

    token_payload = await _exchange_token(shop, code)
    access_token = token_payload.get("access_token")
    scope = token_payload.get("scope", "")

    if not access_token:
        raise HTTPException(status_code=400, detail="Missing access token from Shopify.")

    _store_shop_token(shop, access_token, scope)

    redirect_host = host or _base64_host(shop)
    admin_url = _shopify_admin_app_url(shop)
    app_url = admin_url or _shopify_app_url(request)
    if not app_url:
        raise HTTPException(status_code=500, detail="Missing Shopify app URL.")
    if not admin_url:
        app_url = f"{app_url}?shop={shop}&host={redirect_host}"
    response = RedirectResponse(url=app_url, status_code=302)
    response.delete_cookie("shopify_oauth_state")
    return response


@app.get("/shopify/billing/active")
async def shopify_billing_active(request: Request, shop: str | None = None):
    auth_shop = getattr(request.state, "shop", None) or shop
    if not auth_shop:
        raise HTTPException(status_code=401, detail="Missing shop context.")
    record = _get_shop_record(auth_shop, request.query_params.get("host"))
    access_token = record["access_token"]
    subscriptions = await _shopify_active_subscriptions(auth_shop, access_token)
    return {"subscriptions": subscriptions}


@app.post("/shopify/billing/ensure")
async def shopify_billing_ensure(request: Request, shop: str | None = None, host: str | None = None):
    auth_shop = getattr(request.state, "shop", None) or shop
    if not auth_shop:
        raise HTTPException(status_code=401, detail="Missing shop context.")
    record = _get_shop_record(auth_shop, host or request.query_params.get("host"))
    access_token = record["access_token"]
    subscriptions = await _shopify_active_subscriptions(auth_shop, access_token)
    for subscription in subscriptions:
        if subscription.get("name") == SHOPIFY_SUBSCRIPTION_NAME and _extract_usage_line_item_id([subscription]):
            return {"active": True, "subscription": subscription}

    mutation = """
      mutation CreateSubscription($name: String!, $returnUrl: URL!, $terms: String!, $test: Boolean!) {
        appSubscriptionCreate(
          name: $name
          returnUrl: $returnUrl
          lineItems: [
            {
              plan: {
                appUsagePricingDetails: {
                  terms: $terms
                  cappedAmount: { amount: 100, currencyCode: USD }
                }
              }
            }
          ]
          test: $test
        ) {
          confirmationUrl
          userErrors {
            field
            message
          }
        }
      }
    """
    return_url = _shopify_app_url(request)
    if return_url and (shop or host):
        parsed_return = urlparse(return_url)
        query = dict(parse_qsl(parsed_return.query))
        if shop:
            query["shop"] = shop
        if host:
            query["host"] = host
        parsed_return = parsed_return._replace(query=urlencode(query))
        return_url = urlunparse(parsed_return)
    if not return_url:
        raise HTTPException(status_code=500, detail="Missing Shopify app URL.")
    if host and "admin.shopify.com" not in return_url:
        return_url = f"{return_url}?shop={auth_shop}&host={host}"

    variables = {
        "name": SHOPIFY_SUBSCRIPTION_NAME,
        "returnUrl": return_url,
        "terms": "8 cents per image, billed through Shopify.",
        "test": SHOPIFY_TEST_BILLING,
    }
    created = await _shopify_graphql(auth_shop, access_token, mutation, variables)
    payload = created.get("data", {}).get("appSubscriptionCreate", {})
    if payload.get("userErrors"):
        raise HTTPException(status_code=400, detail=payload["userErrors"])
    return {"active": False, "confirmationUrl": payload.get("confirmationUrl")}


@app.post("/shopify/billing/usage")
async def shopify_billing_usage(request: Request, payload: UsageChargeRequest, shop: str | None = None):
    auth_shop = getattr(request.state, "shop", None) or shop
    if not auth_shop:
        raise HTTPException(status_code=401, detail="Missing shop context.")
    _check_rate_limit(auth_shop, "billing_usage")
    record = _get_shop_record(auth_shop, request.query_params.get("host"))
    access_token = record["access_token"]
    if abs(payload.price - SHOPIFY_USAGE_PRICE_USD) > 1e-6:
        raise HTTPException(status_code=400, detail="Invalid price.")
    description = SHOPIFY_USAGE_DESCRIPTION
    price = SHOPIFY_USAGE_PRICE_USD

    subscriptions = await _shopify_active_subscriptions(auth_shop, access_token)
    usage_line_item_id = _extract_usage_line_item_id(subscriptions)
    if not usage_line_item_id:
        raise HTTPException(status_code=400, detail="No active usage plan found.")

    usage_record_id = await _create_usage_record(
        auth_shop,
        access_token,
        usage_line_item_id,
        description=description,
        amount=price,
    )
    logging.info("billing_usage shop=%s usage_id=%s amount=%.2f", auth_shop, usage_record_id, price)
    return {"ok": True, "usageRecordId": usage_record_id}


@app.post("/shopify/products/{product_id}/images")
async def shopify_product_image_upload(
    product_id: str,
    request: Request,
    payload: ImageUploadRequest,
    shop: str | None = None,
    make_primary: bool = False,
):
    auth_shop = getattr(request.state, "shop", None) or shop
    if not auth_shop:
        raise HTTPException(status_code=401, detail="Missing shop context.")
    _check_rate_limit(auth_shop, "product_upload")
    record = _get_shop_record(auth_shop, request.query_params.get("host"))
    access_token = record["access_token"]
    image_base64 = payload.image_base64
    filename = payload.filename
    if not image_base64:
        raise HTTPException(status_code=400, detail="Missing image_base64.")

    attachment = _extract_base64(image_base64)
    estimated_bytes = (len(attachment) * 3) // 4 - attachment.count("=")
    if estimated_bytes > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image exceeds 10MB limit.")
    payload = {"image": {"attachment": attachment}}
    if filename:
        payload["image"]["filename"] = filename

    response = await _shopify_rest_with_retry(
        auth_shop,
        access_token,
        "POST",
        f"/products/{product_id}/images.json",
        payload,
    )
    if make_primary:
        image_id = (response or {}).get("image", {}).get("id")
        if image_id:
            try:
                await _shopify_rest_with_retry(
                    auth_shop,
                    access_token,
                    "PUT",
                    f"/products/{product_id}/images/{image_id}.json",
                    {"image": {"id": image_id, "position": 1}},
                )
            except Exception:
                logging.warning("product_image_reorder_failed shop=%s product_id=%s image_id=%s", auth_shop, product_id, image_id)
    logging.info("product_upload shop=%s product_id=%s", auth_shop, product_id)
    return response


@app.post("/shopify/optimize-listing")
async def shopify_optimize_listing(request: Request, payload: ShopifyOptimizeRequest):
    auth_shop = getattr(request.state, "shop", None)
    if not auth_shop:
        raise HTTPException(status_code=401, detail="Missing shop context.")
    if not SUPABASE_FUNCTION_BASE or not SUPABASE_SERVICE_KEY:
        raise HTTPException(status_code=500, detail="Missing Supabase configuration.")
    record = _get_shop_record(auth_shop, request.query_params.get("host"))
    access_token = record["access_token"]
    subscriptions = await _shopify_active_subscriptions(auth_shop, access_token)
    usage_line_item_id = _extract_usage_line_item_id(subscriptions)
    if not usage_line_item_id:
        raise HTTPException(status_code=402, detail="Active billing subscription required.")

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "apikey": SUPABASE_SERVICE_KEY,
        "x-nudio-shopify-mode": "true",
    }
    body = payload.dict(exclude_none=True)
    if not body.get("userEmail"):
        body["userEmail"] = f"shopify+{auth_shop}@nudio.ai"
    timeout = httpx.Timeout(180.0, connect=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            response = await client.post(
                f"{SUPABASE_FUNCTION_BASE}/optimize-listing",
                headers=headers,
                json=body,
            )
        except httpx.ReadTimeout:
            raise HTTPException(
                status_code=504,
                detail="Processing timed out. Please try again.",
            )
    if response.status_code >= 400:
        try:
            detail = response.json()
        except Exception:
            detail = response.text
        logging.warning(
            "optimize_listing_failed shop=%s status=%s detail=%s",
            auth_shop,
            response.status_code,
            detail,
        )
        raise HTTPException(status_code=response.status_code, detail=detail)
    result = response.json()
    usage_record_id = await _create_usage_record(
        auth_shop,
        access_token,
        usage_line_item_id,
        description=SHOPIFY_USAGE_DESCRIPTION,
        amount=SHOPIFY_USAGE_PRICE_USD,
    )
    logging.info("optimize_listing_billed shop=%s usage_id=%s amount=%.2f", auth_shop, usage_record_id, SHOPIFY_USAGE_PRICE_USD)
    if isinstance(result, dict):
        result["usageRecordId"] = usage_record_id
    return result


@app.post("/shopify/convert-heic")
async def shopify_convert_heic(
    request: Request,
    file: UploadFile = File(...),
    shop: str | None = None,
):
    auth_shop = getattr(request.state, "shop", None) or shop
    if not auth_shop:
        raise HTTPException(status_code=401, detail="Missing shop context.")
    _check_rate_limit(auth_shop, "convert_heic")
    if not file:
        raise HTTPException(status_code=400, detail="Missing file.")
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty upload.")
    if len(contents) > MAX_HEIC_BYTES:
        raise HTTPException(status_code=413, detail="Image exceeds 20MB limit.")
    try:
        image = Image.open(BytesIO(contents))
        image = image.convert("RGB")
    except Exception as exc:
        logging.warning("heic_decode_failed shop=%s error=%s", auth_shop, exc)
        raise HTTPException(status_code=400, detail="HEIC conversion failed.")
    output = BytesIO()
    image.save(output, format="JPEG", quality=92, optimize=True)
    return Response(content=output.getvalue(), media_type="image/jpeg")


@app.get("/shopify/products")
async def shopify_products(request: Request, shop: str | None = None, limit: int = 25):
    auth_shop = getattr(request.state, "shop", None) or shop
    if not auth_shop:
        raise HTTPException(status_code=401, detail="Missing shop context.")
    record = _get_shop_record(auth_shop, request.query_params.get("host"))
    access_token = record["access_token"]
    payload = {"limit": max(1, min(limit, 250)), "fields": "id,title,images"}
    response = await _shopify_rest(
        auth_shop,
        access_token,
        "GET",
        "/products.json",
        payload,
    )
    return response


@app.get("/shopify/products/{product_id}/images")
async def shopify_product_images(request: Request, product_id: str, shop: str | None = None):
    auth_shop = getattr(request.state, "shop", None) or shop
    if not auth_shop:
        raise HTTPException(status_code=401, detail="Missing shop context.")
    record = _get_shop_record(auth_shop, request.query_params.get("host"))
    access_token = record["access_token"]
    payload = {"fields": "id,src,position,alt"}
    response = await _shopify_rest(
        auth_shop,
        access_token,
        "GET",
        f"/products/{product_id}/images.json",
        payload,
    )
    return response


@app.get("/shopify/images/fetch")
async def shopify_fetch_image(request: Request, src: str, shop: str | None = None):
    auth_shop = getattr(request.state, "shop", None) or shop
    if not auth_shop:
        raise HTTPException(status_code=401, detail="Missing shop context.")
    _get_shop_record(auth_shop, request.query_params.get("host"))
    if not src:
        raise HTTPException(status_code=400, detail="Missing image source.")
    if not _is_allowed_shopify_image_url(src):
        raise HTTPException(status_code=400, detail="Unsupported image source.")

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(src)
        response.raise_for_status()
        content_type = response.headers.get("Content-Type", "image/jpeg")
        content = response.content

    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image exceeds 10MB limit.")

    encoded = base64.b64encode(content).decode("utf-8")
    data_url = f"data:{content_type};base64,{encoded}"
    return {"data_url": data_url}


@app.get("/shopify/health")
async def shopify_health():
    return {"ok": True, "timestamp": datetime.now(timezone.utc).isoformat()}


async def _handle_shopify_webhook(request: Request, delete_shop: bool = False) -> dict:
    try:
        raw_body = await request.body()
        hmac_header = request.headers.get("X-Shopify-Hmac-Sha256", "")
        if not _verify_webhook_hmac(raw_body, hmac_header):
            raise HTTPException(status_code=401, detail="Invalid webhook signature.")
        if delete_shop:
            shop = request.headers.get("X-Shopify-Shop-Domain", "")
            if _is_valid_shop_domain(shop):
                _delete_shop_record(shop)
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as exc:
        logging.exception("webhook_handler_failed error=%s", exc)
        raise HTTPException(status_code=401, detail="Invalid webhook signature.")


# Shopify CLI compliance_topics webhook (single endpoint for GDPR topics).
@app.post("/shopify/webhooks/compliance")
async def shopify_webhooks_compliance(request: Request):
    if not SHOPIFY_API_SECRET:
        raise HTTPException(status_code=401, detail="Invalid webhook signature.")
    topic = request.headers.get("X-Shopify-Topic", "")
    delete_shop = topic == "shop/redact"
    return await _handle_shopify_webhook(request, delete_shop=delete_shop)


# Canonical compliance webhook paths (preferred).
@app.post("/shopify/webhooks/app/uninstalled")
async def shopify_app_uninstalled(request: Request):
    return await _handle_shopify_webhook(request, delete_shop=True)


@app.post("/shopify/webhooks/customers/data_request")
async def shopify_customers_data_request(request: Request):
    return await _handle_shopify_webhook(request)


@app.post("/shopify/webhooks/customers/redact")
async def shopify_customers_redact(request: Request):
    return await _handle_shopify_webhook(request)


@app.post("/shopify/webhooks/shop/redact")
async def shopify_shop_redact(request: Request):
    return await _handle_shopify_webhook(request, delete_shop=True)


# Backward-compatible paths (legacy underscore URLs).
@app.post("/shopify/webhooks/app_uninstalled")
async def shopify_app_uninstalled_legacy(request: Request):
    return await _handle_shopify_webhook(request, delete_shop=True)


@app.post("/shopify/webhooks/customers_data_request")
async def shopify_customers_data_request_legacy(request: Request):
    return await _handle_shopify_webhook(request)


@app.post("/shopify/webhooks/customers_redact")
async def shopify_customers_redact_legacy(request: Request):
    return await _handle_shopify_webhook(request)


@app.post("/shopify/webhooks/shop_redact")
async def shopify_shop_redact_legacy(request: Request):
    return await _handle_shopify_webhook(request, delete_shop=True)
