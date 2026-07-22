"""CoinGecko crypto helpers split by URI purpose."""

from ...config import Config
from ...victor.services.http import cached_fetch, get_json

BASE = "https://api.coingecko.com/api/v3"

COINS = (
	("BTC", "bitcoin"),
	("ETH", "ethereum"),
	("XRP", "ripple"),
	("SOL", "solana"),
	("BNB", "binancecoin"),
	("DOGE", "dogecoin"),
	("ADA", "cardano"),
	("TRX", "tron"),
	("AVAX", "avalanche-2"),
	("LINK", "chainlink"),
	("DOT", "polkadot"),
	("LTC", "litecoin"),
	("BCH", "bitcoin-cash"),
	("XLM", "stellar"),
	("ATOM", "cosmos"),
	("NEAR", "near"),
	("APT", "aptos"),
	("ARB", "arbitrum"),
	("OP", "optimism"),
	("FIL", "filecoin"),
	("ALGO", "algorand"),
	("ETC", "ethereum-classic"),
	("UNI", "uniswap"),
	("AAVE", "aave"),
	("MKR", "maker"),
	("SUI", "sui"),
	("ICP", "internet-computer"),
	("HBAR", "hedera-hashgraph"),
	("VET", "vechain"),
	("MATIC", "matic-network"),
	("PEPE", "pepe"),
	("SHIB", "shiba-inu"),
)
COINS_BY_SYMBOL = dict(COINS)


def _normalize_symbols(symbols):
	if not symbols:
		return [symbol for symbol, _ in COINS]
	seen = set()
	selected = []
	for raw in symbols:
		symbol = str(raw or "").strip().upper()
		if not symbol or symbol in seen or symbol not in COINS_BY_SYMBOL:
			continue
		seen.add(symbol)
		selected.append(symbol)
	return selected


def fundamentals(symbol: str, coin_id: str, force: bool = False):
	"""URI: GET /coins/{id} — coin detail payload."""

	def live():
		headers = {}
		if Config.COINGECKO_API_KEY:
			headers["x-cg-demo-api-key"] = Config.COINGECKO_API_KEY

		payload = get_json(
			f"{BASE}/coins/{coin_id}",
			params={
				"localization": "false",
				"tickers": "false",
				"market_data": "true",
				"community_data": "false",
				"developer_data": "false",
				"sparkline": "false",
			},
			headers=headers or None,
		)
		if not isinstance(payload, dict) or not payload:
			raise ValueError("empty coingecko coin detail")

		market_data = payload.get("market_data") or {}
		market_cap = (market_data.get("market_cap") or {}).get("sgd")
		if market_cap is None:
			market_cap = (market_data.get("market_cap") or {}).get("usd")

		return {
			"symbol": symbol,
			"name": payload.get("name") or symbol,
			"description": (payload.get("description") or {}).get("en") or None,
			"type": "coin",
			"currency": "SGD",
			"market_cap": market_cap,
			"raw": payload,
		}

	return cached_fetch(
		f"coingecko:fundamentals:{symbol}",
		24 * 3600,
		live,
		lambda: {
			"symbol": symbol,
			"name": symbol,
			"description": None,
			"type": "coin",
			"currency": "SGD",
			"market_cap": None,
			"raw": {},
		},
		force=force,
	)


def market_chart(symbol: str, coin_id: str, force: bool = False):
	"""URI: GET /coins/{id}/market_chart?vs_currency=sgd&days=7"""

	def live():
		headers = {}
		if Config.COINGECKO_API_KEY:
			headers["x-cg-demo-api-key"] = Config.COINGECKO_API_KEY

		payload = get_json(
			f"{BASE}/coins/{coin_id}/market_chart",
			params={"vs_currency": "sgd", "days": 7},
			headers=headers or None,
		)
		prices = payload.get("prices")
		if not isinstance(prices, list) or not prices:
			raise ValueError("empty market chart")

		points = []
		for row in prices:
			if not isinstance(row, list) or len(row) < 2:
				continue
			points.append({"ts_ms": row[0], "price_sgd": float(row[1])})

		if not points:
			raise ValueError("empty market chart")

		return {
			"symbol": symbol,
			"coin_id": coin_id,
			"vs_currency": "sgd",
			"days": 7,
			"points": points,
		}

	return cached_fetch(
		f"coingecko:market_chart:{symbol}:sgd:7",
		30 * 60,
		live,
		lambda: {
			"symbol": symbol,
			"coin_id": coin_id,
			"vs_currency": "sgd",
			"days": 7,
			"points": [],
		},
		force=force,
	)


def market_chart_all(force: bool = False, symbols=None):
	"""Return 7-day SGD market chart data for the requested symbol subset."""
	items = []
	for symbol in _normalize_symbols(symbols):
		coin_id = COINS_BY_SYMBOL[symbol]
		payload, source = market_chart(symbol, coin_id, force=force)
		items.append({**payload, "source": source})
	return items


def fundamentals_all(force: bool = False, symbols=None):
	"""Return CoinGecko-backed fundamentals for the requested symbol subset."""
	items = []
	for symbol in _normalize_symbols(symbols):
		coin_id = COINS_BY_SYMBOL[symbol]
		payload, source = fundamentals(symbol, coin_id, force=force)
		items.append({**payload, "source": source})
	return items
