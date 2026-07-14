"""Victor's PayPal Sandbox checkout integration.

Graded URIs: POST /v2/checkout/orders, POST /v2/checkout/orders/{id}/capture,
GET /v2/checkout/orders/{id}. (OAuth token endpoint excluded from the tally.)
"""
import time

import requests

from ...config import Config

_token_cache = {"token": None, "exp": 0}


def configured() -> bool:
    return bool(Config.PAYPAL_CLIENT_ID and Config.PAYPAL_CLIENT_SECRET)


def app_token() -> str:
    """Client-credentials token for the Orders API (cached until expiry)."""
    if _token_cache["token"] and time.time() < _token_cache["exp"] - 60:
        return _token_cache["token"]
    r = requests.post(
        f"{Config.PAYPAL_BASE}/v1/oauth2/token",
        auth=(Config.PAYPAL_CLIENT_ID, Config.PAYPAL_CLIENT_SECRET),
        data={"grant_type": "client_credentials"},
        timeout=15)
    r.raise_for_status()
    j = r.json()
    _token_cache.update(token=j["access_token"], exp=time.time() + j.get("expires_in", 300))
    return j["access_token"]


# ---------- Checkout Orders v2 ----------
def create_order(sgd_amount: str, description: str, return_url: str, cancel_url: str) -> dict:
    r = requests.post(
        f"{Config.PAYPAL_BASE}/v2/checkout/orders",
        headers={"Authorization": f"Bearer {app_token()}", "Content-Type": "application/json"},
        json={
            "intent": "CAPTURE",
            "purchase_units": [{
                "amount": {"currency_code": "SGD", "value": sgd_amount},
                "description": description,
                **({"payee": {"email_address": Config.PAYPAL_MERCHANT_EMAIL}}
                   if Config.PAYPAL_MERCHANT_EMAIL else {}),
            }],
            "application_context": {
                "brand_name": "Straits Digital Bank",
                "user_action": "PAY_NOW",
                "return_url": return_url,
                "cancel_url": cancel_url,
            },
        },
        timeout=20)
    r.raise_for_status()
    j = r.json()
    approve = next((l["href"] for l in j.get("links", []) if l["rel"] == "approve"), None)
    return {"id": j["id"], "status": j["status"], "approve_url": approve}


def capture_order(order_id: str) -> dict:
    r = requests.post(
        f"{Config.PAYPAL_BASE}/v2/checkout/orders/{order_id}/capture",
        headers={"Authorization": f"Bearer {app_token()}", "Content-Type": "application/json"},
        timeout=20)
    r.raise_for_status()
    return r.json()


def get_order(order_id: str) -> dict:
    r = requests.get(
        f"{Config.PAYPAL_BASE}/v2/checkout/orders/{order_id}",
        headers={"Authorization": f"Bearer {app_token()}"},
        timeout=15)
    r.raise_for_status()
    return r.json()
