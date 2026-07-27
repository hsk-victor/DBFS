"""GNews helpers for symbol-specific crypto news."""

import re

import requests

from ...config import Config
from .http import get_json

BASE = "https://gnews.io/api/v4"

SYMBOL_ALIASES = {
	"BTC": ("bitcoin", "btc", "xbt"),
	"ETH": ("ethereum", "eth"),
	"XRP": ("xrp", "ripple"),
}


def _normalize_symbol(symbol: str) -> str:
	cleaned = (symbol or "").strip().upper()
	if not cleaned:
		raise ValueError("symbol is required")
	if not re.fullmatch(r"[A-Z0-9]{2,15}", cleaned):
		raise ValueError("invalid symbol format")
	return cleaned


def _build_query(symbol: str) -> str:
	aliases = SYMBOL_ALIASES.get(symbol, (symbol.lower(), symbol))
	return " OR ".join(f'"{name}"' for name in aliases)


def _is_relevant(article: dict, symbol: str) -> bool:
	aliases = SYMBOL_ALIASES.get(symbol, (symbol.lower(), symbol))
	text = " ".join(
		[
			article.get("title") or "",
			article.get("description") or "",
			article.get("content") or "",
		]
	).lower()
	if not text.strip():
		return False
	pattern = r"\b(?:" + "|".join(re.escape(alias) for alias in aliases) + r")\b"
	return re.search(pattern, text) is not None


def _fetch_payload(symbol: str) -> dict:
	if not Config.GNEWS_API_KEY:
		raise ValueError("no gnews key")

	try:
		return get_json(
			f"{BASE}/search",
			params={
				"q": _build_query(symbol),
				"lang": "en",
				"sortby": "publishedAt",
				"apikey": Config.GNEWS_API_KEY,
				"max": 25,
			},
		)
	except requests.HTTPError as exc:
		response = exc.response
		if response is not None:
			try:
				detail = response.json()
			except ValueError:
				detail = response.text
			raise RuntimeError(f"gnews upstream error ({response.status_code}): {detail}") from exc
		raise


def _normalize_payload(payload: dict, symbol: str) -> dict:
	articles = payload.get("articles")
	if not isinstance(articles, list):
		raise ValueError("empty gnews articles")

	items = []
	for article in articles:
		if not _is_relevant(article, symbol):
			continue
		source = article.get("source") or {}
		items.append(
			{
				"title": article.get("title"),
				"source": source.get("name"),
				"url": article.get("url"),
				"published_at": article.get("publishedAt"),
				"image": article.get("image"),
				"description": article.get("description"),
			}
		)

	return {
		"symbol": symbol,
		"query": _build_query(symbol),
		"language": "en",
		"sort_by": "publishedAt",
		"items": items,
		"total_results": len(items),
	}


def search_symbol_strict(symbol: str) -> dict:
	"""GET /search?q=...&lang=en&sortby=publishedAt&apikey=..."""
	cleaned = _normalize_symbol(symbol)
	payload = _fetch_payload(cleaned)
	return _normalize_payload(payload, cleaned)

