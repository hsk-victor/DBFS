"""Forex persistence using the shared backend-only Supabase client.

A small JSON fallback keeps the zero-configuration demo persistent across
Flask restarts. It is intentionally separate from Victor's Stocks store.
"""
import json
import threading
import time
from pathlib import Path

from ...shared.database import supabase

_LOCAL_PATH = Path(__file__).resolve().parents[3] / "data" / "forex_store.json"


class Store:
    def __init__(self):
        self._sb = supabase
        self._lock = threading.RLock()
        self._local = self._load_local()

    def _load_local(self):
        try:
            data = json.loads(_LOCAL_PATH.read_text(encoding="utf-8"))
            for key in ("quotes", "orders", "holdings", "cache"):
                data.setdefault(key, {})
            return data
        except Exception:
            return {"quotes": {}, "orders": {}, "holdings": {}, "cache": {}}

    def _save_local(self):
        _LOCAL_PATH.parent.mkdir(parents=True, exist_ok=True)
        _LOCAL_PATH.write_text(json.dumps(self._local, indent=2), encoding="utf-8")

    # API cache
    def cache_get(self, key: str, max_age_s: int):
        row = self._cache_row(key)
        if row and time.time() - int(row["fetched_at"]) <= max_age_s:
            return row["payload"]
        return None

    def cache_get_stale(self, key: str):
        row = self._cache_row(key)
        return row["payload"] if row else None

    def _cache_row(self, key):
        if self._sb:
            try:
                result = self._sb.table("api_cache").select("payload,fetched_at").eq("key", key).execute()
                if result.data:
                    return result.data[0]
            except Exception:
                pass
        with self._lock:
            return self._local["cache"].get(key)

    def cache_put(self, key: str, payload):
        row = {"key": key, "payload": payload, "fetched_at": int(time.time())}
        if self._sb:
            try:
                self._sb.table("api_cache").upsert(row).execute()
            except Exception:
                pass
        with self._lock:
            self._local["cache"][key] = {"payload": payload, "fetched_at": row["fetched_at"]}
            self._save_local()

    # Quotes
    def add_quote(self, user_id: str, quote: dict):
        row = {**quote, "user_id": user_id}
        if self._sb:
            self._sb.table("forex_quotes").insert(row).execute()
        with self._lock:
            self._local["quotes"][quote["quote_id"]] = row
            self._save_local()
        return row

    def find_quote(self, user_id: str, quote_id: str):
        if self._sb:
            try:
                result = (self._sb.table("forex_quotes").select("*")
                          .eq("user_id", user_id).eq("quote_id", quote_id).limit(1).execute())
                return result.data[0] if result.data else None
            except Exception:
                pass
        with self._lock:
            row = self._local["quotes"].get(quote_id)
            return dict(row) if row and row.get("user_id") == user_id else None

    def update_quote(self, user_id: str, quote_id: str, patch: dict):
        if self._sb:
            self._sb.table("forex_quotes").update(patch).eq("user_id", user_id).eq("quote_id", quote_id).execute()
        with self._lock:
            row = self._local["quotes"].get(quote_id)
            if row and row.get("user_id") == user_id:
                row.update(patch)
                self._save_local()

    def mark_quote_expired(self, user_id: str, quote_id: str):
        self.update_quote(user_id, quote_id, {"status": "expired"})

    def mark_quote_used(self, user_id: str, quote_id: str):
        self.update_quote(user_id, quote_id, {"status": "used"})

    # Orders
    def add_order(self, user_id: str, order: dict):
        row = {**order, "user_id": user_id}
        if self._sb:
            self._sb.table("forex_orders").insert(row).execute()
        with self._lock:
            self._local["orders"][order["order_id"]] = row
            self._save_local()
        return row

    def find_order(self, user_id: str, order_id: str):
        if self._sb:
            try:
                result = (self._sb.table("forex_orders").select("*")
                          .eq("user_id", user_id).eq("order_id", order_id).limit(1).execute())
                return result.data[0] if result.data else None
            except Exception:
                pass
        with self._lock:
            row = self._local["orders"].get(order_id)
            return dict(row) if row and row.get("user_id") == user_id else None

    def find_order_by_quote(self, user_id: str, quote_id: str):
        if self._sb:
            try:
                result = (self._sb.table("forex_orders").select("*")
                          .eq("user_id", user_id).eq("quote_id", quote_id).limit(1).execute())
                return result.data[0] if result.data else None
            except Exception:
                pass
        with self._lock:
            row = next((item for item in self._local["orders"].values()
                        if item.get("user_id") == user_id and item.get("quote_id") == quote_id), None)
            return dict(row) if row else None

    def get_orders(self, user_id: str):
        if self._sb:
            try:
                result = (self._sb.table("forex_orders").select("*").eq("user_id", user_id)
                          .order("created_at", desc=True).limit(50).execute())
                return result.data
            except Exception:
                pass
        with self._lock:
            rows = [dict(row) for row in self._local["orders"].values()
                    if row.get("user_id") == user_id]
        return sorted(rows, key=lambda row: row.get("created_at", 0), reverse=True)[:50]

    def update_order(self, user_id: str, order_id: str, patch: dict):
        if self._sb:
            self._sb.table("forex_orders").update(patch).eq("user_id", user_id).eq("order_id", order_id).execute()
        with self._lock:
            row = self._local["orders"].get(order_id)
            if row and row.get("user_id") == user_id:
                row.update(patch)
                self._save_local()

    # Holdings
    def get_holdings(self, user_id: str):
        if self._sb:
            try:
                result = self._sb.table("forex_holdings").select("*").eq("user_id", user_id).execute()
                return result.data
            except Exception:
                pass
        with self._lock:
            return [dict(row) for row in self._local["holdings"].values()
                    if row.get("user_id") == user_id]

    def apply_fill(self, user_id: str, currency: str, amount: float, sgd_rate: float):
        with self._lock:
            current = next((h for h in self.get_holdings(user_id)
                            if h.get("currency") == currency), None)
            old_amount = float(current.get("amount", 0)) if current else 0.0
            old_avg = float(current.get("avg_sgd_rate", 0)) if current else 0.0
            new_amount = old_amount + amount
            new_avg = ((old_amount * old_avg) + (amount * sgd_rate)) / new_amount
            row = {
                "user_id": user_id,
                "currency": currency,
                "amount": round(new_amount, 4),
                "avg_sgd_rate": round(new_avg, 4),
                "updated_at": int(time.time()),
            }
            if self._sb:
                self._sb.table("forex_holdings").upsert(row).execute()
            self._local["holdings"][f"{user_id}:{currency}"] = row
            self._save_local()
            return row


store = Store()
