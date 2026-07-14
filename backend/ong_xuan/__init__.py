"""Ong Xuan's backend module."""
from flask import Blueprint, jsonify

other_bp = Blueprint("other", __name__)


@other_bp.get("/health")
def health():
    return jsonify({"ok": True, "module": "other", "owner": "Ong Xuan"})


def register_blueprints(app):
    app.register_blueprint(other_bp, url_prefix="/api/other")
