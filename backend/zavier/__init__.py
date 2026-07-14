"""Zavier's Crypto backend module."""
from flask import Blueprint, jsonify

crypto_bp = Blueprint("crypto", __name__)


@crypto_bp.get("/health")
def health():
    return jsonify({"ok": True, "module": "crypto", "owner": "Zavier"})


def register_blueprints(app):
    app.register_blueprint(crypto_bp, url_prefix="/api/crypto")
