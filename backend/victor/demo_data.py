"""Demo-mode dataset.

Served whenever a provider key is missing or a live call fails, so the app
(and the graded demo) never dies on a rate limit or an outage. Mirrors the
figures used in the design prototype.
"""
import math
import random
import time


def _fallback_stock(name: str, price: float, chg: float, target: float, market_cap: str) -> dict:
    """Compact offline fallback for stocks whose normal data comes from APIs."""
    return {
        "name": name,
        "price": price,
        "chg": chg,
        "target": target,
        "fund": [
            ["Mkt cap", market_cap], ["P/E fwd", "—"], ["EPS ttm", "—"],
            ["Rev growth", "—"], ["Gross margin", "—"], ["YTD", "—"],
        ],
        "news": [
            [f"{name} latest market update", "Market feed", 4],
            [f"Analysts review the outlook for {name}", "Market feed", 24],
            [f"{name} shares track the broader market", "Market feed", 48],
        ],
    }


DEMO_STOCKS = {
    "NVDA": {
        "name": "NVIDIA Corporation", "price": 172.40, "chg": 2.31, "target": 205,
        "fund": [["Mkt cap", "$4.21T"], ["P/E fwd", "46.2"], ["EPS ttm", "$3.71"],
                 ["Rev growth", "+62.4%"], ["Gross margin", "74.8%"], ["YTD", "+28.4%"]],
        "news": [
            ["NVIDIA lifts data-center outlook on sustained Blackwell demand", "Reuters", 2],
            ["TSMC expands CoWoS capacity for AI accelerators", "Nikkei", 6],
            ["US weighs tighter AI chip export rules", "FT", 24],
        ],
    },
    "GOOG": {
        "name": "Alphabet Inc", "price": 198.16, "chg": -0.84, "target": 225,
        "fund": [["Mkt cap", "$2.44T"], ["P/E fwd", "21.8"], ["EPS ttm", "$8.91"],
                 ["Rev growth", "+13.6%"], ["Gross margin", "58.1%"], ["YTD", "+4.7%"]],
        "news": [
            ["Alphabet keeps 2026 capex guidance unchanged", "Reuters", 3],
            ["Gemini API usage doubles quarter over quarter", "TechCrunch", 8],
            ["EU opens fresh probe into ad-tech practices", "Bloomberg", 24],
        ],
    },
    "INTC": {
        "name": "Intel Corporation", "price": 33.92, "chg": 1.12, "target": 36,
        "fund": [["Mkt cap", "$148B"], ["P/E fwd", "28.4"], ["EPS ttm", "$0.94"],
                 ["Rev growth", "+3.1%"], ["Gross margin", "39.2%"], ["YTD", "+41.6%"]],
        "news": [
            ["Intel signs second external foundry customer for 18A", "WSJ", 4],
            ["Intel to detail Panther Lake ramp at investor day", "CNBC", 9],
            ["Analysts flag continued gross-margin pressure", "Barron's", 24],
        ],
    },
    "AMD": {
        "name": "Advanced Micro Devices", "price": 224.10, "chg": 1.84, "target": 248,
        "fund": [["Mkt cap", "$363B"], ["P/E fwd", "38.9"], ["EPS ttm", "$4.02"],
                 ["Rev growth", "+24.2%"], ["Gross margin", "52.4%"], ["YTD", "+85.5%"]],
        "news": [
            ["AMD wins new hyperscaler order for MI400", "Reuters", 5],
            ["Server CPU share climbs to 41%", "Mercury Research", 24],
            ["Client segment demand remains soft", "WSJ", 24],
        ],
    },
    "MSFT": {
        "name": "Microsoft Corporation", "price": 512.30, "chg": 0.42, "target": 560,
        "fund": [["Mkt cap", "$3.81T"], ["P/E fwd", "33.1"], ["EPS ttm", "$13.42"],
                 ["Rev growth", "+15.8%"], ["Gross margin", "69.5%"], ["YTD", "+21.5%"]],
        "news": [
            ["Azure AI services revenue run-rate tops $60B", "Bloomberg", 4],
            ["Microsoft schedules Q4 earnings for 28 Jul", "Press release", 24],
            ["Copilot seat growth steady in enterprise", "ZDNet", 48],
        ],
    },
    "TSLA": {
        "name": "Tesla Inc", "price": 291.55, "chg": -2.10, "target": 270,
        "fund": [["Mkt cap", "$937B"], ["P/E fwd", "88.6"], ["EPS ttm", "$1.84"],
                 ["Rev growth", "-4.8%"], ["Gross margin", "17.1%"], ["YTD", "-27.8%"]],
        "news": [
            ["Tesla trims full-year delivery guidance", "Reuters", 3],
            ["Price cuts widen across European markets", "Bloomberg", 24],
            ["Robotaxi pilot expands to two new cities", "The Verge", 48],
        ],
    },
    "AAPL": _fallback_stock("Apple Inc", 230.00, 0.35, 250.00, "$3.5T"),
    "AMZN": _fallback_stock("Amazon.com Inc", 225.00, 0.70, 250.00, "$2.4T"),
    "META": _fallback_stock("Meta Platforms Inc", 680.00, 1.10, 750.00, "$1.7T"),
    "AVGO": _fallback_stock("Broadcom Inc", 290.00, 0.85, 320.00, "$1.4T"),
    "JPM": _fallback_stock("JPMorgan Chase & Co", 290.00, 0.20, 310.00, "$800B"),
    "WMT": _fallback_stock("Walmart Inc", 105.00, 0.15, 115.00, "$840B"),
    "LLY": _fallback_stock("Eli Lilly and Company", 980.00, -0.30, 1050.00, "$930B"),
    "V": _fallback_stock("Visa Inc", 365.00, 0.25, 390.00, "$710B"),
    "ORCL": _fallback_stock("Oracle Corporation", 245.00, 0.60, 270.00, "$680B"),
    "MA": _fallback_stock("Mastercard Incorporated", 580.00, 0.30, 620.00, "$530B"),
    "XOM": _fallback_stock("Exxon Mobil Corporation", 115.00, -0.20, 125.00, "$500B"),
    "NFLX": _fallback_stock("Netflix Inc", 1250.00, 0.90, 1350.00, "$530B"),
    "COST": _fallback_stock("Costco Wholesale Corporation", 1000.00, 0.10, 1080.00, "$440B"),
    "UNH": _fallback_stock("UnitedHealth Group Incorporated", 340.00, -0.45, 390.00, "$310B"),
}

DEMO_AI = {
    "NVDA": {"tag": "Bullish", "text": "Momentum remains constructive: Blackwell-generation demand is still supply-constrained and this week's headlines skew positive on data-center orders. Valuation is rich at ~46x forward earnings, so consider sizing in tranches rather than a single entry."},
    "GOOG": {"tag": "Neutral", "text": "Search and YouTube ad revenue are growing steadily while Gemini monetisation is still early. Today's move tracks the broader market rather than company news - no headline catalyst detected in the last 24 hours."},
    "INTC": {"tag": "Bullish", "text": "Foundry turnaround signals are improving - 18A yields and a second external customer dominate this week's coverage. Margins remain well below peers, so treat this as a longer-horizon recovery position rather than a momentum trade."},
    "AMD": {"tag": "Bullish", "text": "MI400 accelerator orders and continued share gains in server CPUs keep the setup constructive. Watch the November roadmap update as the next catalyst."},
    "MSFT": {"tag": "Neutral", "text": "Azure growth is steady and AI services attach continues to climb; today's move is in line with the index. No earnings catalyst until the Q4 report in late July."},
    "TSLA": {"tag": "Bearish", "text": "Delivery guidance was trimmed and margin pressure persists; this week's headlines skew negative. High volatility - size positions conservatively."},
}

DEMO_NEWS_TAGS = {
    "NVDA": ["Bullish", "Bullish", "Bearish"],
    "GOOG": ["Neutral", "Bullish", "Bearish"],
    "INTC": ["Bullish", "Neutral", "Bearish"],
    "AMD": ["Bullish", "Neutral", "Bearish"],
    "MSFT": ["Bullish", "Neutral", "Neutral"],
    "TSLA": ["Bearish", "Bearish", "Bullish"],
}


def demo_quote(sym: str) -> dict:
    d = DEMO_STOCKS[sym]
    prev = d["price"] / (1 + d["chg"] / 100)
    return {
        "symbol": sym, "price": d["price"], "change_pct": d["chg"],
        "prev_close": round(prev, 2), "high": round(d["price"] * 1.012, 2),
        "low": round(d["price"] * 0.986, 2), "open": round(prev * 1.003, 2),
        "ts": int(time.time()),
    }


def demo_profile(sym: str) -> dict:
    d = DEMO_STOCKS[sym]
    return {"symbol": sym, "name": d["name"], "exchange": "NASDAQ", "currency": "USD",
            "industry": "Technology", "logo": ""}


def demo_news(sym: str) -> list[dict]:
    d = DEMO_STOCKS[sym]
    now = int(time.time())
    return [{"headline": n[0], "source": n[1], "datetime": now - n[2] * 3600, "url": "#"}
            for n in d["news"]]


def demo_candles(sym: str, points: int = 60) -> list[dict]:
    """Deterministic pseudo-random OHLC walk around the demo price."""
    d = DEMO_STOCKS[sym]
    rnd = random.Random(sym)
    base = d["price"] * 0.92
    out = []
    now = int(time.time())
    v = base
    for i in range(points):
        drift = (d["price"] - v) * 0.06
        o = v
        c = max(1.0, v + drift + (rnd.random() - 0.48) * d["price"] * 0.018)
        hi = max(o, c) * (1 + rnd.random() * 0.008)
        lo = min(o, c) * (1 - rnd.random() * 0.008)
        out.append({"t": now - (points - i) * 86400, "o": round(o, 2), "h": round(hi, 2),
                    "l": round(lo, 2), "c": round(c, 2)})
        v = c
    return out


def demo_fundamentals(sym: str) -> dict:
    d = DEMO_STOCKS[sym]
    return {"symbol": sym, "metrics": [{"label": f[0], "value": f[1]} for f in d["fund"]],
            "target": d["target"]}
