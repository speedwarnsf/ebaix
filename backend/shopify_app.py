import base64
import hashlib
import hmac
import os
import re
from io import BytesIO
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urlencode

import httpx
import asyncio
import jwt
import logging
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from PIL import Image
from pillow_heif import register_heif_opener
from pydantic import BaseModel
from supabase import Client, create_client

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

SHOPIFY_API_KEY = os.environ.get("SHOPIFY_API_KEY")
SHOPIFY_API_SECRET = os.environ.get("SHOPIFY_API_SECRET")
SHOPIFY_SCOPES = os.environ.get("SHOPIFY_SCOPES", "read_products,write_products,write_webhooks")
SHOPIFY_APP_URL = os.environ.get("SHOPIFY_APP_URL", "https://app.nudio.ai/shopify/app")
SHOPIFY_OAUTH_CALLBACK = os.environ.get(
    "SHOPIFY_OAUTH_CALLBACK", "https://app.nudio.ai/shopify/oauth/callback"
)
SHOPIFY_TEST_BILLING = os.environ.get("SHOPIFY_TEST_BILLING", "false").lower() in ("1", "true", "yes")
SHOPIFY_SHOPS_TABLE = os.environ.get("SHOPIFY_SHOPS_TABLE", "shopify_shops")
SHOPIFY_FRONTEND_BUILD_DIR = os.environ.get(
    "SHOPIFY_FRONTEND_BUILD_DIR",
    str(Path(__file__).resolve().parents[1] / "frontend-shopify" / "build"),
)

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
    path = request.url.path
    public_paths = (
        "/shopify/install",
        "/shopify/oauth/callback",
        "/shopify/app",
        "/shopify/health",
        "/shopify/webhooks/app/uninstalled",
        "/shopify/webhooks/customers/data_request",
        "/shopify/webhooks/customers/redact",
        "/shopify/webhooks/shop/redact",
        "/shopify/webhooks/app_uninstalled",
        "/shopify/webhooks/customers_redact",
        "/shopify/webhooks/customers_data_request",
        "/shopify/webhooks/shop_redact",
    )
    if path.startswith("/shopify/app/") or path in public_paths:
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
        frame_ancestors = "'none'"
    response.headers["Content-Security-Policy"] = f"frame-ancestors {frame_ancestors};"
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
        match = re.search(r"([a-zA-Z0-9\\-]+\\.myshopify\\.com)", decoded)
        return match.group(1) if match else ""
    match = re.search(r"admin\\.shopify\\.com/store/([^/?#]+)", decoded)
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
    if not hmac_header:
        return False
    digest = hmac.new(
        SHOPIFY_API_SECRET.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).digest()
    computed = base64.b64encode(digest).decode("utf-8")
    return hmac.compare_digest(computed, hmac_header)


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


async def _ensure_webhooks(shop: str, access_token: str) -> None:
    webhook_topics = {
        "app/uninstalled": "/shopify/webhooks/app/uninstalled",
        "customers/data_request": "/shopify/webhooks/customers/data_request",
        "customers/redact": "/shopify/webhooks/customers/redact",
        "shop/redact": "/shopify/webhooks/shop/redact",
    }
    webhook_base = SHOPIFY_APP_URL
    if webhook_base.endswith("/shopify/app"):
        webhook_base = webhook_base[: -len("/shopify/app")]
    elif webhook_base.endswith("/shopify"):
        webhook_base = webhook_base[: -len("/shopify")]

    try:
        existing = await _shopify_rest(
            shop,
            access_token,
            "GET",
            "/webhooks.json",
            {"fields": "id,topic,address"},
        )
    except httpx.HTTPStatusError as exc:
        logging.warning("webhook_list_failed shop=%s status=%s", shop, exc.response.status_code)
        return
    current = {
        webhook["topic"]: webhook
        for webhook in existing.get("webhooks", [])
        if webhook.get("topic") in webhook_topics
    }

    for topic, path in webhook_topics.items():
        address = f"{webhook_base}{path}"
        if topic in current:
            existing_webhook = current[topic]
            if existing_webhook.get("address") == address:
                continue
            webhook_id = existing_webhook.get("id")
            if webhook_id:
                payload = {
                    "webhook": {
                        "id": webhook_id,
                        "address": address,
                        "format": "json",
                    }
                }
                try:
                    await _shopify_rest(shop, access_token, "PUT", f"/webhooks/{webhook_id}.json", payload)
                except httpx.HTTPStatusError as exc:
                    logging.warning("webhook_update_failed shop=%s topic=%s status=%s", shop, topic, exc.response.status_code)
                continue
        payload = {
            "webhook": {
                "topic": topic,
                "address": address,
                "format": "json",
            }
        }
        try:
            await _shopify_rest(shop, access_token, "POST", "/webhooks.json", payload)
        except httpx.HTTPStatusError as exc:
            logging.warning("webhook_create_failed shop=%s topic=%s status=%s", shop, topic, exc.response.status_code)


def _get_shop_record(shop: str) -> dict:
    result = supabase.table(SHOPIFY_SHOPS_TABLE).select("*").eq("shop_domain", shop).limit(1).execute()
    data = result.data[0] if result.data else None
    if not data:
        raise HTTPException(
            status_code=401,
            detail={
                "error": "shop_not_installed",
                "install_url": _shopify_install_url(shop),
            },
        )
    return data


def _shopify_install_url(shop: str) -> str:
    if not SHOPIFY_API_KEY or not SHOPIFY_API_SECRET:
        return ""
    if not _is_valid_shop_domain(shop):
        return ""
    state = base64.urlsafe_b64encode(os.urandom(24)).decode("utf-8").rstrip("=")
    params = {
        "client_id": SHOPIFY_API_KEY,
        "scope": SHOPIFY_SCOPES,
        "redirect_uri": SHOPIFY_OAUTH_CALLBACK,
        "state": state,
    }
    return f"https://{shop}/admin/oauth/authorize?{urlencode(params)}"


async def _shopify_graphql(shop: str, access_token: str, query: str, variables: dict | None = None) -> dict:
    url = f"https://{shop}/admin/api/2024-10/graphql.json"
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
    url = f"https://{shop}/admin/api/2024-10/{path.lstrip('/')}"
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


def _shop_from_issuer(issuer: str) -> str | None:
    if not issuer:
        return None
    if issuer.startswith("https://") and issuer.endswith("/admin"):
        return issuer.replace("https://", "").replace("/admin", "")
    if issuer.startswith("https://admin.shopify.com/store/"):
        slug = issuer.split("/store/", 1)[-1].strip("/")
        if slug:
            return f"{slug}.myshopify.com"
    if issuer.startswith("https://") and ".myshopify.com" in issuer:
        return issuer.replace("https://", "").strip("/")
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
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="Session token expired.") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="Invalid session token.") from exc
    shop = _shop_from_session_token(payload)
    if not shop or not _is_valid_shop_domain(shop):
        raise HTTPException(status_code=401, detail="Invalid session token shop.")
    issuer = payload.get("iss")
    expected_issuer = f"https://{shop}/admin"
    expected_store_issuer = f"https://{shop}"
    expected_admin_store = f"https://admin.shopify.com/store/{shop.replace('.myshopify.com', '')}"
    issuer_ok = issuer in (expected_issuer, expected_store_issuer, expected_admin_store)
    if not issuer_ok and isinstance(issuer, str) and issuer.endswith("/admin/"):
        issuer_ok = issuer.rstrip("/") in (expected_issuer, expected_store_issuer, expected_admin_store)
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
    description: str = "Nudio image processing"
    price: float = 0.08


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


@app.get("/shopify/app")
async def shopify_app_root():
    index_path = _frontend_index_path()
    if not index_path.exists():
        raise HTTPException(status_code=500, detail="Shopify frontend build missing.")
    return FileResponse(index_path)


@app.get("/shopify/app/{full_path:path}")
async def shopify_app_catchall(full_path: str):
    index_path = _frontend_index_path()
    if not index_path.exists():
        raise HTTPException(status_code=500, detail="Shopify frontend build missing.")
    asset_path = _resolve_build_asset(full_path)
    if asset_path and asset_path.is_file():
        return FileResponse(asset_path)
    return FileResponse(index_path)


@app.get("/shopify/install")
async def shopify_install(shop: str):
    if not SHOPIFY_API_KEY or not SHOPIFY_API_SECRET:
        raise HTTPException(status_code=500, detail="Missing Shopify API config.")
    if not _is_valid_shop_domain(shop):
        raise HTTPException(status_code=400, detail="Invalid shop domain.")

    state = base64.urlsafe_b64encode(os.urandom(24)).decode("utf-8").rstrip("=")
    params = {
        "client_id": SHOPIFY_API_KEY,
        "scope": SHOPIFY_SCOPES,
        "redirect_uri": SHOPIFY_OAUTH_CALLBACK,
        "state": state,
    }
    install_url = f"https://{shop}/admin/oauth/authorize?{urlencode(params)}"
    response = RedirectResponse(url=install_url, status_code=302)
    response.set_cookie(
        "shopify_oauth_state",
        state,
        httponly=True,
        secure=True,
        samesite="lax",
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
    if not cookie_state or cookie_state != state:
        raise HTTPException(status_code=400, detail="Invalid OAuth state.")

    token_payload = await _exchange_token(shop, code)
    access_token = token_payload.get("access_token")
    scope = token_payload.get("scope", "")

    if not access_token:
        raise HTTPException(status_code=400, detail="Missing access token from Shopify.")

    _store_shop_token(shop, access_token, scope)
    await _ensure_webhooks(shop, access_token)

    redirect_host = host or _base64_host(shop)
    app_url = f"{SHOPIFY_APP_URL}?shop={shop}&host={redirect_host}"
    return RedirectResponse(url=app_url, status_code=302)


@app.get("/shopify/billing/active")
async def shopify_billing_active(request: Request, shop: str | None = None):
    auth_shop = getattr(request.state, "shop", None) or shop
    if not auth_shop:
        raise HTTPException(status_code=401, detail="Missing shop context.")
    record = _get_shop_record(auth_shop)
    access_token = record["access_token"]
    query = """
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
    data = await _shopify_graphql(auth_shop, access_token, query)
    subscriptions = data.get("data", {}).get("currentAppInstallation", {}).get("activeSubscriptions", [])
    return {"subscriptions": subscriptions}


@app.post("/shopify/billing/ensure")
async def shopify_billing_ensure(request: Request, shop: str | None = None, host: str | None = None):
    auth_shop = getattr(request.state, "shop", None) or shop
    if not auth_shop:
        raise HTTPException(status_code=401, detail="Missing shop context.")
    record = _get_shop_record(auth_shop)
    access_token = record["access_token"]
    query = """
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
    existing = await _shopify_graphql(auth_shop, access_token, query)
    subscriptions = existing.get("data", {}).get("currentAppInstallation", {}).get("activeSubscriptions", [])
    for subscription in subscriptions:
        if subscription.get("name") == "Nudio (Product Studio)":
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
    return_url = SHOPIFY_APP_URL
    if host:
        return_url = f"{SHOPIFY_APP_URL}?shop={auth_shop}&host={host}"

    variables = {
        "name": "Nudio (Product Studio)",
        "returnUrl": return_url,
        "terms": "8 cents per image, billed through Shopify.",
        "test": SHOPIFY_TEST_BILLING,
    }
    created = await _shopify_graphql(auth_shop, access_token, mutation, variables)
    payload = created.get("data", {}).get("appSubscriptionCreate", {})
    if payload.get("userErrors"):
        raise HTTPException(status_code=400, detail=payload["userErrors"])
    return {"active": False, "confirmationUrl": payload.get("confirmationUrl")}


@app.post("/shopify/webhooks/register")
async def shopify_webhooks_register(request: Request, shop: str | None = None):
    auth_shop = getattr(request.state, "shop", None) or shop
    if not auth_shop:
        raise HTTPException(status_code=401, detail="Missing shop context.")
    record = _get_shop_record(auth_shop)
    access_token = record.get("access_token", "")
    if not access_token:
        raise HTTPException(status_code=401, detail="Missing Shopify access token.")
    await _ensure_webhooks(auth_shop, access_token)
    return {"ok": True}


@app.post("/shopify/billing/usage")
async def shopify_billing_usage(request: Request, payload: UsageChargeRequest, shop: str | None = None):
    auth_shop = getattr(request.state, "shop", None) or shop
    if not auth_shop:
        raise HTTPException(status_code=401, detail="Missing shop context.")
    _check_rate_limit(auth_shop, "billing_usage")
    record = _get_shop_record(auth_shop)
    access_token = record["access_token"]
    description = payload.description
    price = payload.price
    if price <= 0:
        raise HTTPException(status_code=400, detail="Invalid price.")
    query = """
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
    data = await _shopify_graphql(auth_shop, access_token, query)
    subscriptions = data.get("data", {}).get("currentAppInstallation", {}).get("activeSubscriptions", [])
    usage_line_item_id = None
    for subscription in subscriptions:
        if subscription.get("name") != "Nudio (Product Studio)":
            continue
        for line_item in subscription.get("lineItems", []):
            pricing = line_item.get("plan", {}).get("pricingDetails", {})
            if pricing.get("__typename") == "AppUsagePricing":
                usage_line_item_id = line_item.get("id")
                break
    if not usage_line_item_id:
        raise HTTPException(status_code=400, detail="No active usage plan found.")

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
        "amount": {"amount": price, "currencyCode": "USD"},
    }
    created = await _shopify_graphql(auth_shop, access_token, mutation, variables)
    payload = created.get("data", {}).get("appUsageRecordCreate", {})
    if payload.get("userErrors"):
        raise HTTPException(status_code=400, detail=payload["userErrors"])
    logging.info("billing_usage shop=%s usage_id=%s amount=%.2f", auth_shop, payload.get("appUsageRecord", {}).get("id"), price)
    return {"ok": True, "usageRecordId": payload.get("appUsageRecord", {}).get("id")}


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
    record = _get_shop_record(auth_shop)
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

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "apikey": SUPABASE_SERVICE_KEY,
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
    return response.json()


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
    record = _get_shop_record(auth_shop)
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
    record = _get_shop_record(auth_shop)
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
    if not src:
        raise HTTPException(status_code=400, detail="Missing image source.")
    allowed_hosts = ("cdn.shopify.com", ".myshopify.com")
    if not any(host in src for host in allowed_hosts):
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
    raw_body = await request.body()
    hmac_header = request.headers.get("X-Shopify-Hmac-Sha256", "")
    if not _verify_webhook_hmac(raw_body, hmac_header):
        raise HTTPException(status_code=401, detail="Invalid webhook signature.")
    if delete_shop:
        shop = request.headers.get("X-Shopify-Shop-Domain", "")
        if _is_valid_shop_domain(shop):
            _delete_shop_record(shop)
    return {"ok": True}


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
