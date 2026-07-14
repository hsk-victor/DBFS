"""PayPal login. Real 'Log in with PayPal' when keys are configured,
plus a demo login so the app runs with zero setup."""
import secrets

from flask import Blueprint, jsonify, redirect, request, session

from ..config import Config
from . import paypal_auth as paypal

auth_bp = Blueprint("auth", __name__)


def current_user():
    return session.get("user")


def require_user():
    u = current_user()
    if not u:
        return None, (jsonify({"error": "not authenticated"}), 401)
    return u, None


@auth_bp.get("/login")
def login():
    if not paypal.configured():
        return jsonify({"error": "PayPal not configured — use /api/auth/demo"}), 503
    state = secrets.token_urlsafe(16)
    session["oauth_state"] = state
    return redirect(paypal.authorize_url(state))


@auth_bp.get("/callback")
def callback():
    if request.args.get("state") != session.pop("oauth_state", None):
        return jsonify({"error": "state mismatch"}), 400
    code = request.args.get("code")
    if not code:
        return redirect(Config.FRONTEND_URL + "?login=cancelled")
    token = paypal.exchange_code(code)
    user = paypal.userinfo(token)
    user["demo"] = False
    session["user"] = user
    return redirect(Config.FRONTEND_URL)


@auth_bp.post("/demo")
def demo_login():
    user = {
        "user_id": "demo-user-001",
        "name": "Tan Wei Ming",
        "email": "tan.wm@sandbox.paypal.com",
        "verified": True,
        "demo": True,
    }
    session["user"] = user
    return jsonify(user)


@auth_bp.get("/me")
def me():
    u = current_user()
    if not u:
        return jsonify({"authenticated": False, "paypal_configured": paypal.configured()})
    return jsonify({"authenticated": True, "paypal_configured": paypal.configured(), "user": u})


@auth_bp.post("/logout")
def logout():
    session.clear()
    return jsonify({"ok": True})
