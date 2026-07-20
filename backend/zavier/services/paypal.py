"""PayPal helpers for Zavier's crypto feature routes."""

import requests

from ...config import Config
from ...victor.services.http import get_json


def userinfo_strict(user_access_token: str) -> dict:
	"""URI: GET /v1/identity/openidconnect/userinfo?schema=openid"""
	token = (user_access_token or "").strip()
	if not token:
		raise ValueError("missing user access token")

	try:
		payload = get_json(
			f"{Config.PAYPAL_BASE}/v1/identity/openidconnect/userinfo",
			params={"schema": "openid"},
			headers={"Authorization": f"Bearer {token}"},
		)
	except requests.HTTPError as exc:
		response = exc.response
		if response is not None:
			try:
				detail = response.json()
			except ValueError:
				detail = response.text
			raise RuntimeError(f"paypal upstream error ({response.status_code}): {detail}") from exc
		raise

	return payload

