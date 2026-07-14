"""Shared fetch-with-cache helpers for external data providers.

Normal reads reuse the last cached response indefinitely to protect free API
quotas. A caller must explicitly pass ``force=True`` to fetch fresh live data.
If a live request fails, stale cache and demo data remain available as fallbacks.
"""
import requests

from .store import store

TIMEOUT = 8


def cached_fetch(key: str, max_age_s: int, fetch_live, demo, force: bool = False):
    # max_age_s remains in the interface so each provider documents its intended
    # freshness, but ordinary reads no longer refresh automatically when it expires.
    del max_age_s
    if not force:
        cached = store.cache_get_stale(key)
        if cached is not None:
            return cached, "cached"
    try:
        data = fetch_live()
        if data is not None:
            store.cache_put(key, data)
            return data, "live"
    except (requests.RequestException, ValueError, KeyError):
        pass
    stale = store.cache_get_stale(key)
    if stale is not None:
        return stale, "cached"
    return demo(), "demo"


def get_json(url: str, params: dict | None = None, headers: dict | None = None):
    response = requests.get(url, params=params, headers=headers, timeout=TIMEOUT)
    response.raise_for_status()
    return response.json()
