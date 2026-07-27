import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


class Config:
    SECRET_KEY = os.getenv("FLASK_SECRET_KEY", "dev-only-secret")

    PAYPAL_CLIENT_ID = os.getenv("PAYPAL_CLIENT_ID", "")
    PAYPAL_CLIENT_SECRET = os.getenv("PAYPAL_CLIENT_SECRET", "")
    PAYPAL_MERCHANT_EMAIL = os.getenv("PAYPAL_MERCHANT_EMAIL", "")
    PAYPAL_REDIRECT_URI = os.getenv("PAYPAL_REDIRECT_URI", "http://127.0.0.1:5000/api/auth/callback")
    PAYPAL_BASE = "https://api-m.sandbox.paypal.com"
    PAYPAL_WEB = "https://www.sandbox.paypal.com"

    EODHD_API_KEY = os.getenv("EODHD_API_KEY", "")
    COINGECKO_API_KEY = os.getenv("COINGECKO_API_KEY", "")
    GNEWS_API_KEY = os.getenv("GNEWS_API_KEY", "")
    FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY", "")
    TWELVEDATA_API_KEY = os.getenv("TWELVEDATA_API_KEY", "")
    FMP_API_KEY = os.getenv("FMP_API_KEY", "")

    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5-nano")
    GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

    SUPABASE_URL = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

    FALLBACK_USD_SGD = float(os.getenv("FALLBACK_USD_SGD", "1.2748"))

    # After PayPal login / checkout we bounce back to the SPA.
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://127.0.0.1:5173")
