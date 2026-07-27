"""EODHD crypto helpers split by URI purpose."""

from datetime import date, timedelta

from ...config import Config
from .http import cached_fetch, get_json

BASE = "https://eodhd.com/api"

PAIRS = (
    ("BTC", "BTC-USD.CC"),
    ("ETH", "ETH-USD.CC"),
    ("XRP", "XRP-USD.CC"),
    ("SOL", "SOL-USD.CC"),
    ("BNB", "BNB-USD.CC"),
    ("DOGE", "DOGE-USD.CC"),
    ("ADA", "ADA-USD.CC"),
    ("TRX", "TRX-USD.CC"),
    ("AVAX", "AVAX-USD.CC"),
    ("LINK", "LINK-USD.CC"),
    ("DOT", "DOT-USD.CC"),
    ("LTC", "LTC-USD.CC"),
    ("BCH", "BCH-USD.CC"),
    ("XLM", "XLM-USD.CC"),
    ("ATOM", "ATOM-USD.CC"),
    ("NEAR", "NEAR-USD.CC"),
    ("APT", "APT-USD.CC"),
    ("ARB", "ARB-USD.CC"),
    ("OP", "OP-USD.CC"),
    ("FIL", "FIL-USD.CC"),
    ("ALGO", "ALGO-USD.CC"),
    ("ETC", "ETC-USD.CC"),
    ("UNI", "UNI-USD.CC"),
    ("AAVE", "AAVE-USD.CC"),
    ("MKR", "MKR-USD.CC"),
    ("SUI", "SUI-USD.CC"),
    ("ICP", "ICP-USD.CC"),
    ("HBAR", "HBAR-USD.CC"),
    ("VET", "VET-USD.CC"),
    ("MATIC", "MATIC-USD.CC"),
    ("PEPE", "PEPE-USD.CC"),
    ("SHIB", "SHIB-USD.CC"),
)
PAIRS_BY_SYMBOL = dict(PAIRS)

# NOT COUNTED WITHIN THE 10 URIS
def usd_sgd(force: bool = False):
    """Return the live USD→SGD exchange rate from EODHD forex data."""

    def live():
        if not Config.EODHD_API_KEY:
            raise ValueError("no eodhd key")
        payload = get_json(
            f"{BASE}/real-time/USDSGD.FOREX",
            params={"api_token": Config.EODHD_API_KEY, "fmt": "json"},
        )
        if not isinstance(payload, dict):
            raise ValueError("empty fx quote")

        rate = payload.get("close")
        if rate is None:
            rate = payload.get("price")
        if rate is None:
            raise ValueError("empty fx quote")

        return {
            "rate": float(rate),
            "date": payload.get("timestamp") or payload.get("datetime") or payload.get("date") or "",
            "provider": "EODHD Forex",
            "raw": payload,
        }

    return cached_fetch(
        "eodhd:fx:usdsgd",
        6 * 3600,
        live,
        lambda: {"rate": Config.FALLBACK_USD_SGD, "date": "", "provider": "fixed fallback"},
        force=force,
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

        change_pct = payload.get("change_p")
        if change_pct is None:
            previous_close = payload.get("previousClose")
            try:
                p = float(price)
                if previous_close not in (None, 0, "0"):
                    pc = float(previous_close)
                    change_pct = ((p - pc) / pc) * 100
                elif payload.get("open") not in (None, 0, "0"):
                    op = float(payload.get("open"))
                    change_pct = ((p - op) / op) * 100
            except (TypeError, ValueError, ZeroDivisionError):
                change_pct = None

        return {
            "symbol": symbol,
            "price": float(price),
            "change_pct": float(change_pct) if change_pct is not None else 0.0,
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


def _normalize_symbols(symbols):
    if not symbols:
        return [symbol for symbol, _ in PAIRS]
    seen = set()
    selected = []
    for raw in symbols:
        symbol = str(raw or "").strip().upper()
        if not symbol or symbol in seen or symbol not in PAIRS_BY_SYMBOL:
            continue
        seen.add(symbol)
        selected.append(symbol)
    return selected


def realtime_prices(force: bool = False, symbols=None):
    """Return latest prices for the requested symbol subset."""
    quotes = []
    for symbol in _normalize_symbols(symbols):
        provider_symbol = PAIRS_BY_SYMBOL[symbol]
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


def eod_series_all(force: bool = False, symbols=None):
    """Return EOD candles for the requested symbol subset."""
    items = []
    for symbol in _normalize_symbols(symbols):
        provider_symbol = PAIRS_BY_SYMBOL[symbol]
        payload, source = eod_series(symbol, provider_symbol, force=force)
        items.append({**payload, "source": source})
    return items
