"""Shared Supabase client for all feature modules."""
from ..config import Config


def _create_client():
    backend_key = Config.SUPABASE_SERVICE_KEY
    # A publishable key cannot bypass the backend-only RLS policies.
    if backend_key.startswith("sb_publishable_"):
        backend_key = ""
    if not Config.SUPABASE_URL or not backend_key:
        return None
    try:
        from supabase import create_client
        return create_client(Config.SUPABASE_URL, backend_key)
    except Exception:
        return None


supabase = _create_client()


def is_connected() -> bool:
    return supabase is not None
