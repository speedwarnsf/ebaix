import base64
from datetime import datetime, timezone
import os
import pathlib
import sys

import jwt
import pytest
from unittest.mock import patch
from fastapi import HTTPException

BACKEND_DIR = pathlib.Path(__file__).resolve().parents[1]
sys.path.append(str(BACKEND_DIR))

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault(
    "SUPABASE_SERVICE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ0ZXN0In0.c2ln",
)

from shopify_app import (
    _shop_from_host_param,
    _is_valid_shop_domain,
    _shop_from_session_token,
    _verify_session_token,
    _shopify_install_url,
    _make_oauth_state,
    _verify_oauth_state,
    _shopify_app_origin,
)


def test_shop_from_host_param_valid_admin_url():
    host_param = base64.b64encode(b"admin.shopify.com/store/test-store").decode("utf-8")
    assert _shop_from_host_param(host_param) == "test-store.myshopify.com"


def test_shop_from_host_param_valid_myshopify_url():
    host_param = base64.b64encode(b"test.myshopify.com/some/path").decode("utf-8")
    assert _shop_from_host_param(host_param) == "test.myshopify.com"


def test_shop_from_host_param_invalid():
    host_param = base64.b64encode(b"invalid").decode("utf-8")
    assert _shop_from_host_param(host_param) == ""


def test_shop_from_host_param_empty():
    assert _shop_from_host_param("") == ""


def test_shop_from_host_param_bad_base64():
    assert _shop_from_host_param("badbase64==") == ""


def test_is_valid_shop_domain_valid():
    assert _is_valid_shop_domain("test.myshopify.com") is True


def test_is_valid_shop_domain_invalid():
    assert _is_valid_shop_domain("invalid") is False


def test_is_valid_shop_domain_empty():
    assert _is_valid_shop_domain("") is False


def test_shop_from_session_token_valid_dest():
    payload = {"dest": "https://test.myshopify.com"}
    assert _shop_from_session_token(payload) == "test.myshopify.com"


def test_shop_from_session_token_valid_iss_admin():
    payload = {"iss": "https://test.myshopify.com/admin"}
    assert _shop_from_session_token(payload) == "test.myshopify.com"


def test_shop_from_session_token_valid_iss_store():
    payload = {"iss": "https://admin.shopify.com/store/test-store"}
    assert _shop_from_session_token(payload) == "test-store.myshopify.com"


def test_shop_from_session_token_valid_iss_myshopify():
    payload = {"iss": "https://test.myshopify.com"}
    assert _shop_from_session_token(payload) == "test.myshopify.com"


def test_shop_from_session_token_invalid_iss():
    payload = {"iss": "invalid"}
    assert _shop_from_session_token(payload) is None


def test_shop_from_session_token_no_iss_dest():
    assert _shop_from_session_token({}) is None


@patch("shopify_app.SHOPIFY_API_KEY", "api_key")
@patch("shopify_app.SHOPIFY_API_SECRET", "secret")
@patch("shopify_app.jwt.decode")
def test_verify_session_token_valid(mock_decode):
    mock_decode.return_value = {
        "iss": "https://test.myshopify.com/admin",
        "aud": "api_key",
        "exp": int(datetime.now(timezone.utc).timestamp()) + 3600,
        "sub": "sub",
        "iat": int(datetime.now(timezone.utc).timestamp()),
        "dest": "https://test.myshopify.com",
    }
    assert _verify_session_token("token") == mock_decode.return_value


@patch("shopify_app.SHOPIFY_API_KEY", "api_key")
@patch("shopify_app.SHOPIFY_API_SECRET", "secret")
@patch("shopify_app.jwt.decode")
def test_verify_session_token_invalid(mock_decode):
    mock_decode.side_effect = jwt.InvalidTokenError
    with pytest.raises(HTTPException) as exc:
        _verify_session_token("invalid")
    assert exc.value.status_code == 401


@patch("shopify_app.SHOPIFY_API_KEY", "api_key")
@patch("shopify_app.SHOPIFY_API_SECRET", "secret")
@patch("shopify_app.jwt.decode")
def test_verify_session_token_expired(mock_decode):
    mock_decode.side_effect = jwt.ExpiredSignatureError
    with pytest.raises(HTTPException) as exc:
        _verify_session_token("expired")
    assert exc.value.status_code == 401


@patch("shopify_app.SHOPIFY_API_KEY", "api_key")
@patch("shopify_app.SHOPIFY_API_SECRET", "secret")
@patch("shopify_app.SHOPIFY_SCOPES", "scopes")
@patch("shopify_app.SHOPIFY_OAUTH_CALLBACK", "callback")
@patch("shopify_app.SHOPIFY_APP_URL", "https://app.example.com/shopify/app")
def test_shopify_install_url_with_origin():
    assert _shopify_install_url("test.myshopify.com") == "https://app.example.com/shopify/install?shop=test.myshopify.com"


@patch("shopify_app.SHOPIFY_API_KEY", "api_key")
@patch("shopify_app.SHOPIFY_API_SECRET", "secret")
@patch("shopify_app.SHOPIFY_SCOPES", "scopes")
@patch("shopify_app.SHOPIFY_OAUTH_CALLBACK", "callback")
@patch("shopify_app.SHOPIFY_APP_URL", "")
@patch("shopify_app._make_oauth_state", return_value="state")
def test_shopify_install_url_no_origin(mock_state):
    assert _shopify_install_url("test.myshopify.com") == "https://test.myshopify.com/admin/oauth/authorize?client_id=api_key&scope=scopes&redirect_uri=callback&state=state"


@patch("shopify_app.SHOPIFY_API_KEY", "")
def test_shopify_install_url_no_key():
    assert _shopify_install_url("test.myshopify.com") == ""


@patch("shopify_app._is_valid_shop_domain", return_value=False)
def test_shopify_install_url_invalid_shop(mock_valid):
    assert _shopify_install_url("invalid") == ""


@patch("shopify_app.SHOPIFY_API_SECRET", "secret")
def test_make_verify_oauth_state_valid():
    state = _make_oauth_state("test.myshopify.com")
    assert _verify_oauth_state(state, "test.myshopify.com") is True


@patch("shopify_app.SHOPIFY_API_SECRET", "secret")
def test_verify_oauth_state_invalid_shop():
    state = _make_oauth_state("test.myshopify.com")
    assert _verify_oauth_state(state, "wrong.myshopify.com") is False


@patch("shopify_app.SHOPIFY_API_SECRET", "secret")
def test_verify_oauth_state_expired():
    payload = {
        "shop": "test.myshopify.com",
        "iat": int(datetime.now(timezone.utc).timestamp()) - 700,
        "exp": int(datetime.now(timezone.utc).timestamp()) - 100,
    }
    state = jwt.encode(payload, "secret", algorithm="HS256")
    assert _verify_oauth_state(state, "test.myshopify.com") is False


@patch("shopify_app.SHOPIFY_API_SECRET", "")
def test_make_oauth_state_no_secret():
    state = _make_oauth_state("test.myshopify.com")
    assert len(state) > 0
    assert _verify_oauth_state(state, "test.myshopify.com") is False


@patch("shopify_app.SHOPIFY_APP_URL", "https://app.example.com/shopify/app")
def test_shopify_app_origin_valid():
    assert _shopify_app_origin() == "https://app.example.com"


@patch("shopify_app.SHOPIFY_APP_URL", "invalid")
def test_shopify_app_origin_invalid():
    assert _shopify_app_origin() == ""


@patch("shopify_app.SHOPIFY_APP_URL", "")
def test_shopify_app_origin_empty():
    assert _shopify_app_origin() == ""
