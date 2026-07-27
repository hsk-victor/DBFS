"""Ong Xuan's Log in with PayPal (OpenID Connect) integration."""
from urllib.parse import urlencode

import requests

from ..config import Config


def configured() -> bool:
    return bool(Config.PAYPAL_CLIENT_ID and Config.PAYPAL_CLIENT_SECRET)


def authorize_url(state: str) -> str:
    query = urlencode({
        "flowEntry": "static",
        "client_id": Config.PAYPAL_CLIENT_ID,
        "response_type": "code",
        "scope": (
            "openid profile email address "
            "https://uri.paypal.com/services/paypalattributes"
        ),
        "redirect_uri": Config.ONG_XUAN_PAYPAL_REDIRECT_URI,
        "state": state,
    })
    return f"{Config.PAYPAL_WEB}/signin/authorize?{query}"


def exchange_code(code: str) -> str:
    response = requests.post(
        f"{Config.PAYPAL_BASE}/v1/oauth2/token",
        auth=(Config.PAYPAL_CLIENT_ID, Config.PAYPAL_CLIENT_SECRET),
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": Config.ONG_XUAN_PAYPAL_REDIRECT_URI,
        },
        timeout=15,
    )
    response.raise_for_status()
    return response.json()["access_token"]


def userinfo(user_access_token: str) -> dict:
    response = requests.get(
        f"{Config.PAYPAL_BASE}/v1/identity/openidconnect/userinfo",
        params={"schema": "openid"},
        headers={"Authorization": f"Bearer {user_access_token}"},
        timeout=15,
    )
    response.raise_for_status()
    payload = response.json()
    address = payload.get("address") or {}
    given = str(payload.get("given_name") or "").strip()
    family = str(payload.get("family_name") or "").strip()
    full_name = (
        str(payload.get("name") or "").strip()
        or " ".join(value for value in (given, family) if value).strip()
    )
    return {
        "user_id": payload.get("user_id", payload.get("sub", "")),
        "name": full_name,
        "email": payload.get("email", ""),
        "verified": payload.get("verified_account", False),
        "given_name": given,
        "family_name": family,
        "email_verified": payload.get("email_verified", False),
        "payer_id": payload.get("payer_id", payload.get("user_id", payload.get("sub", ""))),
        "address": {
            "street_address": address.get("street_address", ""),
            "locality": address.get("locality", ""),
            "region": address.get("region", ""),
            "country": address.get("country", ""),
            "postal_code": address.get("postal_code", ""),
        },
    }
