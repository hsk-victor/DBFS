"""Frankfurter — USD→SGD ECB reference rate (1 graded URI, no key needed)."""
from ...config import Config
from .http import cached_fetch, get_json


def usd_sgd(force: bool = False):
    def live():
        j = get_json("https://api.frankfurter.dev/v1/latest", {"base": "USD", "symbols": "SGD"})
        rate = j["rates"]["SGD"]
        return {"rate": rate, "date": j.get("date", ""), "provider": "Frankfurter (ECB)"}

    def demo():
        return {"rate": Config.FALLBACK_USD_SGD, "date": "", "provider": "fixed fallback"}

    return cached_fetch("fx:usdsgd", 6 * 3600, live, demo, force=force)
