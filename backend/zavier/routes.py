"""Crypto API routes for Zavier's feature area."""

import secrets
import time

from flask import Blueprint, jsonify, redirect, request

from ..config import Config
from ..shared.auth import require_user
from ..shared.database import supabase
from .services.GNews import search_symbol_strict
from .services.coingecko import COINS as COINGECKO_COINS, fundamentals_all
from .services.eodhd import eod_series_all, realtime_prices, usd_sgd
from .services.paypal import capture_order, create_order, create_payout, get_payout_batch, userinfo_strict

crypto_bp = Blueprint("crypto", __name__)

ALLOWED_CRYPTO = {symbol for symbol, _ in COINGECKO_COINS}
SYMBOL_LIST = [symbol for symbol, _ in COINGECKO_COINS]


def _now_label() -> str:
    return time.strftime("%d %b %H:%M", time.localtime())


def _read_user():
    user, err = require_user()
    return user, err


def _parse_symbols_arg():
    raw = str(request.args.get("symbols", "")).strip()
    if not raw:
        return SYMBOL_LIST
    selected = []
    seen = set()
    for part in raw.split(","):
        symbol = part.strip().upper()
        if not symbol or symbol in seen or symbol not in ALLOWED_CRYPTO:
            continue
        seen.add(symbol)
        selected.append(symbol)
    return selected or SYMBOL_LIST


def _insert_order(record: dict):
    if not supabase:
        raise RuntimeError("supabase is not configured")
    supabase.table("crypto_orders").insert(record).execute()


def _update_order(user_id: str, order_id: str, patch: dict):
    if not supabase:
        raise RuntimeError("supabase is not configured")
    supabase.table("crypto_orders").update(patch).eq("user_id", user_id).eq("order_id", order_id).execute()


def _find_order(user_id: str, order_id: str):
    if not supabase:
        raise RuntimeError("supabase is not configured")
    res = (
        supabase.table("crypto_orders")
        .select("*")
        .eq("user_id", user_id)
        .eq("order_id", order_id)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def _find_holding(user_id: str, symbol: str):
    if not supabase:
        raise RuntimeError("supabase is not configured")
    res = (
        supabase.table("crypto_holdings")
        .select("qty,avg_price")
        .eq("user_id", user_id)
        .eq("symbol", symbol)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def _apply_crypto_fill(user_id: str, symbol: str, shares: float, price_usd: float):
    if not supabase:
        raise RuntimeError("supabase is not configured")
    res = (
        supabase.table("crypto_holdings")
        .select("qty,avg_price")
        .eq("user_id", user_id)
        .eq("symbol", symbol)
        .limit(1)
        .execute()
    )
    current = res.data[0] if res.data else None
    if current:
        old_qty = float(current.get("qty") or 0)
        old_avg = float(current.get("avg_price") or 0)
    else:
        old_qty = 0.0
        old_avg = 0.0

    new_qty = old_qty + shares
    if new_qty <= 0:
        return

    if current and old_qty > 0:
        new_avg = ((old_qty * old_avg) + (shares * price_usd)) / new_qty
    else:
        new_avg = price_usd

    supabase.table("crypto_holdings").upsert({
        "user_id": user_id,
        "symbol": symbol,
        "qty": new_qty,
        "avg_price": new_avg,
    }).execute()


def _apply_crypto_sell(user_id: str, symbol: str, shares: float):
    current = _find_holding(user_id, symbol)
    if not current:
        raise RuntimeError("holding not found")

    old_qty = float(current.get("qty") or 0)
    old_avg = float(current.get("avg_price") or 0)
    if shares <= 0:
        raise RuntimeError("sell shares must be positive")
    if shares > old_qty + 1e-9:
        raise RuntimeError("sell quantity exceeds holdings")

    new_qty = old_qty - shares
    if new_qty <= 1e-9:
        # Schema enforces qty > 0, so fully liquidated holdings must be removed.
        supabase.table("crypto_holdings").delete().eq("user_id", user_id).eq("symbol", symbol).execute()
        return

    supabase.table("crypto_holdings").upsert({
        "user_id": user_id,
        "symbol": symbol,
        "qty": new_qty,
        "avg_price": old_avg,
    }).execute()


def _parse_order_body(body: dict):
    symbol = str(body.get("symbol", "")).upper().strip()
    if symbol not in ALLOWED_CRYPTO:
        return None, "unknown crypto symbol"

    side = str(body.get("side", "buy")).lower().strip()
    if side not in {"buy", "sell"}:
        return None, "side must be buy or sell"

    order_type = str(body.get("order_type", "market")).lower().strip()
    if order_type not in {"market", "limit"}:
        return None, "order_type must be market or limit"

    mode = str(body.get("mode", "shares")).lower().strip()
    if mode not in {"shares", "cash"}:
        return None, "mode must be shares or cash"

    price = float(body.get("price_usd") or 0)
    fx_rate = float(body.get("fx_rate") or 0)
    if price <= 0:
        return None, "invalid price"
    if fx_rate <= 0:
        return None, "invalid fx rate"

    if mode == "cash":
        cash_sgd = max(0.0, float(body.get("cash_sgd") or 0))
        shares = round(cash_sgd / fx_rate / price, 6) if price > 0 else 0
    else:
        shares = float(body.get("qty") or 0)

    if shares <= 0:
        return None, "quantity must be positive"

    usd_total = round(shares * price, 2)
    sgd_total = round(usd_total * fx_rate, 2)

    return {
        "symbol": symbol,
        "side": side,
        "order_type": order_type,
        "shares": shares,
        "price_usd": round(price, 6),
        "usd_total": usd_total,
        "fx_rate": fx_rate,
        "sgd_total": sgd_total,
    }, None

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


@crypto_bp.post("/orders")
def create_crypto_order():
    user, err = _read_user()
    if err:
        return err
    if not supabase:
        return jsonify({"error": "supabase not configured"}), 503

    body = request.get_json(silent=True) or {}
    normalized, message = _parse_order_body(body)
    if not normalized:
        return jsonify({"error": message}), 400

    if normalized["side"] == "sell":
        try:
            h = _find_holding(user["user_id"], normalized["symbol"])
        except Exception as exc:
            return jsonify({"error": f"holding lookup failed: {exc}"}), 502
        owned = float((h or {}).get("qty") or 0)
        if normalized["shares"] > owned + 1e-9:
            return jsonify({"error": f"cannot sell {normalized['shares']:.6f} {normalized['symbol']} (owned {owned:.6f})"}), 400

    order_id = "CRY-" + secrets.token_hex(4).upper()
    status = "working" if normalized["order_type"] == "limit" else "filled"
    if normalized["side"] == "buy" and normalized["order_type"] == "market" and not user.get("demo"):
        status = "pending_approval"

    record = {
        "order_id": order_id,
        "user_id": user["user_id"],
        "symbol": normalized["symbol"],
        "side": normalized["side"],
        "order_type": normalized["order_type"],
        "shares": normalized["shares"],
        "price_usd": normalized["price_usd"],
        "usd_total": normalized["usd_total"],
        "fx_rate": normalized["fx_rate"],
        "sgd_total": normalized["sgd_total"],
        "status": status,
        "time_label": _now_label(),
        "created_at": int(time.time()),
    }

    approve_url = None
    payout_batch_id = None
    payout_status = None
    if status == "pending_approval":
        base = request.host_url.rstrip("/")
        try:
            created = create_order(
                amount_sgd=f"{normalized['sgd_total']:.2f}",
                symbol=normalized["symbol"],
                shares=float(normalized["shares"]),
                price_usd=float(normalized["price_usd"]),
                fx_rate=float(normalized["fx_rate"]),
                return_url=f"{base}/api/crypto/orders/paypal/return",
                cancel_url=f"{base}/api/crypto/orders/paypal/cancel",
            )
        except Exception as exc:
            return jsonify({"error": str(exc)}), 502

        if not created.get("id"):
            return jsonify({"error": "paypal create order returned no id"}), 502

        record["order_id"] = created["id"]
        approve_url = created.get("approve_url")

    if normalized["side"] == "sell" and normalized["order_type"] == "market" and not user.get("demo"):
        payout_status = "failed"
        try:
            sender_batch_id = "CRY-SELL-" + secrets.token_hex(8).upper()
            created = create_payout(
                sender_batch_id=sender_batch_id,
                receiver_email=str(user.get("email") or "").strip(),
                amount_sgd=f"{normalized['sgd_total']:.2f}",
                note=f"Sell {normalized['shares']:.6f} {normalized['symbol']} via sandbox payout",
            )
            payout_batch_id = created.get("batch_id")
            payout_status = created.get("status") or "PENDING"
            if payout_batch_id:
                try:
                    fetched = get_payout_batch(payout_batch_id)
                    payout_status = (fetched.get("batch_header") or {}).get("batch_status", payout_status)
                except Exception:
                    pass
            if payout_status in {"SUCCESS", "PENDING", "PROCESSING"}:
                status = "filled"
            else:
                status = "failed"
        except Exception as exc:
            return jsonify({"error": f"paypal payout failed: {exc}"}), 502

        if payout_batch_id:
            record["order_id"] = payout_batch_id
        record["status"] = status

    try:
        _insert_order(record)
    except Exception as exc:
        return jsonify({"error": f"order persistence failed: {exc}"}), 502

    if record["status"] == "filled":
        try:
            if record["side"] == "buy":
                _apply_crypto_fill(user["user_id"], record["symbol"], float(record["shares"]), float(record["price_usd"]))
            else:
                _apply_crypto_sell(user["user_id"], record["symbol"], float(record["shares"]))
        except Exception as exc:
            return jsonify({"error": f"holdings update failed: {exc}"}), 502

    return jsonify({"order": record, "approve_url": approve_url, "payout_batch_id": payout_batch_id, "payout_status": payout_status})


@crypto_bp.get("/orders/<order_id>")
def crypto_order_status(order_id):
    user, err = _read_user()
    if err:
        return err
    if not supabase:
        return jsonify({"error": "supabase not configured"}), 503
    try:
        row = _find_order(user["user_id"], order_id)
    except Exception as exc:
        return jsonify({"error": f"order lookup failed: {exc}"}), 502
    if not row:
        return jsonify({"error": "order not found"}), 404

    return jsonify({"order": row, "paypal": None})


@crypto_bp.get("/holdings")
def crypto_holdings():
    user, err = _read_user()
    if err:
        return err
    if not supabase:
        return jsonify({"error": "supabase not configured"}), 503

    try:
        res = (
            supabase.table("crypto_holdings")
            .select("symbol,qty,avg_price")
            .eq("user_id", user["user_id"])
            .execute()
        )
    except Exception as exc:
        return jsonify({"error": f"holdings lookup failed: {exc}"}), 502

    rows = res.data or []
    holdings = []
    for row in rows:
        symbol = str(row.get("symbol", "")).upper().strip()
        if symbol not in ALLOWED_CRYPTO:
            continue
        holdings.append({
            "symbol": symbol,
            "qty": float(row.get("qty") or 0),
            "avg_price": float(row.get("avg_price") or 0),
        })
    return jsonify({"holdings": holdings})


@crypto_bp.get("/orders/paypal/return")
def crypto_paypal_return():
    user, err = _read_user()
    if err:
        return jsonify({"ok": False, "error": "not authenticated"}), 401
    if not supabase:
        return jsonify({"ok": False, "error": "supabase not configured"}), 503

    order_id = str(request.args.get("token", "")).strip()
    if not order_id:
        return jsonify({"ok": False, "error": "missing paypal token"}), 400

    row = _find_order(user["user_id"], order_id)
    if not row:
        return jsonify({"ok": False, "error": "order not found"}), 404

    try:
        captured = capture_order(order_id)
        if captured.get("status") == "COMPLETED":
            _update_order(user["user_id"], order_id, {"status": "filled"})
            try:
                _apply_crypto_fill(user["user_id"], row["symbol"], float(row["shares"]), float(row["price_usd"]))
            except Exception as exc:
                return jsonify({"ok": False, "order_id": order_id, "status": "failed", "error": f"holdings update failed: {exc}"}), 502
            return redirect(f"{Config.FRONTEND_URL}?section=Crypto&crypto_order_status=filled&crypto_order_id={order_id}")
    except Exception as exc:
        _update_order(user["user_id"], order_id, {"status": "failed"})
        return redirect(f"{Config.FRONTEND_URL}?section=Crypto&crypto_order_status=failed&crypto_order_id={order_id}")

    _update_order(user["user_id"], order_id, {"status": "failed"})
    return redirect(f"{Config.FRONTEND_URL}?section=Crypto&crypto_order_status=failed&crypto_order_id={order_id}")


@crypto_bp.get("/orders/paypal/cancel")
def crypto_paypal_cancel():
    user, err = _read_user()
    if err:
        return jsonify({"ok": False, "error": "not authenticated"}), 401
    if not supabase:
        return jsonify({"ok": False, "error": "supabase not configured"}), 503

    order_id = str(request.args.get("token", "")).strip()
    if not order_id:
        return jsonify({"ok": False, "error": "missing paypal token"}), 400
    try:
        _update_order(user["user_id"], order_id, {"status": "cancelled"})
    except Exception as exc:
        return jsonify({"ok": False, "error": f"cancel failed: {exc}"}), 502
    return redirect(f"{Config.FRONTEND_URL}?section=Crypto&crypto_order_status=cancelled&crypto_order_id={order_id}")


@crypto_bp.get("/prices")
def prices():
    force = str(request.args.get("force", "false")).lower() in {"1", "true", "yes", "on"}
    symbols = _parse_symbols_arg()
    payload = realtime_prices(force=force, symbols=symbols)
    return jsonify({"symbols": symbols, "items": payload})


@crypto_bp.get("/eod")
def eod():
    force = str(request.args.get("force", "false")).lower() in {"1", "true", "yes", "on"}
    symbols = _parse_symbols_arg()
    payload = eod_series_all(force=force, symbols=symbols)
    return jsonify({"symbols": symbols, "items": payload})


@crypto_bp.get("/fundamentals")
def fundamentals():
    force = str(request.args.get("force", "false")).lower() in {"1", "true", "yes", "on"}
    symbols = _parse_symbols_arg()
    payload = fundamentals_all(force=force, symbols=symbols)
    return jsonify({"symbols": symbols, "items": payload})


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