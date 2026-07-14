"""Persistence layer.

Supabase (Postgres) when configured; otherwise a local JSON file so the app
still runs end-to-end with zero cloud setup. Every public method degrades
gracefully — a dead Supabase project must never take the demo down.
"""
import json
import threading
import time
from pathlib import Path

from ...shared.database import supabase

_LOCAL_PATH = Path(__file__).resolve().parent.parent.parent.parent / "data" / "local_store.json"


class Store:
    def __init__(self):
        self._lock = threading.Lock()
        self._sb = None
        self._sb = supabase
        self._local = self._load_local()

    @property
    def is_cloud(self) -> bool:
        return self._sb is not None

    # ---------- local fallback ----------
    def _load_local(self) -> dict:
        try:
            return json.loads(_LOCAL_PATH.read_text(encoding="utf-8"))
        except Exception:
            return {"watchlists": {}, "holdings": {}, "orders": {}, "cache": {}}

    def _save_local(self):
        try:
            _LOCAL_PATH.parent.mkdir(parents=True, exist_ok=True)
            _LOCAL_PATH.write_text(json.dumps(self._local, indent=1), encoding="utf-8")
        except Exception:
            pass

    # ---------- api cache ----------
    def cache_get(self, key: str, max_age_s: int):
        if self._sb:
            try:
                res = self._sb.table("api_cache").select("payload,fetched_at").eq("key", key).execute()
                if res.data:
                    row = res.data[0]
                    if time.time() - row["fetched_at"] <= max_age_s:
                        return row["payload"]
                return None
            except Exception:
                pass
        with self._lock:
            row = self._local["cache"].get(key)
            if row and time.time() - row["fetched_at"] <= max_age_s:
                return row["payload"]
        return None

    def cache_get_stale(self, key: str):
        """Any cached copy regardless of age — last resort before demo data."""
        cloud_missing = False
        if self._sb:
            try:
                res = self._sb.table("api_cache").select("payload").eq("key", key).execute()
                if res.data:
                    return res.data[0]["payload"]
                cloud_missing = True
            except Exception:
                pass
        with self._lock:
            row = self._local["cache"].get(key)
        if row and cloud_missing:
            try:
                self._sb.table("api_cache").upsert({
                    "key": key,
                    "payload": row["payload"],
                    "fetched_at": row["fetched_at"],
                }).execute()
            except Exception:
                pass
        return row["payload"] if row else None

    def cache_put(self, key: str, payload):
        now = int(time.time())
        if self._sb:
            try:
                self._sb.table("api_cache").upsert(
                    {"key": key, "payload": payload, "fetched_at": now}).execute()
            except Exception:
                pass
        with self._lock:
            self._local["cache"][key] = {"payload": payload, "fetched_at": now}
            self._save_local()

    # ---------- watchlist / layout ----------
    def get_watchlist(self, user_id: str):
        if self._sb:
            try:
                res = self._sb.table("watchlist").select("layout").eq("user_id", user_id).execute()
                if res.data:
                    return res.data[0]["layout"]
                return None
            except Exception:
                pass
        with self._lock:
            return self._local["watchlists"].get(user_id)

    def save_watchlist(self, user_id: str, layout: list):
        if self._sb:
            try:
                self._sb.table("watchlist").upsert(
                    {"user_id": user_id, "layout": layout, "updated_at": int(time.time())}).execute()
            except Exception:
                pass
        with self._lock:
            self._local["watchlists"][user_id] = layout
            self._save_local()

    # ---------- holdings ----------
    def get_holdings(self, user_id: str) -> dict:
        if self._sb:
            try:
                res = self._sb.table("holdings").select("symbol,qty,avg_price").eq("user_id", user_id).execute()
                return {r["symbol"]: {"qty": r["qty"], "avg": r["avg_price"]} for r in res.data}
            except Exception:
                pass
        with self._lock:
            return dict(self._local["holdings"].get(user_id, {}))

    def apply_fill(self, user_id: str, symbol: str, side: str, qty: float, price: float):
        holdings = self.get_holdings(user_id)
        h = holdings.get(symbol, {"qty": 0.0, "avg": price})
        if side == "buy":
            nq = h["qty"] + qty
            holdings[symbol] = {"qty": nq, "avg": (h["avg"] * h["qty"] + price * qty) / nq}
        else:
            nq = h["qty"] - qty
            if nq <= 1e-4:
                holdings.pop(symbol, None)
            else:
                holdings[symbol] = {"qty": nq, "avg": h["avg"]}
        if self._sb:
            try:
                if symbol in holdings:
                    self._sb.table("holdings").upsert({
                        "user_id": user_id, "symbol": symbol,
                        "qty": holdings[symbol]["qty"], "avg_price": holdings[symbol]["avg"],
                    }).execute()
                else:
                    self._sb.table("holdings").delete().eq("user_id", user_id).eq("symbol", symbol).execute()
            except Exception:
                pass
        with self._lock:
            self._local["holdings"][user_id] = holdings
            self._save_local()
        return holdings

    def seed_holdings_if_new(self, user_id: str):
        """First login gets a small starter portfolio so the dashboard isn't empty."""
        if self.get_holdings(user_id):
            return
        for sym, qty, avg in [("NVDA", 12, 150.10), ("GOOG", 8, 176.20), ("MSFT", 4, 480.00)]:
            self.apply_fill(user_id, sym, "buy", qty, avg)

    # ---------- orders ----------
    def get_orders(self, user_id: str) -> list:
        if self._sb:
            try:
                res = (self._sb.table("orders").select("*").eq("user_id", user_id)
                       .order("created_at", desc=True).limit(30).execute())
                return res.data
            except Exception:
                pass
        with self._lock:
            return list(self._local["orders"].get(user_id, []))

    def add_order(self, user_id: str, order: dict):
        order.setdefault("created_at", int(time.time()))
        if self._sb:
            try:
                self._sb.table("orders").insert({**order, "user_id": user_id}).execute()
            except Exception:
                pass
        with self._lock:
            lst = self._local["orders"].setdefault(user_id, [])
            lst.insert(0, order)
            del lst[30:]
            self._save_local()

    def update_order(self, user_id: str, order_id: str, patch: dict):
        if self._sb:
            try:
                self._sb.table("orders").update(patch).eq("user_id", user_id).eq("order_id", order_id).execute()
            except Exception:
                pass
        with self._lock:
            for o in self._local["orders"].get(user_id, []):
                if o.get("order_id") == order_id:
                    o.update(patch)
            self._save_local()

    def find_order(self, user_id: str, order_id: str):
        for o in self.get_orders(user_id):
            if o.get("order_id") == order_id:
                return o
        return None


store = Store()
