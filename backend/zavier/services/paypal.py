"""PayPal helpers for Zavier's crypto feature routes."""

import time

import requests

from ...config import Config

_TOKEN_VALUE = None
_TOKEN_EXPIRY = 0


def configured() -> bool:
	return bool(Config.PAYPAL_CLIENT_ID and Config.PAYPAL_CLIENT_SECRET)


def _raise_http_error(prefix: str, exc: requests.HTTPError):
	response = exc.response
	if response is not None:
		try:
			detail = response.json()
		except ValueError:
			detail = response.text
		raise RuntimeError(f"{prefix} ({response.status_code}): {detail}") from exc
	raise exc


def _access_token() -> str:
	global _TOKEN_VALUE, _TOKEN_EXPIRY

	if not configured():
		raise RuntimeError("PayPal credentials are not configured")

	now = int(time.time())
	if _TOKEN_VALUE and now < _TOKEN_EXPIRY - 30:
		return _TOKEN_VALUE

	try:
		response = requests.post(
			f"{Config.PAYPAL_BASE}/v1/oauth2/token",
			auth=(Config.PAYPAL_CLIENT_ID, Config.PAYPAL_CLIENT_SECRET),
			headers={"Accept": "application/json", "Accept-Language": "en_US"},
			data={"grant_type": "client_credentials"},
			timeout=20,
		)
		response.raise_for_status()
	except requests.HTTPError as exc:
		_raise_http_error("paypal auth error", exc)

	payload = response.json()
	token = payload.get("access_token", "")
	expires_in = int(payload.get("expires_in", 300))
	if not token:
		raise RuntimeError("paypal auth error: missing access token")

	_TOKEN_VALUE = token
	_TOKEN_EXPIRY = now + expires_in
	return token


def _paypal_request(method: str, path: str, *, params=None, json_body=None, bearer=None) -> dict:
	headers = {"Content-Type": "application/json"}
	token = bearer or _access_token()
	headers["Authorization"] = f"Bearer {token}"

	try:
		response = requests.request(
			method,
			f"{Config.PAYPAL_BASE}{path}",
			params=params,
			json=json_body,
			headers=headers,
			timeout=20,
		)
		response.raise_for_status()
	except requests.HTTPError as exc:
		_raise_http_error("paypal upstream error", exc)

	return response.json()


def create_order(amount_sgd: str, description: str, return_url: str, cancel_url: str) -> dict:
	payload = _paypal_request(
		"POST",
		"/v2/checkout/orders",
		json_body={
			"intent": "CAPTURE",
			"purchase_units": [{
				"amount": {"currency_code": "SGD", "value": amount_sgd},
				"description": description,
			}],
			"application_context": {
				"return_url": return_url,
				"cancel_url": cancel_url,
				"shipping_preference": "NO_SHIPPING",
				"user_action": "PAY_NOW",
			},
		},
	)
	approve = ""
	for link in payload.get("links", []):
		if link.get("rel") == "approve":
			approve = link.get("href", "")
			break

	return {
		"id": payload.get("id", ""),
		"status": payload.get("status", ""),
		"approve_url": approve,
		"raw": payload,
	}


def capture_order(order_id: str) -> dict:
	order_id = (order_id or "").strip()
	if not order_id:
		raise ValueError("missing order id")
	return _paypal_request("POST", f"/v2/checkout/orders/{order_id}/capture", json_body={})


def userinfo_strict(user_access_token: str) -> dict:
	"""URI: GET /v1/identity/openidconnect/userinfo?schema=openid"""
	token = (user_access_token or "").strip()
	if not token:
		raise ValueError("missing user access token")
	return _paypal_request(
		"GET",
		"/v1/identity/openidconnect/userinfo",
		params={"schema": "openid"},
		bearer=token,
	)

