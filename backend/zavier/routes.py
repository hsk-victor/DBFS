"""Crypto API routes for Zavier's feature area."""

from flask import Blueprint, jsonify, request

from .services.GNews import search_symbol_strict
from .services.coingecko import fundamentals_all, market_chart_all
from .services.eodhd import eod_series_all, realtime_prices, usd_sgd
from .services.paypal import userinfo_strict

crypto_bp = Blueprint("crypto", __name__)

# NOT COUNTED WITHIN THE 10 URIS
@crypto_bp.get("/fx") 
def fx():
    force = str(request.args.get("force", "false")).lower() in {"1", "true", "yes", "on"}
    payload, source = usd_sgd(force=force)
    return jsonify({**payload, "source": source})

# NOT COUNTED WITHIN THE 10 URIS
@crypto_bp.get("/health")
def health():
    return jsonify({"ok": True, "module": "crypto", "owner": "Zavier"})


@crypto_bp.get("/paypal/profile")
def paypal_profile():
    auth = request.headers.get("Authorization", "")
    token = ""
    if auth.lower().startswith("bearer "):
        token = auth[7:].strip()
    if not token:
        token = str(request.args.get("token", "")).strip()
    if not token:
        return jsonify({"ok": False, "error": "missing PayPal user token (Bearer token or ?token=...)"}), 400

    try:
        payload = userinfo_strict(token)
        return jsonify({"ok": True, "user": payload})
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 502


@crypto_bp.get("/prices")
def prices():
    force = str(request.args.get("force", "false")).lower() in {"1", "true", "yes", "on"}
    payload = realtime_prices(force=force)
    return jsonify({"symbols": ["BTC", "ETH", "XRP"], "items": payload})


@crypto_bp.get("/eod")
def eod():
    force = str(request.args.get("force", "false")).lower() in {"1", "true", "yes", "on"}
    payload = eod_series_all(force=force)
    return jsonify({"symbols": ["BTC", "ETH", "XRP"], "items": payload})


@crypto_bp.get("/fundamentals")
def fundamentals():
    force = str(request.args.get("force", "false")).lower() in {"1", "true", "yes", "on"}
    payload = fundamentals_all(force=force)
    return jsonify({"symbols": ["BTC", "ETH", "XRP"], "items": payload})


@crypto_bp.get("/chart")
def chart():
    force = str(request.args.get("force", "false")).lower() in {"1", "true", "yes", "on"}
    payload = market_chart_all(force=force)
    return jsonify({"symbols": ["BTC", "ETH", "XRP"], "items": payload})


@crypto_bp.get("/news")
def news():
    symbol = str(request.args.get("symbol", "")).strip().upper()
    if not symbol:
        return jsonify({"ok": False, "error": "missing symbol query param (use BTC, ETH, or XRP)"}), 400
    try:
        payload = search_symbol_strict(symbol)
        return jsonify({**payload, "source": "live"})
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 502


def register_blueprints(app):
    app.register_blueprint(crypto_bp, url_prefix="/api/crypto")