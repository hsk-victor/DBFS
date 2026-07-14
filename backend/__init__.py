from flask import Flask
from flask_cors import CORS

from .config import Config


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)
    app.secret_key = Config.SECRET_KEY

    # Vite dev server origin; cookies ride on the /api proxy in dev,
    # CORS covers direct calls if anyone runs the frontend un-proxied.
    CORS(app, origins=["http://localhost:5173", "http://127.0.0.1:5173"], supports_credentials=True)

    from .ong_xuan import register_blueprints as register_ong_xuan
    from .shared import register_blueprints as register_shared
    from .victor import register_blueprints as register_victor
    from .zavier import register_blueprints as register_zavier

    register_shared(app)
    register_victor(app)
    register_zavier(app)
    register_ong_xuan(app)

    @app.get("/api/health")
    def health():
        from .shared.database import is_connected
        return {
            "ok": True,
            "paypal": bool(Config.PAYPAL_CLIENT_ID),
            "finnhub": bool(Config.FINNHUB_API_KEY),
            "twelvedata": bool(Config.TWELVEDATA_API_KEY),
            "fmp": bool(Config.FMP_API_KEY),
            "openai": bool(Config.OPENAI_API_KEY),
            "groq": bool(Config.GROQ_API_KEY),
            "supabase": is_connected(),
        }

    return app
