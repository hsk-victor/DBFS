"""Market data endpoints. Each response carries a `source` flag
(live / cached / demo) that drives the status pill in the UI."""
from flask import Blueprint, jsonify, request

from ..demo_data import DEMO_STOCKS
from ..services import finnhub, fmp, frankfurter, twelvedata
from ..services.store import store
from ...shared.auth import require_user

market_bp = Blueprint("market", __name__)

# Fixed catalogue: it never changes with an external ranking or provider result.
SYMBOLS = [
    "NVDA", "MSFT", "AAPL", "GOOG", "AMZN", "META", "AVGO", "TSLA", "JPM", "WMT",
    "LLY", "V", "ORCL", "MA", "XOM", "NFLX", "COST", "AMD", "UNH", "INTC",
]


def _check_sym(sym: str):
    sym = sym.upper()
    if sym not in SYMBOLS:
        return None
    return sym


def _settle_triggered_limits(user_id: str, fresh_prices: dict[str, float]):
    """Fill working limits crossed by this refresh's genuinely live quotes."""
    filled = []
    failed = []
    holdings = store.get_holdings(user_id)
    available = {symbol: position["qty"] for symbol, position in holdings.items()}
    orders = sorted(store.get_orders(user_id), key=lambda order: order.get("created_at", 0))
    for order in orders:
        if order.get("status") != "working" or order.get("order_type") != "limit":
            continue
        symbol = order.get("symbol")
        market_price = fresh_prices.get(symbol)
        if market_price is None:
            continue
        limit_price = float(order.get("price_usd") or 0)
        side = order.get("side")
        crossed = ((side == "buy" and market_price <= limit_price)
                   or (side == "sell" and market_price >= limit_price))
        if not crossed:
            continue
        shares = float(order.get("shares") or 0)
        if side == "sell" and shares > available.get(symbol, 0) + 1e-6:
            store.update_order(user_id, order["order_id"], {"status": "failed"})
            failed.append(order["order_id"])
            continue
        # This simulator fills at the user's limit price. That is deterministic,
        # never worse than the limit, and keeps the stored order totals accurate.
        store.update_order(user_id, order["order_id"], {"status": "filled"})
        store.apply_fill(user_id, symbol, side, shares, limit_price)
        available[symbol] = available.get(symbol, 0) + (shares if side == "buy" else -shares)
        filled.append(order["order_id"])
    return {"filled": filled, "failed": failed}


@market_bp.get("/symbols")
def symbols():
    out = []
    for s in SYMBOLS:
        q, src = finnhub.quote(s)
        out.append({"symbol": s, "name": DEMO_STOCKS[s]["name"],
                    "price": q["price"], "change_pct": q["change_pct"], "source": src})
    return jsonify(out)


@market_bp.get("/quote/<sym>")
def quote(sym):
    sym = _check_sym(sym)
    if not sym:
        return jsonify({"error": "unknown symbol"}), 404
    q, src = finnhub.quote(sym)
    if src == "demo":  # Finnhub down → try the Twelve Data backup quote
        q2, src2 = twelvedata.quote_backup(sym)
        if src2 != "demo":
            q, src = q2, src2
    return jsonify({**q, "source": src})


@market_bp.get("/profile/<sym>")
def profile(sym):
    sym = _check_sym(sym)
    if not sym:
        return jsonify({"error": "unknown symbol"}), 404
    p, src = finnhub.profile(sym)
    return jsonify({**p, "source": src})


@market_bp.get("/news/<sym>")
def news(sym):
    sym = _check_sym(sym)
    if not sym:
        return jsonify({"error": "unknown symbol"}), 404
    n, src = finnhub.news(sym)
    return jsonify({"items": n, "source": src})


@market_bp.get("/candles/<sym>")
def candles(sym):
    sym = _check_sym(sym)
    if not sym:
        return jsonify({"error": "unknown symbol"}), 404
    rng = request.args.get("range", "1M")
    c, src = twelvedata.candles(sym, rng, request.args.get("from"), request.args.get("to"))
    return jsonify({"candles": c, "source": src})


@market_bp.get("/fx")
def fx():
    f, src = frankfurter.usd_sgd()
    return jsonify({**f, "source": src})


@market_bp.post("/refresh")
def refresh_market():
    """Refresh quote summaries and settle any limits crossed by fresh prices."""
    user, err = require_user()
    if err:
        return err
    body = request.get_json(silent=True) or {}
    requested = body.get("symbols") or []
    selected = []
    for raw in requested:
        sym = _check_sym(str(raw))
        if sym and sym not in selected:
            selected.append(sym)
    # Keep the request bounded even if a malformed client sends a huge list.
    selected = selected[:len(SYMBOLS)]

    quotes = []
    for sym in selected:
        quote_data, source = finnhub.quote(sym, force=True)
        if source == "demo":
            backup, backup_source = twelvedata.quote_backup(sym, force=True)
            if backup_source != "demo":
                quote_data, source = backup, backup_source
        quotes.append({**quote_data, "source": source})

    fx_data, fx_source = frankfurter.usd_sgd(force=True)
    fresh_prices = {
        quote["symbol"]: float(quote["price"])
        for quote in quotes
        if quote.get("source") == "live"
    }
    order_results = _settle_triggered_limits(user["user_id"], fresh_prices)
    return jsonify({
        "quotes": quotes,
        "fx": {**fx_data, "source": fx_source},
        "requested": selected,
        "orders": order_results,
    })


@market_bp.get("/fundamentals/<sym>")
def fundamentals(sym):
    sym = _check_sym(sym)
    if not sym:
        return jsonify({"error": "unknown symbol"}), 404
    f, src = fmp.fundamentals(sym)
    return jsonify({**f, "source": src})
