"""Isolated PayPal Sandbox checkout client for Forex purchases."""
import time

import requests

from ...config import Config

_token_cache = {"token": None, "exp": 0}


def configured() -> bool:
    return bool(Config.PAYPAL_CLIENT_ID and Config.PAYPAL_CLIENT_SECRET)


def app_token() -> str:
    if _token_cache["token"] and time.time() < _token_cache["exp"] - 60:
        return _token_cache["token"]
    response = requests.post(
        f"{Config.PAYPAL_BASE}/v1/oauth2/token",
        auth=(Config.PAYPAL_CLIENT_ID, Config.PAYPAL_CLIENT_SECRET),
        data={"grant_type": "client_credentials"},
        timeout=15,
    )
    response.raise_for_status()
    payload = response.json()
    _token_cache.update(
        token=payload["access_token"],
        exp=time.time() + payload.get("expires_in", 300),
    )
    return payload["access_token"]


def create_order(sgd_amount: str, description: str, return_url: str, cancel_url: str) -> dict:
    response = requests.post(
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
                "brand_name": "StraitsFX",
                "user_action": "PAY_NOW",
                "return_url": return_url,
                "cancel_url": cancel_url,
            },
        },
        timeout=20,
    )
    response.raise_for_status()
    payload = response.json()
    approve_url = next(
        (link["href"] for link in payload.get("links", []) if link.get("rel") == "approve"),
        None,
    )
    return {"id": payload["id"], "status": payload["status"], "approve_url": approve_url}


def capture_order(order_id: str) -> dict:
    response = requests.post(
        f"{Config.PAYPAL_BASE}/v2/checkout/orders/{order_id}/capture",
        headers={
            "Authorization": f"Bearer {app_token()}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        timeout=20,
    )
    response.raise_for_status()
    return response.json()


def get_order(order_id: str) -> dict:
    """Return PayPal's current representation of a checkout order."""
    response = requests.get(
        f"{Config.PAYPAL_BASE}/v2/checkout/orders/{order_id}",
        headers={"Authorization": f"Bearer {app_token()}"},
        timeout=15,
    )
    response.raise_for_status()
    return response.json()


def get_capture(capture_id: str) -> dict:
    """Return final settlement details for a captured payment."""
    response = requests.get(
        f"{Config.PAYPAL_BASE}/v2/payments/captures/{capture_id}",
        headers={"Authorization": f"Bearer {app_token()}"},
        timeout=15,
    )
    response.raise_for_status()
    return response.json()
