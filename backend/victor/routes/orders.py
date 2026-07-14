"""Order placement + PayPal checkout.

Market buys with PayPal configured run the real approve→capture flow;
demo mode simulates the fill so the app works with zero setup.
Limit orders are recorded as 'working' and evaluated on manual market refresh.
Sells are recorded and the payout is simulated in sandbox.
"""
import secrets
import time

import requests
from flask import Blueprint, jsonify, redirect, request

from ...config import Config
from ...shared.auth import require_user
from ..services import finnhub, frankfurter, paypal
from ..services.store import store
from .market import _check_sym

orders_bp = Blueprint("orders", __name__)


def _now_label():
    t = time.localtime()
    return time.strftime("%d %b %H:%M", t)


def _order_payload(user, body):
    sym = _check_sym(body.get("symbol", ""))
    if not sym:
        return None, "unknown symbol"
    side = body.get("side", "buy")
    otype = body.get("order_type", "market")
    mode = body.get("mode", "shares")

    quote, _ = finnhub.quote(sym)
    fx, _ = frankfurter.usd_sgd()
    rate = fx["rate"]

    limit_price = float(body.get("limit_price") or 0)
    if otype == "limit" and limit_price <= 0:
        return None, "limit price must be positive"
    eff_price = limit_price if (otype == "limit" and limit_price > 0) else quote["price"]

    if mode == "cash":
        cash_sgd = max(0.0, float(body.get("cash_sgd") or 0))
        shares = round(cash_sgd / rate / eff_price, 4) if eff_price > 0 else 0
    else:
        shares = float(body.get("qty") or 0)

    if shares <= 0:
        return None, "quantity must be positive"

    if side == "sell":
        holdings = store.get_holdings(user["user_id"])
        owned = holdings.get(sym, {}).get("qty", 0)
        if shares > owned + 1e-6:
            return None, f"cannot sell {shares} — you hold {owned}"

    usd = eff_price * shares
    sgd = usd * rate
    return {
        "symbol": sym, "side": side, "order_type": otype,
        "shares": shares, "price_usd": round(eff_price, 2),
        "usd_total": round(usd, 2), "fx_rate": rate, "sgd_total": round(sgd, 2),
    }, None


@orders_bp.post("")
@orders_bp.post("/")
def place_order():
    user, err = require_user()
    if err:
        return err
    body = request.get_json(silent=True) or {}
    o, msg = _order_payload(user, body)
    if not o:
        return jsonify({"error": msg}), 400

    record = {
        **o,
        "order_id": "SDB-" + secrets.token_hex(4).upper(),
        "status": "working" if o["order_type"] == "limit" else "filled",
        "time_label": _now_label(),
    }

    # Real PayPal checkout: market buys only (limit orders hold no funds;
    # sell payouts are simulated in sandbox).
    if (o["side"] == "buy" and o["order_type"] == "market"
            and paypal.configured() and not user.get("demo")):
        try:
            base = request.host_url.rstrip("/")
            pp = paypal.create_order(
                f"{o['sgd_total']:.2f}",
                f"{o['shares']} x {o['symbol']} @ ${o['price_usd']:.2f}",
                return_url=f"{base}/api/orders/paypal/return",
                cancel_url=f"{base}/api/orders/paypal/cancel",
            )
            record.update(order_id=pp["id"], status="pending_approval")
            store.add_order(user["user_id"], record)
            return jsonify({"order": record, "approve_url": pp["approve_url"]})
        except requests.RequestException as e:
            return jsonify({"error": f"PayPal order creation failed: {e}"}), 502

    # Simulated path (demo login, limit orders, sells)
    store.add_order(user["user_id"], record)
    if record["status"] == "filled":
        store.apply_fill(user["user_id"], o["symbol"], o["side"], o["shares"], o["price_usd"])
    return jsonify({"order": record, "approve_url": None})


@orders_bp.get("/paypal/return")
def paypal_return():
    user, err = require_user()
    if err:
        return redirect(Config.FRONTEND_URL + "?order_status=error")
    order_id = request.args.get("token", "")
    rec = store.find_order(user["user_id"], order_id)
    try:
        cap = paypal.capture_order(order_id)
        status = cap.get("status", "")
        if status == "COMPLETED" and rec:
            store.update_order(user["user_id"], order_id, {"status": "filled"})
            store.apply_fill(user["user_id"], rec["symbol"], rec["side"],
                             rec["shares"], rec["price_usd"])
            return redirect(f"{Config.FRONTEND_URL}?order_status=filled&order_id={order_id}")
    except requests.RequestException:
        pass
    if rec:
        store.update_order(user["user_id"], order_id, {"status": "failed"})
    return redirect(f"{Config.FRONTEND_URL}?order_status=error&order_id={order_id}")


@orders_bp.get("/paypal/cancel")
def paypal_cancel():
    user, _ = require_user()
    order_id = request.args.get("token", "")
    if user and order_id:
        store.update_order(user["user_id"], order_id, {"status": "cancelled"})
    return redirect(f"{Config.FRONTEND_URL}?order_status=cancelled")


@orders_bp.get("")
@orders_bp.get("/")
def list_orders():
    user, err = require_user()
    if err:
        return err
    return jsonify(store.get_orders(user["user_id"]))


@orders_bp.post("/<order_id>/cancel")
def cancel_order(order_id):
    user, err = require_user()
    if err:
        return err
    rec = store.find_order(user["user_id"], order_id)
    if not rec:
        return jsonify({"error": "order not found"}), 404
    if rec["status"] != "working":
        return jsonify({"error": "only working orders can be cancelled"}), 400
    store.update_order(user["user_id"], order_id, {"status": "cancelled"})
    return jsonify({"ok": True})


@orders_bp.get("/<order_id>")
def order_details(order_id):
    user, err = require_user()
    if err:
        return err
    rec = store.find_order(user["user_id"], order_id)
    if not rec:
        return jsonify({"error": "order not found"}), 404
    details = None
    if paypal.configured() and not order_id.startswith("SDB-"):
        try:
            details = paypal.get_order(order_id)
        except requests.RequestException:
            details = None
    return jsonify({"order": rec, "paypal": details})
