"""Persistence for Forex, isolated from the Stocks store.

Supabase is authoritative whenever database configuration is present. Local
JSON is used only when Supabase is deliberately unconfigured for offline demo
mode; a broken cloud connection is never disguised as a successful local write.
"""
import json
import logging
import threading
import time
from pathlib import Path

from ...config import Config
from ...shared.database import supabase

log = logging.getLogger(__name__)
_LOCAL_PATH = Path(__file__).resolve().parents[3] / "data" / "forex_store.json"


class PersistenceError(RuntimeError):
    """A safe, user-facing persistence failure."""


class Store:
    def __init__(self):
        self._sb = supabase
        self._cloud_expected = bool(Config.SUPABASE_URL or Config.SUPABASE_SERVICE_KEY)
        self._lock = threading.RLock()
        self._local = self._load_local()

    @property
    def is_cloud(self) -> bool:
        return self._sb is not None

    @property
    def storage_status(self) -> str:
        if self.is_cloud:
            return "supabase"
        return "misconfigured" if self._cloud_expected else "local_demo"

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

    def _require_available(self):
        if self._cloud_expected and not self._sb:
            raise PersistenceError("Supabase backend credentials are misconfigured")

    def _cloud(self, operation: str, callback):
        self._require_available()
        try:
            return callback()
        except Exception as exc:
            log.error("Forex Supabase %s failed: %s", operation, type(exc).__name__)
            raise PersistenceError(f"Forex database {operation} failed") from exc

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
        if self._cloud_expected:
            result = self._cloud(
                "cache read",
                lambda: self._sb.table("api_cache").select("payload,fetched_at").eq("key", key).execute(),
            )
            return result.data[0] if result.data else None
        with self._lock:
            return self._local["cache"].get(key)

    def cache_put(self, key: str, payload):
        row = {"key": key, "payload": payload, "fetched_at": int(time.time())}
        if self._cloud_expected:
            self._cloud("cache write", lambda: self._sb.table("api_cache").upsert(row).execute())
            return
        with self._lock:
            self._local["cache"][key] = {"payload": payload, "fetched_at": row["fetched_at"]}
            self._save_local()

    # Quotes
    def add_quote(self, user_id: str, quote: dict):
        row = {**quote, "user_id": user_id}
        if self._cloud_expected:
            self._cloud("quote insert", lambda: self._sb.table("forex_quotes").insert(row).execute())
        else:
            with self._lock:
                self._local["quotes"][quote["quote_id"]] = row
                self._save_local()
        return row

    def find_quote(self, user_id: str, quote_id: str):
        if self._cloud_expected:
            result = self._cloud(
                "quote read",
                lambda: (self._sb.table("forex_quotes").select("*").eq("user_id", user_id)
                         .eq("quote_id", quote_id).limit(1).execute()),
            )
            return result.data[0] if result.data else None
        with self._lock:
            row = self._local["quotes"].get(quote_id)
            return dict(row) if row and row.get("user_id") == user_id else None

    def update_quote(self, user_id: str, quote_id: str, patch: dict):
        if self._cloud_expected:
            self._cloud(
                "quote update",
                lambda: (self._sb.table("forex_quotes").update(patch).eq("user_id", user_id)
                         .eq("quote_id", quote_id).execute()),
            )
            return
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
        if self._cloud_expected:
            self._cloud("order insert", lambda: self._sb.table("forex_orders").insert(row).execute())
        else:
            with self._lock:
                self._local["orders"][order["order_id"]] = row
                self._save_local()
        return row

    def find_order(self, user_id: str, order_id: str):
        if self._cloud_expected:
            result = self._cloud(
                "order read",
                lambda: (self._sb.table("forex_orders").select("*").eq("user_id", user_id)
                         .eq("order_id", order_id).limit(1).execute()),
            )
            return result.data[0] if result.data else None
        with self._lock:
            row = self._local["orders"].get(order_id)
            return dict(row) if row and row.get("user_id") == user_id else None

    def find_order_by_quote(self, user_id: str, quote_id: str):
        if self._cloud_expected:
            result = self._cloud(
                "order by quote read",
                lambda: (self._sb.table("forex_orders").select("*").eq("user_id", user_id)
                         .eq("quote_id", quote_id).limit(1).execute()),
            )
            return result.data[0] if result.data else None
        with self._lock:
            row = next((item for item in self._local["orders"].values()
                        if item.get("user_id") == user_id and item.get("quote_id") == quote_id), None)
            return dict(row) if row else None

    def get_orders(self, user_id: str):
        if self._cloud_expected:
            result = self._cloud(
                "orders read",
                lambda: (self._sb.table("forex_orders").select("*").eq("user_id", user_id)
                         .order("created_at", desc=True).limit(50).execute()),
            )
            return result.data
        with self._lock:
            rows = [dict(row) for row in self._local["orders"].values()
                    if row.get("user_id") == user_id]
        return sorted(rows, key=lambda row: row.get("created_at", 0), reverse=True)[:50]

    def update_order(self, user_id: str, order_id: str, patch: dict):
        if self._cloud_expected:
            self._cloud(
                "order update",
                lambda: (self._sb.table("forex_orders").update(patch).eq("user_id", user_id)
                         .eq("order_id", order_id).execute()),
            )
            return
        with self._lock:
            row = self._local["orders"].get(order_id)
            if row and row.get("user_id") == user_id:
                row.update(patch)
                self._save_local()

    # Holdings
    def get_holdings(self, user_id: str):
        if self._cloud_expected:
            result = self._cloud(
                "holdings read",
                lambda: self._sb.table("forex_holdings").select("*").eq("user_id", user_id).execute(),
            )
            return result.data
        with self._lock:
            return [dict(row) for row in self._local["holdings"].values()
                    if row.get("user_id") == user_id]

    def apply_fill(self, user_id: str, currency: str, amount: float, sgd_rate: float):
        if self._cloud_expected:
            current = next((h for h in self.get_holdings(user_id) if h.get("currency") == currency), None)
        else:
            with self._lock:
                current = next((h for h in self.get_holdings(user_id)
                                if h.get("currency") == currency), None)
        old_amount = float(current.get("amount", 0)) if current else 0.0
        old_avg = float(current.get("avg_sgd_rate", 0)) if current else 0.0
        new_amount = old_amount + amount
        row = {
            "user_id": user_id, "currency": currency,
            "amount": round(new_amount, 4),
            "avg_sgd_rate": round(((old_amount * old_avg) + (amount * sgd_rate)) / new_amount, 4),
            "updated_at": int(time.time()),
        }
        if self._cloud_expected:
            self._cloud("holding upsert", lambda: self._sb.table("forex_holdings").upsert(row).execute())
        else:
            with self._lock:
                self._local["holdings"][f"{user_id}:{currency}"] = row
                self._save_local()
        return row

    def complete_order(self, user_id: str, order_id: str):
        """Atomically complete a cloud order; guard local demo completion with a lock."""
        if self._cloud_expected:
            try:
                result = self._sb.rpc(
                    "complete_forex_order",
                    {"p_user_id": user_id, "p_order_id": order_id},
                ).execute()
            except Exception as exc:
                # Temporary compatibility until the reviewed RPC migration is
                # applied. This protects one Flask process only; the RPC remains
                # the production-grade cross-process transaction boundary.
                if getattr(exc, "code", None) == "PGRST202" or "PGRST202" in str(exc):
                    log.warning("Forex completion RPC is not installed; using single-process lock")
                    return self._complete_order_locked(user_id, order_id)
                log.error("Forex Supabase order completion failed: %s", type(exc).__name__)
                raise PersistenceError("Forex database order completion failed") from exc
            if not result.data:
                return self.find_order(user_id, order_id)
            return result.data[0] if isinstance(result.data, list) else result.data

        return self._complete_order_locked(user_id, order_id)

    def _complete_order_locked(self, user_id: str, order_id: str):
        with self._lock:
            order = self.find_order(user_id, order_id)
            if not order or order.get("status") not in ("pending_paypal", "filled"):
                return None
            if order["status"] == "filled":
                return order
            self.apply_fill(user_id, order["currency"], float(order["amount"]), float(order["sgd_rate"]))
            self.mark_quote_used(user_id, order["quote_id"])
            self.update_order(user_id, order_id, {"status": "filled"})
            return self.find_order(user_id, order_id)


store = Store()
