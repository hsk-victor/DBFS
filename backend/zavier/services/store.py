"""Zavier-owned cache persistence for external Crypto API responses."""
import json
import threading
import time
from pathlib import Path

from ...shared.database import supabase

_LOCAL_PATH = Path(__file__).resolve().parents[3] / "data" / "zavier_cache.json"


class CacheStore:
    def __init__(self):
        self._sb = supabase
        self._lock = threading.RLock()
        self._local = self._load_local()

    def _load_local(self):
        try:
            payload = json.loads(_LOCAL_PATH.read_text(encoding="utf-8"))
            return payload if isinstance(payload, dict) else {}
        except Exception:
            return {}

    def _save_local(self):
        try:
            _LOCAL_PATH.parent.mkdir(parents=True, exist_ok=True)
            _LOCAL_PATH.write_text(json.dumps(self._local, indent=2), encoding="utf-8")
        except Exception:
            pass

    def cache_get_stale(self, key: str):
        if self._sb:
            try:
                result = self._sb.table("api_cache").select("payload").eq("key", key).execute()
                if result.data:
                    return result.data[0]["payload"]
            except Exception:
                pass
        with self._lock:
            row = self._local.get(key)
            return row.get("payload") if row else None

    def cache_put(self, key: str, payload):
        fetched_at = int(time.time())
        if self._sb:
            try:
                self._sb.table("api_cache").upsert({
                    "key": key,
                    "payload": payload,
                    "fetched_at": fetched_at,
                }).execute()
            except Exception:
                pass
        with self._lock:
            self._local[key] = {"payload": payload, "fetched_at": fetched_at}
            self._save_local()


store = CacheStore()
