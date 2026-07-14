"""Grounded AI research using OpenAI with an optional Groq fallback.

Only public market data is sent to either provider. Customer profile data is
never included, and every response is cached and displayed with a financial-
advice disclaimer.
"""
import json

import requests

from ...config import Config
from ..demo_data import DEMO_AI, DEMO_NEWS_TAGS
from .http import cached_fetch

OPENAI_URL = "https://api.openai.com/v1/responses"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

PROMPT = """You are the research desk of a Singapore retail bank's stock-trading app.
Analyze this stock using ONLY the data below. Do not use any other knowledge.

DATA:
{data}

Return JSON containing:
- tag: Bullish, Neutral, or Bearish
- analysis: 3-4 plain-English sentences explaining what the data shows, one risk,
  and one practical consideration for a retail investor
- news_tags: one Bullish, Neutral, or Bearish label per headline, in the same order
"""


def _openai(prompt: str) -> str:
    response = requests.post(
        OPENAI_URL,
        headers={
            "Authorization": f"Bearer {Config.OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": Config.OPENAI_MODEL,
            "input": prompt,
            "max_output_tokens": 500,
            "store": False,
            "reasoning": {"effort": "minimal"},
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "stock_analysis",
                    "strict": True,
                    "schema": {
                        "type": "object",
                        "properties": {
                            "tag": {
                                "type": "string",
                                "enum": ["Bullish", "Neutral", "Bearish"],
                            },
                            "analysis": {"type": "string"},
                            "news_tags": {
                                "type": "array",
                                "items": {
                                    "type": "string",
                                    "enum": ["Bullish", "Neutral", "Bearish"],
                                },
                            },
                        },
                        "required": ["tag", "analysis", "news_tags"],
                        "additionalProperties": False,
                    },
                }
            },
        },
        timeout=25,
    )
    response.raise_for_status()
    payload = response.json()
    for item in payload.get("output", []):
        if item.get("type") != "message":
            continue
        for content in item.get("content", []):
            if content.get("type") == "output_text":
                return content["text"]
    raise ValueError("OpenAI response did not contain output text")


def _groq(prompt: str) -> str:
    response = requests.post(
        GROQ_URL,
        headers={"Authorization": f"Bearer {Config.GROQ_API_KEY}"},
        json={
            "model": "llama-3.3-70b-versatile",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.4,
            "max_tokens": 500,
        },
        timeout=25,
    )
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"]


def _parse(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        text = text[text.find("{"):]
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < start:
        raise ValueError("model response did not contain JSON")
    return json.loads(text[start:end + 1])


def analyze(sym: str, quote: dict, fundamentals: dict, headlines: list[dict]):
    """Return a grounded analysis response and its cache/source state."""
    def live():
        data = json.dumps({
            "symbol": sym,
            "quote": {
                "price_usd": quote.get("price"),
                "day_change_pct": quote.get("change_pct"),
            },
            "fundamentals": fundamentals.get("metrics", []),
            "analyst_price_target_usd": fundamentals.get("target"),
            "headlines": [headline["headline"] for headline in headlines[:5]],
        }, indent=1)
        prompt = PROMPT.format(data=data)
        last_error = None
        providers = [
            (Config.OPENAI_MODEL, _openai, Config.OPENAI_API_KEY),
            ("llama-3.3-70b", _groq, Config.GROQ_API_KEY),
        ]
        for name, provider, api_key in providers:
            if not api_key:
                continue
            try:
                output = _parse(provider(prompt))
                if output.get("tag") not in ("Bullish", "Neutral", "Bearish"):
                    continue
                if not output.get("analysis"):
                    continue
                tags = output.get("news_tags") or []
                tags = [
                    tag if tag in ("Bullish", "Neutral", "Bearish") else "Neutral"
                    for tag in tags
                ]
                while len(tags) < len(headlines):
                    tags.append("Neutral")
                return {
                    "tag": output["tag"],
                    "analysis": output["analysis"],
                    "news_tags": tags[:len(headlines)],
                    "model": name,
                }
            except (requests.RequestException, ValueError, KeyError, json.JSONDecodeError) as error:
                last_error = error
        raise ValueError(f"no LLM available: {last_error}")

    def demo():
        fallback = DEMO_AI.get(
            sym,
            {"tag": "Neutral", "text": "No analysis available for this symbol yet."},
        )
        tags = DEMO_NEWS_TAGS.get(sym, ["Neutral"] * len(headlines))
        while len(tags) < len(headlines):
            tags.append("Neutral")
        return {
            "tag": fallback["tag"],
            "analysis": fallback["text"],
            "news_tags": tags[:len(headlines)],
            "model": "demo",
        }

    # Provider and model are part of the key so old Gemini/demo cache entries
    # cannot mask a successful OpenAI integration.
    cache_key = f"ai:openai:{Config.OPENAI_MODEL}:{sym}:{round(quote.get('price', 0))}"
    return cached_fetch(cache_key, 6 * 3600, live, demo)
