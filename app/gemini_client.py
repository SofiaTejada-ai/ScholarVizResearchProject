"""
Simple Gemini client wrapper
- Removes any hard length truncation
- Increases default max_tokens
- Uses the Google Generative Language REST endpoint if GEMINI_API_KEY is provided

Note: This is a lightweight wrapper intended to be easy to read and modify. In production you
may want to adopt an official client library, retries/backoff, and stronger error handling.
"""

from typing import Optional
import os
import requests

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "text-bison-001")
DEFAULT_MAX_TOKENS = int(os.getenv("GEMINI_MAX_TOKENS", "8192"))


class GeminiClientError(RuntimeError):
    pass


def generate_text(prompt: str, *, max_tokens: Optional[int] = None, temperature: float = 0.0, model: Optional[str] = None) -> str:
    """Generate text from Gemini/Generative API.

    This function intentionally does NOT truncate the prompt. If you want to enforce a hard
    prompt length limit do that upstream where the call originates. The default max_tokens has
    been increased to DEFAULT_MAX_TOKENS to allow longer outputs.

    Args:
        prompt: full prompt to send to the model (no internal truncation performed)
        max_tokens: maximum tokens to generate (defaults to DEFAULT_MAX_TOKENS)
        temperature: sampling temperature
        model: override model name; otherwise GEMINI_MODEL is used

    Returns:
        Generated text string (may be empty on some model responses)

    Raises:
        GeminiClientError for missing credentials or HTTP errors
    """
    if GEMINI_API_KEY is None:
        raise GeminiClientError("GEMINI_API_KEY environment variable is not set")

    model = model or GEMINI_MODEL
    max_tokens = int(max_tokens) if max_tokens is not None else DEFAULT_MAX_TOKENS

    # Use the Generative Language REST endpoint. Many deployments accept an API key in the
    # query string; adjust as needed for your environment (e.g. service account, OAuth token).
    url = f"https://generativelanguage.googleapis.com/v1beta2/models/{model}:generateText?key={GEMINI_API_KEY}"

    payload = {
        "prompt": {"text": prompt},
        # maxOutputTokens controls output length in the Generative API
        "maxOutputTokens": max_tokens,
        "temperature": temperature,
    }

    try:
        resp = requests.post(url, json=payload, timeout=60)
    except Exception as exc:
        raise GeminiClientError(f"Request to Gemini API failed: {exc}") from exc

    if not resp.ok:
        # Surface as much information as possible for debugging
        msg = f"Gemini API returned {resp.status_code}: {resp.text}"
        raise GeminiClientError(msg)

    data = resp.json()

    # Different API versions return text in different fields. Prefer candidate output if present.
    text = ""
    if isinstance(data, dict):
        # v1beta2 style: { "candidates": [{"output":"..."}], ... }
        candidates = data.get("candidates")
        if candidates and isinstance(candidates, list):
            text = candidates[0].get("output", "") if isinstance(candidates[0], dict) else ""
        # fallback: sometimes there's an "output" top-level key
        if not text:
            text = data.get("output", "") or data.get("content", "") or ""

    return text
