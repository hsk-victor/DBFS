"""Zavier's independent Crypto authentication session."""
import secrets

from flask import Blueprint, jsonify, redirect, request, session

from ..config import Config
from . import paypal_auth as paypal

auth_bp = Blueprint("zavier_auth", __name__)
USER_KEY = "zavier_user"
STATE_KEY = "zavier_oauth_state"


def current_user():
    return session.get(USER_KEY)


def require_user():
    user = current_user()
    if not user:
        return None, (jsonify({"error": "not authenticated"}), 401)
    return user, None


@auth_bp.get("/login")
def login():
    if not paypal.configured():
        return jsonify({"error": "PayPal not configured - use the Crypto demo login"}), 503
    state = secrets.token_urlsafe(16)
    session[STATE_KEY] = state
    return redirect(paypal.authorize_url(state))


@auth_bp.get("/callback")
def callback():
    if request.args.get("state") != session.pop(STATE_KEY, None):
        return jsonify({"error": "state mismatch"}), 400
    code = request.args.get("code")
    if not code:
        return redirect(f"{Config.FRONTEND_URL}?section=Crypto&login=cancelled")
    token = paypal.exchange_code(code)
    user = paypal.userinfo(token)
    user["demo"] = False
    session[USER_KEY] = user
    return redirect(f"{Config.FRONTEND_URL}?section=Crypto")


@auth_bp.post("/demo")
def demo_login():
    user = {
        "user_id": "demo-user-001",
        "name": "Tan Wei Ming",
        "given_name": "Tan",
        "family_name": "Wei Ming",
        "email": "tan.wm@sandbox.paypal.com",
        "email_verified": True,
        "verified": True,
        "payer_id": "DEMO-PAYER-001",
        "address": {
            "street_address": "10 Marina Boulevard",
            "locality": "Singapore",
            "region": "Singapore",
            "country": "SG",
            "postal_code": "018983",
        },
        "demo": True,
    }
    session[USER_KEY] = user
    return jsonify(user)


@auth_bp.get("/me")
def me():
    user = current_user()
    if not user:
        return jsonify({"authenticated": False, "paypal_configured": paypal.configured()})
    return jsonify({"authenticated": True, "paypal_configured": paypal.configured(), "user": user})


@auth_bp.post("/logout")
def logout():
    session.pop(USER_KEY, None)
    session.pop(STATE_KEY, None)
    return jsonify({"ok": True})
