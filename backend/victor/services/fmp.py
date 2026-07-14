"""Financial Modeling Prep — fundamentals + analyst price targets.

Feature-only provider (not in the nominated graded 10). Feeds the Data tab
and grounds the AI analysis prompt.
"""
from ...config import Config
from ..demo_data import demo_fundamentals
from .http import cached_fetch, get_json

BASE = "https://financialmodelingprep.com/stable"


def _fmt_big(n):
    if n is None:
        return "—"
    for div, suf in [(1e12, "T"), (1e9, "B"), (1e6, "M")]:
        if abs(n) >= div:
            return f"${n / div:.2f}{suf}"
    return f"${n:,.0f}"


def fundamentals(sym: str):
    def live():
        if not Config.FMP_API_KEY:
            raise ValueError("no fmp key")
        km = get_json(f"{BASE}/key-metrics", {"symbol": sym, "apikey": Config.FMP_API_KEY, "limit": 1})
        pt = get_json(f"{BASE}/price-target-summary", {"symbol": sym, "apikey": Config.FMP_API_KEY})
        if not km:
            raise ValueError("empty key-metrics")
        k = km[0]
        target = None
        if pt:
            target = pt[0].get("lastMonthAvgPriceTarget") or pt[0].get("lastYearAvgPriceTarget")
        metrics = [
            {"label": "Mkt cap", "value": _fmt_big(k.get("marketCap"))},
            {"label": "P/E", "value": f"{k.get('peRatio') or k.get('priceToEarningsRatio') or 0:.1f}"},
            {"label": "Rev / share", "value": f"${k.get('revenuePerShare') or 0:.2f}"},
            {"label": "FCF yield", "value": f"{(k.get('freeCashFlowYield') or 0) * 100:.1f}%"},
            {"label": "ROE", "value": f"{(k.get('returnOnEquity') or 0) * 100:.1f}%"},
            {"label": "Debt/Equity", "value": f"{k.get('debtToEquity') or 0:.2f}"},
        ]
        return {"symbol": sym, "metrics": metrics, "target": target}
    return cached_fetch(f"fund:{sym}", 24 * 3600, live, lambda: demo_fundamentals(sym))
