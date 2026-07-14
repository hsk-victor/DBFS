"""Victor's Stocks backend module."""


def register_blueprints(app):
    from .routes.ai import ai_bp
    from .routes.market import market_bp
    from .routes.orders import orders_bp
    from .routes.portfolio import portfolio_bp

    app.register_blueprint(market_bp, url_prefix="/api/market")
    app.register_blueprint(ai_bp, url_prefix="/api/ai")
    app.register_blueprint(orders_bp, url_prefix="/api/orders")
    app.register_blueprint(portfolio_bp, url_prefix="/api/portfolio")
