"""Finnhub — live quotes, company profiles, per-ticker news (3 graded URIs)."""
from ...config import Config
from ..demo_data import demo_news, demo_profile, demo_quote
from .http import cached_fetch, get_json

BASE = "https://finnhub.io/api/v1"


def _key_ok():
    if not Config.FINNHUB_API_KEY:
        raise ValueError("no finnhub key")
    return Config.FINNHUB_API_KEY


def quote(sym: str, force: bool = False):
    def live():
        token = _key_ok()
        j = get_json(f"{BASE}/quote", {"symbol": sym, "token": token})
        if not j.get("c"):
            raise ValueError("empty quote")
        return {"symbol": sym, "price": j["c"], "change_pct": round(j.get("dp") or 0.0, 2),
                "prev_close": j.get("pc"), "high": j.get("h"), "low": j.get("l"),
                "open": j.get("o"), "ts": j.get("t")}
    return cached_fetch(f"quote:{sym}", 60, live, lambda: demo_quote(sym), force=force)


def profile(sym: str):
    def live():
        token = _key_ok()
        j = get_json(f"{BASE}/stock/profile2", {"symbol": sym, "token": token})
        if not j.get("name"):
            raise ValueError("empty profile")
        return {"symbol": sym, "name": j["name"], "exchange": j.get("exchange", ""),
                "currency": j.get("currency", "USD"), "industry": j.get("finnhubIndustry", ""),
                "logo": j.get("logo", "")}
    return cached_fetch(f"profile:{sym}", 24 * 3600, live, lambda: demo_profile(sym))


def news(sym: str):
    def live():
        token = _key_ok()
        from datetime import date, timedelta
        to = date.today()
        frm = to - timedelta(days=7)
        j = get_json(f"{BASE}/company-news",
                     {"symbol": sym, "from": frm.isoformat(), "to": to.isoformat(), "token": token})
        if not isinstance(j, list) or not j:
            raise ValueError("empty news")
        return [{"headline": n.get("headline", ""), "source": n.get("source", ""),
                 "datetime": n.get("datetime", 0), "url": n.get("url", "#")} for n in j[:6]]
    return cached_fetch(f"news:{sym}", 30 * 60, live, lambda: demo_news(sym))
