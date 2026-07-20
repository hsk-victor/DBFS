"""EODHD crypto helpers split by URI purpose."""

from datetime import date, timedelta

from ...config import Config
from ...victor.services.http import cached_fetch, get_json

BASE = "https://eodhd.com/api"

PAIRS = (
    ("BTC", "BTC-USD.CC"),
    ("ETH", "ETH-USD.CC"),
    ("XRP", "XRP-USD.CC"),
)


def realtime_price(symbol: str, provider_symbol: str, force: bool = False):
    """Return the latest EODHD price for one crypto symbol."""

    def live():
        if not Config.EODHD_API_KEY:
            raise ValueError("no eodhd key")
        payload = get_json(
            f"{BASE}/real-time/{provider_symbol}",
            params={"api_token": Config.EODHD_API_KEY, "fmt": "json"},
        )
        if not isinstance(payload, dict):
            raise ValueError("empty quote")

        price = payload.get("close")
        if price is None:
            price = payload.get("price")
        if price is None:
            raise ValueError("empty quote")

        return {
            "symbol": symbol,
            "price": float(price),
            "open": payload.get("open"),
            "high": payload.get("high"),
            "low": payload.get("low"),
            "volume": payload.get("volume"),
            "timestamp": payload.get("timestamp") or payload.get("datetime") or payload.get("ts"),
            "raw": payload,
        }

    return cached_fetch(
        f"eodhd:realtime:{symbol}",
        60,
        live,
        lambda: {"symbol": symbol, "price": None},
        force=force,
    )


def realtime_prices(force: bool = False):
    """Return latest prices for the fixed assignment symbols."""
    quotes = []
    for symbol, provider_symbol in PAIRS:
        payload, source = realtime_price(symbol, provider_symbol, force=force)
        quotes.append({**payload, "source": source})
    return quotes


def eod_series(symbol: str, provider_symbol: str, force: bool = False):
    """URI: GET /api/eod/{symbol} — recent daily candles for one symbol."""

    def live():
        if not Config.EODHD_API_KEY:
            raise ValueError("no eodhd key")
        start_date = (date.today() - timedelta(days=45)).isoformat()
        payload = get_json(
            f"{BASE}/eod/{provider_symbol}",
            params={
                "api_token": Config.EODHD_API_KEY,
                "fmt": "json",
                "period": "d",
                "order": "a",
                "from": start_date,
            },
        )
        if not isinstance(payload, list) or not payload:
            raise ValueError("empty eod series")

        points = payload[-30:]
        return {
            "symbol": symbol,
            "points": [
                {
                    "date": p.get("date"),
                    "open": p.get("open"),
                    "high": p.get("high"),
                    "low": p.get("low"),
                    "close": p.get("close"),
                    "volume": p.get("volume"),
                }
                for p in points
            ],
        }

    return cached_fetch(
        f"eodhd:eod:{symbol}",
        15 * 60,
        live,
        lambda: {"symbol": symbol, "points": []},
        force=force,
    )


def eod_series_all(force: bool = False):
    """Return EOD candles for BTC, ETH, XRP."""
    items = []
    for symbol, provider_symbol in PAIRS:
        payload, source = eod_series(symbol, provider_symbol, force=force)
        items.append({**payload, "source": source})
    return items


def fundamentals(symbol: str, provider_symbol: str, force: bool = False):
    """URI: GET /api/fundamentals/{symbol} — fundamentals payload for one symbol."""

    def live():
        if not Config.EODHD_API_KEY:
            raise ValueError("no eodhd key")
        payload = get_json(
            f"{BASE}/fundamentals/{provider_symbol}",
            params={"api_token": Config.EODHD_API_KEY, "fmt": "json"},
        )
        if not isinstance(payload, dict) or not payload:
            raise ValueError("empty fundamentals")

        general = payload.get("General") or {}
        highlights = payload.get("Highlights") or {}
        market_cap = highlights.get("MarketCapitalization")
        if market_cap is None:
            market_cap = highlights.get("MarketCapitalizationMln")

        return {
            "symbol": symbol,
            "name": general.get("Name"),
            "description": general.get("Description"),
            "type": general.get("Type"),
            "currency": general.get("CurrencyCode"),
            "market_cap": market_cap,
            "raw": payload,
        }

    return cached_fetch(
        f"eodhd:fundamentals:{symbol}",
        24 * 3600,
        live,
        lambda: {"symbol": symbol, "name": None, "market_cap": None},
        force=force,
    )


def fundamentals_all(force: bool = False):
    """Return fundamentals for BTC, ETH, XRP."""
    items = []
    for symbol, provider_symbol in PAIRS:
        payload, source = fundamentals(symbol, provider_symbol, force=force)
        items.append({**payload, "source": source})
    return items