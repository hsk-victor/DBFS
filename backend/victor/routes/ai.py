"""AI research desk — grounded analysis per symbol (innovation layer)."""
from flask import Blueprint, jsonify

from ..services import finnhub, fmp, llm
from ...shared.auth import require_user
from .market import _check_sym

ai_bp = Blueprint("ai", __name__)


@ai_bp.get("/analysis/<sym>")
def analysis(sym):
    _, err = require_user()
    if err:
        return err
    sym = _check_sym(sym)
    if not sym:
        return jsonify({"error": "unknown symbol"}), 404
    quote, _ = finnhub.quote(sym)
    fund, _ = fmp.fundamentals(sym)
    news, _ = finnhub.news(sym)
    result, src = llm.analyze(sym, quote, fund, news)
    return jsonify({**result, "source": src,
                    "disclaimer": "AI-generated · Not financial advice"})
