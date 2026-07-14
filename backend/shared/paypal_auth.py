"""Shared Log in with PayPal (OpenID Connect) integration."""
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
        "scope": "openid profile email",
        "redirect_uri": Config.PAYPAL_REDIRECT_URI,
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
            "redirect_uri": Config.PAYPAL_REDIRECT_URI,
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
    return {
        "user_id": payload.get("user_id", payload.get("sub", "")),
        "name": payload.get("name", ""),
        "email": payload.get("email", ""),
        "verified": payload.get("verified_account", False),
    }
