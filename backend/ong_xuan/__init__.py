"""Ong Xuan's Forex backend module.

Provides the DBFS Assignment 2 foreign-exchange feature:
- retrieves live EUR/SGD, GBP/SGD and USD/SGD rates from Frankfurter API
- compares rates with a second FX API provider
- retrieves 7-day FX rate history
- creates forex purchase quotes
- simulates/creates PayPal Sandbox checkout orders for buy transactions
"""
import secrets
import time
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

import requests
from flask import Blueprint, jsonify, redirect, request, session

from ..config import Config
from ..shared.auth import require_user
from ..victor.services import paypal

forex_bp = Blueprint("ong_xuan_forex", __name__)

SUPPORTED = {
    "USD": {"name": "US Dollar", "flag": "🇺🇸", "fallback": Decimal("1.3500")},
    "EUR": {"name": "Euro", "flag": "🇪🇺", "fallback": Decimal("1.4700")},
    "GBP": {"name": "British Pound", "flag": "🇬🇧", "fallback": Decimal("1.7200")},
}


def _money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _rate(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def _as_decimal(value, field: str) -> Decimal:
    try:
        d = Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise ValueError(f"{field} must be a number")

    if d <= 0:
        raise ValueError(f"{field} must be positive")

    return d


def _live_rates():
    """Return SGD cost for 1 unit of each foreign currency.

    Frankfurter returns how much foreign currency 1 SGD buys, so we invert the
    rates to show the normal display: 1 USD/EUR/GBP = X SGD.
    """
    response = requests.get(
        "https://api.frankfurter.dev/v1/latest",
        params={"base": "SGD", "symbols": "USD,EUR,GBP"},
        timeout=12,
    )
    response.raise_for_status()
    data = response.json()

    rates = {}

    for code in SUPPORTED:
        raw = Decimal(str(data["rates"][code]))
        rates[code] = _rate(Decimal("1") / raw)

    return {
        "rates": rates,
        "date": data.get("date", ""),
        "source": "Frankfurter API",
        "demo": False,
    }


def get_rates():
    try:
        return _live_rates()
    except Exception:
        return {
            "rates": {code: cfg["fallback"] for code, cfg in SUPPORTED.items()},
            "date": "",
            "source": "Fixed fallback rates",
            "demo": True,
        }


def get_backup_rates():
    """Return SGD cost for 1 unit of each foreign currency from a second FX provider.

    This uses open.er-api.com as a backup provider. It returns how much foreign
    currency 1 SGD buys, so we invert it to show 1 USD/EUR/GBP = X SGD.
    """
    try:
        response = requests.get(
            "https://open.er-api.com/v6/latest/SGD",
            timeout=12,
        )
        response.raise_for_status()
        data = response.json()

        rates = {}

        for code in SUPPORTED:
            raw = Decimal(str(data["rates"][code]))
            rates[code] = _rate(Decimal("1") / raw)

        return {
            "rates": rates,
            "source": "Open Exchange Rate API",
            "demo": False,
        }
    except Exception:
        return {
            "rates": {code: cfg["fallback"] for code, cfg in SUPPORTED.items()},
            "source": "Fixed fallback rates",
            "demo": True,
        }


def get_rate_history():
    """Return 7-day FX rate history using Frankfurter API."""
    try:
        end_date = date.today()
        start_date = end_date - timedelta(days=7)

        response = requests.get(
            f"https://api.frankfurter.dev/v1/{start_date}..{end_date}",
            params={"base": "SGD", "symbols": "USD,EUR,GBP"},
            timeout=12,
        )
        response.raise_for_status()
        data = response.json()

        history = []

        for d, values in data.get("rates", {}).items():
            item = {"date": d}

            for code in SUPPORTED:
                raw = Decimal(str(values[code]))
                item[code] = float(_rate(Decimal("1") / raw))

            history.append(item)

        return {
            "source": "Frankfurter API",
            "history": history,
        }
    except Exception:
        return {
            "source": "No history available",
            "history": [],
        }


def _format_rates(payload):
    return {
        "date": payload["date"],
        "source": payload["source"],
        "demo": payload["demo"],
        "base": "SGD",
        "rates": [
            {
                "code": code,
                "pair": f"{code}/SGD",
                "name": SUPPORTED[code]["name"],
                "flag": SUPPORTED[code]["flag"],
                "sgd_per_unit": float(payload["rates"][code]),
            }
            for code in ("USD", "EUR", "GBP")
        ],
    }


def _orders():
    return session.setdefault("ong_xuan_forex_orders", [])


@forex_bp.get("/health")
def health():
    return jsonify({"ok": True, "module": "forex", "owner": "Ong Xuan"})


@forex_bp.get("/rates")
def rates():
    return jsonify(_format_rates(get_rates()))


@forex_bp.get("/rate-comparison")
def rate_comparison():
    primary = get_rates()
    backup = get_backup_rates()

    comparison = []

    for code in ("USD", "EUR", "GBP"):
        primary_rate = primary["rates"][code]
        backup_rate = backup["rates"][code]
        difference = _rate(primary_rate - backup_rate)

        comparison.append({
            "code": code,
            "pair": f"{code}/SGD",
            "primary_rate": float(primary_rate),
            "primary_source": primary["source"],
            "backup_rate": float(backup_rate),
            "backup_source": backup["source"],
            "difference": float(difference),
        })

    return jsonify({
        "comparison": comparison,
        "primary_source": primary["source"],
        "backup_source": backup["source"],
    })


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
    sgd_rate = rates_payload["rates"][currency]
    sgd_total = _money(amount * sgd_rate)
    service_fee = _money(sgd_total * Decimal("0.005"))
    payable = _money(sgd_total + service_fee)

    return jsonify({
        "quote_id": "FXQ-" + secrets.token_hex(4).upper(),
        "currency": currency,
        "currency_name": SUPPORTED[currency]["name"],
        "pair": f"{currency}/SGD",
        "amount": float(amount),
        "sgd_rate": float(sgd_rate),
        "sgd_total": float(sgd_total),
        "service_fee": float(service_fee),
        "payable_sgd": float(payable),
        "rate_date": rates_payload["date"],
        "rate_source": rates_payload["source"],
        "customer_email": user.get("email", ""),
    })


@forex_bp.post("/buy")
def buy():
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
    sgd_rate = rates_payload["rates"][currency]
    sgd_total = _money(amount * sgd_rate)
    service_fee = _money(sgd_total * Decimal("0.005"))
    payable = _money(sgd_total + service_fee)

    order = {
        "order_id": "ONGX-FX-" + secrets.token_hex(4).upper(),
        "owner": "Ong Xuan",
        "customer": user.get("email", ""),
        "currency": currency,
        "currency_name": SUPPORTED[currency]["name"],
        "amount": float(amount),
        "sgd_rate": float(sgd_rate),
        "sgd_total": float(sgd_total),
        "service_fee": float(service_fee),
        "payable_sgd": float(payable),
        "rate_source": rates_payload["source"],
        "rate_date": rates_payload["date"],
        "status": "filled",
        "created_at": int(time.time()),
    }

    # If PayPal Sandbox is configured and this is a real PayPal login,
    # create a real PayPal checkout. Demo login will simulate purchase.
    if paypal.configured() and not user.get("demo"):
        try:
            base = request.host_url.rstrip("/")
            pp = paypal.create_order(
                f"{payable:.2f}",
                f"Buy {amount} {currency} via StraitsFX",
                return_url=f"{base}/api/ong-xuan/forex/paypal/return",
                cancel_url=f"{base}/api/ong-xuan/forex/paypal/cancel",
            )

            order.update({"order_id": pp["id"], "status": "pending_paypal"})
            _orders().append(order)
            session.modified = True

            return jsonify({"order": order, "approve_url": pp.get("approve_url")})
        except requests.RequestException as exc:
            return jsonify({"error": f"PayPal checkout failed: {exc}"}), 502

    _orders().append(order)
    session.modified = True

    return jsonify({"order": order, "approve_url": None})


@forex_bp.get("/orders")
def list_orders():
    user, err = require_user()
    if err:
        return err

    uid = user.get("email", "")
    return jsonify([o for o in _orders() if o.get("customer") == uid])


@forex_bp.get("/paypal/return")
def paypal_return():
    user, err = require_user()
    if err:
        return redirect(Config.FRONTEND_URL + "?forex_status=error")

    order_id = request.args.get("token", "")

    try:
        cap = paypal.capture_order(order_id)
        status = cap.get("status")
    except requests.RequestException:
        status = "FAILED"

    for order in _orders():
        if order.get("order_id") == order_id and order.get("customer") == user.get("email"):
            order["status"] = "filled" if status == "COMPLETED" else "failed"
            session.modified = True
            break

    result = "filled" if status == "COMPLETED" else "error"
    return redirect(f"{Config.FRONTEND_URL}?forex_status={result}&forex_order_id={order_id}")


@forex_bp.get("/paypal/cancel")
def paypal_cancel():
    order_id = request.args.get("token", "")

    for order in _orders():
        if order.get("order_id") == order_id:
            order["status"] = "cancelled"
            session.modified = True
            break

    return redirect(Config.FRONTEND_URL + "?forex_status=cancelled")


def register_blueprints(app):
    app.register_blueprint(forex_bp, url_prefix="/api/ong-xuan/forex")