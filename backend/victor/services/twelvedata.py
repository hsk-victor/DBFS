"""Twelve Data — OHLC time series for candlestick charts (2 graded URIs)."""
from ...config import Config
from ..demo_data import demo_candles, demo_quote
from .http import cached_fetch, get_json

BASE = "https://api.twelvedata.com"

RANGE_PARAMS = {
    "1D": {"interval": "15min", "outputsize": 28},
    "1M": {"interval": "1day", "outputsize": 22},
    "1Y": {"interval": "1week", "outputsize": 52},
}


def candles(sym: str, rng: str = "1M", start: str | None = None, end: str | None = None):
    def live():
        if not Config.TWELVEDATA_API_KEY:
            raise ValueError("no twelvedata key")
        params = {"symbol": sym, "apikey": Config.TWELVEDATA_API_KEY, "order": "asc"}
        if rng == "custom" and start and end:
            params.update({"interval": "1day", "start_date": start, "end_date": end})
        else:
            params.update(RANGE_PARAMS.get(rng, RANGE_PARAMS["1M"]))
        j = get_json(f"{BASE}/time_series", params)
        vals = j.get("values")
        if not vals:
            raise ValueError(j.get("message", "empty series"))
        return [{"t": v["datetime"], "o": float(v["open"]), "h": float(v["high"]),
                 "l": float(v["low"]), "c": float(v["close"])} for v in vals]

    key = f"candles:{sym}:{rng}:{start or ''}:{end or ''}"
    return cached_fetch(key, 15 * 60, live, lambda: demo_candles(sym, 24))


def quote_backup(sym: str, force: bool = False):
    """Second quote source — redundancy if Finnhub is down on demo day."""
    def live():
        if not Config.TWELVEDATA_API_KEY:
            raise ValueError("no twelvedata key")
        j = get_json(f"{BASE}/quote", {"symbol": sym, "apikey": Config.TWELVEDATA_API_KEY})
        if "close" not in j:
            raise ValueError(j.get("message", "empty quote"))
        return {"symbol": sym, "price": float(j["close"]),
                "change_pct": round(float(j.get("percent_change") or 0), 2),
                "prev_close": float(j.get("previous_close") or 0),
                "high": float(j.get("high") or 0), "low": float(j.get("low") or 0),
                "open": float(j.get("open") or 0), "ts": int(j.get("timestamp") or 0)}
    return cached_fetch(f"quote2:{sym}", 60, live, lambda: demo_quote(sym), force=force)
