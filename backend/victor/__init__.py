"""Victor's Stocks backend module."""


def register_blueprints(app):
    from .auth import auth_bp
    from .routes.ai import ai_bp
    from .routes.market import market_bp
    from .routes.orders import orders_bp
    from .routes.portfolio import portfolio_bp

    app.register_blueprint(auth_bp, url_prefix="/api/victor/auth")
    app.register_blueprint(auth_bp, url_prefix="/api/auth", name="victor_auth_legacy")
    app.register_blueprint(market_bp, url_prefix="/api/market")
    app.register_blueprint(ai_bp, url_prefix="/api/ai")
    app.register_blueprint(orders_bp, url_prefix="/api/orders")
    app.register_blueprint(portfolio_bp, url_prefix="/api/portfolio")
