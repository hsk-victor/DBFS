"""Ong Xuan's persistent, quote-bound Forex feature."""
import secrets
import time
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from urllib.parse import urlencode

import requests
from flask import Blueprint, jsonify, redirect, request

from ..config import Config
from .auth import require_user
from .services import paypal
from .services.store import PersistenceError, store

forex_bp = Blueprint("ong_xuan_forex", __name__)

SUPPORTED = {
    "USD": {"name": "US Dollar", "flag": "🇺🇸", "fallback": Decimal("1.3500")},
    "EUR": {"name": "Euro", "flag": "🇪🇺", "fallback": Decimal("1.4700")},
    "GBP": {"name": "British Pound", "flag": "🇬🇧", "fallback": Decimal("1.7200")},
}
RATES_KEY = "forex:rates:SGD"
COMPARISON_KEY = "forex:comparison:SGD"
HISTORY_KEY = "forex:history:ALL:7d"


def _money(value):
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _rate(value):
    return Decimal(str(value)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def _as_decimal(value, field):
    try:
        number = Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise ValueError(f"{field} must be a number")
    if not number.is_finite():
        raise ValueError(f"{field} must be finite")
    if number <= 0:
        raise ValueError(f"{field} must be positive")
    return number


def _fallback_rates():
    return {
        "rates": {code: float(cfg["fallback"]) for code, cfg in SUPPORTED.items()},
        "date": "", "source": "Fixed fallback rates", "demo": True,
    }


def _live_rates():
    response = requests.get(
        "https://api.frankfurter.dev/v1/latest",
        params={"base": "SGD", "symbols": "USD,EUR,GBP"}, timeout=12,
    )
    response.raise_for_status()
    data = response.json()
    return {
        "rates": {code: float(_rate(Decimal("1") / Decimal(str(data["rates"][code]))))
                  for code in SUPPORTED},
        "date": data.get("date", ""), "source": "Frankfurter API", "demo": False,
    }


def get_rates():
    cached = store.cache_get(RATES_KEY, 300)
    if cached:
        return cached
    try:
        payload = _live_rates()
        store.cache_put(RATES_KEY, payload)
        return payload
    except Exception:
        return store.cache_get_stale(RATES_KEY) or _fallback_rates()


def _live_comparison():
    primary = get_rates()
    response = requests.get("https://open.er-api.com/v6/latest/SGD", timeout=12)
    response.raise_for_status()
    data = response.json()
    backup = {code: float(_rate(Decimal("1") / Decimal(str(data["rates"][code]))))
              for code in SUPPORTED}
    return {
        "comparison": [{
            "code": code, "pair": f"{code}/SGD",
            "primary_rate": float(primary["rates"][code]),
            "primary_source": primary["source"],
            "backup_rate": backup[code], "backup_source": "Open Exchange Rate API",
            "difference": float(_rate(Decimal(str(primary["rates"][code])) - Decimal(str(backup[code])))),
        } for code in ("USD", "EUR", "GBP")],
        "primary_source": primary["source"], "backup_source": "Open Exchange Rate API",
    }


def get_comparison():
    cached = store.cache_get(COMPARISON_KEY, 300)
    if cached:
        return cached
    try:
        payload = _live_comparison()
        store.cache_put(COMPARISON_KEY, payload)
        return payload
    except Exception:
        stale = store.cache_get_stale(COMPARISON_KEY)
        if stale:
            return stale
        rates = _fallback_rates()
        return {
            "comparison": [{
                "code": code, "pair": f"{code}/SGD",
                "primary_rate": rates["rates"][code], "primary_source": rates["source"],
                "backup_rate": rates["rates"][code], "backup_source": rates["source"],
                "difference": 0.0,
            } for code in ("USD", "EUR", "GBP")],
            "primary_source": rates["source"], "backup_source": rates["source"],
        }


def _live_history():
    end = date.today()
    start = end - timedelta(days=7)
    response = requests.get(
        f"https://api.frankfurter.dev/v1/{start}..{end}",
        params={"base": "SGD", "symbols": "USD,EUR,GBP"}, timeout=12,
    )
    response.raise_for_status()
    data = response.json()
    history = []
    for day, values in data.get("rates", {}).items():
        item = {"date": day}
        for code in SUPPORTED:
            item[code] = float(_rate(Decimal("1") / Decimal(str(values[code]))))
        history.append(item)
    return {"source": "Frankfurter API", "history": history}


def get_rate_history():
    cached = store.cache_get(HISTORY_KEY, 3600)
    if cached:
        return cached
    try:
        payload = _live_history()
        store.cache_put(HISTORY_KEY, payload)
        return payload
    except Exception:
        return store.cache_get_stale(HISTORY_KEY) or {"source": "No history available", "history": []}


def _format_rates(payload):
    return {
        "date": payload.get("date", ""), "source": payload["source"],
        "demo": payload.get("demo", False), "base": "SGD",
        "rates": [{
            "code": code, "pair": f"{code}/SGD", "name": SUPPORTED[code]["name"],
            "flag": SUPPORTED[code]["flag"], "sgd_per_unit": float(payload["rates"][code]),
        } for code in ("USD", "EUR", "GBP")],
    }


def _frontend_redirect(status, order_id=""):
    query = urlencode({"section": "Forex", "forex_status": status,
                       **({"forex_order_id": order_id} if order_id else {})})
    return redirect(f"{Config.FRONTEND_URL}?{query}")


def _complete_order(user_id, order):
    """Idempotently complete through the store's transactional path."""
    latest = store.find_order(user_id, order["order_id"])
    if not latest:
        return None
    if latest.get("status") == "filled":
        return latest
    if latest.get("status") != "pending_paypal":
        return None
    return store.complete_order(user_id, latest["order_id"])


@forex_bp.errorhandler(PersistenceError)
def persistence_error(exc):
    return jsonify({"error": str(exc)}), 503


@forex_bp.get("/health")
def health():
    return jsonify({
        "ok": store.storage_status != "misconfigured",
        "module": "forex", "owner": "Ong Xuan",
        "storage": store.storage_status,
        "paypal_checkout": paypal.configured(),
    })


@forex_bp.get("/rates")
def rates():
    return jsonify(_format_rates(get_rates()))


@forex_bp.get("/rate-comparison")
def rate_comparison():
    return jsonify(get_comparison())


@forex_bp.get("/history")
def rate_history():
    return jsonify(get_rate_history())


@forex_bp.post("/quote")
def quote():
    user, err = require_user()
    if err:
        return err
    body = request.get_json(silent=True) or {}
    currency = str(body.get("currency", "")).upper().strip()
    if currency not in SUPPORTED:
        return jsonify({"error": "please select USD, EUR or GBP"}), 400
    try:
        amount = _as_decimal(body.get("amount"), "amount")
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    rates_payload = get_rates()
    sgd_rate = _rate(rates_payload["rates"][currency])
    sgd_total = _money(amount * sgd_rate)
    service_fee = _money(sgd_total * Decimal("0.005"))
    payable = _money(sgd_total + service_fee)
    now = int(time.time())
    record = {
        "quote_id": "FXQ-" + secrets.token_hex(4).upper(),
        "currency": currency, "amount": float(amount), "sgd_rate": float(sgd_rate),
        "sgd_total": float(sgd_total), "service_fee": float(service_fee),
        "payable_sgd": float(payable), "rate_date": rates_payload.get("date", ""),
        "rate_source": rates_payload["source"], "status": "active",
        "created_at": now, "expires_at": now + 300,
    }
    try:
        store.add_quote(user["user_id"], record)
    except Exception:
        return jsonify({"error": "Unable to persist quote"}), 503
    return jsonify({**record, "currency_name": SUPPORTED[currency]["name"],
                    "pair": f"{currency}/SGD", "customer_email": user.get("email", "")})


@forex_bp.post("/buy")
def buy():
    user, err = require_user()
    if err:
        return err
    quote_id = str((request.get_json(silent=True) or {}).get("quote_id", "")).strip()
    if not quote_id:
        return jsonify({"error": "quote_id is required"}), 400
    accepted = store.find_quote(user["user_id"], quote_id)
    if not accepted:
        return jsonify({"error": "quote not found"}), 404
    if accepted.get("status") != "active":
        return jsonify({"error": f"quote is {accepted.get('status', 'unavailable')}"}), 409
    if int(accepted.get("expires_at", 0)) <= int(time.time()):
        store.mark_quote_expired(user["user_id"], quote_id)
        return jsonify({"error": "quote has expired; request a new quote"}), 410
    if store.find_order_by_quote(user["user_id"], quote_id):
        return jsonify({"error": "an order already exists for this quote"}), 409

    order_id = "ONGX-FX-" + secrets.token_hex(4).upper()
    if not user.get("demo") and not paypal.configured():
        return jsonify({"error": "Forex PayPal checkout is not configured"}), 503
    real_paypal = not user.get("demo")
    try:
        if real_paypal:
            base = request.host_url.rstrip("/")
            pp = paypal.create_order(
                f"{Decimal(str(accepted['payable_sgd'])):.2f}",
                f"Buy {accepted['amount']} {accepted['currency']} via StraitsFX",
                return_url=f"{base}/api/ong-xuan/forex/paypal/return",
                cancel_url=f"{base}/api/ong-xuan/forex/paypal/cancel",
            )
            order_id = pp["id"]
        record = {
            "order_id": order_id, "quote_id": quote_id,
            "currency": accepted["currency"], "amount": accepted["amount"],
            "customer_email": user.get("email", ""),
            "currency_name": SUPPORTED[accepted["currency"]]["name"],
            "sgd_rate": accepted["sgd_rate"], "sgd_total": accepted["sgd_total"],
            "service_fee": accepted["service_fee"], "payable_sgd": accepted["payable_sgd"],
            "rate_source": accepted["rate_source"], "rate_date": accepted["rate_date"],
            "status": "pending_paypal", "created_at": int(time.time()),
        }
        store.add_order(user["user_id"], record)
        if not real_paypal:
            record = _complete_order(user["user_id"], record)
        return jsonify({"order": record, "approve_url": pp.get("approve_url") if real_paypal else None})
    except requests.RequestException as exc:
        return jsonify({"error": f"PayPal checkout failed: {exc}"}), 502
    except Exception:
        return jsonify({"error": "Unable to persist Forex order"}), 503


@forex_bp.get("/orders")
def list_orders():
    user, err = require_user()
    return err if err else jsonify(store.get_orders(user["user_id"]))


@forex_bp.get("/holdings")
def list_holdings():
    user, err = require_user()
    return err if err else jsonify(store.get_holdings(user["user_id"]))


@forex_bp.get("/paypal/return")
def paypal_return():
    user, err = require_user()
    if err:
        return _frontend_redirect("error")
    order_id = request.args.get("token", "")
    order = store.find_order(user["user_id"], order_id)
    if not order:
        return _frontend_redirect("error", order_id)
    if order.get("status") == "filled":
        return _frontend_redirect("filled", order_id)
    if order.get("status") != "pending_paypal":
        return _frontend_redirect("error", order_id)
    try:
        captured = paypal.capture_order(order_id)
        if captured.get("status") == "COMPLETED" and _complete_order(user["user_id"], order):
            return _frontend_redirect("filled", order_id)
    except requests.RequestException:
        pass
    store.update_order(user["user_id"], order_id, {"status": "failed"})
    return _frontend_redirect("error", order_id)


@forex_bp.get("/paypal/cancel")
def paypal_cancel():
    user, _ = require_user()
    order_id = request.args.get("token", "")
    if user and order_id:
        order = store.find_order(user["user_id"], order_id)
        if order and order.get("status") == "pending_paypal":
            store.update_order(user["user_id"], order_id, {"status": "cancelled"})
    return _frontend_redirect("cancelled", order_id)


def register_blueprints(app):
    from .auth import auth_bp

    app.register_blueprint(auth_bp, url_prefix="/api/ong-xuan/auth")
    app.register_blueprint(forex_bp, url_prefix="/api/ong-xuan/forex")
