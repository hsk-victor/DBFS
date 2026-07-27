"""Holdings (marked to market) + per-user watchlist/canvas layout."""
from flask import Blueprint, jsonify, request

from ..services import finnhub, frankfurter
from ..services.store import store
from ..auth import require_user
from .market import SYMBOLS

portfolio_bp = Blueprint("portfolio", __name__)

DEFAULT_LAYOUT = [
    {"sym": "NVDA", "x": 36, "y": 36, "w": 344, "h": 400, "z": 1, "tab": "ai", "big": False},
    {"sym": "GOOG", "x": 412, "y": 92, "w": 344, "h": 400, "z": 2, "tab": "ai", "big": False},
    {"sym": "INTC", "x": 788, "y": 36, "w": 344, "h": 400, "z": 3, "tab": "ai", "big": False},
    {"sym": "__PF", "x": 36, "y": 470, "w": 400, "h": 356, "z": 5, "tab": "ai", "big": False},
]


@portfolio_bp.get("/holdings")
def holdings():
    user, err = require_user()
    if err:
        return err
    h = store.get_holdings(user["user_id"])
    fx, _ = frankfurter.usd_sgd()
    out = []
    for sym, pos in h.items():
        q, src = finnhub.quote(sym)
        out.append({
            "symbol": sym, "qty": pos["qty"], "avg_price": pos["avg"],
            "price": q["price"], "change_pct": q["change_pct"],
            "value_usd": round(pos["qty"] * q["price"], 2),
            "pl_pct": round((q["price"] - pos["avg"]) / pos["avg"] * 100, 2) if pos["avg"] else 0,
            "source": src,
        })
    return jsonify({"holdings": out, "fx_rate": fx["rate"]})


@portfolio_bp.get("/watchlist")
def get_watchlist():
    user, err = require_user()
    if err:
        return err
    layout = store.get_watchlist(user["user_id"])
    return jsonify({"layout": layout or DEFAULT_LAYOUT})


@portfolio_bp.put("/watchlist")
def put_watchlist():
    user, err = require_user()
    if err:
        return err
    layout = request.get_json(silent=True)
    if not isinstance(layout, list):
        return jsonify({"error": "layout must be a list"}), 400
    cleaned = []
    for c in layout:
        if not isinstance(c, dict) or "sym" not in c:
            continue
        if c["sym"] not in SYMBOLS and c["sym"] != "__PF":
            continue
        cleaned.append({k: c.get(k) for k in
                        ("sym", "x", "y", "w", "h", "z", "tab", "big",
                         "range", "from", "to", "showOrders", "showTrades")})
    store.save_watchlist(user["user_id"], cleaned)
    return jsonify({"ok": True})
